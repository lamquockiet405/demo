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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DishesService } from './dishes.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { GetDishesQueryDto } from './dto/get-dishes-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Quản lý danh mục món ăn, công thức và dữ liệu dinh dưỡng của món.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Dishes & Recipes Management')
@Controller('dishes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DishesController {
  constructor(private readonly dishesService: DishesService) {}

  /**
   * GET /dishes: Lấy danh sách món ăn kèm phân loại và chỉ số dinh dưỡng.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang DishesService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách món ăn kèm phân loại và chỉ số dinh dưỡng' })
  async findAll(@Query() query: GetDishesQueryDto) {
    return this.dishesService.findAll(query);
  }

  /**
   * GET /dishes/categories: Lấy danh mục phân loại món (Món chính, Canh, Phụ, Tráng miệng...).
   * Chuyển xử lý sang DishesService.getCategories() và trả kết quả cho client.
   */
  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh mục phân loại món (Món chính, Canh, Phụ, Tráng miệng...)' })
  async getCategories() {
    return this.dishesService.getCategories();
  }

  /**
   * GET /dishes/:id: Xem chi tiết món ăn kèm công thức và thành phần dinh dưỡng.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang DishesService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết món ăn kèm công thức và thành phần dinh dưỡng' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dishesService.findOne(id);
  }

  /**
   * POST /dishes: Tạo món ăn mới và lập công thức nguyên liệu.
   * @param dto Dữ liệu body JSON, kiểu CreateDishDto.
   * Chuyển xử lý sang DishesService.create() và trả kết quả cho client.
   * Service lưu món, công thức rồi gọi recalculateDishNutrition để tính và lưu dinh dưỡng từ nguyên liệu.
   */
  @Post()
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL')
  @ApiOperation({ summary: 'Tạo món ăn mới và lập công thức nguyên liệu' })
  async create(@Body() dto: CreateDishDto) {
    return this.dishesService.create(dto);
  }

  /**
   * PUT /dishes/:id: Cập nhật món ăn và công thức.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateDishDto.
   * Chuyển xử lý sang DishesService.update() và trả kết quả cho client.
   * Khi body có recipes, service thay công thức và gọi recalculateDishNutrition để tính lại dinh dưỡng.
   */
  @Put(':id')
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL')
  @ApiOperation({ summary: 'Cập nhật món ăn và công thức' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDishDto,
  ) {
    return this.dishesService.update(id, dto);
  }

  /**
   * DELETE /dishes/:id: Xóa món ăn.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang DishesService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGER', 'PRINCIPAL')
  @ApiOperation({ summary: 'Xóa món ăn' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.dishesService.remove(id);
  }
}
