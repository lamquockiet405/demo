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

/**
 * Quản lý khoảng cách tối thiểu giữa các lần lặp món hoặc nhóm món theo trường.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Nutrition Engine - Spacing Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-rules/spacing-rules')
export class SpacingRulesController {
  constructor(private readonly spacingRulesService: SpacingRulesService) {}

  /**
   * GET /nutrition-rules/spacing-rules: Lấy danh sách quy tắc giãn cách lặp món.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * @param targetType Tham số targetType trong query string (tùy chọn).
   * @param ageGroup Tham số ageGroup trong query string (tùy chọn).
   * @param mealSlot Tham số mealSlot trong query string (tùy chọn).
   * @param isActive Tham số isActive trong query string (tùy chọn).
   * Chuyển xử lý sang SpacingRulesService.findAll() và trả kết quả cho client.
   */
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

  /**
   * GET /nutrition-rules/spacing-rules/summary: Thống kê tổng quan quy tắc giãn cách.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang SpacingRulesService.getSummary() và trả kết quả cho client.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Thống kê tổng quan quy tắc giãn cách' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSummary(@CurrentTenant() tenantId: number) {
    return this.spacingRulesService.getSummary(Number(tenantId) || 1);
  }

  /**
   * GET /nutrition-rules/spacing-rules/dishes-catalog: Lấy danh mục món ăn và loại món từ database để chọn.
   * Chuyển xử lý sang SpacingRulesService.getDishesCatalog() và trả kết quả cho client.
   */
  @Get('dishes-catalog')
  @ApiOperation({ summary: 'Lấy danh mục món ăn và loại món từ database để chọn' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getDishesCatalog() {
    return this.spacingRulesService.getDishesCatalog();
  }

  /**
   * GET /nutrition-rules/spacing-rules/:id: Xem chi tiết 1 quy tắc giãn cách.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang SpacingRulesService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 quy tắc giãn cách' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.findOne(id, Number(tenantId) || 1);
  }

  /**
   * POST /nutrition-rules/spacing-rules: Tạo quy tắc giãn cách lặp món mới.
   * @param dto Dữ liệu body JSON, kiểu CreateSpacingRuleDto.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang SpacingRulesService.create() và trả kết quả cho client.
   */
  @Post()
  @ApiOperation({ summary: 'Tạo quy tắc giãn cách lặp món mới' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async create(@Body() dto: CreateSpacingRuleDto, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.create(dto, Number(tenantId) || 1);
  }

  /**
   * PUT /nutrition-rules/spacing-rules/:id: Cập nhật quy tắc giãn cách.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateSpacingRuleDto.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang SpacingRulesService.update() và trả kết quả cho client.
   */
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

  /**
   * PATCH /nutrition-rules/spacing-rules/:id/toggle: Bật/tắt trạng thái áp dụng quy tắc.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang SpacingRulesService.toggleActive() và trả kết quả cho client.
   */
  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Bật/tắt trạng thái áp dụng quy tắc' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async toggleActive(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.toggleActive(id, Number(tenantId) || 1);
  }

  /**
   * DELETE /nutrition-rules/spacing-rules/:id: Xóa quy tắc giãn cách.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param tenantId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang SpacingRulesService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa quy tắc giãn cách' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentTenant() tenantId: number) {
    return this.spacingRulesService.remove(id, Number(tenantId) || 1);
  }
}

