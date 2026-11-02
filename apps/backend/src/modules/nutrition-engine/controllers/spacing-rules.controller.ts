import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { SpacingRulesService } from '../services/spacing-rules.service';
import { CreateSpacingRuleDto } from '../dto/create-spacing-rule.dto';
import { UpdateSpacingRuleDto } from '../dto/update-spacing-rule.dto';

@ApiTags('Nutrition Engine - Spacing Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-rules/spacing-rules')
export class SpacingRulesController {
  constructor(private readonly spacingRulesService: SpacingRulesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách quy tắc giãn cách lặp món' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query('targetType') targetType?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('mealSlot') mealSlot?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.spacingRulesService.findAll(Number(tenantId) || 1, { targetType, ageGroup, mealSlot, isActive });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Thống kê tổng quan quy tắc giãn cách' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSummary(@CurrentTenant() tenantId: number) {
    return this.spacingRulesService.getSummary(Number(tenantId) || 1);
  }

  @Get('dishes-catalog')
  @ApiOperation({ summary: 'Lấy danh mục món ăn và loại món từ database để chọn' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getDishesCatalog() {
    return this.spacingRulesService.getDishesCatalog();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 quy tắc giãn cách' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.findOne(id, Number(tenantId) || 1);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo quy tắc giãn cách lặp món mới' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async create(@Body() dto: CreateSpacingRuleDto, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.create(dto, Number(tenantId) || 1);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật quy tắc giãn cách' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpacingRuleDto,
    @CurrentTenant() tenantId: number,
  ) {
    return this.spacingRulesService.update(id, dto, Number(tenantId) || 1);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Bật/tắt trạng thái áp dụng quy tắc' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async toggleActive(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.toggleActive(id, Number(tenantId) || 1);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa quy tắc giãn cách' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.remove(id, Number(tenantId) || 1);
  }
}

