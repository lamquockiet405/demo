import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SnackServicesService, SnackMenuDayItem } from './snack-services.service';
import { CreateSnackServicePeriodDto } from './dto/create-snack-service-period.dto';
import { UpdateSnackServiceDto } from './dto/update-snack-service.dto';
import { RegisterSnackServiceDto } from './dto/register-snack-service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Snack Services Management')
@Controller('snack-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SnackServicesController {
  constructor(private readonly snackService: SnackServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các kỳ dịch vụ ăn xế 17h (Ẩn thông tin thanh toán với CGDD)' })
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('grade') grade?: string,
  ) {
    return this.snackService.findAll(req.user, { search, status, grade });
  }

  @Get('list')
  @ApiOperation({ summary: 'Lấy danh sách rút gọn các kỳ dịch vụ ăn xế' })
  async getList(@Req() req: any) {
    return this.snackService.findAll(req.user);
  }

  @Get('parent-overview')
  @Roles('PARENT', 'SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'TEACHER')
  @ApiOperation({
    summary:
      'Phụ huynh xem các gói ăn xế đã công bố và Lịch ăn xế (Chỉ trả về lịch ăn xế khi đã đóng tiền PAID)',
  })
  async getParentOverview(@CurrentUser('id') userId?: number) {
    return this.snackService.getParentSnackOverview(userId || 13);
  }

  @Get('dayboarding')
  @ApiOperation({ summary: 'Lấy dữ liệu tổng hợp dịch vụ bán trú và đăng ký' })
  async getDayboarding() {
    return this.snackService.getDayboardingSummary();
  }

  @Get('check-allergy')
  @ApiOperation({ summary: 'Kiểm tra độ an toàn dị ứng của trẻ với thực đơn đợt ăn xế' })
  async checkAllergy(
    @Query('periodId', ParseIntPipe) periodId: number,
    @Query('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.snackService.checkAllergySafety(periodId, studentId);
  }

  @Get('students-available')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'PARENT')
  @ApiOperation({ summary: 'Lấy danh sách học sinh có thể đăng ký đợt ăn xế (Chặn CGDD)' })
  async getStudentsAvailable(@Query('periodId') periodId?: string) {
    return this.snackService.getStudentsAvailable(periodId ? Number(periodId) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết kỳ dịch vụ ăn xế và danh sách trẻ đăng ký (Ẩn với CGDD)' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.snackService.findOne(id, req.user);
  }

  @Post('periods')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Hiệu trưởng / School Manager tạo mới kỳ đăng ký dịch vụ ăn xế' })
  async createPeriod(@Body() dto: CreateSnackServicePeriodDto) {
    return this.snackService.createPeriod(dto);
  }

  @Put(':id/menu-schedule')
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Chuyên gia Dinh dưỡng (CGDD) / Hiệu trưởng lên thực đơn ăn xế cho gói dịch vụ' })
  async updateMenuSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { menuSchedule: SnackMenuDayItem[]; description?: string },
  ) {
    return this.snackService.updateMenuSchedule(id, body);
  }

  @Post('enrollment')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'PARENT')
  @ApiOperation({ summary: 'Đăng ký tham gia dịch vụ ăn xế (Kiểm tra quy tắc dị ứng)' })
  async registerEnrollment(@Body() dto: RegisterSnackServiceDto, @Req() req: any) {
    return this.snackService.registerEnrollment(dto, req.user);
  }

  @Put('registrations/:id/confirm-payment')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Xác nhận thanh toán cho đăng ký ăn xế' })
  async confirmPayment(@Param('id', ParseIntPipe) id: number) {
    return this.snackService.confirmPayment(id);
  }

  @Post()
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Hiệu trưởng tạo mới gói dịch vụ ăn xế' })
  async createService(@Body() dto: any) {
    return this.snackService.createService(dto);
  }

  @Put(':id')
  @Roles('SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Hiệu trưởng cập nhật thông tin kỳ dịch vụ ăn xế' })
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
  @ApiOperation({ summary: 'Công bố / Mở lại kỳ đăng ký ăn xế' })
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
  @ApiOperation({ summary: 'Hiệu trưởng xóa gói dịch vụ ăn xế (Chặn nếu đã có phụ huynh đóng tiền)' })
  async deleteService(@Param('id', ParseIntPipe) id: number) {
    return this.snackService.deleteService(id);
  }
}
