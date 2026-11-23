import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import {
  ChildAccessActor,
  ChildrenService,
} from "../services/children.service";
import { CreateChildDto } from "../dto/create-child.dto";
import { UpdateChildDto } from "../dto/update-child.dto";
import { GetChildrenQueryDto } from "../dto/get-children-query.dto";
import { DeclareAllergyDto } from "../dto/declare-allergy.dto";
import { UpdateAllergyDto } from "../dto/update-allergy.dto";
import { UpdateNutritionProfileDto } from "../dto/update-nutrition-profile.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AllergyWriteGuard } from '../../../common/guards/allergy-write.guard';
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

/**
 * Quản lý hồ sơ trẻ và các thông tin khai báo, lịch sử, cảnh báo dị ứng.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản trước khi thực thi các endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Children & Allergies Management")
@Controller("children")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  /**
   * GET /children: Lấy danh sách hồ sơ trẻ (Phân trang, tìm kiếm, lọc theo lớp/dị ứng).
   * @param query Bộ lọc trong query string.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({
    summary:
      "Lấy danh sách hồ sơ trẻ (Phân trang, tìm kiếm, lọc theo lớp/dị ứng)",
  })
  async findAll(
    @Query() query: GetChildrenQueryDto,
    @CurrentUser() actor: ChildAccessActor,
    @CurrentTenant() schoolId: number,
  ) {
    return this.childrenService.findAll(query, actor, schoolId);
  }

  /**
   * GET /children/stats: Thống kê tổng số trẻ, giới tính, tỷ lệ có dị ứng.
   * Chuyển xử lý sang ChildrenService.getStats() và trả kết quả cho client.
   */
  @Get("stats")
  @ApiOperation({ summary: "Thống kê tổng số trẻ, giới tính, tỷ lệ có dị ứng" })
  async getStats(@CurrentTenant() schoolId: number, @Query() query: GetChildrenQueryDto) {
    return this.childrenService.getStats(schoolId, query);
  }

  /**
   * GET /children/allergen-catalogs: Danh mục 8 dị ứng phổ biến chuẩn.
   * Chuyển xử lý sang ChildrenService.getAllergenCatalogs() và trả kết quả cho client.
   */
  @Get("allergen-catalogs")
  @ApiOperation({ summary: "Danh mục 8 dị ứng phổ biến chuẩn" })
  async getAllergenCatalogs() {
    return this.childrenService.getAllergenCatalogs();
  }

  /**
   * POST /children/rescan-allergies: Quét lại toàn bộ rủi ro dị ứng học sinh.
   * Chuyển xử lý sang ChildrenService.rescanAllergies() và trả kết quả cho client.
   * Service hiện chỉ trả thông báo thành công, chưa thực hiện quét hoặc lưu cảnh báo.
   */
  @Post("rescan-allergies")
  @ApiOperation({ summary: "Quét lại toàn bộ rủi ro dị ứng học sinh" })
  async rescanAllergies() {
    return this.childrenService.rescanAllergies();
  }

  /**
   * POST /children/import: Nhập khẩu danh sách học sinh hàng loạt.
   * @param items Trường items trong body JSON.
   * Chuyển xử lý sang ChildrenService.importChildren() và trả kết quả cho client.
   */
  @Post("import")
  @ApiOperation({ summary: "Nhập khẩu danh sách học sinh hàng loạt" })
  async importChildren(@Body("items") items: any[]) {
    return this.childrenService.importChildren(items || []);
  }

  /**
   * GET /children/:id/allergy-history: Xem lịch sử khai báo và cảnh báo dị ứng của trẻ.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.getAllergyHistory() và trả kết quả cho client.
   */
  @Get(":id/allergy-history")
  @ApiOperation({ summary: "Xem lịch sử khai báo và cảnh báo dị ứng của trẻ" })
  async getAllergyHistory(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: ChildAccessActor,
  ) {
    return this.childrenService.getAllergyHistory(id, actor);
  }

  /**
   * GET /children/:id: Xem chi tiết hồ sơ một trẻ.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.findOne() và trả kết quả cho client.
   */
  @Get(":id")
  @ApiOperation({ summary: "Xem chi tiết hồ sơ một trẻ" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: ChildAccessActor,
  ) {
    return this.childrenService.findOne(id, actor);
  }

  /**
   * GET /children/:id/nutrition-profile: Đọc hồ sơ dinh dưỡng của trẻ và truyền thông tin người truy cập sang service.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.getNutritionProfile() và trả kết quả cho client.
   */
  @Get(":id/nutrition-profile")
  async getNutritionProfile(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: ChildAccessActor,
  ) {
    return this.childrenService.getNutritionProfile(id, actor);
  }

  /**
   * PATCH /children/:id/nutrition-profile: Cập nhật hồ sơ dinh dưỡng của trẻ từ UpdateNutritionProfileDto và người thực hiện.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateNutritionProfileDto.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.updateNutritionProfile() và trả kết quả cho client.
   */
  @Patch(":id/nutrition-profile")
  async updateNutritionProfile(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateNutritionProfileDto,
    @CurrentUser() actor: ChildAccessActor,
  ) {
    return this.childrenService.updateNutritionProfile(id, dto, actor);
  }

  /**
   * POST /children: Tạo mới hồ sơ trẻ.
   * @param dto Dữ liệu body JSON, kiểu CreateChildDto.
   * Chuyển xử lý sang ChildrenService.create() và trả kết quả cho client.
   */
  @Post()
  @ApiOperation({ summary: "Tạo mới hồ sơ trẻ" })
  async create(@Body() dto: CreateChildDto) {
    return this.childrenService.create(dto);
  }

  /**
   * PATCH /children/:id: Cập nhật hồ sơ trẻ.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateChildDto.
   * Chuyển xử lý sang ChildrenService.update() và trả kết quả cho client.
   */
  @Patch(":id")
  @ApiOperation({ summary: "Cập nhật hồ sơ trẻ" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateChildDto,
  ) {
    return this.childrenService.update(id, dto);
  }

  /**
   * POST /children/:childId/allergies: Khai báo thông tin dị ứng cho trẻ (Phụ huynh / Y tế / GV).
   * @param childId Giá trị childId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu DeclareAllergyDto.
   * @param userId Trường sub của tài khoản đã xác thực.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.declareAllergy() và trả kết quả cho client.
   */
  @Post(":childId/allergies")
  @UseGuards(AllergyWriteGuard)
  @ApiOperation({
    summary: "Khai báo thông tin dị ứng cho trẻ (Phụ huynh / Y tế / GV)",
  })
  async declareAllergy(
    @Param("childId", ParseIntPipe) childId: number,
    @Body() dto: DeclareAllergyDto,
    @CurrentUser("sub") userId: number,
    @CurrentUser() actor: ChildAccessActor,
  ) {
    return this.childrenService.declareAllergy(childId, dto, userId, actor);
  }

  /**
   * PUT /children/allergies/:allergyId: Cập nhật bản ghi dị ứng của trẻ.
   * @param allergyId Giá trị allergyId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateAllergyDto.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.updateAllergy() và trả kết quả cho client.
   */
  @Put("allergies/:allergyId")
  @UseGuards(AllergyWriteGuard)
  @ApiOperation({ summary: "Cập nhật bản ghi dị ứng của trẻ" })
  async updateAllergy(
    @Param("allergyId", ParseIntPipe) allergyId: number,
    @Body() dto: UpdateAllergyDto,
    @CurrentUser() actor: ChildAccessActor,
  ) {
    return this.childrenService.updateAllergy(allergyId, dto, actor);
  }

  /**
   * DELETE /children/allergies/:allergyId: Xóa bản ghi dị ứng.
   * @param allergyId Giá trị allergyId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang ChildrenService.deleteAllergy() và trả kết quả cho client.
   */
  @Delete("allergies/:allergyId")
  @UseGuards(AllergyWriteGuard)
  @ApiOperation({ summary: "Xóa bản ghi dị ứng" })
  async deleteAllergy(
    @Param("allergyId", ParseIntPipe) allergyId: number,
    @CurrentUser() actor: ChildAccessActor,
  ) {
    return this.childrenService.deleteAllergy(allergyId, actor);
  }
}
