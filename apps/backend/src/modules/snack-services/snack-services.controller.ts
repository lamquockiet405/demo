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
import { SnackServicesService } from './snack-services.service';
import { CreateSnackServicePeriodDto } from './dto/create-snack-service-period.dto';
import { UpdateSnackServiceDto } from './dto/update-snack-service.dto';
import { RegisterSnackServiceDto } from './dto/register-snack-service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Snack Services Management')
@Controller('snack-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SnackServicesController {
  constructor(private readonly snackService: SnackServicesService) {}

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

  @Get('check-allergy')
  @ApiOperation({ summary: 'Kiểm tra độ an toàn dị ứng của trẻ với thực đơn đợt ăn xế' })
  async checkAllergy(
    @Query('periodId', ParseIntPipe) periodId: number,
    @Query('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.snackService.checkAllergySafety(periodId, studentId);
  }

  @Get('students-available')
  @ApiOperation({ summary: 'Lấy danh sách học sinh có thể đăng ký đợt ăn xế' })
  async getStudentsAvailable(@Query('periodId') periodId?: string) {
    return this.snackService.getStudentsAvailable(periodId ? Number(periodId) : undefined);
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
