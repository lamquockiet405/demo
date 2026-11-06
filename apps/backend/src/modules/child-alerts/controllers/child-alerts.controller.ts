import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ChildAlertsService } from '../services/child-alerts.service';
import { QueryChildAlertsDto } from '../dto/query-child-alerts.dto';
import { ResolveAlertDto } from '../dto/resolve-alert.dto';

/**
 * Cung cấp cảnh báo của trẻ theo phạm vi vai trò và tiếp nhận xác nhận hoặc xử lý cảnh báo.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('UC93: Role-Specific Child Alerts Summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('child-alerts')
export class ChildAlertsController {
  constructor(private readonly alertsService: ChildAlertsService) {}

  /**
   * GET /child-alerts/summary: Xem tổng hợp cảnh báo trẻ em tự động phân tầng theo Role (UC93 Core Endpoint).
   * @param user Thông tin tài khoản đã xác thực.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang ChildAlertsService.getRoleScopedAlertsSummary() và trả kết quả cho client.
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Xem tổng hợp cảnh báo trẻ em tự động phân tầng theo Role (UC93 Core Endpoint)',
    description: 'Hệ thống tự động kiểm tra Role của người dùng để trả về chính xác Scope tương ứng (Data Privacy & Child Safety).',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER', 'PARENT')
  async getRoleScopedSummary(
    @CurrentUser() user: any,
    @Query() query: QueryChildAlertsDto,
  ) {
    return this.alertsService.getRoleScopedAlertsSummary(user, query);
  }

  /**
   * GET /child-alerts/school-manager: Cảnh báo cấp trường dành cho Ban Giám Hiệu (School Manager Scope).
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * @param query Bộ lọc trong query string (tùy chọn).
   * Chuyển xử lý sang ChildAlertsService.getSchoolManagerAlerts() và trả kết quả cho client.
   */
  @Get('school-manager')
  @ApiOperation({
    summary: 'Cảnh báo cấp trường dành cho Ban Giám Hiệu (School Manager Scope)',
    description: 'Bao gồm: Xung đột dị ứng chưa xử lý trước 09h00, ngộ độc/bất thường diện rộng (>30% bỏ ăn), nợ phí bán trú, khiếu nại phụ huynh.',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSchoolManagerAlerts(
    @CurrentTenant() schoolId?: number,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getSchoolManagerAlerts(schoolId, query);
  }

  /**
   * GET /child-alerts/nutritionist: Cảnh báo an toàn thực phẩm & lâm sàng cho Chuyên viên Dinh dưỡng (Nutritionist Scope).
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * @param query Bộ lọc trong query string (tùy chọn).
   * Chuyển xử lý sang ChildAlertsService.getNutritionistAlerts() và trả kết quả cho client.
   */
  @Get('nutritionist')
  @ApiOperation({
    summary: 'Cảnh báo an toàn thực phẩm & lâm sàng cho Chuyên viên Dinh dưỡng (Nutritionist Scope)',
    description: 'Bao gồm: Trùng lặp chất dị ứng thực đơn ngày mai, trẻ sụt cân liên tiếp 2 kỳ (Z < -2 SD), thiếu hụt vi chất Thông tư 28.',
  })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getNutritionistAlerts(
    @CurrentTenant() schoolId?: number,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getNutritionistAlerts(schoolId, query);
  }

  /**
   * GET /child-alerts/teacher: Cảnh báo điều hành lớp học & chăm sóc trực tiếp cho Giáo viên (Teacher Scope).
   * @param teacherUserId Trường id của tài khoản đã xác thực (tùy chọn).
   * @param classId Tham số classId trong query string (tùy chọn).
   * @param query Bộ lọc trong query string (tùy chọn).
   * Chuyển xử lý sang ChildAlertsService.getTeacherAlerts() và trả kết quả cho client.
   */
  @Get('teacher')
  @ApiOperation({
    summary: 'Cảnh báo điều hành lớp học & chăm sóc trực tiếp cho Giáo viên (Teacher Scope)',
    description: 'Bao gồm: Khay ăn riêng dán nhãn xanh tại bàn cho bé dị ứng, học sinh ăn kém 2 ngày (<30%), đơn thuốc & dặn dò y tế phụ huynh.',
  })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @Roles('TEACHER', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getTeacherAlerts(
    @CurrentUser('id') teacherUserId?: number,
    @Query('classId') classId?: string,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getTeacherAlerts(teacherUserId, classId, query);
  }

  /**
   * GET /child-alerts/parent: Thông báo & cảnh báo cá nhân hóa cho con dành cho Phụ huynh (Parent Scope).
   * @param parentUserId Trường id của tài khoản đã xác thực (tùy chọn).
   * @param studentId Tham số studentId trong query string (tùy chọn).
   * @param query Bộ lọc trong query string (tùy chọn).
   * Chuyển xử lý sang ChildAlertsService.getParentAlerts() và trả kết quả cho client.
   */
  @Get('parent')
  @ApiOperation({
    summary: 'Thông báo & cảnh báo cá nhân hóa cho con dành cho Phụ huynh (Parent Scope)',
    description: 'Bao gồm: Món ăn thay thế an toàn hôm nay, báo cáo lượng ăn trưa & xế sau giờ ăn, nhắc lịch cân đo và lời khuyên y tế.',
  })
  @ApiQuery({ name: 'studentId', required: false, type: String })
  @Roles('PARENT', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getParentAlerts(
    @CurrentUser('id') parentUserId?: number,
    @Query('studentId') studentId?: string,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getParentAlerts(parentUserId, studentId, query);
  }

  /**
   * POST /child-alerts/resolve: Xác nhận xử lý / đóng cảnh báo (Acknowledge / Resolve Alert).
   * @param dto Dữ liệu body JSON, kiểu ResolveAlertDto.
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang ChildAlertsService.resolveOrAcknowledgeAlert() và trả kết quả cho client.
   */
  @Post('resolve')
  @ApiOperation({
    summary: 'Xác nhận xử lý / đóng cảnh báo (Acknowledge / Resolve Alert)',
    description: 'Bếp xác nhận món thay thế, Giáo viên xác nhận khay ăn tại bàn, School Manager xử lý khiếu nại...',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER')
  async resolveAlert(
    @Body() dto: ResolveAlertDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.alertsService.resolveOrAcknowledgeAlert(dto, userId);
  }
}

