import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { NutritionPhysicalDashboardService } from '../services/nutrition-physical-dashboard.service';
import {
  ApproveBudgetDto,
  CreatePersonalizedDietDto,
  ScheduleParentConsultationDto,
} from '../dto/nutrition-physical-actions.dto';

@ApiTags('UC92: Nutrition & Physical Status Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard/nutrition-physical')
export class NutritionPhysicalDashboardController {
  constructor(
    private readonly dashboardService: NutritionPhysicalDashboardService,
  ) {}

  @Get('school-manager')
  @ApiOperation({
    summary: 'Dữ liệu chỉ huy điều hành dành cho Ban Giám Hiệu (School Manager View)',
    description: 'Truy vấn các chỉ số vĩ mô toàn trường, tỷ lệ phát triển bình thường (>90%), tỷ lệ SDD (<3%), tỷ lệ béo phì (<5%), đối chiếu khối lớp và hành động phê duyệt ngân sách.',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSchoolManagerOverview(@CurrentTenant() schoolId?: number) {
    return this.dashboardService.getSchoolManagerOverview(schoolId);
  }

  @Get('nutritionist')
  @ApiOperation({
    summary: 'Dữ liệu can thiệp lâm sàng dành cho Chuyên viên Dinh dưỡng (Nutritionist View)',
    description: 'Truy vấn chỉ số năng lượng Calo Thông tư 28 (600-726 Kcal), tỷ lệ P:L:G (14:26:60), đạm động vật (>50%), vi chất (Ca, Fe, Zn, Vit A, Vit D), danh sách trẻ lệch chuẩn Z-score (|Z| > 2 SD).',
  })
  @ApiQuery({ name: 'classId', required: false, type: Number })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getNutritionistClinicalOverview(
    @Query('classId') classId?: string,
    @CurrentTenant() schoolId?: number,
  ) {
    const classIdNum = classId ? parseInt(classId, 10) : undefined;
    return this.dashboardService.getNutritionistClinicalOverview(schoolId, classIdNum);
  }

  @Post('action/budget')
  @ApiOperation({
    summary: 'Phê duyệt ngân sách bổ sung vi chất cho Khối Nhà trẻ (School Manager Action)',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async approveBudget(
    @Body() dto: ApproveBudgetDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.dashboardService.approveBudget(dto, userId);
  }

  @Post('action/diet')
  @ApiOperation({
    summary: 'Lập thực đơn can thiệp cá nhân hóa (Personalized Diet) cho trẻ lệch chuẩn (Nutritionist Action)',
  })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async createPersonalizedDiet(
    @Body() dto: CreatePersonalizedDietDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.dashboardService.createPersonalizedDiet(dto, userId);
  }

  @Post('action/consult')
  @ApiOperation({
    summary: 'Đặt lịch hẹn tư vấn chế độ ăn dặm / ăn tại nhà với phụ huynh qua App (Nutritionist Action)',
  })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async scheduleParentConsultation(
    @Body() dto: ScheduleParentConsultationDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.dashboardService.scheduleParentConsultation(dto, userId);
  }

  @Get('export-report')
  @ApiOperation({
    summary: 'Xuất dữ liệu báo cáo sơ kết dinh dưỡng gửi Phòng Giáo dục & Đào tạo (PGD&ĐT)',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST')
  async exportNutritionReport(
    @Query('semester') semester?: string,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.dashboardService.exportNutritionReport(schoolId, semester);
  }
}

