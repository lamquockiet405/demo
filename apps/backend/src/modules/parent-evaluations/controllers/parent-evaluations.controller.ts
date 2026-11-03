import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ParentEvaluationService } from '../services/parent-evaluation.service';
import { ParentEvaluationQueryParams } from '../dto/parent-evaluation-query.dto';
import { RespondEvaluationPayload } from '../dto/respond-parent-evaluation.dto';
import { SubmitEvaluationDto } from '../dto/submit-evaluation.dto';
import { QueryParentEvaluationSummaryDto } from '../dto/query-parent-evaluation-summary.dto';
import { RespondSpecialistDto } from '../dto/respond-specialist.dto';
import { CreateRecipeImprovementLogDto } from '../dto/create-recipe-improvement-log.dto';

@ApiTags('Parent Evaluations & Feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parent-evaluations')
export class ParentEvaluationsController {
  constructor(private readonly evalService: ParentEvaluationService) {}

  @Get('portal-data')
  @ApiOperation({ summary: 'Dữ liệu tổng hợp trang đánh giá của phụ huynh' })
  @Roles('PARENT', 'SCHOOL_MANAGEMENT', 'TEACHER', 'NUTRITIONIST', 'PRINCIPAL', 'SUPER_ADMIN')
  async getPortalData(
    @Query('childId') childId?: string,
    @CurrentUser('id') userId?: number,
  ) {
    return this.evalService.getPortalData(childId, userId);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Phụ huynh gửi đánh giá hoặc kiến nghị bữa ăn' })
  @Roles('PARENT', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async submitEvaluation(
    @Body() payload: SubmitEvaluationDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.evalService.submitEvaluation(payload, userId);
  }

  @Get('child-menu-consumption')
  @ApiOperation({ summary: 'Theo dõi tình hình ăn uống thực tế của con' })
  @Roles('PARENT', 'TEACHER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getChildMenuConsumption(
    @Query('childId') childId?: string,
    @Query('date') date?: string,
    @CurrentUser('id') userId?: number,
  ) {
    return this.evalService.getChildMenuConsumption(childId, date, userId);
  }

  @Post('child-consumption/heart')
  @ApiOperation({ summary: 'Thả tim / cảm ơn bữa ăn của bé' })
  @Roles('PARENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async toggleHeartReaction(
    @Body('attendanceId') attendanceId: string,
    @CurrentUser('id') userId?: number,
  ) {
    return this.evalService.toggleHeartReaction(attendanceId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đánh giá của phụ huynh (kèm bộ lọc & thống kê)' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER', 'PARENT')
  async getEvaluations(
    @Query() query: ParentEvaluationQueryParams,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.evalService.getEvaluations(query, schoolId);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Nhà trường phản hồi ý kiến đánh giá của phụ huynh' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER')
  async respondToEvaluation(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: RespondEvaluationPayload,
    @CurrentUser('id') userId: number,
  ) {
    return this.evalService.respondToEvaluation(id, payload, userId);
  }

  @Put(':id/respond')
  @ApiOperation({ summary: 'Cập nhật nội dung phản hồi của nhà trường' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER')
  async updateResponse(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: RespondEvaluationPayload,
    @CurrentUser('id') userId: number,
  ) {
    return this.evalService.updateResponse(id, payload, userId);
  }

  @Put(':id/draft')
  @ApiOperation({ summary: 'Chuyển trạng thái nháp phản hồi' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER')
  async toggleDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body('isDrafting') isDrafting: boolean,
  ) {
    return this.evalService.toggleDraft(id, isDrafting);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UC97: VIEW PARENT EVALUATION SUMMARY REPORT (SCHOOL MANAGER & NUTRITIONIST)
  // ════════════════════════════════════════════════════════════════════════════

  @Get('summary-report')
  @ApiOperation({ summary: 'Báo cáo tổng hợp đánh giá của phụ huynh & chỉ số CSAT (UC97)' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST')
  async getSummaryReport(
    @Query() query: QueryParentEvaluationSummaryDto,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.evalService.getSummaryReport(query, schoolId);
  }

  @Post(':id/respond-specialist')
  @ApiOperation({ summary: 'Phản hồi chuyên môn Dinh dưỡng hoặc Ban Giám Hiệu gửi phụ huynh (UC97)' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST')
  async respondSpecialist(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: RespondSpecialistDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') userRole?: string,
  ) {
    return this.evalService.respondSpecialist(id, payload, userId, userRole);
  }

  @Post('recipe-improvement-log')
  @ApiOperation({ summary: 'Chuyên viên Dinh dưỡng thêm món vào Sổ tay cải tiến công thức Bếp trưởng (UC97)' })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'SUPER_ADMIN')
  async createRecipeImprovementLog(
    @Body() payload: CreateRecipeImprovementLogDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') userRole?: string,
  ) {
    return this.evalService.createRecipeImprovementLog(payload, userId, userRole);
  }

  @Get('recipe-improvement-logs')
  @ApiOperation({ summary: 'Xem danh sách Sổ tay cải tiến công thức nấu của Bếp trưởng (UC97)' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'KITCHEN_STAFF')
  async getRecipeImprovementLogs() {
    return this.evalService.getRecipeImprovementLogs();
  }

  @Get('summary-report/export')
  @ApiOperation({ summary: 'Xuất dữ liệu báo cáo tổng hợp đánh giá phụ huynh chính thức (UC97)' })
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST')
  async exportSummaryReport(@Query() query: QueryParentEvaluationSummaryDto) {
    return this.evalService.exportSummaryReport(query);
  }
}
