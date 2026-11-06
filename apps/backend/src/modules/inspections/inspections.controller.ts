import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { InspectionsService } from "./inspections.service";
import { SealSampleDto } from "./dto/seal-sample.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

/**
 * Quản lý kiểm thực ba bước và việc niêm phong, tra cứu, hủy mẫu thức ăn lưu.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Food Safety & 3-Step Inspections")
@Controller("inspections")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  /**
   * GET /inspections: Lấy toàn bộ danh sách biên bản kiểm thực 3 bước (QĐ 1246/QĐ-BYT).
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang InspectionsService.getInspections() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({
    summary: "Lấy toàn bộ danh sách biên bản kiểm thực 3 bước (QĐ 1246/QĐ-BYT)",
  })
  async getInspections(@Query() query: any) {
    return this.inspectionsService.getInspections(query);
  }

  /**
   * GET /inspections/meal-ingredients: Lấy danh sách nguyên liệu và món ăn theo ca ăn thực đơn.
   * @param mealDate Tham số mealDate trong query string (tùy chọn).
   * @param mealTime Tham số mealTime trong query string (tùy chọn).
   * Chuyển xử lý sang InspectionsService.getMealIngredients() và trả kết quả cho client.
   */
  @Get("meal-ingredients")
  @ApiOperation({
    summary: "Lấy danh sách nguyên liệu và món ăn theo ca ăn thực đơn",
  })
  async getMealIngredients(
    @Query("mealDate") mealDate?: string,
    @Query("mealTime") mealTime?: string,
  ) {
    return this.inspectionsService.getMealIngredients(mealDate, mealTime);
  }

  /**
   * GET /inspections/samples: Lấy danh sách các mẫu thức ăn lưu 24h (QĐ 1246/QĐ-BYT).
   * Chuyển xử lý sang InspectionsService.getSamples() và trả kết quả cho client.
   */
  @Get("samples")
  @ApiOperation({
    summary: "Lấy danh sách các mẫu thức ăn lưu 24h (QĐ 1246/QĐ-BYT)",
  })
  async getSamples() {
    return this.inspectionsService.getSamples();
  }

  /**
   * GET /inspections/samples/:id: Xem chi tiết mẫu thức ăn lưu 24h và tình trạng niêm phong.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang InspectionsService.getSampleDetail() và trả kết quả cho client.
   */
  @Get("samples/:id")
  @ApiOperation({
    summary: "Xem chi tiết mẫu thức ăn lưu 24h và tình trạng niêm phong",
  })
  async getSampleDetail(@Param("id", ParseIntPipe) id: number) {
    return this.inspectionsService.getSampleDetail(id);
  }

  /**
   * PATCH /inspections/samples/:id/dispose: Hủy mẫu lưu an toàn sau 24 giờ (chỉ nhân viên bếp thực hiện).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang InspectionsService.disposeSample() và trả kết quả cho client.
   */
  @Patch("samples/:id/dispose")
  @Roles(
    "KITCHEN_STAFF",
    "KITCHEN_MANAGER",
    "SUPER_ADMIN",
    "PRINCIPAL",
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
  )
  @ApiOperation({
    summary: "Hủy mẫu lưu an toàn sau 24 giờ (chỉ nhân viên bếp thực hiện)",
  })
  async disposeSamplePatch(@Param("id", ParseIntPipe) id: number) {
    return this.inspectionsService.disposeSample(id);
  }

  /**
   * POST /inspections/samples/:id/dispose: Hủy mẫu lưu an toàn sau 24 giờ (POST fallback, chỉ nhân viên bếp thực hiện).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang InspectionsService.disposeSample() và trả kết quả cho client.
   */
  @Post("samples/:id/dispose")
  @Roles(
    "KITCHEN_STAFF",
    "KITCHEN_MANAGER",
    "SUPER_ADMIN",
    "PRINCIPAL",
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
  )
  @ApiOperation({
    summary:
      "Hủy mẫu lưu an toàn sau 24 giờ (POST fallback, chỉ nhân viên bếp thực hiện)",
  })
  async disposeSamplePost(@Param("id", ParseIntPipe) id: number) {
    return this.inspectionsService.disposeSample(id);
  }

  /**
   * PATCH /inspections/samples/:id/photo: Cập nhật ảnh chụp mẫu lưu thực phẩm 24h.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang InspectionsService.updateSamplePhoto() và trả kết quả cho client.
   */
  @Patch("samples/:id/photo")
  @Roles(
    "KITCHEN_STAFF",
    "KITCHEN_MANAGER",
    "NUTRITIONIST",
    "SCHOOL_MANAGER",
    "PRINCIPAL",
    "SUPER_ADMIN",
  )
  @ApiOperation({ summary: "Cập nhật ảnh chụp mẫu lưu thực phẩm 24h" })
  async updateSamplePhotoPatch(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { imageUrl: string },
  ) {
    return this.inspectionsService.updateSamplePhoto(id, body.imageUrl);
  }

  /**
   * POST /inspections/samples/:id/photo: Cập nhật ảnh chụp mẫu lưu thực phẩm 24h (POST fallback).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang InspectionsService.updateSamplePhoto() và trả kết quả cho client.
   */
  @Post("samples/:id/photo")
  @Roles(
    "KITCHEN_STAFF",
    "KITCHEN_MANAGER",
    "NUTRITIONIST",
    "SCHOOL_MANAGER",
    "PRINCIPAL",
    "SUPER_ADMIN",
  )
  @ApiOperation({
    summary: "Cập nhật ảnh chụp mẫu lưu thực phẩm 24h (POST fallback)",
  })
  async updateSamplePhotoPost(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { imageUrl: string },
  ) {
    return this.inspectionsService.updateSamplePhoto(id, body.imageUrl);
  }

  /**
   * POST /inspections/samples: Niêm phong mẫu thức ăn lưu 24 giờ.
   * @param dto Dữ liệu body JSON, kiểu SealSampleDto.
   * Chuyển xử lý sang InspectionsService.sealSample() và trả kết quả cho client.
   */
  @Post("samples")
  @Roles("KITCHEN_STAFF", "NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Niêm phong mẫu thức ăn lưu 24 giờ" })
  async sealSample(@Body() dto: SealSampleDto) {
    return this.inspectionsService.sealSample(dto);
  }

  /**
   * POST /inspections/step1: Bước 1: Kiểm tra thực phẩm trước khi chế biến.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.createStep1() và trả kết quả cho client.
   */
  @Post("step1")
  @Roles("KITCHEN_STAFF", "NUTRITIONIST", "SUPER_ADMIN", "PRINCIPAL")
  @ApiOperation({ summary: "Bước 1: Kiểm tra thực phẩm trước khi chế biến" })
  async createStep1(@Body() body: any, @CurrentUser("sub") userId: number) {
    return this.inspectionsService.createStep1(body, userId);
  }

  /**
   * POST /inspections: Lập mới biên bản kiểm thực 3 bước.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.createStep1() và trả kết quả cho client.
   */
  @Post()
  @Roles("KITCHEN_STAFF", "NUTRITIONIST", "SUPER_ADMIN", "PRINCIPAL")
  @ApiOperation({ summary: "Lập mới biên bản kiểm thực 3 bước" })
  async createInspection(
    @Body() body: any,
    @CurrentUser("sub") userId: number,
  ) {
    return this.inspectionsService.createStep1(body, userId);
  }

  /**
   * PATCH /inspections/:id/step2: Bước 2: Kiểm tra thực phẩm trong quá trình chế biến.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.updateStep2() và trả kết quả cho client.
   */
  @Patch(":id/step2")
  @Roles("KITCHEN_STAFF", "NUTRITIONIST", "SUPER_ADMIN", "PRINCIPAL")
  @ApiOperation({
    summary: "Bước 2: Kiểm tra thực phẩm trong quá trình chế biến",
  })
  async updateStep2(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser("sub") userId: number,
  ) {
    return this.inspectionsService.updateStep2(id, body, userId);
  }

  /**
   * PATCH /inspections/:id/step3: Bước 3: Kiểm tra thức ăn trước khi ăn & lưu mẫu.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.updateStep3() và trả kết quả cho client.
   */
  @Patch(":id/step3")
  @Roles("KITCHEN_STAFF", "NUTRITIONIST", "SUPER_ADMIN", "PRINCIPAL")
  @ApiOperation({ summary: "Bước 3: Kiểm tra thức ăn trước khi ăn & lưu mẫu" })
  async updateStep3(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser("sub") userId: number,
  ) {
    return this.inspectionsService.updateStep3(id, body, userId);
  }

  /**
   * GET /inspections/:id: Xem chi tiết biên bản kiểm thực 3 bước.
   * @param id Giá trị id trên URL.
   * Chuyển xử lý sang InspectionsService.getInspectionDetail() và trả kết quả cho client.
   */
  @Get(":id")
  @ApiOperation({ summary: "Xem chi tiết biên bản kiểm thực 3 bước" })
  async getInspectionDetail(@Param("id") id: string) {
    return this.inspectionsService.getInspectionDetail(id);
  }

  /**
   * POST /inspections/create-session: Lập biên bản kiểm thực mới (chờ bếp chụp ảnh minh chứng).
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.createSessionByNutritionist() và trả kết quả cho client.
   */
  @Post("create-session")
  @Roles(
    "KITCHEN_STAFF",
    "KITCHEN_MANAGER",
    "NUTRITIONIST",
    "SUPER_ADMIN",
    "PRINCIPAL",
  )
  @ApiOperation({
    summary: "Lập biên bản kiểm thực mới (chờ bếp chụp ảnh minh chứng)",
  })
  async createSessionByNutritionist(
    @Body() body: any,
    @CurrentUser("sub") userId: number,
  ) {
    return this.inspectionsService.createSessionByNutritionist(body, userId);
  }

  /**
   * POST /inspections/:id/kitchen-submit: Bếp tải ảnh minh chứng 3 bước và gửi lên để duyệt.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.kitchenSubmitPhotos() và trả kết quả cho client.
   */
  @Post(":id/kitchen-submit")
  @Roles("KITCHEN_STAFF", "NUTRITIONIST", "SUPER_ADMIN")
  @ApiOperation({
    summary: "Bếp tải ảnh minh chứng 3 bước và gửi lên để duyệt",
  })
  async kitchenSubmitPhotos(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser("sub") userId: number,
  ) {
    return this.inspectionsService.kitchenSubmitPhotos(id, body, userId);
  }

  /**
   * POST /inspections/:id/approve: Chuyên gia dinh dưỡng hoặc Hiệu trưởng phê duyệt biên bản kiểm thực đạt chuẩn.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.approveInspection() và trả kết quả cho client.
   */
  @Post(":id/approve")
  @Roles(
    "NUTRITIONIST",
    "PRINCIPAL",
    "SCHOOL_MANAGEMENT",
    "SCHOOL_MANAGER",
    "SUPER_ADMIN",
  )
  @ApiOperation({
    summary:
      "Chuyên gia dinh dưỡng hoặc Hiệu trưởng phê duyệt biên bản kiểm thực đạt chuẩn",
  })
  async approveInspection(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser("sub") userId: number,
  ) {
    return this.inspectionsService.approveInspection(id, body, userId);
  }

  /**
   * POST /inspections/:id/reject: Chuyên gia dinh dưỡng hoặc Hiệu trưởng yêu cầu chụp lại ảnh minh chứng.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang InspectionsService.rejectInspection() và trả kết quả cho client.
   */
  @Post(":id/reject")
  @Roles(
    "NUTRITIONIST",
    "PRINCIPAL",
    "SCHOOL_MANAGEMENT",
    "SCHOOL_MANAGER",
    "SUPER_ADMIN",
  )
  @ApiOperation({
    summary:
      "Chuyên gia dinh dưỡng hoặc Hiệu trưởng yêu cầu chụp lại ảnh minh chứng",
  })
  async rejectInspection(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser("sub") userId: number,
  ) {
    return this.inspectionsService.rejectInspection(id, body, userId);
  }
}
