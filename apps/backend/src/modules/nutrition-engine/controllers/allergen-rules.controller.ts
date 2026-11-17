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
import { AllergenRulesService } from "../services/allergen-rules.service";
import { CreateAllergenDto } from "../dto/create-allergen.dto";
import { UpdateAllergenDto } from "../dto/update-allergen.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";

/**
 * Quản lý danh mục tác nhân dị ứng dùng khi khai báo và kiểm tra thực đơn.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Allergen Standards & Rules")
@Controller("allergens")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AllergenRulesController {
  constructor(private readonly allergenService: AllergenRulesService) {}

  /**
   * GET /allergens: Lấy danh mục các loại dị ứng chuẩn.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang AllergenRulesService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: "Lấy danh mục các loại dị ứng chuẩn" })
  async findAll(@Query() query: any) {
    return this.allergenService.findAll(query);
  }

  /**
   * GET /allergens/:id: Xem chi tiết danh mục dị ứng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang AllergenRulesService.findOne() và trả kết quả cho client.
   */
  @Get(":id")
  @ApiOperation({ summary: "Xem chi tiết danh mục dị ứng" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.allergenService.findOne(id);
  }

  /**
   * POST /allergens: Thêm mới loại dị ứng.
   * @param dto Dữ liệu body JSON, kiểu CreateAllergenDto.
   * Chuyển xử lý sang AllergenRulesService.create() và trả kết quả cho client.
   */
  @Post()
  @Roles("SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Thêm mới loại dị ứng" })
  async create(@Body() dto: CreateAllergenDto) {
    return this.allergenService.create(dto);
  }

  /**
   * PUT /allergens/:id: Cập nhật loại dị ứng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateAllergenDto.
   * Chuyển xử lý sang AllergenRulesService.update() và trả kết quả cho client.
   */
  @Put(":id")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Cập nhật loại dị ứng" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAllergenDto,
  ) {
    return this.allergenService.update(id, dto);
  }

  /**
   * PATCH /allergens/:id/status: Bật/tắt trạng thái loại dị ứng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang AllergenRulesService.findOne(), AllergenRulesService.update() và trả kết quả cho client.
   * Đọc bản ghi hiện tại rồi truyền isActive đảo ngược sang service.update.
   */
  @Patch(":id/status")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Bật/tắt trạng thái loại dị ứng" })
  async toggleStatus(@Param("id", ParseIntPipe) id: number) {
    const current = await this.allergenService.findOne(id);
    return this.allergenService.update(id, { isActive: !current.isActive });
  }

  /**
   * PATCH /allergens/:id/restore: Yêu cầu khôi phục tác nhân dị ứng theo ID trên URL.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang AllergenRulesService.restore() và trả kết quả cho client.
   */
  @Patch(":id/restore")
  @Roles("PRINCIPAL", "SCHOOL_MANAGER", "SUPER_ADMIN")
  async restore(@Param("id", ParseIntPipe) id: number) {
    return this.allergenService.restore(id);
  }

  /**
   * DELETE /allergens/:id: Xóa loại dị ứng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang AllergenRulesService.remove() và trả kết quả cho client.
   */
  @Delete(":id")
  @Roles("SCHOOL_MANAGER", "PRINCIPAL")
  @ApiOperation({ summary: "Xóa loại dị ứng" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.allergenService.remove(id);
  }
}
