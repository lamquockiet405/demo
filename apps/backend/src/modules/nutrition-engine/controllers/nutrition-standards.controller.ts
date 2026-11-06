import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NutritionRulesService } from "../services/nutrition-rules.service";
import { CreateNutritionRuleDto } from "../dto/create-nutrition-rule.dto";
import { UpdateNutritionRuleDto } from "../dto/update-nutrition-rule.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";

/**
 * Quản lý các chuẩn và chỉ tiêu dinh dưỡng phục vụ đánh giá thực đơn.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Nutrition Rules & Standards")
@Controller("nutrition-rules")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NutritionStandardsController {
  constructor(private readonly rulesService: NutritionRulesService) {}

  /**
   * GET /nutrition-rules: Lấy danh sách các chuẩn dinh dưỡng theo nhóm tuổi.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang NutritionRulesService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({
    summary: "Lấy danh sách các chuẩn dinh dưỡng theo nhóm tuổi",
  })
  async findAll(@Query() query: any) {
    return this.rulesService.findAll(query);
  }

  /**
   * GET /nutrition-rules/stats: Thống kê quy tắc dinh dưỡng Thông tư 28.
   * Chuyển xử lý sang NutritionRulesService.getStats() và trả kết quả cho client.
   */
  @Get("stats")
  @ApiOperation({ summary: "Thống kê quy tắc dinh dưỡng Thông tư 28" })
  async getStats() {
    return this.rulesService.getStats();
  }

  /**
   * POST /nutrition-rules/sync-rda: Đồng bộ quy chuẩn Quốc gia (VN-RDA 2024 & TT 28).
   * Chuyển xử lý sang NutritionRulesService.syncRdaStandards() và trả kết quả cho client.
   */
  @Post("sync-rda")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGEMENT", "PRINCIPAL", "ADMIN")
  @ApiOperation({ summary: "Đồng bộ quy chuẩn Quốc gia (VN-RDA 2024 & TT 28)" })
  async syncRda() {
    return this.rulesService.syncRdaStandards();
  }

  /**
   * GET /nutrition-rules/:id: Xem chi tiết chuẩn dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang NutritionRulesService.findOne() và trả kết quả cho client.
   */
  @Get(":id")
  @ApiOperation({ summary: "Xem chi tiết chuẩn dinh dưỡng" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rulesService.findOne(id);
  }

  /**
   * POST /nutrition-rules: Thêm mới quy tắc chuẩn dinh dưỡng.
   * @param dto Dữ liệu body JSON, kiểu CreateNutritionRuleDto.
   * Chuyển xử lý sang NutritionRulesService.create() và trả kết quả cho client.
   */
  @Post()
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Thêm mới quy tắc chuẩn dinh dưỡng" })
  async create(@Body() dto: CreateNutritionRuleDto) {
    return this.rulesService.create(dto);
  }

  /**
   * PUT /nutrition-rules/:id: Cập nhật chỉ tiêu dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateNutritionRuleDto.
   * Chuyển xử lý sang NutritionRulesService.update() và trả kết quả cho client.
   */
  @Put(":id")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Cập nhật chỉ tiêu dinh dưỡng" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateNutritionRuleDto,
  ) {
    return this.rulesService.update(id, dto);
  }

  /**
   * PATCH /nutrition-rules/:id/status: Bật/tắt trạng thái áp dụng quy tắc.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param isActive Trường isActive trong body JSON.
   * Chuyển xử lý sang NutritionRulesService.update() và trả kết quả cho client.
   * Chuyển isActive trong body thành status ACTIVE hoặc INACTIVE trước khi cập nhật.
   */
  @Patch(":id/status")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Bật/tắt trạng thái áp dụng quy tắc" })
  async toggleStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body("isActive") isActive: boolean,
  ) {
    return this.rulesService.update(id, {
      status: isActive ? "ACTIVE" : "INACTIVE",
    });
  }

  /**
   * PATCH /nutrition-rules/:id/restore: Yêu cầu khôi phục quy tắc dinh dưỡng theo ID trên URL.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang NutritionRulesService.restore() và trả kết quả cho client.
   */
  @Patch(":id/restore")
  @Roles("NUTRITIONIST", "PRINCIPAL", "SCHOOL_MANAGER", "SUPER_ADMIN")
  async restore(@Param("id", ParseIntPipe) id: number) {
    return this.rulesService.restore(id);
  }

  /**
   * DELETE /nutrition-rules/:id: Xóa quy tắc dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang NutritionRulesService.remove() và trả kết quả cho client.
   */
  @Delete(":id")
  @Roles("NUTRITIONIST", "SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Xóa quy tắc dinh dưỡng" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.rulesService.remove(id);
  }
}
