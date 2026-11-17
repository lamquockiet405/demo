import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasingService } from '../services/purchasing.service';
import { DailyPurchasingQueryDto } from '../dto/daily-purchasing-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

/**
 * Cung cấp gợi ý mua nguyên liệu dựa trên thực đơn và ngày phục vụ.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Purchasing & Kitchen Gross Weight')
@Controller('menus/purchasing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  /**
   * GET /menus/purchasing/daily-suggestion: Tính khối lượng đi chợ thô (Gross Weight Purchasing) dựa theo tổng số học sinh các lớp.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang PurchasingService.getDailyPurchasingSuggestion() và trả kết quả cho client.
   */
  @Get('daily-suggestion')
  @Roles('KITCHEN_STAFF', 'KITCHEN_MANAGER', 'NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Tính khối lượng đi chợ thô (Gross Weight Purchasing) dựa theo tổng số học sinh các lớp',
  })
  async getDailyPurchasingSuggestion(@Query() query: DailyPurchasingQueryDto) {
    return this.purchasingService.getDailyPurchasingSuggestion(query);
  }

  /**
   * GET /menus/purchasing/available-days: Lấy danh sách các ngày thực đơn đã phê duyệt kèm thống kê.
   * Chuyển xử lý sang PurchasingService.getAvailableMenuDays() và trả kết quả cho client.
   */
  @Get('available-days')
  @Roles('KITCHEN_STAFF', 'KITCHEN_MANAGER', 'NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Lấy danh sách các ngày thực đơn đã phê duyệt kèm thống kê',
  })
  async getAvailableMenuDays() {
    return this.purchasingService.getAvailableMenuDays();
  }
}

