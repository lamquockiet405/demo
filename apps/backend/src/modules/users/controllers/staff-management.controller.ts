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
import { StaffManagementService } from '../services/staff-management.service';
import { QueryStaffDto } from '../dto/staff/query-staff.dto';
import { CreateStaffDto } from '../dto/staff/create-staff.dto';
import { UpdateStaffDto } from '../dto/staff/update-staff.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

/**
 * Quản lý tài khoản cán bộ, giáo viên, nhân viên và vai trò được phân công.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Staff Management')
@Controller('users/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaffManagementController {
  constructor(private readonly staffService: StaffManagementService) {}

  /**
   * GET /users/staff: Lấy danh sách cán bộ, giáo viên, nhân viên trường học.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang StaffManagementService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách cán bộ, giáo viên, nhân viên trường học' })
  async findAll(@Query() query: QueryStaffDto) {
    return this.staffService.findAll(query);
  }

  /**
   * GET /users/staff/stats: Thống kê tổng số lượng nhân sự theo vị trí.
   * Chuyển xử lý sang StaffManagementService.getStats() và trả kết quả cho client.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng số lượng nhân sự theo vị trí' })
  async getStats() {
    return this.staffService.getStats();
  }

  /**
   * GET /users/staff/roles: Lấy danh mục vai trò nhân sự.
   * Chuyển xử lý sang StaffManagementService.getRoles() và trả kết quả cho client.
   */
  @Get('roles')
  @ApiOperation({ summary: 'Lấy danh mục vai trò nhân sự' })
  async getRoles() {
    return this.staffService.getRoles();
  }

  /**
   * GET /users/staff/:id: Xem chi tiết một nhân viên.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang StaffManagementService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết một nhân viên' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.findOne(id);
  }

  /**
   * POST /users/staff: Thêm mới nhân viên / giáo viên (BGH).
   * @param dto Dữ liệu body JSON, kiểu CreateStaffDto.
   * Chuyển xử lý sang StaffManagementService.create() và trả kết quả cho client.
   */
  @Post()
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Thêm mới nhân viên / giáo viên (BGH)' })
  async create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  /**
   * PATCH /users/staff/:id: Cập nhật nhân viên / phân quyền (BGH).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateStaffDto.
   * Chuyển xử lý sang StaffManagementService.update() và trả kết quả cho client.
   */
  @Patch(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cập nhật nhân viên / phân quyền (BGH)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(id, dto);
  }

  /**
   * PUT /users/staff/:id: Cập nhật toàn bộ thông tin nhân sự (BGH).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateStaffDto.
   * Chuyển xử lý sang StaffManagementService.update() và trả kết quả cho client.
   * Dùng cùng staffService.update với endpoint PATCH, không có nhánh thay thế toàn bộ riêng.
   */
  @Put(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cập nhật toàn bộ thông tin nhân sự (BGH)' })
  async updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(id, dto);
  }

  /**
   * PATCH /users/staff/:id/restore: Khôi phục tài khoản nhân sự.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang StaffManagementService.restore() và trả kết quả cho client.
   */
  @Patch(':id/restore')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Khôi phục tài khoản nhân sự' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.restore(id);
  }

  /**
   * PATCH /users/staff/:id/status: Đổi trạng thái tài khoản nhân sự.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang StaffManagementService.toggleStatus() và trả kết quả cho client.
   */
  @Patch(':id/status')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Đổi trạng thái tài khoản nhân sự' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.toggleStatus(id);
  }

  /**
   * DELETE /users/staff/:id: Xóa nhân viên (BGH).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang StaffManagementService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Xóa nhân viên (BGH)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.remove(id);
  }
}
