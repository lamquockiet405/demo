import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasingService } from '../services/purchasing.service';
import { DailyPurchasingQueryDto } from '../dto/daily-purchasing-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Purchasing & Kitchen Gross Weight')
@Controller('menus/purchasing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get('daily-suggestion')
  @Roles('KITCHEN_STAFF', 'KITCHEN_MANAGER', 'NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Tính khối lượng đi chợ thô (Gross Weight Purchasing) dựa theo tổng số học sinh các lớp',
  })
  async getDailyPurchasingSuggestion(@Query() query: DailyPurchasingQueryDto) {
    return this.purchasingService.getDailyPurchasingSuggestion(query);
  }

  @Get('available-days')
  @Roles('KITCHEN_STAFF', 'KITCHEN_MANAGER', 'NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Lấy danh sách các ngày thực đơn đã phê duyệt kèm thống kê',
  })
  async getAvailableMenuDays() {
    return this.purchasingService.getAvailableMenuDays();
  }
}

