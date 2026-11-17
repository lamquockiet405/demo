import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { DashboardService } from '../services/dashboard.service';

/**
 * Cung cấp các chỉ số tổng quan cho màn hình điều hành trường mầm non.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Dashboard & Executive Overview')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/summary: Tổng quan chỉ số điều hành trường mầm non (Executive Summary).
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang DashboardService.getExecutiveSummary() và trả kết quả cho client.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Tổng quan chỉ số điều hành trường mầm non (Executive Summary)' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST', 'TEACHER', 'KITCHEN_STAFF')
  async getExecutiveSummary(@CurrentTenant() schoolId?: number) {
    return this.dashboardService.getExecutiveSummary(schoolId);
  }
}
