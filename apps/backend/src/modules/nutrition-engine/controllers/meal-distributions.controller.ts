import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { MealDistributionsService } from '../services/meal-distributions.service';
import { CreateMealDistributionDto, UpdateMealDistributionDto } from '../dto/meal-distribution.dto';

/**
 * Bảng phân bổ năng lượng & dinh dưỡng theo bữa trong ngày
 * (bữa sáng / trưa / chiều chiếm bao nhiêu % nhu cầu cả ngày).
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 */
@ApiTags('Nutrition Engine - Meal Energy Distribution')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-rules/meal-distributions')
export class MealDistributionsController {
  constructor(private readonly mealDistributionsService: MealDistributionsService) {}

  /** GET /nutrition-rules/meal-distributions: Danh sách phân bổ % năng lượng theo bữa. */
  @Get()
  @ApiOperation({ summary: 'Danh sách phân bổ % năng lượng theo bữa trong ngày' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'KITCHEN_STAFF', 'TEACHER', 'PARENT')
  async findAll(@CurrentTenant() tenantId: number, @Query('ageGroup') ageGroup?: string) {
    return this.mealDistributionsService.findAll(Number(tenantId) || 1, ageGroup || undefined);
  }

  /** GET /nutrition-rules/meal-distributions/overview?ageGroup=MAU_GIAO: Bảng thành phần dinh dưỡng mục tiêu theo bữa. */
  @Get('overview')
  @ApiOperation({ summary: 'Bảng thành phần dinh dưỡng mục tiêu theo bữa (Kcal, P, L, G và % cả ngày)' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'KITCHEN_STAFF', 'TEACHER', 'PARENT')
  async getOverview(@CurrentTenant() tenantId: number, @Query('ageGroup') ageGroup?: string) {
    return this.mealDistributionsService.getOverview(Number(tenantId) || 1, ageGroup || 'MAU_GIAO');
  }

  /** POST /nutrition-rules/meal-distributions: Thêm cấu hình cho một bữa. */
  @Post()
  @ApiOperation({ summary: 'Thêm phân bổ năng lượng cho một bữa' })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async create(@Body() dto: CreateMealDistributionDto, @CurrentTenant() tenantId: number) {
    return this.mealDistributionsService.create(dto, Number(tenantId) || 1);
  }

  /** POST /nutrition-rules/meal-distributions/reset?ageGroup=MAU_GIAO: Khôi phục giá trị mặc định. */
  @Post('reset')
  @ApiOperation({ summary: 'Khôi phục phân bổ mặc định theo 01/VBHN-BGDĐT' })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async reset(@Query('ageGroup') ageGroup: string, @CurrentTenant() tenantId: number) {
    return this.mealDistributionsService.resetDefaults(ageGroup, Number(tenantId) || 1);
  }

  /** PUT /nutrition-rules/meal-distributions/:id: Cập nhật % năng lượng của một bữa. */
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật phân bổ năng lượng của một bữa' })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMealDistributionDto,
    @CurrentTenant() tenantId: number,
  ) {
    return this.mealDistributionsService.update(id, dto, Number(tenantId) || 1);
  }

  /** DELETE /nutrition-rules/meal-distributions/:id */
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa phân bổ năng lượng của một bữa' })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.mealDistributionsService.remove(id, Number(tenantId) || 1);
  }
}
