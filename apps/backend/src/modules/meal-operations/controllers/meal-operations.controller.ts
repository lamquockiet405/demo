import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { MealOperationsService } from '../services/meal-operations.service';
import { QueryMealOperationsDto } from '../dto/query-meal-operations.dto';
import { SignInspectionDto } from '../dto/sign-inspection.dto';
import { TeacherSensoryEvaluationDto } from '../dto/teacher-sensory-evaluation.dto';

/**
 * Tổng hợp vận hành bữa ăn, đối soát suất ăn, kiểm thực và đánh giá sau bữa.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('UC94: View Meal Operations Report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meal-operations')
export class MealOperationsController {
  constructor(private readonly mealOperationsService: MealOperationsService) {}

  /**
   * GET /meal-operations/report: Xem báo cáo vận hành bữa ăn & bán trú toàn trường (Daily Closed-Loop Report).
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang MealOperationsService.getDailyMealOperationsReport() và trả kết quả cho client.
   */
  @Get('report')
  @ApiOperation({
    summary: 'Xem báo cáo vận hành bữa ăn & bán trú toàn trường (Daily Closed-Loop Report)',
    description: 'Kết hợp 3 khối dữ liệu: Cân đối suất ăn/hoàn phí, Biên bản kiểm thực 3 bước & lưu mẫu 24h, Báo cáo tiêu thụ & thức ăn thừa (Plate Waste).',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'KITCHEN_STAFF', 'TEACHER', 'NUTRITIONIST')
  async getDailyReport(
    @Query() query: QueryMealOperationsDto,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.mealOperationsService.getDailyMealOperationsReport(query.date, schoolId || query.schoolId);
  }

  /**
   * GET /meal-operations/reconciliation: Khối 1: Báo cáo cân đối suất ăn & đối soát tài chính hoàn phí.
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang MealOperationsService.getDailyMealOperationsReport() và trả kết quả cho client.
   * Chỉ trả phần reconciliation của báo cáo tổng hợp do service cung cấp.
   */
  @Get('reconciliation')
  @ApiOperation({
    summary: 'Khối 1: Báo cáo cân đối suất ăn & đối soát tài chính hoàn phí',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'KITCHEN_STAFF', 'TEACHER')
  async getReconciliation(
    @Query() query: QueryMealOperationsDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.mealOperationsService.getDailyMealOperationsReport(query.date, schoolId || query.schoolId);
    return report.reconciliation;
  }

  /**
   * GET /meal-operations/food-safety: Khối 2: Biên bản kiểm thực 3 bước & Nhật ký lưu mẫu 24h (Quyết định 1246/QĐ-BYT).
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang MealOperationsService.getDailyMealOperationsReport() và trả kết quả cho client.
   * Chỉ trả phần foodSafetyInspection của báo cáo tổng hợp do service cung cấp.
   */
  @Get('food-safety')
  @ApiOperation({
    summary: 'Khối 2: Biên bản kiểm thực 3 bước & Nhật ký lưu mẫu 24h (Quyết định 1246/QĐ-BYT)',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'KITCHEN_STAFF', 'TEACHER')
  async getFoodSafety(
    @Query() query: QueryMealOperationsDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.mealOperationsService.getDailyMealOperationsReport(query.date, schoolId || query.schoolId);
    return report.foodSafetyInspection;
  }

  /**
   * GET /meal-operations/plate-waste: Khối 3: Báo cáo tiêu thụ, tỷ lệ ăn hết suất & Chỉ số món ăn thừa (Plate Waste Management).
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang MealOperationsService.getDailyMealOperationsReport() và trả kết quả cho client.
   * Chỉ trả phần consumptionAndPlateWaste của báo cáo tổng hợp do service cung cấp.
   */
  @Get('plate-waste')
  @ApiOperation({
    summary: 'Khối 3: Báo cáo tiêu thụ, tỷ lệ ăn hết suất & Chỉ số món ăn thừa (Plate Waste Management)',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'KITCHEN_STAFF', 'TEACHER', 'NUTRITIONIST')
  async getPlateWaste(
    @Query() query: QueryMealOperationsDto,
    @CurrentTenant() schoolId?: number,
  ) {
    const report = await this.mealOperationsService.getDailyMealOperationsReport(query.date, schoolId || query.schoolId);
    return report.consumptionAndPlateWaste;
  }

  /**
   * POST /meal-operations/sign-inspection: Ký xác nhận điện tử biên bản kiểm thực 3 bước hoặc lưu mẫu 24h.
   * @param dto Dữ liệu body JSON, kiểu SignInspectionDto.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang MealOperationsService.signInspection() và trả kết quả cho client.
   */
  @Post('sign-inspection')
  @ApiOperation({
    summary: 'Ký xác nhận điện tử biên bản kiểm thực 3 bước hoặc lưu mẫu 24h',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'KITCHEN_STAFF')
  async signInspection(
    @Body() dto: SignInspectionDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || 1;
    return this.mealOperationsService.signInspection(dto, userId);
  }

  /**
   * POST /meal-operations/teacher-sensory: Giáo viên gửi đánh giá nhanh cảm quan khay thức ăn (độ ấm, mùi vị, độ sạch sẽ).
   * @param dto Dữ liệu body JSON, kiểu TeacherSensoryEvaluationDto.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang MealOperationsService.submitTeacherSensory() và trả kết quả cho client.
   */
  @Post('teacher-sensory')
  @ApiOperation({
    summary: 'Giáo viên gửi đánh giá nhanh cảm quan khay thức ăn (độ ấm, mùi vị, độ sạch sẽ)',
  })
  @Roles('TEACHER', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async submitTeacherSensory(
    @Body() dto: TeacherSensoryEvaluationDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || 1;
    return this.mealOperationsService.submitTeacherSensory(dto, userId);
  }

  /**
   * GET /meal-operations/export-report: Kết xuất báo cáo lưu trữ phục vụ đón đoàn thanh tra Y tế học đường.
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang MealOperationsService.exportOperationsReport() và trả kết quả cho client.
   */
  @Get('export-report')
  @ApiOperation({
    summary: 'Kết xuất báo cáo lưu trữ phục vụ đón đoàn thanh tra Y tế học đường',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async exportReport(
    @Query() query: QueryMealOperationsDto,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.mealOperationsService.exportOperationsReport(query.date, schoolId || query.schoolId);
  }
}

