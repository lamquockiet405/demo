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
import { ParentManagementService } from '../services/parent-management.service';
import { QueryParentDto } from '../dto/parent/query-parent.dto';
import { CreateParentDto } from '../dto/parent/create-parent.dto';
import { UpdateParentDto } from '../dto/parent/update-parent.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

/**
 * Quản lý tài khoản phụ huynh để nhà trường tra cứu, cập nhật và khôi phục.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Parent Management')
@Controller('users/parents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ParentManagementController {
  constructor(private readonly parentService: ParentManagementService) {}

  /**
   * GET /users/parents: Lấy danh sách tài khoản phụ huynh học sinh.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang ParentManagementService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tài khoản phụ huynh học sinh' })
  async findAll(@Query() query: QueryParentDto, @CurrentTenant() schoolId: number) {
    return this.parentService.findAll(query, schoolId);
  }

  /**
   * GET /users/parents/stats: Thống kê tình hình tài khoản phụ huynh.
   * Chuyển xử lý sang ParentManagementService.getStats() và trả kết quả cho client.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tình hình tài khoản phụ huynh' })
  async getStats(@Query() query: QueryParentDto, @CurrentTenant() schoolId: number) {
    return this.parentService.getStats(query, schoolId);
  }

  /**
   * GET /users/parents/check-email: Kiểm tra email phụ huynh đã tồn tại hay chưa.
   * @param email Tham số email trong query string.
   * Chuyển xử lý sang ParentManagementService.checkEmailExists() và trả kết quả cho client.
   */
  @Get('check-email')
  @ApiOperation({ summary: 'Kiểm tra email phụ huynh đã tồn tại hay chưa' })
  async checkEmail(@Query('email') email: string) {
    return this.parentService.checkEmailExists(email);
  }

  /**
   * GET /users/parents/:id: Xem chi tiết phụ huynh.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang ParentManagementService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết phụ huynh' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.parentService.findOne(id);
  }

  /**
   * POST /users/parents: Tạo tài khoản phụ huynh mới.
   * @param dto Dữ liệu body JSON, kiểu CreateParentDto.
   * Chuyển xử lý sang ParentManagementService.create() và trả kết quả cho client.
   */
  @Post()
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Tạo tài khoản phụ huynh mới' })
  async create(@Body() dto: CreateParentDto) {
    return this.parentService.create(dto);
  }

  /**
   * PATCH /users/parents/:id: Cập nhật thông tin phụ huynh.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateParentDto.
   * Chuyển xử lý sang ParentManagementService.update() và trả kết quả cho client.
   */
  @Patch(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cập nhật thông tin phụ huynh' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParentDto,
  ) {
    return this.parentService.update(id, dto);
  }

  /**
   * PUT /users/parents/:id: Cập nhật toàn bộ thông tin phụ huynh.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateParentDto.
   * Chuyển xử lý sang ParentManagementService.update() và trả kết quả cho client.
   * Dùng cùng parentService.update với endpoint PATCH, không có nhánh thay thế toàn bộ riêng.
   */
  @Put(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cập nhật toàn bộ thông tin phụ huynh' })
  async updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParentDto,
  ) {
    return this.parentService.update(id, dto);
  }

  /**
   * POST /users/parents/:id/restore: Khôi phục tài khoản phụ huynh.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang ParentManagementService.restore() và trả kết quả cho client.
   */
  @Post(':id/restore')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Khôi phục tài khoản phụ huynh' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.parentService.restore(id);
  }

  /**
   * DELETE /users/parents/:id: Xóa tài khoản phụ huynh.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang ParentManagementService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Xóa tài khoản phụ huynh' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.parentService.remove(id);
  }
}
