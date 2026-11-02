import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { SnackRevenueService } from '../services/snack-revenue.service';
import { QuerySnackRevenueDto } from '../dto/query-snack-revenue.dto';
import { SendDebtReminderDto } from '../dto/send-debt-reminder.dto';

@ApiTags('UC96: View Snack Service Revenue Report (School Manager Only)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('snack-revenue')
export class SnackRevenueController {
  constructor(private readonly revenueService: SnackRevenueService) {}

  @Get('report')
  @ApiOperation({
    summary: 'Xem báo cáo doanh thu & quyết toán dịch vụ ăn xế (Chỉ dành riêng cho School Manager)',
    description: 'Chứa thông tin tài chính nhạy cảm: Dòng tiền ròng, tỷ lệ thu phí (KPI >= 95%), cấn trừ hoàn phí do vắng có phép, định mức chi phí 70% nguyên liệu - 20% phục vụ ngoài giờ - 10% VNPAY.',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getRevenueReport(
    @Query() query: QuerySnackRevenueDto,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.revenueService.getSnackRevenueReport(query, schoolId || query.schoolId);
  }

  @Get('aging-debts')
  @ApiOperation({
    summary: 'Danh sách công nợ tồn đọng phụ huynh chưa đóng tiền ăn xế quá hạn',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getAgingDebts(
    @Query() query: QuerySnackRevenueDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.revenueService.getSnackRevenueReport(query, schoolId || query.schoolId);
    return report.agingDebts;
  }

  @Post('send-debt-reminder')
  @ApiOperation({
    summary: 'Gửi tin nhắn đôn đốc thu phí (SMS / App Push) tới phụ huynh có công nợ quá hạn',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async sendDebtReminder(
    @Body() dto: SendDebtReminderDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || 1;
    return this.revenueService.sendDebtReminder(dto, userId);
  }

  @Get('reconciliation-details')
  @ApiOperation({
    summary: 'Chi tiết đối chiếu điểm danh và cấn trừ tiền hoàn phí sang tháng tiếp theo',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getReconciliationDetails(
    @Query() query: QuerySnackRevenueDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.revenueService.getSnackRevenueReport(query, schoolId || query.schoolId);
    return report.attendanceReconciliation;
  }

  @Get('vnpay-reconciliation')
  @ApiOperation({
    summary: 'Đối chiếu sao kê giao dịch cổng VNPAY với tài khoản ngân hàng nhà trường',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getVnpayReconciliation(
    @Query() query: QuerySnackRevenueDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.revenueService.getSnackRevenueReport(query, schoolId || query.schoolId);
    return report.vnpayTransactions;
  }

  @Get('export-financial-report')
  @ApiOperation({
    summary: 'Kết xuất báo cáo tài chính quyết toán phục vụ cơ quan thuế và họp phụ huynh',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async exportFinancialReport(
    @Query() query: QuerySnackRevenueDto,
  ) {
    return this.revenueService.exportFinancialReport(query);
  }
}

