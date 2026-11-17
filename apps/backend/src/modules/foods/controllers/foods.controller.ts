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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FoodsService } from '../services/foods.service';
import { CreateFoodDto } from '../dto/create-food.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
import { GetFoodsQueryDto } from '../dto/get-foods-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

/**
 * Quản lý kho nguyên liệu và thành phần dinh dưỡng dùng để xây dựng công thức món.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Foods & FCT Ingredients')
@Controller('foods')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  /**
   * GET /foods: Lấy danh sách nguyên liệu FCT (tìm kiếm, lọc nhóm, phân trang).
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang FoodsService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nguyên liệu FCT (tìm kiếm, lọc nhóm, phân trang)' })
  async findAll(@Query() query: GetFoodsQueryDto, @CurrentUser() actor: any) {
    return this.foodsService.findAll(query, actor);
  }

  /**
   * GET /foods/stats: Thống kê tổng số nguyên liệu và nhóm thực phẩm.
   * Chuyển xử lý sang FoodsService.getStats() và trả kết quả cho client.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng số nguyên liệu và nhóm thực phẩm' })
  async getStats() {
    return this.foodsService.getStats();
  }

  /**
   * GET /foods/categories: Lấy danh mục 14 nhóm thực phẩm theo Viện Dinh Dưỡng.
   * Chuyển xử lý sang FoodsService.getCategories() và trả kết quả cho client.
   */
  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh mục 14 nhóm thực phẩm theo Viện Dinh Dưỡng' })
  async getCategories() {
    return this.foodsService.getCategories();
  }

  /**
   * GET /foods/:id: Xem chi tiết thành phần dinh dưỡng của 1 nguyên liệu.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang FoodsService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết thành phần dinh dưỡng của 1 nguyên liệu' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: any) {
    return this.foodsService.findOne(id, actor);
  }

  /**
   * POST /foods: Tạo mới nguyên liệu vào kho dữ liệu.
   * @param dto Dữ liệu body JSON, kiểu CreateFoodDto.
   * Chuyển xử lý sang FoodsService.create() và trả kết quả cho client.
   */
  @Post()
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL')
  @ApiOperation({ summary: 'Tạo mới nguyên liệu vào kho dữ liệu' })
  async create(@Body() dto: CreateFoodDto, @CurrentUser() actor: any) {
    return this.foodsService.create(dto, actor);
  }

  /**
   * PUT /foods/:id: Cập nhật chỉ số dinh dưỡng nguyên liệu.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateFoodDto.
   * Chuyển xử lý sang FoodsService.update() và trả kết quả cho client.
   */
  @Put(':id')
  @Patch(':id')
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL')
  @ApiOperation({ summary: 'Cập nhật chỉ số dinh dưỡng nguyên liệu' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFoodDto,
    @CurrentUser() actor: any,
  ) {
    return this.foodsService.update(id, dto, actor);
  }

  /**
   * DELETE /foods/:id: Xóa nguyên liệu.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang FoodsService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL')
  @ApiOperation({ summary: 'Xóa nguyên liệu' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: any) {
    return this.foodsService.remove(id, actor);
  }

  /**
   * POST /foods/upload: Tải lên hình ảnh nguyên liệu.
   * Hiện trả URL ảnh cố định; chưa nhận file hoặc lưu ảnh được tải lên.
   */
  @Post('upload')
  @ApiOperation({ summary: 'Tải lên hình ảnh nguyên liệu' })
  async upload() {
    return {
      success: true,
      url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
    };
  }
}
