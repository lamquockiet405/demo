import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../services/audit-logs.service';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';

/**
 * Cung cấp dữ liệu nhật ký kiểm toán để truy vết hoạt động trong hệ thống.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Audit Logs & System Traceability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) { }

  /**
   * GET /audit-logs: Truy vấn danh sách nhật ký kiểm toán hệ thống.
   * @param query Bộ lọc trong query string.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang AuditLogsService.getAuditLogs() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Truy vấn danh sách nhật ký kiểm toán hệ thống' })
  @Roles('SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getAuditLogs(
    @Query() query: QueryAuditLogsDto,
    @CurrentTenant() tenantId: string | number,
    @CurrentUser() user: any,
  ) {
    return this.auditLogsService.getAuditLogs(query, tenantId);
  }

  /**
   * GET /audit-logs/filters: Lấy các tùy chọn bộ lọc nhật ký.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang AuditLogsService.getFilterOptions() và trả kết quả cho client.
   */
  @Get('filters')
  @ApiOperation({ summary: 'Lấy các tùy chọn bộ lọc nhật ký' })
  @Roles('SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getFilterOptions(@CurrentTenant() tenantId: string | number) {
    return this.auditLogsService.getFilterOptions(tenantId);
  }

  /**
   * GET /audit-logs/stats: Thống kê tổng số lượng nhật ký kiểm toán.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang AuditLogsService.getStats() và trả kết quả cho client.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng số lượng nhật ký kiểm toán' })
  @Roles('SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getStats(@CurrentTenant() tenantId: string | number) {
    return this.auditLogsService.getStats(tenantId);
  }
}
