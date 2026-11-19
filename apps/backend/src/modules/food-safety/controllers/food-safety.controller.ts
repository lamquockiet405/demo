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

@ApiTags('UC95: View Food Safety Compliance Report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('food-safety')
export class FoodSafetyController {
  constructor(private readonly foodSafetyService: FoodSafetyService) {}

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

