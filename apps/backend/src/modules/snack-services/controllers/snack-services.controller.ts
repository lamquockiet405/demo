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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SnackServicesService } from '../services/snack-services.service';
import { CreateSnackServicePeriodDto } from '../dto/create-snack-service-period.dto';
import { UpdateSnackServiceDto } from '../dto/update-snack-service.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Snack Services Management')
@Controller('snack-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SnackServicesController {
  constructor(private readonly snackService: SnackServicesService) { }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các kỳ dịch vụ ăn xế 17h' })
  async findAll() {
    return this.snackService.findAll();
  }

  @Get('list')
  @ApiOperation({ summary: 'Lấy danh sách rút gọn các kỳ dịch vụ ăn xế' })
  async getList() {
    return this.snackService.findAll();
  }

  @Get('dayboarding')
  @ApiOperation({ summary: 'Lấy dữ liệu tổng hợp dịch vụ bán trú và đăng ký' })
  async getDayboarding() {
    return this.snackService.getDayboardingSummary();
  }

  @Get('roster')
  @ApiOperation({ summary: 'Xem và lọc danh sách phân công phục vụ ăn xế (Snack Service Roster)' })
  @ApiQuery({ name: 'periodId', required: false, description: 'ID đợt đăng ký ăn xế' })
  @ApiQuery({ name: 'classId', required: false, description: 'ID lớp học' })
  @ApiQuery({ name: 'ageGroup', required: false, description: 'Khối lớp (Mẫu giáo, Nhà trẻ,...)' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm theo tên hoặc mã học sinh' })
  @ApiQuery({ name: 'attendanceStatus', required: false, description: 'Trạng thái điểm danh (ALL, PRESENT, ABSENT)' })
  @ApiQuery({ name: 'portionStatus', required: false, description: 'Trạng thái khẩu phần (ALL, PENDING, SERVED, SKIPPED)' })
  @ApiQuery({ name: 'allergyOnly', required: false, description: 'Chỉ học sinh có cảnh báo dị ứng' })
  async getRoster(
    @Query('periodId') periodId?: string,
    @Query('classId') classId?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('search') search?: string,
    @Query('attendanceStatus') attendanceStatus?: string,
    @Query('portionStatus') portionStatus?: string,
    @Query('allergyOnly') allergyOnly?: boolean | string,
  ) {
    return this.snackService.getRoster({
      periodId,
      classId,
      ageGroup,
      search,
      attendanceStatus,
      portionStatus,
      allergyOnly,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết kỳ dịch vụ ăn xế và danh sách trẻ đăng ký' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.snackService.findOne(id);
  }

  @Post('periods')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Tạo mới kỳ đăng ký dịch vụ ăn xế' })
  async createPeriod(@Body() dto: CreateSnackServicePeriodDto) {
    return this.snackService.createPeriod(dto);
  }

  @Post('enrollment')
  @Roles('SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'PARENT')
  @ApiOperation({ summary: 'Đăng ký tham gia dịch vụ ăn xế / bán trú' })
  async registerEnrollment(@Body() body: any) {
    return this.snackService.registerEnrollment(body);
  }

  @Post()
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Tạo mới dịch vụ bán trú' })
  async createService(@Body() dto: any) {
    return this.snackService.createService(dto);
  }

  @Put(':id')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cập nhật thông tin kỳ dịch vụ ăn xế' })
  async updatePeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSnackServiceDto,
  ) {
    return this.snackService.updatePeriod(id, dto);
  }

  @Put('periods/:id/close')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Đóng kỳ đăng ký ăn xế' })
  async closePeriod(@Param('id', ParseIntPipe) id: number) {
    return this.snackService.closePeriod(id);
  }

  @Put('periods/:id/open')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mở lại kỳ đăng ký ăn xế' })
  async openPeriod(@Param('id', ParseIntPipe) id: number) {
    return this.snackService.openPeriod(id);
  }

  @Put('periods/:id/toggle')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Chuyển đổi trạng thái đóng/mở kỳ đăng ký ăn xế' })
  async togglePeriod(@Param('id', ParseIntPipe) id: number) {
    return this.snackService.togglePeriod(id);
  }

  @Delete(':id')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Xóa dịch vụ bán trú' })
  async deleteService(@Param('id', ParseIntPipe) id: number) {
    return this.snackService.deleteService(id);
  }
}
