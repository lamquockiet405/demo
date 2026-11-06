import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FoodSafetyService } from '../services/food-safety.service';
import { QueryFoodSafetyDto } from '../dto/query-food-safety.dto';
import { SignMonthlyLogDto } from '../dto/sign-monthly-log.dto';
import { NutritionistReviewDto } from '../dto/nutritionist-review.dto';
import { SuspendSupplierDto } from '../dto/suspend-supplier.dto';

/**
 * Cung cấp báo cáo kiểm thực, lưu mẫu và tiếp nhận nghiệp vụ quản lý an toàn thực phẩm.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('UC95: View Food Safety Compliance Report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('food-safety')
export class FoodSafetyController {
  constructor(private readonly foodSafetyService: FoodSafetyService) {}

  /**
   * GET /food-safety/compliance-report: Xem báo cáo tuân thủ an toàn thực phẩm tổng thể (Zero-Defect Safety Standard).
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang FoodSafetyService.getFoodSafetyComplianceReport() và trả kết quả cho client.
   */
  @Get('compliance-report')
  @ApiOperation({
    summary: 'Xem báo cáo tuân thủ an toàn thực phẩm tổng thể (Zero-Defect Safety Standard)',
    description: 'Bao gồm: Kiểm thực 3 bước & Photo Audit Trail (>=98%), Lưu mẫu 24h & nhiệt độ tủ mát 2-8°C, Hồ sơ pháp lý nhà cung cấp, thẻ xanh bếp & xét nghiệm nước QCVN 01-1.',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'KITCHEN_STAFF')
  async getComplianceReport(
    @Query() query: QueryFoodSafetyDto,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.foodSafetyService.getFoodSafetyComplianceReport(
      query.date,
      query.month,
      query.year,
      schoolId || query.schoolId,
    );
  }

  /**
   * GET /food-safety/inspections/3-step: Khối 1: Báo cáo tuân thủ kiểm thực 3 bước & Photo Audit Trail.
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang FoodSafetyService.getFoodSafetyComplianceReport() và trả kết quả cho client.
   * Chỉ trả phần inspection3Step của báo cáo tổng hợp do service cung cấp.
   */
  @Get('inspections/3-step')
  @ApiOperation({
    summary: 'Khối 1: Báo cáo tuân thủ kiểm thực 3 bước & Photo Audit Trail',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'KITCHEN_STAFF')
  async get3StepInspections(
    @Query() query: QueryFoodSafetyDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.foodSafetyService.getFoodSafetyComplianceReport(
      query.date,
      query.month,
      query.year,
      schoolId || query.schoolId,
    );
    return report.inspection3Step;
  }

  /**
   * GET /food-safety/samples/retention-log: Khối 2: Nhật ký lưu mẫu thức ăn 24h & Nhiệt độ tủ mát chuyên dụng (2 - 8°C).
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang FoodSafetyService.getFoodSafetyComplianceReport() và trả kết quả cho client.
   * Chỉ trả phần sampleRetention24h của báo cáo tổng hợp do service cung cấp.
   */
  @Get('samples/retention-log')
  @ApiOperation({
    summary: 'Khối 2: Nhật ký lưu mẫu thức ăn 24h & Nhiệt độ tủ mát chuyên dụng (2 - 8°C)',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'KITCHEN_STAFF')
  async getSampleRetentionLog(
    @Query() query: QueryFoodSafetyDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.foodSafetyService.getFoodSafetyComplianceReport(
      query.date,
      query.month,
      query.year,
      schoolId || query.schoolId,
    );
    return report.sampleRetention24h;
  }

  /**
   * GET /food-safety/legal-compliance: Khối 3: Hồ sơ pháp lý, chứng nhận nhà cung cấp, thẻ xanh nhân viên bếp & nước QCVN 01-1.
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang FoodSafetyService.getFoodSafetyComplianceReport() và trả kết quả cho client.
   * Chỉ trả phần legalAndCertificates của báo cáo tổng hợp do service cung cấp.
   */
  @Get('legal-compliance')
  @ApiOperation({
    summary: 'Khối 3: Hồ sơ pháp lý, chứng nhận nhà cung cấp, thẻ xanh nhân viên bếp & nước QCVN 01-1',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST')
  async getLegalCompliance(
    @Query() query: QueryFoodSafetyDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.foodSafetyService.getFoodSafetyComplianceReport(
      query.date,
      query.month,
      query.year,
      schoolId || query.schoolId,
    );
    return report.legalAndCertificates;
  }

  /**
   * POST /food-safety/sign-monthly-log: School Manager: Ký phê duyệt sổ kiểm thực điện tử định kỳ theo tháng.
   * @param dto Dữ liệu body JSON, kiểu SignMonthlyLogDto.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang FoodSafetyService.signMonthlyLog() và trả kết quả cho client.
   */
  @Post('sign-monthly-log')
  @ApiOperation({
    summary: 'School Manager: Ký phê duyệt sổ kiểm thực điện tử định kỳ theo tháng',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async signMonthlyLog(
    @Body() dto: SignMonthlyLogDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || 1;
    return this.foodSafetyService.signMonthlyLog(dto, userId);
  }

  /**
   * POST /food-safety/nutritionist-review: Nutritionist: Ghi nhận phân tích chuyên môn sự cố cảm quan hoặc thành phần phụ gia.
   * @param dto Dữ liệu body JSON, kiểu NutritionistReviewDto.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang FoodSafetyService.submitNutritionistReview() và trả kết quả cho client.
   */
  @Post('nutritionist-review')
  @ApiOperation({
    summary: 'Nutritionist: Ghi nhận phân tích chuyên môn sự cố cảm quan hoặc thành phần phụ gia',
  })
  @Roles('NUTRITIONIST', 'SUPER_ADMIN')
  async submitNutritionistReview(
    @Body() dto: NutritionistReviewDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || 1;
    return this.foodSafetyService.submitNutritionistReview(dto, userId);
  }

  /**
   * POST /food-safety/suspend-supplier: School Manager: Ban hành quyết định đình chỉ nhà cung cấp vi phạm tỷ lệ Reject Rate > 2%.
   * @param dto Dữ liệu body JSON, kiểu SuspendSupplierDto.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang FoodSafetyService.suspendSupplier() và trả kết quả cho client.
   */
  @Post('suspend-supplier')
  @ApiOperation({
    summary: 'School Manager: Ban hành quyết định đình chỉ nhà cung cấp vi phạm tỷ lệ Reject Rate > 2%',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async suspendSupplier(
    @Body() dto: SuspendSupplierDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || 1;
    return this.foodSafetyService.suspendSupplier(dto, userId);
  }

  /**
   * GET /food-safety/export-compliance-dossier: Xuất trọn bộ hồ sơ pháp lý & sổ kiểm thực 3 bước phục vụ đón đoàn thanh tra đột xuất.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang FoodSafetyService.exportComplianceDossier() và trả kết quả cho client.
   */
  @Get('export-compliance-dossier')
  @ApiOperation({
    summary: 'Xuất trọn bộ hồ sơ pháp lý & sổ kiểm thực 3 bước phục vụ đón đoàn thanh tra đột xuất',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST')
  async exportComplianceDossier(
    @Query() query: QueryFoodSafetyDto,
  ) {
    return this.foodSafetyService.exportComplianceDossier(query.date, query.month, query.year);
  }
}

