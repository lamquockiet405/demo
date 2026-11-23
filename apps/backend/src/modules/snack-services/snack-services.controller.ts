import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import {
  SnackServicesService,
  SnackMenuDayItem,
} from "./snack-services.service";
import { CreateSnackServicePeriodDto } from "./dto/create-snack-service-period.dto";
import { UpdateSnackServiceDto } from "./dto/update-snack-service.dto";
import { RegisterSnackServiceDto } from "./dto/register-snack-service.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

/**
 * Quản lý kỳ dịch vụ ăn xế, dữ liệu bán trú và yêu cầu đăng ký dịch vụ.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Snack Services Management")
@Controller("snack-services")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SnackServicesController {
  constructor(private readonly snackService: SnackServicesService) {}

  /**
   * GET /snack-services: Lấy danh sách các kỳ dịch vụ ăn xế 17h (Ẩn thông tin thanh toán với CGDD).
   * @param req HTTP request để đọc thông tin người dùng, header hoặc địa chỉ IP.
   * @param search Tham số search trong query string (tùy chọn).
   * @param status Tham số status trong query string (tùy chọn).
   * @param grade Tham số grade trong query string (tùy chọn).
   * Chuyển xử lý sang SnackServicesService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({
    summary:
      "Lấy danh sách các kỳ dịch vụ ăn xế 17h (Ẩn thông tin thanh toán với CGDD)",
  })
  async findAll(
    @Req() req: any,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("grade") grade?: string,
    @Query("academicYearId") academicYearId?: number,
    @Query("allAcademicYears") allAcademicYears?: boolean,
  ) {
    return this.snackService.findAll(req.user, {
      search,
      status,
      grade,
      academicYearId: academicYearId ? Number(academicYearId) : undefined,
      allAcademicYears: allAcademicYears ? Boolean(allAcademicYears) : undefined,
    });
  }

  /**
   * GET /snack-services/list: Lấy danh sách rút gọn các kỳ dịch vụ ăn xế.
   * @param req HTTP request để đọc thông tin người dùng, header hoặc địa chỉ IP.
   * Chuyển xử lý sang SnackServicesService.findAll() và trả kết quả cho client.
   */
  @Get("list")
  @ApiOperation({ summary: "Lấy danh sách rút gọn các kỳ dịch vụ ăn xế" })
  async getList(@Req() req: any) {
    return this.snackService.findAll(req.user);
  }

  /**
   * GET /snack-services/parent-overview: Phụ huynh xem các gói ăn xế đã công bố và Lịch ăn xế (Chỉ trả về lịch ăn xế khi đã đóng tiền PAID).
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang SnackServicesService.getParentSnackOverview() và trả kết quả cho client.
   */
  @Get("parent-overview")
  @Roles(
    "PARENT",
    "SUPER_ADMIN",
    "PRINCIPAL",
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "TEACHER",
  )
  @ApiOperation({
    summary:
      "Phụ huynh xem các gói ăn xế đã công bố và Lịch ăn xế (Cho phép xem trước thực đơn)",
  })
  async getParentOverview(
    @CurrentUser("sub") userId: number,
    @Query("studentId") studentId?: string,
  ) {
    return this.snackService.getParentSnackOverview(
      userId,
      studentId ? Number(studentId) : undefined,
    );
  }

  /**
   * GET /snack-services/dayboarding: Lấy dữ liệu tổng hợp dịch vụ bán trú và đăng ký.
   * Chuyển xử lý sang SnackServicesService.getDayboardingSummary() và trả kết quả cho client.
   */
  @Get("dayboarding")
  @ApiOperation({ summary: "Lấy dữ liệu tổng hợp dịch vụ bán trú và đăng ký" })
  async getDayboarding() {
    return this.snackService.getDayboardingSummary();
  }

  /**
   * GET /snack-services/check-allergy: Kiểm tra độ an toàn dị ứng của trẻ với thực đơn đợt ăn xế.
   * @param periodId Tham số periodId trong query string.
   * @param studentId Tham số studentId trong query string.
   * Chuyển xử lý sang SnackServicesService.checkAllergySafety() và trả kết quả cho client.
   */
  @Get("check-allergy")
  @ApiOperation({
    summary: "Kiểm tra độ an toàn dị ứng của trẻ với thực đơn đợt ăn xế",
  })
  async checkAllergy(
    @Query("periodId", ParseIntPipe) periodId: number,
    @Query("studentId", ParseIntPipe) studentId: number,
  ) {
    return this.snackService.checkAllergySafety(periodId, studentId);
  }

  /**
   * GET /snack-services/students-available: Lấy danh sách học sinh có thể đăng ký đợt ăn xế (Chặn CGDD).
   * @param periodId Tham số periodId trong query string (tùy chọn).
   * Chuyển xử lý sang SnackServicesService.getStudentsAvailable() và trả kết quả cho client.
   */
  @Get("students-available")
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "TEACHER",
    "PARENT",
  )
  @ApiOperation({
    summary: "Lấy danh sách học sinh có thể đăng ký đợt ăn xế (Chặn CGDD)",
  })
  async getStudentsAvailable(@Query("periodId") periodId?: string) {
    return this.snackService.getStudentsAvailable(
      periodId ? Number(periodId) : undefined,
    );
  }

  /**
   * GET /snack-services/:id: Xem chi tiết kỳ dịch vụ ăn xế và danh sách trẻ đăng ký (Ẩn với CGDD).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param req HTTP request để đọc thông tin người dùng, header hoặc địa chỉ IP.
   * Chuyển xử lý sang SnackServicesService.findOne() và trả kết quả cho client.
   */
  @Get(":id")
  @ApiOperation({
    summary:
      "Xem chi tiết kỳ dịch vụ ăn xế và danh sách trẻ đăng ký (Ẩn với CGDD)",
  })
  async findOne(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.snackService.findOne(id, req.user);
  }

  /**
   * POST /snack-services/periods: Hiệu trưởng / School Manager tạo mới kỳ đăng ký dịch vụ ăn xế.
   * @param dto Dữ liệu body JSON, kiểu CreateSnackServicePeriodDto.
   * Chuyển xử lý sang SnackServicesService.createPeriod() và trả kết quả cho client.
   */
  @Post("periods")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({
    summary: "Hiệu trưởng / School Manager tạo mới kỳ đăng ký dịch vụ ăn xế",
  })
  async createPeriod(@Body() dto: CreateSnackServicePeriodDto) {
    return this.snackService.createPeriod(dto);
  }

  /**
   * PUT /snack-services/:id/menu-schedule: Chuyên gia Dinh dưỡng (CGDD) / Hiệu trưởng lên thực đơn ăn xế cho gói dịch vụ.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang SnackServicesService.updateMenuSchedule() và trả kết quả cho client.
   */
  @Put(":id/menu-schedule")
  @Roles(
    "NUTRITIONIST",
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
  )
  @ApiOperation({
    summary:
      "Chuyên gia Dinh dưỡng (CGDD) / Hiệu trưởng lên thực đơn ăn xế cho gói dịch vụ",
  })
  async updateMenuSchedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { menuSchedule: SnackMenuDayItem[]; description?: string },
  ) {
    return this.snackService.updateMenuSchedule(id, body);
  }

  /**
   * POST /snack-services/enrollment: Đăng ký tham gia dịch vụ ăn xế (Kiểm tra quy tắc dị ứng).
   * @param dto Dữ liệu body JSON, kiểu RegisterSnackServiceDto.
   * @param req HTTP request để đọc thông tin người dùng, header hoặc địa chỉ IP.
   * Chuyển xử lý sang SnackServicesService.registerEnrollment() và trả kết quả cho client.
   */
  @Post("enrollment")
  @Roles(
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
    "TEACHER",
    "PARENT",
  )
  @ApiOperation({
    summary: "Đăng ký tham gia dịch vụ ăn xế (Kiểm tra quy tắc dị ứng)",
  })
  async registerEnrollment(
    @Body() dto: RegisterSnackServiceDto,
    @Req() req: any,
  ) {
    return this.snackService.registerEnrollment(dto, req.user);
  }

  /**
   * PUT /snack-services/registrations/:id/confirm-payment: Xác nhận thanh toán cho đăng ký ăn xế.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang SnackServicesService.confirmPayment() và trả kết quả cho client.
   */
  @Put("registrations/:id/confirm-payment")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Xác nhận thanh toán cho đăng ký ăn xế" })
  async confirmPayment(@Param("id", ParseIntPipe) id: number) {
    return this.snackService.confirmPayment(id);
  }

  /**
   * POST /snack-services: Hiệu trưởng tạo mới gói dịch vụ ăn xế.
   * @param dto Dữ liệu body JSON.
   * Chuyển xử lý sang SnackServicesService.createService() và trả kết quả cho client.
   */
  @Post()
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Hiệu trưởng tạo mới gói dịch vụ ăn xế" })
  async createService(@Body() dto: any) {
    return this.snackService.createService(dto);
  }

  /**
   * PUT /snack-services/:id: Hiệu trưởng cập nhật thông tin kỳ dịch vụ ăn xế.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateSnackServiceDto.
   * Chuyển xử lý sang SnackServicesService.updatePeriod() và trả kết quả cho client.
   */
  @Put(":id")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Hiệu trưởng cập nhật thông tin kỳ dịch vụ ăn xế" })
  async updatePeriod(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSnackServiceDto,
  ) {
    return this.snackService.updatePeriod(id, dto);
  }

  /**
   * PUT /snack-services/periods/:id/close: Đóng kỳ đăng ký ăn xế.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang SnackServicesService.closePeriod() và trả kết quả cho client.
   */
  @Put("periods/:id/close")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Đóng kỳ đăng ký ăn xế" })
  async closePeriod(@Param("id", ParseIntPipe) id: number) {
    return this.snackService.closePeriod(id);
  }

  /**
   * PUT /snack-services/periods/:id/open: Công bố / Mở lại kỳ đăng ký ăn xế.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang SnackServicesService.openPeriod() và trả kết quả cho client.
   */
  @Put("periods/:id/open")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Công bố / Mở lại kỳ đăng ký ăn xế" })
  async openPeriod(@Param("id", ParseIntPipe) id: number) {
    return this.snackService.openPeriod(id);
  }

  /**
   * PUT /snack-services/periods/:id/toggle: Chuyển đổi trạng thái đóng/mở kỳ đăng ký ăn xế.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang SnackServicesService.togglePeriod() và trả kết quả cho client.
   */
  @Put("periods/:id/toggle")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Chuyển đổi trạng thái đóng/mở kỳ đăng ký ăn xế" })
  async togglePeriod(@Param("id", ParseIntPipe) id: number) {
    return this.snackService.togglePeriod(id);
  }

  @Put("periods/:id/toggle-lock")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Khóa/Mở khóa dịch vụ không thể đóng tiền nữa" })
  async togglePeriodLock(@Param("id", ParseIntPipe) id: number) {
    return this.snackService.togglePeriodLock(id);
  }

  @Put(":id/toggle-lock")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({ summary: "Khóa/Mở khóa dịch vụ không thể đóng tiền nữa" })
  async toggleLock(@Param("id", ParseIntPipe) id: number) {
    return this.snackService.togglePeriodLock(id);
  }

  /**
   * DELETE /snack-services/:id: Hiệu trưởng xóa gói dịch vụ ăn xế (Chặn nếu đã có phụ huynh đóng tiền).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang SnackServicesService.deleteService() và trả kết quả cho client.
   */
  @Delete(":id")
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiOperation({
    summary:
      "Hiệu trưởng xóa gói dịch vụ ăn xế (Chặn nếu đã có phụ huynh đóng tiền)",
  })
  async deleteService(@Param("id", ParseIntPipe) id: number) {
    return this.snackService.deleteService(id);
  }
}
