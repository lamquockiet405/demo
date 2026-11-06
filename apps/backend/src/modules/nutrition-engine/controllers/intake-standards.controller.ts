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

/**
 * Quản lý định mức nhu cầu năng lượng và vi chất áp dụng cho từng trường.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Nutrition Engine - Intake Standards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-rules/intake-standards')
export class IntakeStandardsController {
  constructor(private readonly intakeStandardsService: IntakeStandardsService) {}

  /**
   * GET /nutrition-rules/intake-standards: Lấy danh sách định mức nhu cầu năng lượng & vi chất học sinh (Phụ lục 1 -> 6).
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * @param ageGroup Tham số ageGroup trong query string (tùy chọn).
   * @param gender Tham số gender trong query string (tùy chọn).
   * @param mealScope Tham số mealScope trong query string (tùy chọn).
   * @param isActive Tham số isActive trong query string (tùy chọn).
   * Chuyển xử lý sang IntakeStandardsService.findAll() và trả kết quả cho client.
   */
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

  /**
   * GET /nutrition-rules/intake-standards/summary: Thống kê định mức dinh dưỡng.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang IntakeStandardsService.getSummary() và trả kết quả cho client.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Thống kê định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSummary(@CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.getSummary(Number(tenantId) || 1);
  }

  /**
   * GET /nutrition-rules/intake-standards/:id: Xem chi tiết 1 định mức dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang IntakeStandardsService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.findOne(id, Number(tenantId) || 1);
  }

  /**
   * POST /nutrition-rules/intake-standards: Tạo định mức nhu cầu dinh dưỡng & vi chất mới.
   * @param dto Dữ liệu body JSON, kiểu CreateIntakeStandardDto.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang IntakeStandardsService.create() và trả kết quả cho client.
   */
  @Post()
  @ApiOperation({ summary: 'Tạo định mức nhu cầu dinh dưỡng & vi chất mới' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async create(@Body() dto: CreateIntakeStandardDto, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.create(dto, Number(tenantId) || 1);
  }

  /**
   * PUT /nutrition-rules/intake-standards/:id: Cập nhật định mức dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateIntakeStandardDto.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang IntakeStandardsService.update() và trả kết quả cho client.
   */
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

  /**
   * PATCH /nutrition-rules/intake-standards/:id/toggle: Bật/tắt trạng thái định mức dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang IntakeStandardsService.toggleActive() và trả kết quả cho client.
   */
  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Bật/tắt trạng thái định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async toggleActive(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.toggleActive(id, Number(tenantId) || 1);
  }

  /**
   * DELETE /nutrition-rules/intake-standards/:id: Xóa định mức dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang IntakeStandardsService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa định mức dinh dưỡng' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.intakeStandardsService.remove(id, Number(tenantId) || 1);
  }
}

