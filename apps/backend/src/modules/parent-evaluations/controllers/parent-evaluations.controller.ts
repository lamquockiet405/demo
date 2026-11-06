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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CurrentTenant } from "../../../common/decorators/current-tenant.decorator";
import { ParentEvaluationService } from "../services/parent-evaluation.service";
import { ParentEvaluationQueryParams } from "../dto/parent-evaluation-query.dto";
import { RespondEvaluationPayload } from "../dto/respond-parent-evaluation.dto";
import { SubmitEvaluationDto } from "../dto/submit-evaluation.dto";
import { QueryParentEvaluationSummaryDto } from "../dto/query-parent-evaluation-summary.dto";
import { RespondSpecialistDto } from "../dto/respond-specialist.dto";
import { CreateRecipeImprovementLogDto } from "../dto/create-recipe-improvement-log.dto";

/**
 * Cung cấp dữ liệu phụ huynh theo dõi bữa ăn và trao đổi phản hồi với nhà trường.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Parent Evaluations & Feedback")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("parent-evaluations")
export class ParentEvaluationsController {
  constructor(private readonly evalService: ParentEvaluationService) {}

  /**
   * GET /parent-evaluations/portal-data: Dữ liệu tổng hợp trang đánh giá của phụ huynh.
   * @param childId Tham số childId trong query string (tùy chọn).
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * @param date Tham số date trong query string (tùy chọn).
   * @param mealType Tham số mealType trong query string (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.getPortalData() và trả kết quả cho client.
   */
  @Get("portal-data")
  @ApiOperation({ summary: "Dữ liệu tổng hợp trang đánh giá của phụ huynh" })
  @Roles(
    "PARENT",
    "SCHOOL_MANAGEMENT",
    "TEACHER",
    "NUTRITIONIST",
    "PRINCIPAL",
    "SUPER_ADMIN",
  )
  async getPortalData(
    @Query("childId") childId?: string,
    @CurrentUser("id") userId?: number,
    @Query("date") date?: string,
    @Query("mealType") mealType?: string,
  ) {
    return this.evalService.getPortalData(childId, userId, date, mealType);
  }

  /**
   * POST /parent-evaluations/submit: Phụ huynh gửi đánh giá hoặc kiến nghị bữa ăn.
   * @param payload Dữ liệu body JSON, kiểu SubmitEvaluationDto.
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.submitEvaluation() và trả kết quả cho client.
   */
  @Post("submit")
  @ApiOperation({ summary: "Phụ huynh gửi đánh giá hoặc kiến nghị bữa ăn" })
  @Roles("PARENT", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async submitEvaluation(
    @Body() payload: SubmitEvaluationDto,
    @CurrentUser("id") userId?: number,
  ) {
    return this.evalService.submitEvaluation(payload, userId);
  }

  /**
   * PUT /parent-evaluations/:id: Phụ huynh chỉnh sửa đánh giá đã có của con.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param payload Dữ liệu body JSON, kiểu SubmitEvaluationDto.
   * @param userId Trường id của tài khoản đã xác thực.
   * Chuyển xử lý sang ParentEvaluationService.updateEvaluation() và trả kết quả cho client.
   */
  @Put(":id")
  @ApiOperation({ summary: "Phụ huynh chỉnh sửa đánh giá đã có của con" })
  @Roles("PARENT", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async updateEvaluation(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: SubmitEvaluationDto,
    @CurrentUser("id") userId: number,
  ) {
    return this.evalService.updateEvaluation(id, payload, userId);
  }

  /**
   * GET /parent-evaluations/child-menu-consumption: Theo dõi tình hình ăn uống thực tế của con.
   * @param childId Tham số childId trong query string (tùy chọn).
   * @param date Tham số date trong query string (tùy chọn).
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.getChildMenuConsumption() và trả kết quả cho client.
   */
  @Get("child-menu-consumption")
  @ApiOperation({ summary: "Theo dõi tình hình ăn uống thực tế của con" })
  @Roles("PARENT", "TEACHER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async getChildMenuConsumption(
    @Query("childId") childId?: string,
    @Query("date") date?: string,
    @CurrentUser("id") userId?: number,
  ) {
    return this.evalService.getChildMenuConsumption(childId, date, userId);
  }

  /**
   * POST /parent-evaluations/child-consumption/heart: Thả tim / cảm ơn bữa ăn của bé.
   * @param attendanceId Trường attendanceId trong body JSON.
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.toggleHeartReaction() và trả kết quả cho client.
   * Service hiện trả liked = true trong response, chưa lưu hoặc đảo phản ứng trong database.
   */
  @Post("child-consumption/heart")
  @ApiOperation({ summary: "Thả tim / cảm ơn bữa ăn của bé" })
  @Roles("PARENT", "PRINCIPAL", "SUPER_ADMIN")
  async toggleHeartReaction(
    @Body("attendanceId") attendanceId: string,
    @CurrentUser("id") userId?: number,
  ) {
    return this.evalService.toggleHeartReaction(attendanceId, userId);
  }

  /**
   * GET /parent-evaluations: Danh sách đánh giá của phụ huynh (kèm bộ lọc & thống kê).
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.getEvaluations() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({
    summary: "Danh sách đánh giá của phụ huynh (kèm bộ lọc & thống kê)",
  })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
    "TEACHER",
    "PARENT",
  )
  async getEvaluations(
    @Query() query: ParentEvaluationQueryParams,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.evalService.getEvaluations(query, schoolId);
  }

  /**
   * POST /parent-evaluations/:id/respond: Nhà trường phản hồi ý kiến đánh giá của phụ huynh.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param payload Dữ liệu body JSON, kiểu RespondEvaluationPayload.
   * @param userId Trường id của tài khoản đã xác thực.
   * Chuyển xử lý sang ParentEvaluationService.respondToEvaluation() và trả kết quả cho client.
   */
  @Post(":id/respond")
  @ApiOperation({
    summary: "Nhà trường phản hồi ý kiến đánh giá của phụ huynh",
  })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
    "TEACHER",
  )
  async respondToEvaluation(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: RespondEvaluationPayload,
    @CurrentUser("id") userId: number,
  ) {
    return this.evalService.respondToEvaluation(id, payload, userId);
  }

  /**
   * PUT /parent-evaluations/:id/respond: Cập nhật nội dung phản hồi của nhà trường.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param payload Dữ liệu body JSON, kiểu RespondEvaluationPayload.
   * @param userId Trường id của tài khoản đã xác thực.
   * Chuyển xử lý sang ParentEvaluationService.updateResponse() và trả kết quả cho client.
   */
  @Put(":id/respond")
  @ApiOperation({ summary: "Cập nhật nội dung phản hồi của nhà trường" })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
    "TEACHER",
  )
  async updateResponse(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: RespondEvaluationPayload,
    @CurrentUser("id") userId: number,
  ) {
    return this.evalService.updateResponse(id, payload, userId);
  }

  /**
   * PUT /parent-evaluations/:id/draft: Chuyển trạng thái nháp phản hồi.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param isDrafting Trường isDrafting trong body JSON.
   * Chuyển xử lý sang ParentEvaluationService.toggleDraft() và trả kết quả cho client.
   */
  @Put(":id/draft")
  @ApiOperation({ summary: "Chuyển trạng thái nháp phản hồi" })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
    "TEACHER",
  )
  async toggleDraft(
    @Param("id", ParseIntPipe) id: number,
    @Body("isDrafting") isDrafting: boolean,
  ) {
    return this.evalService.toggleDraft(id, isDrafting);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UC97: VIEW PARENT EVALUATION SUMMARY REPORT (SCHOOL MANAGER & NUTRITIONIST)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /parent-evaluations/summary-report: Báo cáo tổng hợp đánh giá của phụ huynh & chỉ số CSAT (UC97).
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.getSummaryReport() và trả kết quả cho client.
   */
  @Get("summary-report")
  @ApiOperation({
    summary: "Báo cáo tổng hợp đánh giá của phụ huynh & chỉ số CSAT (UC97)",
  })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
  )
  async getSummaryReport(
    @Query() query: QueryParentEvaluationSummaryDto,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.evalService.getSummaryReport(query, schoolId);
  }

  /**
   * POST /parent-evaluations/:id/respond-specialist: Phản hồi chuyên môn Dinh dưỡng hoặc Ban Giám Hiệu gửi phụ huynh (UC97).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param payload Dữ liệu body JSON, kiểu RespondSpecialistDto.
   * @param userId Trường id của tài khoản đã xác thực.
   * @param userRole Trường role của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.respondSpecialist() và trả kết quả cho client.
   */
  @Post(":id/respond-specialist")
  @ApiOperation({
    summary:
      "Phản hồi chuyên môn Dinh dưỡng hoặc Ban Giám Hiệu gửi phụ huynh (UC97)",
  })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
  )
  async respondSpecialist(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: RespondSpecialistDto,
    @CurrentUser("id") userId: number,
    @CurrentUser("role") userRole?: string,
  ) {
    return this.evalService.respondSpecialist(id, payload, userId, userRole);
  }

  /**
   * POST /parent-evaluations/recipe-improvement-log: Chuyên viên Dinh dưỡng thêm món vào Sổ tay cải tiến công thức Bếp trưởng (UC97).
   * @param payload Dữ liệu body JSON, kiểu CreateRecipeImprovementLogDto.
   * @param userId Trường id của tài khoản đã xác thực.
   * @param userRole Trường role của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang ParentEvaluationService.createRecipeImprovementLog() và trả kết quả cho client.
   */
  @Post("recipe-improvement-log")
  @ApiOperation({
    summary:
      "Chuyên viên Dinh dưỡng thêm món vào Sổ tay cải tiến công thức Bếp trưởng (UC97)",
  })
  @Roles("NUTRITIONIST", "SCHOOL_MANAGEMENT", "SCHOOL_MANAGER", "SUPER_ADMIN")
  async createRecipeImprovementLog(
    @Body() payload: CreateRecipeImprovementLogDto,
    @CurrentUser("id") userId: number,
    @CurrentUser("role") userRole?: string,
  ) {
    return this.evalService.createRecipeImprovementLog(
      payload,
      userId,
      userRole,
    );
  }

  /**
   * GET /parent-evaluations/recipe-improvement-logs: Xem danh sách Sổ tay cải tiến công thức nấu của Bếp trưởng (UC97).
   * Chuyển xử lý sang ParentEvaluationService.getRecipeImprovementLogs() và trả kết quả cho client.
   */
  @Get("recipe-improvement-logs")
  @ApiOperation({
    summary:
      "Xem danh sách Sổ tay cải tiến công thức nấu của Bếp trưởng (UC97)",
  })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
    "KITCHEN_STAFF",
  )
  async getRecipeImprovementLogs() {
    return this.evalService.getRecipeImprovementLogs();
  }

  /**
   * GET /parent-evaluations/summary-report/export: Xuất dữ liệu báo cáo tổng hợp đánh giá phụ huynh chính thức (UC97).
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang ParentEvaluationService.exportSummaryReport() và trả kết quả cho client.
   */
  @Get("summary-report/export")
  @ApiOperation({
    summary:
      "Xuất dữ liệu báo cáo tổng hợp đánh giá phụ huynh chính thức (UC97)",
  })
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
  )
  async exportSummaryReport(@Query() query: QueryParentEvaluationSummaryDto) {
    return this.evalService.exportSummaryReport(query);
  }
}
