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
import { FrequencyRulesService } from '../services/frequency-rules.service';
import { CreateFrequencyRuleDto } from '../dto/create-frequency-rule.dto';
import { UpdateFrequencyRuleDto } from '../dto/update-frequency-rule.dto';

@ApiTags('Nutrition Engine - Frequency Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-rules/frequency-rules')
export class FrequencyRulesController {
  constructor(private readonly frequencyRulesService: FrequencyRulesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách quy tắc tần suất nhóm thực phẩm & loại món' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query('targetType') targetType?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('mealSlot') mealSlot?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.frequencyRulesService.findAll(Number(tenantId) || 1, { targetType, ageGroup, mealSlot, isActive });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Thống kê tổng quan quy tắc tần suất' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSummary(@CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.getSummary(Number(tenantId) || 1);
  }

  @Get('food-groups-catalog')
  @ApiOperation({ summary: 'Lấy danh mục 10 nhóm thực phẩm Phụ lục 7 và loại món từ database' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getFoodGroupsCatalog() {
    return this.frequencyRulesService.getFoodGroupsCatalog();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 quy tắc tần suất' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.findOne(id, Number(tenantId) || 1);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo quy tắc tần suất nhóm thực phẩm / loại món mới' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async create(@Body() dto: CreateFrequencyRuleDto, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.create(dto, Number(tenantId) || 1);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật quy tắc tần suất' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFrequencyRuleDto,
    @CurrentTenant() tenantId: number,
  ) {
    return this.frequencyRulesService.update(id, dto, Number(tenantId) || 1);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Bật/tắt trạng thái áp dụng quy tắc' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async toggleActive(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.toggleActive(id, Number(tenantId) || 1);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa quy tắc tần suất' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.remove(id, Number(tenantId) || 1);
  }
}

