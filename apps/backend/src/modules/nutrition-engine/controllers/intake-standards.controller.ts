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
import { IntakeStandardsService } from '../services/intake-standards.service';
import { CreateIntakeStandardDto } from '../dto/create-intake-standard.dto';
import { UpdateIntakeStandardDto } from '../dto/update-intake-standard.dto';

@ApiTags('Nutrition Engine - Intake Standards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-rules/intake-standards')
export class IntakeStandardsController {
  constructor(private readonly intakeStandardsService: IntakeStandardsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách định mức nhu cầu năng lượng & vi chất học sinh (Phụ lục 1 -> 6)' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findAll(
    @CurrentTenant() tenantId: number,
    @Query('ageGroup') ageGroup?: string,
    @Query('gender') gender?: string,
    @Query('mealScope') mealScope?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.intakeStandardsService.findAll(Number(tenantId) || 1, { ageGroup, gender, mealScope, isActive });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Thống kê định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSummary(@CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.getSummary(Number(tenantId) || 1);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.findOne(id, Number(tenantId) || 1);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo định mức nhu cầu dinh dưỡng & vi chất mới' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async create(@Body() dto: CreateIntakeStandardDto, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.create(dto, Number(tenantId) || 1);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIntakeStandardDto,
    @CurrentTenant() tenantId: number,
  ) {
    return this.intakeStandardsService.update(id, dto, Number(tenantId) || 1);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Bật/tắt trạng thái định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async toggleActive(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.toggleActive(id, Number(tenantId) || 1);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.remove(id, Number(tenantId) || 1);
  }
}

