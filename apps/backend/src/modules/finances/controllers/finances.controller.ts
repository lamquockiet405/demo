import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FinancesService } from '../services/finances.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';

/**
 * Phục vụ màn hình tổng quan tài chính, quản lý khoản chi và yêu cầu nhắc phí.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Finances & Accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  /**
   * GET /finances/overview: Báo cáo tổng quan tài chính, thu chi và định lượng tiền ăn.
   * @param month Tham số month trong query string (tùy chọn).
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang FinancesService.getOverview() và trả kết quả cho client.
   */
  @Get('overview')
  @ApiOperation({ summary: 'Báo cáo tổng quan tài chính, thu chi và định lượng tiền ăn' })
  @Roles('SCHOOL_MANAGEMENT')
  async getOverview(
    @Query('month') month?: string,
    @CurrentTenant() schoolId?: number,
  ): Promise<any> {
    return this.financesService.getOverview(month, schoolId);
  }

  /**
   * POST /finances/expenses: Ghi nhận khoản chi phí nhà bếp / nguyên liệu.
   * @param dto Dữ liệu body JSON, kiểu CreateExpenseDto.
   * Chuyển xử lý sang FinancesService.createExpense() và trả kết quả cho client.
   */
  @Post('expenses')
  @ApiOperation({ summary: 'Ghi nhận khoản chi phí nhà bếp / nguyên liệu' })
  @Roles('SCHOOL_MANAGEMENT')
  async createExpense(@Body() dto: CreateExpenseDto): Promise<any> {
    return this.financesService.createExpense(dto);
  }

  /**
   * DELETE /finances/expenses/:id: Xóa khoản chi phí.
   * @param id Giá trị id trên URL.
   * Chuyển xử lý sang FinancesService.deleteExpense() và trả kết quả cho client.
   */
  @Delete('expenses/:id')
  @ApiOperation({ summary: 'Xóa khoản chi phí' })
  @Roles('SCHOOL_MANAGEMENT')
  async deleteExpense(@Param('id') id: string) {
    return this.financesService.deleteExpense(id);
  }

  /**
   * POST /finances/remind-class/:classId: Gửi nhắc nhở thu phí đến giáo viên chủ nhiệm & phụ huynh lớp.
   * @param classId Giá trị classId trên URL.
   * Chuyển xử lý sang FinancesService.remindClass() và trả kết quả cho client.
   */
  @Post('remind-class/:classId')
  @ApiOperation({ summary: 'Gửi nhắc nhở thu phí đến giáo viên chủ nhiệm & phụ huynh lớp' })
  @Roles('SCHOOL_MANAGEMENT')
  async remindClass(@Param('classId') classId: string) {
    return this.financesService.remindClass(classId);
  }
}
