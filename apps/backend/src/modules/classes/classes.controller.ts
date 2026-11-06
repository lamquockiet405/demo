import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { FilterClassDto } from './dto/filter-class.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Quản lý lớp học và việc gán hoặc đưa học sinh ra khỏi lớp.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Classes Management')
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /**
   * GET /classes: Lấy danh sách các lớp học có đếm số trẻ và cảnh báo dị ứng.
   * @param filter Bộ lọc trong query string.
   * Chuyển xử lý sang ClassesService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các lớp học có đếm số trẻ và cảnh báo dị ứng' })
  async findAll(@Query() filter: FilterClassDto) {
    return this.classesService.findAll(filter);
  }

  /**
   * GET /classes/:id: Chi tiết lớp học và danh sách học sinh.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang ClassesService.findOne() và trả kết quả cho client.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết lớp học và danh sách học sinh' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.classesService.findOne(id);
  }

  /**
   * POST /classes: Tạo lớp học mới (BGH).
   * @param dto Dữ liệu body JSON, kiểu CreateClassDto.
   * Chuyển xử lý sang ClassesService.create() và trả kết quả cho client.
   */
  @Post()
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Tạo lớp học mới (BGH)' })
  async create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  /**
   * PATCH /classes/:id: Cập nhật thông tin lớp học (BGH).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateClassDto.
   * Chuyển xử lý sang ClassesService.update() và trả kết quả cho client.
   */
  @Patch(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cập nhật thông tin lớp học (BGH)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(id, dto);
  }

  /**
   * DELETE /classes/:id: Xóa lớp học (BGH).
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang ClassesService.remove() và trả kết quả cho client.
   */
  @Delete(':id')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Xóa lớp học (BGH)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.classesService.remove(id);
  }

  /**
   * GET /classes/:classId/students: Lấy danh sách học sinh của một lớp.
   * @param classId Giá trị classId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang ClassesService.getStudents() và trả kết quả cho client.
   */
  @Get(':classId/students')
  @ApiOperation({ summary: 'Lấy danh sách học sinh của một lớp' })
  async getStudents(@Param('classId', ParseIntPipe) classId: number) {
    return this.classesService.getStudents(classId);
  }

  /**
   * POST /classes/:classId/students: Thêm học sinh vào lớp học.
   * @param classId Giá trị classId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param childIds Trường childIds trong body JSON.
   * Chuyển xử lý sang ClassesService.addStudents() và trả kết quả cho client.
   */
  @Post(':classId/students')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Thêm học sinh vào lớp học' })
  async addStudents(
    @Param('classId', ParseIntPipe) classId: number,
    @Body('childIds') childIds: number[],
  ) {
    return this.classesService.addStudents(classId, childIds);
  }

  /**
   * DELETE /classes/:classId/students/:childId: Xóa học sinh khỏi lớp học.
   * @param classId Giá trị classId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param childId Giá trị childId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang ClassesService.removeStudent() và trả kết quả cho client.
   */
  @Delete(':classId/students/:childId')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Xóa học sinh khỏi lớp học' })
  async removeStudent(
    @Param('classId', ParseIntPipe) classId: number,
    @Param('childId', ParseIntPipe) childId: number,
  ) {
    return this.classesService.removeStudent(classId, childId);
  }
}
