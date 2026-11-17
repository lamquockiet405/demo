import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { NutritionAdviceService } from "../services/nutrition-advice.service";
import { SendHomeSupplementAdviceDto } from "../dto/send-advice.dto";
import { ConfirmAdviceDto } from "../dto/confirm-advice.dto";

/**
 * Phát hiện tình trạng ăn kém và trao đổi hướng dẫn bổ sung dinh dưỡng với phụ huynh.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Picky Eating Detection & Home Nutrition Advice")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("nutrition-advice")
export class NutritionAdviceController {
  constructor(private readonly adviceService: NutritionAdviceService) {}

  /**
   * GET /nutrition-advice/detect: Phát hiện trẻ biếng ăn / kén ăn từ dữ liệu tiêu thụ thực tế.
   * @param classId Tham số classId trong query string (tùy chọn).
   * @param search Tham số search trong query string (tùy chọn).
   * Chuyển xử lý sang NutritionAdviceService.detectPickyEating() và trả kết quả cho client.
   */
  @Get("detect")
  @ApiOperation({
    summary: "Phát hiện trẻ biếng ăn / kén ăn từ dữ liệu tiêu thụ thực tế",
  })
  @Roles(
    "NUTRITIONIST",
    "TEACHER",
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "PRINCIPAL",
    "SUPER_ADMIN",
  )
  @ApiQuery({
    name: "classId",
    required: false,
    description: "Lọc theo lớp học",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Tìm theo tên hoặc mã học sinh",
  })
  async detectPickyEating(
    @Query("classId") classId?: string,
    @Query("search") search?: string,
  ) {
    return this.adviceService.detectPickyEating(classId, search);
  }

  /**
   * POST /nutrition-advice/send: Chuyên gia dinh dưỡng / Giáo viên gửi tư vấn bổ sung tại nhà cho phụ huynh.
   * @param dto Dữ liệu body JSON, kiểu SendHomeSupplementAdviceDto.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang NutritionAdviceService.sendAdvice() và trả kết quả cho client.
   */
  @Post("send")
  @ApiOperation({
    summary:
      "Chuyên gia dinh dưỡng / Giáo viên gửi tư vấn bổ sung tại nhà cho phụ huynh",
  })
  @Roles("NUTRITIONIST", "TEACHER", "PRINCIPAL", "SUPER_ADMIN")
  async sendAdvice(
    @Body() dto: SendHomeSupplementAdviceDto,
    @CurrentUser("sub") userId: number,
  ) {
    return this.adviceService.sendAdvice(dto, userId);
  }

  /**
   * GET /nutrition-advice/child-advice: Phụ huynh xem danh sách tư vấn bổ sung dinh dưỡng của con.
   * @param childId Tham số childId trong query string (tùy chọn).
   * @param userId Trường sub của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang NutritionAdviceService.getChildAdvice() và trả kết quả cho client.
   */
  @Get("child-advice")
  @ApiOperation({
    summary: "Phụ huynh xem danh sách tư vấn bổ sung dinh dưỡng của con",
  })
  @Roles("PARENT", "NUTRITIONIST", "TEACHER", "PRINCIPAL", "SUPER_ADMIN")
  async getChildAdvice(
    @Query("childId") childId?: string,
    @CurrentUser("sub") userId?: number,
  ) {
    return this.adviceService.getChildAdvice(childId, userId);
  }

  /**
   * POST /nutrition-advice/:id/confirm: Phụ huynh xác nhận đã đọc và gửi phản hồi áp dụng tại nhà.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu ConfirmAdviceDto.
   * @param userId Trường sub của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang NutritionAdviceService.confirmAdvice() và trả kết quả cho client.
   */
  @Post(":id/confirm")
  @ApiOperation({
    summary: "Phụ huynh xác nhận đã đọc và gửi phản hồi áp dụng tại nhà",
  })
  @Roles("PARENT", "PRINCIPAL", "SUPER_ADMIN")
  async confirmAdvice(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ConfirmAdviceDto,
    @CurrentUser("sub") userId?: number,
  ) {
    return this.adviceService.confirmAdvice(id, dto, userId);
  }

  /**
   * GET /nutrition-advice/history: Xem toàn bộ lịch sử tư vấn dinh dưỡng đã gửi.
   * @param studentId Tham số studentId trong query string (tùy chọn).
   * Chuyển xử lý sang NutritionAdviceService.getAdviceHistory() và trả kết quả cho client.
   */
  @Get("history")
  @ApiOperation({ summary: "Xem toàn bộ lịch sử tư vấn dinh dưỡng đã gửi" })
  @Roles("NUTRITIONIST", "TEACHER", "PRINCIPAL", "SUPER_ADMIN")
  async getAdviceHistory(@Query("studentId") studentId?: string) {
    return this.adviceService.getAdviceHistory(
      studentId ? Number(studentId) : undefined,
    );
  }
}
