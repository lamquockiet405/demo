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
import { GrowthDispatchService } from "../services/growth-dispatch.service";
import {
  QueryGrowthNotificationsDto,
  GrowthNotificationItem,
  ExecutiveGrowthHealthSummary,
} from "../dto/query-growth-notifications.dto";
import {
  AcknowledgeNotificationDto,
  AssignInterventionDietDto,
  RequestConsultationDto,
  ApproveInterventionBudgetDto,
} from "../dto/growth-notification-actions.dto";

@ApiTags("Growth & Health Notifications Dispatch (UC85)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("growth-notifications")
export class GrowthDispatchController {
  constructor(private readonly growthDispatchService: GrowthDispatchService) {}

  @Post("scan-dispatch")
  @ApiOperation({
    summary:
      "Quét nhân trắc học tự động & Điều phối thông báo bất thường theo vai trò (UC85)",
  })
  @Roles("SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN", "NUTRITIONIST")
  async scanAndDispatch(@CurrentTenant() schoolId?: number) {
    return this.growthDispatchService.scanAndDispatchNotifications(
      schoolId || 1,
    );
  }

  @Get()
  @ApiOperation({
    summary:
      "Lấy danh sách thông báo bất thường thể trạng theo phân quyền Scoping của 4 Role",
  })
  @Roles(
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "NUTRITIONIST",
    "TEACHER",
    "PARENT",
  )
  async getNotifications(
    @Query() query: QueryGrowthNotificationsDto,
    @CurrentUser() user: any,
  ): Promise<{
    data: GrowthNotificationItem[];
    total: number;
    roleScope: string;
  }> {
    const roles = (user?.roles || []).map((r: any) =>
      typeof r === "string" ? r : r.code,
    );
    const role = roles.some((r: string) =>
      [
        "PRINCIPAL",
        "SCHOOL_MANAGER",
        "SCHOOL_MANAGEMENT",
        "SUPER_ADMIN",
      ].includes(r),
    )
      ? "SCHOOL_MANAGER"
      : roles.includes("NUTRITIONIST")
        ? "NUTRITIONIST"
        : roles.includes("TEACHER")
          ? "TEACHER"
          : "PARENT";
    const userId = Number(user?.sub || user?.id);
    const items = await this.growthDispatchService.getNotificationsByRole(
      role,
      userId,
      query,
    );
    return {
      data: items,
      total: items.length,
      roleScope: role,
    };
  }

  @Get("executive-summary")
  @ApiOperation({
    summary:
      "Báo cáo tổng quan KPI thể chất & ca cảnh báo toàn trường dành cho Ban Giám Hiệu",
  })
  @Roles("SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async getExecutiveSummary(
    @CurrentTenant() schoolId?: number,
  ): Promise<ExecutiveGrowthHealthSummary> {
    return this.growthDispatchService.getExecutiveGrowthHealthSummary(
      schoolId || 1,
    );
  }

  @Put(":id/acknowledge")
  @ApiOperation({
    summary:
      "Giáo viên hoặc Chuyên viên Dinh dưỡng xác nhận đã tiếp nhận chăm sóc học sinh (Acknowledge)",
  })
  @Roles(
    "TEACHER",
    "NUTRITIONIST",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
  )
  async acknowledgeNotification(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AcknowledgeNotificationDto,
    @CurrentUser() user: any,
  ): Promise<GrowthNotificationItem> {
    const userId = Number(user?.sub || user?.id);
    const role = user?.role || "TEACHER";
    return this.growthDispatchService.acknowledgeNotification(
      id,
      userId,
      role,
      dto.note,
    );
  }

  @Post("assign-intervention")
  @ApiOperation({
    summary:
      "Chuyên viên Dinh dưỡng lập Thực đơn can thiệp cá nhân hóa (Personalized Diet Plan)",
  })
  @Roles("NUTRITIONIST", "SUPER_ADMIN")
  async assignIntervention(
    @Body() dto: AssignInterventionDietDto,
    @CurrentUser() user: any,
  ): Promise<GrowthNotificationItem> {
    const userId = Number(user?.sub || user?.id);
    return this.growthDispatchService.assignInterventionDiet(dto, userId);
  }

  @Post("request-consultation")
  @ApiOperation({
    summary:
      "Phụ huynh đặt lịch hẹn tư vấn dinh dưỡng 1-1 với Chuyên viên Dinh dưỡng",
  })
  @Roles("PARENT", "SUPER_ADMIN")
  async requestConsultation(
    @Body() dto: RequestConsultationDto,
    @CurrentUser() user: any,
  ) {
    const userId = Number(user?.sub || user?.id);
    return this.growthDispatchService.requestConsultation(dto, userId);
  }

  @Post("approve-budget")
  @ApiOperation({
    summary:
      "Ban Giám Hiệu phê duyệt ngân sách tài trợ dinh dưỡng can thiệp cho học sinh",
  })
  @Roles("SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async approveBudget(
    @Body() dto: ApproveInterventionBudgetDto,
    @CurrentUser() user: any,
  ) {
    const userId = Number(user?.sub || user?.id);
    return this.growthDispatchService.approveInterventionBudget(dto, userId);
  }
}
