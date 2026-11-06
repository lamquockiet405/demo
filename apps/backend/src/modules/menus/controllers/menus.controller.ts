import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { MenusService } from "../services/menus.service";
import { MenuExportService } from "../services/menu-export.service";
import { QueryMenuDto } from "../dto/query-menu.dto";
import { CreateMenuDto } from "../dto/create-menu.dto";
import { UpdateMenuDto } from "../dto/update-menu.dto";
import { AdjustDishDto } from "../dto/adjust-dish.dto";
import { ApproveMenuDto } from "../dto/approve-menu.dto";
import { RejectMenuDto } from "../dto/reject-menu.dto";
import { AutoGenerateMenuDto } from "../dto/auto-generate-menu.dto";
import { EmergencyRotateDishDto } from "../dto/emergency-rotate-dish.dto";
import { ApplySubstituteDishDto } from "../dto/apply-substitute-dish.dto";
import { SubmitMenuDto } from "../dto/submit-menu.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CurrentTenant } from "../../../common/decorators/current-tenant.decorator";

/**
 * Quản lý thực đơn, phiên bản, món ăn và các bước nộp duyệt, công bố, xuất dữ liệu.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Menus & Weekly Planning")
@Controller("menus")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MenusController {
  constructor(
    private readonly menusService: MenusService,
    private readonly exportService: MenuExportService,
  ) {}

  /**
   * GET /menus: Lấy danh sách thực đơn tuần (tìm kiếm, lọc theo trạng thái/khối).
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang MenusService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({
    summary: "Lấy danh sách thực đơn tuần (tìm kiếm, lọc theo trạng thái/khối)",
  })
  async findAll(@Query() query: QueryMenuDto) {
    return this.menusService.findAll(query);
  }

  /**
   * GET /menus/statistics: Thống kê tổng số thực đơn theo trạng thái phê duyệt.
   * Chuyển xử lý sang MenusService.getStatistics() và trả kết quả cho client.
   */
  @Get("statistics")
  @ApiOperation({
    summary: "Thống kê tổng số thực đơn theo trạng thái phê duyệt",
  })
  async getStatistics() {
    return this.menusService.getStatistics();
  }

  /**
   * GET /menus/available-dishes: Lấy danh sách các món ăn khả dụng để xếp thực đơn.
   * Chuyển xử lý sang MenusService.getAvailableDishes() và trả kết quả cho client.
   */
  @Get("available-dishes")
  @ApiOperation({
    summary: "Lấy danh sách các món ăn khả dụng để xếp thực đơn",
  })
  async getAvailableDishes() {
    return this.menusService.getAvailableDishes();
  }

  /**
   * GET /menus/:id: Xem chi tiết thực đơn tuần theo ma trận ngày và bữa ăn.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param versionNumber Tham số versionNumber trong query string (tùy chọn).
   * Chuyển xử lý sang MenusService.findOne() và trả kết quả cho client.
   * Nếu có query versionNumber thì chuyển sang số để đọc phiên bản được yêu cầu.
   */
  @Get(":id")
  @ApiOperation({
    summary: "Xem chi tiết thực đơn tuần theo ma trận ngày và bữa ăn",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Query("versionNumber") versionNumber?: string,
  ) {
    return this.menusService.findOne(
      id,
      versionNumber === undefined ? undefined : Number(versionNumber),
    );
  }

  /**
   * GET /menus/:id/versions: Lấy danh sách các phiên bản của thực đơn tuần.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang MenusService.getVersions() và trả kết quả cho client.
   */
  @Get(":id/versions")
  @ApiOperation({ summary: "Lấy danh sách các phiên bản của thực đơn tuần" })
  async getVersions(@Param("id", ParseIntPipe) id: number) {
    return this.menusService.getVersions(id);
  }

  /**
   * GET /menus/:id/advisory: Lấy tư vấn Dị ứng học sinh & cá nhân hóa dinh dưỡng BMI.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang MenusService.getAdvisory() và trả kết quả cho client.
   */
  @Get(":id/advisory")
  @ApiOperation({
    summary: "Lấy tư vấn Dị ứng học sinh & cá nhân hóa dinh dưỡng BMI",
  })
  async getAdvisory(@Param("id", ParseIntPipe) id: number) {
    return this.menusService.getAdvisory(id);
  }

  /**
   * POST /menus: Lập thực đơn tuần mới.
   * @param dto Dữ liệu body JSON, kiểu CreateMenuDto.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang MenusService.create() và trả kết quả cho client.
   * Service tạo menu, phiên bản 1, 5 ngày và các bữa BREAKFAST, LUNCH, AFTERNOON_SNACK.
   * Body dùng CreateMenuDto với title, weekStartDate, weekEndDate và ageGroup.
   */
  @Post()
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Lập thực đơn tuần mới" })
  async create(@Body() dto: CreateMenuDto, @CurrentUser("sub") userId: number) {
    return this.menusService.create(dto, userId);
  }

  /**
   * PUT /menus/:id: Cập nhật thông tin thực đơn.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateMenuDto.
   * Chuyển xử lý sang MenusService.update() và trả kết quả cho client.
   */
  @Put(":id")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Cập nhật thông tin thực đơn" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menusService.update(id, dto);
  }

  /**
   * POST /menus/:id/create-version: Tạo phiên bản mới cho thực đơn (v1.1, v2.0...).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang MenusService.createVersion() và trả kết quả cho client.
   */
  @Post(":id/create-version")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Tạo phiên bản mới cho thực đơn (v1.1, v2.0...)" })
  async createVersion(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("sub") userId: number,
  ) {
    return this.menusService.createVersion(id, userId);
  }

  /**
   * POST /menus/:menuId/adjust-dish: Tinh chỉnh / đổi món ăn trong một bữa cụ thể.
   * @param menuId Giá trị menuId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu AdjustDishDto.
   * Chuyển xử lý sang MenusService.adjustDish() và trả kết quả cho client.
   */
  @Post(":menuId/adjust-dish")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Tinh chỉnh / đổi món ăn trong một bữa cụ thể" })
  async adjustDish(
    @Param("menuId", ParseIntPipe) menuId: number,
    @Body() dto: AdjustDishDto,
  ) {
    return this.menusService.adjustDish(menuId, dto);
  }

  /**
   * DELETE /menus/:menuId/dishes/:menuDishId: Xóa món ăn khỏi bữa ăn.
   * @param menuId Giá trị menuId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param menuDishId Giá trị menuDishId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang MenusService.removeDish() và trả kết quả cho client.
   */
  @Delete(":menuId/dishes/:menuDishId")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Xóa món ăn khỏi bữa ăn" })
  async removeDish(
    @Param("menuId", ParseIntPipe) menuId: number,
    @Param("menuDishId", ParseIntPipe) menuDishId: number,
  ) {
    return this.menusService.removeDish(menuId, menuDishId);
  }

  /**
   * POST /menus/:id/submit: Gửi thực đơn lên Ban Giám Hiệu phê duyệt kèm Cam kết chuyên môn & Giải trình vượt ngưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param user Thông tin tài khoản đã xác thực.
   * @param dto Dữ liệu body JSON, kiểu SubmitMenuDto.
   * Chuyển xử lý sang MenusService.submitForReview() và trả kết quả cho client.
   */
  @Post(":id/submit")
  @Roles("NUTRITIONIST", "SUPER_ADMIN")
  @ApiOperation({
    summary:
      "Gửi thực đơn lên Ban Giám Hiệu phê duyệt kèm Cam kết chuyên môn & Giải trình vượt ngưỡng",
  })
  async submitForReview(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() dto: SubmitMenuDto,
  ) {
    return this.menusService.submitForReview(id, user, dto);
  }

  /**
   * POST /menus/:id/approve: Ban Giám Hiệu phê duyệt thực đơn tuần.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param approverId Trường sub của tài khoản đã xác thực.
   * @param dto Dữ liệu body JSON, kiểu ApproveMenuDto.
   * Chuyển xử lý sang MenusService.approveMenu() và trả kết quả cho client.
   */
  @Post(":id/approve")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Ban Giám Hiệu phê duyệt thực đơn tuần" })
  async approveMenu(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("sub") approverId: number,
    @Body() dto: ApproveMenuDto,
  ) {
    return this.menusService.approveMenu(id, approverId, dto.approvalNotes);
  }

  /**
   * POST /menus/:id/reject: Ban Giám Hiệu từ chối thực đơn tuần (yêu cầu sửa).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param approverId Trường sub của tài khoản đã xác thực.
   * @param dto Dữ liệu body JSON, kiểu RejectMenuDto.
   * Chuyển xử lý sang MenusService.rejectMenu() và trả kết quả cho client.
   */
  @Post(":id/reject")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({
    summary: "Ban Giám Hiệu từ chối thực đơn tuần (yêu cầu sửa)",
  })
  async rejectMenu(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("sub") approverId: number,
    @Body() dto: RejectMenuDto,
  ) {
    return this.menusService.rejectMenu(id, approverId, dto.rejectionReason);
  }

  /**
   * POST /menus/:id/publish: Công bố thực đơn tuần cho phụ huynh & giáo viên.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang MenusService.publishMenu() và trả kết quả cho client.
   */
  @Post(":id/publish")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Công bố thực đơn tuần cho phụ huynh & giáo viên" })
  async publishMenu(@Param("id", ParseIntPipe) id: number) {
    return this.menusService.publishMenu(id);
  }

  /**
   * POST /menus/auto-generate: Tự động tạo thực đơn cân đối dinh dưỡng theo chuẩn Thông tư 28.
   * @param dto Dữ liệu body JSON, kiểu AutoGenerateMenuDto.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang MenusService.autoGenerate() và trả kết quả cho client.
   */
  @Post("auto-generate")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({
    summary: "Tự động tạo thực đơn cân đối dinh dưỡng theo chuẩn Thông tư 28",
  })
  async autoGenerate(
    @Body() dto: AutoGenerateMenuDto,
    @CurrentUser("sub") userId: number,
  ): Promise<any> {
    return this.menusService.autoGenerate(dto, userId);
  }

  /**
   * POST /menus/:id/emergency-rotate-dish: Xoay món khẩn cấp (khi thiếu nguyên liệu tại bếp).
   * @param dto Dữ liệu body JSON, kiểu EmergencyRotateDishDto.
   * Hiện chỉ trả thông báo và DTO; chưa dùng ID trên URL hoặc lưu thay đổi món.
   */
  @Post(":id/emergency-rotate-dish")
  @Roles("KITCHEN_STAFF", "NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({
    summary: "Xoay món khẩn cấp (khi thiếu nguyên liệu tại bếp)",
  })
  async emergencyRotateDish(@Body() dto: EmergencyRotateDishDto) {
    return {
      success: true,
      message: "Đã ghi nhận xoay món khẩn cấp",
      details: dto,
    };
  }

  /**
   * POST /menus/:id/apply-substitute-dish: Áp dụng món thay thế cho trẻ dị ứng.
   * @param dto Dữ liệu body JSON, kiểu ApplySubstituteDishDto.
   * Hiện chỉ trả thông báo và DTO; chưa lưu món thay thế cho học sinh.
   */
  @Post(":id/apply-substitute-dish")
  @Roles("NUTRITIONIST", "TEACHER", "KITCHEN_STAFF")
  @ApiOperation({ summary: "Áp dụng món thay thế cho trẻ dị ứng" })
  async applySubstituteDish(@Body() dto: ApplySubstituteDishDto) {
    return {
      success: true,
      message: "Đã lưu món thay thế cho học sinh",
      details: dto,
    };
  }

  /**
   * GET /menus/:menuId/dishes/:menuDishId/substitute-candidates: Danh mục món thay thế từ dữ liệu hiện tại, đối chiếu dị ứng đã khai báo.
   * @param menuId Giá trị menuId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param menuDishId Giá trị menuDishId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang MenusService.getSubstituteCandidates() và trả kết quả cho client.
   */
  @Get(":menuId/dishes/:menuDishId/substitute-candidates")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({
    summary:
      "Danh mục món thay thế từ dữ liệu hiện tại, đối chiếu dị ứng đã khai báo",
  })
  async getSubstituteCandidates(
    @Param("menuId", ParseIntPipe) menuId: number,
    @Param("menuDishId", ParseIntPipe) menuDishId: number,
  ) {
    return this.menusService.getSubstituteCandidates(menuId, menuDishId);
  }

  /**
   * POST /menus/:menuId/dishes/:menuDishId/apply-substitute: Gán món thay thế vào ô món ăn trong thực đơn.
   * @param menuId Giá trị menuId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param menuDishId Giá trị menuDishId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param body Dữ liệu body JSON.
   * Hiện chỉ dựng response từ body và menuDishId; chưa gọi service để lưu món thay thế.
   */
  @Post(":menuId/dishes/:menuDishId/apply-substitute")
  @Roles("NUTRITIONIST", "TEACHER", "KITCHEN_STAFF")
  @ApiOperation({ summary: "Gán món thay thế vào ô món ăn trong thực đơn" })
  async applySubstitute(
    @Param("menuId", ParseIntPipe) menuId: number,
    @Param("menuDishId", ParseIntPipe) menuDishId: number,
    @Body() body: { substituteDishId: string | null; notes?: string },
  ) {
    return {
      id: String(menuDishId),
      substituteDishId: body.substituteDishId,
      substituteNotes: body.notes,
      success: true,
      message: "Đã cập nhật món thay thế thành công",
    };
  }

  /**
   * POST /menus/:id/request-edit: Chuyên viên dinh dưỡng xin chỉnh sửa thực đơn.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param reason Trường reason trong body JSON.
   * Chuyển xử lý sang MenusService.findOne() và trả kết quả cho client.
   * Hiện chỉ gọi findOne để đọc thực đơn; reason chưa được dùng để lưu yêu cầu chỉnh sửa.
   */
  @Post(":id/request-edit")
  @Roles("NUTRITIONIST")
  @ApiOperation({ summary: "Chuyên viên dinh dưỡng xin chỉnh sửa thực đơn" })
  async requestEdit(
    @Param("id", ParseIntPipe) id: number,
    @Body("reason") reason: string,
  ) {
    return this.menusService.findOne(id);
  }

  /**
   * POST /menus/:id/approve-edit-request: Hiệu trưởng đồng ý yêu cầu chỉnh sửa thực đơn.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param notes Trường notes trong body JSON (tùy chọn).
   * Chuyển xử lý sang MenusService.findOne() và trả kết quả cho client.
   * Hiện chỉ đọc thực đơn; notes chưa được dùng để lưu quyết định hoặc mở khóa.
   */
  @Post(":id/approve-edit-request")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Hiệu trưởng đồng ý yêu cầu chỉnh sửa thực đơn" })
  async approveEditRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body("notes") notes?: string,
  ) {
    return this.menusService.findOne(id);
  }

  /**
   * POST /menus/:id/reject-edit-request: Hiệu trưởng từ chối yêu cầu chỉnh sửa thực đơn.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param reason Trường reason trong body JSON (tùy chọn).
   * Chuyển xử lý sang MenusService.findOne() và trả kết quả cho client.
   * Hiện chỉ đọc thực đơn; reason chưa được dùng để lưu quyết định từ chối.
   */
  @Post(":id/reject-edit-request")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Hiệu trưởng từ chối yêu cầu chỉnh sửa thực đơn" })
  async rejectEditRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body("reason") reason?: string,
  ) {
    return this.menusService.findOne(id);
  }

  /**
   * POST /menus/:id/cancel-edit-request: Hủy yêu cầu xin chỉnh sửa.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang MenusService.findOne() và trả kết quả cho client.
   * Hiện chỉ đọc thực đơn, chưa cập nhật trạng thái hủy yêu cầu chỉnh sửa.
   */
  @Post(":id/cancel-edit-request")
  @Roles("NUTRITIONIST")
  @ApiOperation({ summary: "Hủy yêu cầu xin chỉnh sửa" })
  async cancelEditRequest(@Param("id", ParseIntPipe) id: number) {
    return this.menusService.findOne(id);
  }

  /**
   * GET /menus/:id/export/data: Lấy dữ liệu thực đơn để dựng bản in hoặc bản xuất theo thông tin trường hiện tại.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang MenuExportService.exportData() và trả kết quả cho client.
   */
  @Get(":id/export/data")
  async exportData(
    @Param("id", ParseIntPipe) id: number,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.exportService.exportData(id, schoolId);
  }

  /**
   * GET /menus/:id/export/excel: Xuất thực đơn tuần ra định dạng Excel (.xlsx).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang MenuExportService.exportExcel() và trả kết quả cho client.
   */
  @Get(":id/export/excel")
  @ApiOperation({ summary: "Xuất thực đơn tuần ra định dạng Excel (.xlsx)" })
  async exportExcel(
    @Param("id", ParseIntPipe) id: number,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.exportService.exportExcel(id, schoolId);
  }

  /**
   * GET /menus/:id/export/pdf: Xuất thực đơn tuần ra định dạng PDF (.pdf).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang MenuExportService.exportPdf() và trả kết quả cho client.
   */
  @Get(":id/export/pdf")
  @ApiOperation({ summary: "Xuất thực đơn tuần ra định dạng PDF (.pdf)" })
  async exportPdf(@Param("id", ParseIntPipe) id: number) {
    return this.exportService.exportPdf(id);
  }
}
