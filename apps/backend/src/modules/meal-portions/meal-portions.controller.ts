import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MealPortionsService } from './services/meal-portions.service';
import { MealPortionsQueryDto } from './dto/meal-portions-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Meal Portions (Kitchen Display)')
@Controller('meal-portions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MealPortionsController {
  constructor(private readonly portionService: MealPortionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách số suất ăn theo từng lớp cho nhà bếp' })
  async getPortions(@Query() query: MealPortionsQueryDto, @CurrentUser() actor: any) {
    return this.portionService.findAll(query, Number(actor.tenantId) || 1);
  }

  @Put()
  @Roles('KITCHEN_STAFF', 'KITCHEN_MANAGER', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cập nhật số suất thực tế đã nấu/chia của lớp' })
  async updateActual(
    @Body() body: { classId: number; date: string; mealType: string; actualQuantity: number },
    @CurrentUser() actor: any,
  ) {
    return this.portionService.updateActual(body.classId, body.date, body.mealType, body.actualQuantity, Number(actor.tenantId) || 1);
  }
}
