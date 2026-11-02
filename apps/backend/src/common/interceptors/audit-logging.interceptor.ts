import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogsService } from '../../modules/audit-logs/services/audit-logs.service';

// Danh sách các đường dẫn phụ không cần ghi log để tránh trùng lặp hoặc quá tải
const EXCLUDED_PATHS = [
  '/api/v1/audit-logs/filters',
  '/api/v1/audit-logs/stats',
  '/api/docs',
  '/api-docs',
  '/favicon.ico',
];

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLoggingInterceptor');

  constructor(private readonly auditLogsService: AuditLogsService) { }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const method = req.method?.toUpperCase();
    const url = req.originalUrl || req.url;

    // Bỏ qua các request OPTIONS, HEAD và các endpoint ngoại lệ
    if (
      method === 'OPTIONS' ||
      method === 'HEAD' ||
      EXCLUDED_PATHS.some((p) => url.startsWith(p))
    ) {
      return next.handle();
    }

    const { action, targetEntity, isAuditable } = this.resolveActionAndEntity(method, url);

    if (!isAuditable) {
      return next.handle();
    }

    // Làm sạch địa chỉ IP hiển thị
    let clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || req.ip || '127.0.0.1';
    if (clientIp.includes('::1') || clientIp.includes('127.0.0.1')) {
      clientIp = '127.0.0.1';
    } else if (clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }

    const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';
    const targetId = this.extractTargetId(req);

    // Trường hợp đặc biệt: BGH xem màn hình Nhật ký kiểm toán (GET /audit-logs)
    // Ghi nhận ngay trước khi handler xử lý để danh sách trả về hiển thị ngay hành vi này
    if (action === 'VIEW_AUDIT_LOGS') {
      const user = (req as any).user;
      const tenantId = user?.tenantId || (req.headers['x-tenant-id'] as string) || 1;
      try {
        await this.auditLogsService.logAction({
          tenantId,
          userId: user?.id || user?.sub || 1,
          userName: user?.fullName || 'Ban Giám Hiệu',
          userEmail: user?.email || 'hieutruong@huongduong.edu.vn',
          userRole: user?.roles?.[0] || 'SCHOOL_MANAGEMENT',
          action: 'VIEW_AUDIT_LOGS',
          targetEntity: 'AUDIT_LOG',
          targetId: targetId || 'SYSTEM',
          ipAddress: clientIp,
          userAgent,
          details: {
            description: 'Ban Giám hiệu truy cập tra cứu nhật ký kiểm toán & truy vết hệ thống',
            path: url,
            query: req.query,
          },
        });
        (req as any)._auditLogged = true;
      } catch (err: any) {
        this.logger.warn(`Failed to pre-log VIEW_AUDIT_LOGS: ${err.message}`);
      }
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        // Tránh ghi lặp nếu request này đã được ghi log ở tầng trước hoặc trong service
        if ((req as any)._auditLogged) {
          return;
        }

        try {
          const user = (req as any).user;
          const tenantId = user?.tenantId || (req.headers['x-tenant-id'] as string) || req.body?.tenantId || 1;

          // Xử lý thông tin người dùng từ token hoặc từ response login
          let userId = user?.id || user?.sub || null;
          let userName = user?.fullName || user?.name || null;
          let userEmail = user?.email || null;
          let userRole = Array.isArray(user?.roles) ? user.roles[0] : user?.role || null;

          if (!userId && (action === 'LOGIN_SUCCESS' || action === 'QUICK_LOGIN')) {
            const respUser = responseBody?.data?.user || responseBody?.user;
            if (respUser) {
              userId = respUser.id;
              userName = respUser.fullName || respUser.name;
              userEmail = respUser.email;
              userRole = Array.isArray(respUser.roles) ? respUser.roles[0] : respUser.role;
            } else if (req.body?.roleCode) {
              userRole = req.body.roleCode;
              userName = `Tài khoản ${req.body.roleCode}`;
            }
          }

          // Chuẩn hóa chi tiết dữ liệu (che giấu mật khẩu, token)
          const details: Record<string, any> = {
            method,
            path: url,
            statusCode: (ctx.getResponse() as any)?.statusCode || 200,
          };

          if (req.params && Object.keys(req.params).length > 0) {
            details.params = req.params;
          }
          if (req.query && Object.keys(req.query).length > 0) {
            details.query = req.query;
          }
          if (method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
            const sanitizedBody = { ...req.body };
            delete sanitizedBody.password;
            delete sanitizedBody.currentPassword;
            delete sanitizedBody.newPassword;
            delete sanitizedBody.token;
            details.payload = sanitizedBody;
          }

          await this.auditLogsService.logAction({
            tenantId,
            userId,
            userName: userName || 'Người dùng hệ thống',
            userEmail,
            userRole: userRole || 'STAFF',
            action,
            targetEntity,
            targetId,
            ipAddress: clientIp,
            userAgent,
            details,
          });

          (req as any)._auditLogged = true;
        } catch (err: any) {
          this.logger.warn(`Lỗi ghi nhật ký kiểm toán tự động: ${err.message}`);
        }
      }),
    );
  }

  /**
   * Phân tích URL và HTTP Method để xác định Hành động (Action) và Thực thể (Target Entity)
   */
  private resolveActionAndEntity(
    method: string,
    url: string,
  ): { action: string; targetEntity: string; isAuditable: boolean } {
    const cleanUrl = url.split('?')[0].toLowerCase();

    // 1. Xác thực & Phân quyền
    if (cleanUrl.includes('/auth/login') || cleanUrl.includes('/auth/quick-login')) {
      return { action: 'LOGIN_SUCCESS', targetEntity: 'USER', isAuditable: true };
    }
    if (cleanUrl.includes('/auth/logout')) {
      return { action: 'LOGOUT', targetEntity: 'USER', isAuditable: true };
    }
    if (cleanUrl.includes('/auth/change-password') || cleanUrl.includes('/auth/reset-password')) {
      return { action: 'CHANGE_PASSWORD', targetEntity: 'USER', isAuditable: true };
    }

    // 2. Nhật ký kiểm toán
    if (cleanUrl.endsWith('/audit-logs')) {
      return { action: 'VIEW_AUDIT_LOGS', targetEntity: 'AUDIT_LOG', isAuditable: true };
    }

    // 3. Thực đơn & Kế hoạch Dinh dưỡng
    if (cleanUrl.includes('/menus')) {
      if (cleanUrl.includes('/submit')) {
        return { action: 'SUBMIT_MENU_FOR_REVIEW', targetEntity: 'MENU', isAuditable: true };
      }
      if (cleanUrl.includes('/approve')) {
        return { action: 'APPROVE_MENU', targetEntity: 'MENU', isAuditable: true };
      }
      if (cleanUrl.includes('/reject')) {
        return { action: 'REJECT_MENU', targetEntity: 'MENU', isAuditable: true };
      }
      if (cleanUrl.includes('/adjust')) {
        return { action: 'ADJUST_DISH', targetEntity: 'MENU', isAuditable: true };
      }
      if (cleanUrl.includes('/auto-generate')) {
        return { action: 'AUTO_GENERATE_MENU', targetEntity: 'MENU', isAuditable: true };
      }
      if (cleanUrl.includes('/emergency-rotate')) {
        return { action: 'EMERGENCY_ROTATE_DISH', targetEntity: 'MENU', isAuditable: true };
      }
      if (cleanUrl.includes('/export')) {
        return { action: 'EXPORT_MENU', targetEntity: 'MENU', isAuditable: true };
      }
      if (method === 'POST') return { action: 'CREATE_MENU', targetEntity: 'MENU', isAuditable: true };
      if (method === 'PUT' || method === 'PATCH') return { action: 'UPDATE_MENU', targetEntity: 'MENU', isAuditable: true };
      if (method === 'DELETE') return { action: 'DELETE_MENU', targetEntity: 'MENU', isAuditable: true };
      if (method === 'GET' && !cleanUrl.includes('/statistics') && !cleanUrl.includes('/available-dishes')) {
        return { action: 'VIEW_MENU_LIST', targetEntity: 'MENU', isAuditable: true };
      }
    }

    // 4. Kiểm thực 3 bước & Lưu mẫu thức ăn
    if (cleanUrl.includes('/inspections')) {
      if (cleanUrl.includes('/step1')) {
        return { action: 'FOOD_INSPECTION_STEP1', targetEntity: 'FOOD_INSPECTION', isAuditable: true };
      }
      if (cleanUrl.includes('/step2')) {
        return { action: 'FOOD_INSPECTION_STEP2', targetEntity: 'FOOD_INSPECTION', isAuditable: true };
      }
      if (cleanUrl.includes('/step3')) {
        return { action: 'FOOD_INSPECTION_STEP3', targetEntity: 'FOOD_INSPECTION', isAuditable: true };
      }
      if (cleanUrl.includes('/sample')) {
        return { action: 'RETAIN_FOOD_SAMPLE', targetEntity: 'FOOD_SAMPLE', isAuditable: true };
      }
      if (method === 'GET') {
        return { action: 'VIEW_FOOD_INSPECTION', targetEntity: 'FOOD_INSPECTION', isAuditable: true };
      }
    }

    // 5. Theo dõi thể lực WHO
    if (cleanUrl.includes('/growth')) {
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        return { action: 'UPDATE_CHILD_GROWTH', targetEntity: 'CHILD_GROWTH', isAuditable: true };
      }
      if (method === 'GET') {
        return { action: 'VIEW_CHILD_GROWTH', targetEntity: 'CHILD_GROWTH', isAuditable: true };
      }
    }

    // 6. Điểm danh & Báo ăn
    if (cleanUrl.includes('/attendance')) {
      if (cleanUrl.includes('/evaluation')) {
        return { action: 'UPDATE_MEAL_EVALUATION', targetEntity: 'MEAL_EVALUATION', isAuditable: true };
      }
      if (method === 'POST' || method === 'PUT') {
        return { action: 'RECORD_ATTENDANCE', targetEntity: 'ATTENDANCE', isAuditable: true };
      }
      if (method === 'GET') {
        return { action: 'VIEW_ATTENDANCE', targetEntity: 'ATTENDANCE', isAuditable: true };
      }
    }

    // 7. Hồ sơ trẻ em & Dị ứng
    if (cleanUrl.includes('/children')) {
      if (cleanUrl.includes('/allergi') || cleanUrl.includes('/allergy')) {
        return { action: 'UPDATE_CHILD_ALLERGY', targetEntity: 'CHILD_ALLERGY', isAuditable: true };
      }
      if (method === 'POST') return { action: 'CREATE_CHILD', targetEntity: 'CHILD', isAuditable: true };
      if (method === 'PUT' || method === 'PATCH') return { action: 'UPDATE_CHILD', targetEntity: 'CHILD', isAuditable: true };
      if (method === 'DELETE') return { action: 'DELETE_CHILD', targetEntity: 'CHILD', isAuditable: true };
      if (method === 'GET') return { action: 'VIEW_CHILDREN', targetEntity: 'CHILD', isAuditable: true };
    }

    // 8. Lớp học
    if (cleanUrl.includes('/classes')) {
      if (method === 'POST') return { action: 'CREATE_CLASS', targetEntity: 'CLASS', isAuditable: true };
      if (method === 'PUT' || method === 'PATCH') return { action: 'UPDATE_CLASS', targetEntity: 'CLASS', isAuditable: true };
      if (method === 'DELETE') return { action: 'DELETE_CLASS', targetEntity: 'CLASS', isAuditable: true };
      if (method === 'GET') return { action: 'VIEW_CLASSES', targetEntity: 'CLASS', isAuditable: true };
    }

    // 9. Nhân sự & Tài khoản
    if (cleanUrl.includes('/users')) {
      if (cleanUrl.includes('/staff')) {
        if (method === 'POST') return { action: 'CREATE_STAFF', targetEntity: 'USER', isAuditable: true };
        if (method === 'PUT' || method === 'PATCH') return { action: 'UPDATE_STAFF', targetEntity: 'USER', isAuditable: true };
        if (method === 'GET') return { action: 'VIEW_STAFF_LIST', targetEntity: 'USER', isAuditable: true };
      }
      if (method === 'POST' || method === 'PUT') return { action: 'UPDATE_USER', targetEntity: 'USER', isAuditable: true };
      if (method === 'GET' && !cleanUrl.includes('/profile')) return { action: 'VIEW_USERS', targetEntity: 'USER', isAuditable: true };
    }

    // 10. Tài chính & Thanh toán bán trú
    if (cleanUrl.includes('/payments')) {
      if (method === 'POST') return { action: 'SUBMIT_PAYMENT', targetEntity: 'PAYMENT', isAuditable: true };
      if (method === 'GET') return { action: 'VIEW_PAYMENTS', targetEntity: 'PAYMENT', isAuditable: true };
    }
    if (cleanUrl.includes('/finances')) {
      if (method === 'GET') return { action: 'VIEW_FINANCES', targetEntity: 'FINANCE', isAuditable: true };
    }

    // 11. Kho nguyên liệu & Món ăn
    if (cleanUrl.includes('/foods')) {
      if (method === 'POST') return { action: 'CREATE_FOOD_ITEM', targetEntity: 'FOOD_ITEM', isAuditable: true };
      if (method === 'PUT') return { action: 'UPDATE_FOOD_ITEM', targetEntity: 'FOOD_ITEM', isAuditable: true };
      if (method === 'GET') return { action: 'VIEW_FOODS', targetEntity: 'FOOD_ITEM', isAuditable: true };
    }
    if (cleanUrl.includes('/dishes')) {
      if (method === 'POST') return { action: 'CREATE_DISH', targetEntity: 'DISH', isAuditable: true };
      if (method === 'PUT') return { action: 'UPDATE_DISH', targetEntity: 'DISH', isAuditable: true };
      if (method === 'GET') return { action: 'VIEW_DISHES', targetEntity: 'DISH', isAuditable: true };
    }

    // 12. Dịch vụ bán trú (Snack Services)
    if (cleanUrl.includes('/snack-services')) {
      if (method === 'POST') return { action: 'REGISTER_SNACK_SERVICE', targetEntity: 'SNACK_SERVICE', isAuditable: true };
      if (method === 'PUT') return { action: 'UPDATE_SNACK_SERVICE', targetEntity: 'SNACK_SERVICE', isAuditable: true };
      if (method === 'GET') return { action: 'VIEW_SNACK_SERVICES', targetEntity: 'SNACK_SERVICE', isAuditable: true };
    }

    // 13. Đánh giá phụ huynh
    if (cleanUrl.includes('/parent-evaluations')) {
      if (method === 'POST') return { action: 'SUBMIT_PARENT_EVALUATION', targetEntity: 'PARENT_EVALUATION', isAuditable: true };
      if (method === 'GET') return { action: 'VIEW_PARENT_EVALUATIONS', targetEntity: 'PARENT_EVALUATION', isAuditable: true };
    }

    // 14. Tổng quan Dashboard
    if (cleanUrl.includes('/dashboard')) {
      if (method === 'GET') return { action: 'VIEW_DASHBOARD', targetEntity: 'DASHBOARD', isAuditable: true };
    }

    // Mặc định đối với mọi thay đổi trạng thái (POST, PUT, PATCH, DELETE)
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const parts = cleanUrl.replace(/^\/api\/v1\//, '').split('/');
      const resource = parts[0]?.toUpperCase() || 'SYSTEM';
      const actionName = `${method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE'}_${resource}`;
      return { action: actionName, targetEntity: resource, isAuditable: true };
    }

    return { action: 'UNKNOWN', targetEntity: 'SYSTEM', isAuditable: false };
  }

  /**
   * Trích xuất targetId từ params, url hoặc body
   */
  private extractTargetId(req: Request): string | null {
    if (req.params && (req.params.id || req.params.targetId)) {
      return String(req.params.id || req.params.targetId);
    }
    const match = (req.originalUrl || req.url).match(/\/(\d+)(\/|\?|$)/);
    if (match) {
      return match[1];
    }
    if (req.body && req.body.id) {
      return String(req.body.id);
    }
    return null;
  }
}

