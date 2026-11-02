import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ChildAlertsService } from '../services/child-alerts.service';
import { QueryChildAlertsDto } from '../dto/query-child-alerts.dto';
import { ResolveAlertDto } from '../dto/resolve-alert.dto';

@ApiTags('UC93: Role-Specific Child Alerts Summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('child-alerts')
export class ChildAlertsController {
  constructor(private readonly alertsService: ChildAlertsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Xem tổng hợp cảnh báo trẻ em tự động phân tầng theo Role (UC93 Core Endpoint)',
    description: 'Hệ thống tự động kiểm tra Role của người dùng để trả về chính xác Scope tương ứng (Data Privacy & Child Safety).',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER', 'PARENT')
  async getRoleScopedSummary(
    @CurrentUser() user: any,
    @Query() query: QueryChildAlertsDto,
  ) {
    return this.alertsService.getRoleScopedAlertsSummary(user, query);
  }

  @Get('school-manager')
  @ApiOperation({
    summary: 'Cảnh báo cấp trường dành cho Ban Giám Hiệu (School Manager Scope)',
    description: 'Bao gồm: Xung đột dị ứng chưa xử lý trước 09h00, ngộ độc/bất thường diện rộng (>30% bỏ ăn), nợ phí bán trú, khiếu nại phụ huynh.',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getSchoolManagerAlerts(
    @CurrentTenant() schoolId?: number,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getSchoolManagerAlerts(schoolId, query);
  }

  @Get('nutritionist')
  @ApiOperation({
    summary: 'Cảnh báo an toàn thực phẩm & lâm sàng cho Chuyên viên Dinh dưỡng (Nutritionist Scope)',
    description: 'Bao gồm: Trùng lặp chất dị ứng thực đơn ngày mai, trẻ sụt cân liên tiếp 2 kỳ (Z < -2 SD), thiếu hụt vi chất Thông tư 28.',
  })
  @Roles('NUTRITIONIST', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getNutritionistAlerts(
    @CurrentTenant() schoolId?: number,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getNutritionistAlerts(schoolId, query);
  }

  @Get('teacher')
  @ApiOperation({
    summary: 'Cảnh báo điều hành lớp học & chăm sóc trực tiếp cho Giáo viên (Teacher Scope)',
    description: 'Bao gồm: Khay ăn riêng dán nhãn xanh tại bàn cho bé dị ứng, học sinh ăn kém 2 ngày (<30%), đơn thuốc & dặn dò y tế phụ huynh.',
  })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @Roles('TEACHER', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getTeacherAlerts(
    @CurrentUser('id') teacherUserId?: number,
    @Query('classId') classId?: string,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getTeacherAlerts(teacherUserId, classId, query);
  }

  @Get('parent')
  @ApiOperation({
    summary: 'Thông báo & cảnh báo cá nhân hóa cho con dành cho Phụ huynh (Parent Scope)',
    description: 'Bao gồm: Món ăn thay thế an toàn hôm nay, báo cáo lượng ăn trưa & xế sau giờ ăn, nhắc lịch cân đo và lời khuyên y tế.',
  })
  @ApiQuery({ name: 'studentId', required: false, type: String })
  @Roles('PARENT', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getParentAlerts(
    @CurrentUser('id') parentUserId?: number,
    @Query('studentId') studentId?: string,
    @Query() query?: QueryChildAlertsDto,
  ) {
    return this.alertsService.getParentAlerts(parentUserId, studentId, query);
  }

  @Post('resolve')
  @ApiOperation({
    summary: 'Xác nhận xử lý / đóng cảnh báo (Acknowledge / Resolve Alert)',
    description: 'Bếp xác nhận món thay thế, Giáo viên xác nhận khay ăn tại bàn, School Manager xử lý khiếu nại...',
  })
  @Roles('SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST', 'TEACHER')
  async resolveAlert(
    @Body() dto: ResolveAlertDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.alertsService.resolveOrAcknowledgeAlert(dto, userId);
  }
}

