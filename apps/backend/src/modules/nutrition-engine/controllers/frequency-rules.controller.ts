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

/**
 * Quản lý quy tắc tần suất xuất hiện nhóm thực phẩm hoặc loại món theo trường.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Nutrition Engine - Frequency Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-rules/frequency-rules')
export class FrequencyRulesController {
  constructor(private readonly frequencyRulesService: FrequencyRulesService) {}

  /**
   * GET /nutrition-rules/frequency-rules: Lấy danh sách quy tắc tần suất nhóm thực phẩm & loại món.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * @param targetType Tham số targetType trong query string (tùy chọn).
   * @param ageGroup Tham số ageGroup trong query string (tùy chọn).
   * @param mealSlot Tham số mealSlot trong query string (tùy chọn).
   * @param isActive Tham số isActive trong query string (tùy chọn).
   * Chuyển xử lý sang FrequencyRulesService.findAll() và trả kết quả cho client.
   */
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

  /**
   * GET /nutrition-rules/frequency-rules/summary: Thống kê tổng quan quy tắc tần suất.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang FrequencyRulesService.getSummary() và trả kết quả cho client.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Thống kê tổng quan quy tắc tần suất' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSummary(@CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.getSummary(Number(tenantId) || 1);
  }

  /**
   * GET /nutrition-rules/frequency-rules/food-groups-catalog: Lấy danh mục 10 nhóm thực phẩm Phụ lục 7 và loại món từ database.
   * Chuyển xử lý sang FrequencyRulesService.getFoodGroupsCatalog() và trả kết quả cho client.
   */
  @Get('food-groups-catalog')
  @ApiOperation({ summary: 'Lấy danh mục 10 nhóm thực phẩm Phụ lục 7 và loại món từ database' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getFoodGroupsCatalog() {
    return this.frequencyRulesService.getFoodGroupsCatalog();
  }

  /**
   * GET /nutrition-rules/frequency-rules/:id: Xem chi tiết 1 quy tắc tần suất.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang FrequencyRulesService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 quy tắc tần suất' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.findOne(id, Number(tenantId) || 1);
  }

  /**
   * POST /nutrition-rules/frequency-rules: Tạo quy tắc tần suất nhóm thực phẩm / loại món mới.
   * @param dto Dữ liệu body JSON, kiểu CreateFrequencyRuleDto.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang FrequencyRulesService.create() và trả kết quả cho client.
   */
  @Post()
  @ApiOperation({ summary: 'Tạo quy tắc tần suất nhóm thực phẩm / loại món mới' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async create(@Body() dto: CreateFrequencyRuleDto, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.create(dto, Number(tenantId) || 1);
  }

  /**
   * PUT /nutrition-rules/frequency-rules/:id: Cập nhật quy tắc tần suất.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateFrequencyRuleDto.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang FrequencyRulesService.update() và trả kết quả cho client.
   */
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

  /**
   * PATCH /nutrition-rules/frequency-rules/:id/toggle: Bật/tắt trạng thái áp dụng quy tắc.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang FrequencyRulesService.toggleActive() và trả kết quả cho client.
   */
  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Bật/tắt trạng thái áp dụng quy tắc' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async toggleActive(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.toggleActive(id, Number(tenantId) || 1);
  }

  /**
   * DELETE /nutrition-rules/frequency-rules/:id: Xóa quy tắc tần suất.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang FrequencyRulesService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa quy tắc tần suất' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.frequencyRulesService.remove(id, Number(tenantId) || 1);
  }
}

