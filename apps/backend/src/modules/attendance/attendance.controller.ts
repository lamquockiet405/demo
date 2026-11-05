import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './services/attendance.service';
import { MealCoordinationService } from './services/meal-coordination.service';
import { SnackRosterService } from './services/snack-roster.service';
import { AttendanceHistoryService } from './services/attendance-history.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { UpdateMealAttendanceDto } from './dto/update-meal-attendance.dto';
import { MealEvaluationQueryDto } from './dto/meal-evaluation-query.dto';
import { UpdateMealEvaluationDto } from './dto/update-meal-evaluation.dto';
import { AttendanceHistoryFilterDto } from './dto/attendance-history-filter.dto';
import { MealCoordinationDto } from './dto/meal-coordination.dto';
import { SnackRosterQueryDto } from './dto/snack-roster-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Meal Attendance & Evaluations')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly noteService: MealCoordinationService,
    private readonly snackRosterService: SnackRosterService,
    private readonly historyService: AttendanceHistoryService,
  ) {}

  @Get('attendance/classes')
  @ApiOperation({ summary: 'Lấy danh sách các lớp để giáo viên chọn điểm danh' })
  async getClasses() {
    return this.attendanceService.getClasses();
  }

  @Get('attendance/school-summary')
  @ApiOperation({ summary: 'Tổng hợp sĩ số toàn trường trong ngày' })
  async getSchoolSummary(@Query('date') date?: string) {
    return this.attendanceService.getSchoolHeadcountSummary(date);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Lấy danh sách điểm danh bữa ăn của lớp' })
  async getAttendanceList(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.getAttendanceList(query);
  }

  @Put('attendance/child/:childId')
  @ApiOperation({ summary: 'Cập nhật điểm danh ăn bán trú cho 1 học sinh' })
  async updateChildAttendance(
    @Param('childId', ParseIntPipe) childId: number,
    @Body() dto: UpdateMealAttendanceDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.updateChildAttendance(childId, dto, userId);
  }

  @Post('attendance/mark-all')
  @ApiOperation({ summary: 'Điểm danh nhanh có mặt ăn toàn bộ cả lớp' })
  async markAllPresent(
    @Body() body: { classId: string; date: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.markAllPresent(body, userId);
  }

  @Post('attendance/sync-morning')
  @ApiOperation({ summary: 'Đồng bộ sĩ số từ điểm danh đón trẻ buổi sáng' })
  async syncMorning(
    @Body() body: { classId: string; date: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.syncFromMorning(body, userId);
  }

  @Post('attendance/lock-kitchen')
  @ApiOperation({ summary: 'Khóa / Mở khóa sĩ số chốt số suất ăn gửi xuống bếp' })
  async lockKitchen(@Body() body: { classId: string; date: string; notes?: string; isLocked?: boolean }) {
    return this.attendanceService.lockAndSendToKitchen(body);
  }

  @Get('attendance/evaluation')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá mức độ ăn sau bữa' })
  async getEvaluationList(@Query() query: MealEvaluationQueryDto) {
    return this.attendanceService.getEvaluationList(query);
  }

  @Put('attendance/evaluation/child/:childId')
  @ApiOperation({ summary: 'Đánh giá mức độ ăn của 1 trẻ (FULL, PARTIAL, NONE)' })
  async updateChildEvaluation(
    @Param('childId', ParseIntPipe) childId: number,
    @Body() dto: UpdateMealEvaluationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.updateChildEvaluation(childId, dto, userId);
  }

  @Post('attendance/evaluation/batch')
  @ApiOperation({ summary: 'Cập nhật hàng loạt mức độ ăn cho lớp' })
  async batchUpdateEvaluation(
    @Body() body: { classId: string; date: string; portionConsumed: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.batchUpdatePortion(body, userId);
  }

  @Put('attendance/evaluation/sensory')
  @ApiOperation({ summary: 'Lưu đánh giá cảm quan chất lượng món ăn của giáo viên' })
  async updateSensory(@Body() body: any) {
    return this.attendanceService.updateSensoryEvaluation(body);
  }

  @Post('attendance/evaluation/lock')
  @ApiOperation({ summary: 'Khóa và hoàn tất đánh giá bữa ăn' })
  async lockEvaluation(@Body() body: any) {
    return this.attendanceService.lockAndSendEvaluation(body);
  }

  @Get('attendance/history')
  @ApiOperation({ summary: 'Xem và lọc lịch sử điểm danh và sức ăn' })
  async getHistory(@Query() query: AttendanceHistoryFilterDto) {
    return this.historyService.getHistoryList(query);
  }

  @Get('attendance/kitchen-kds')
  @ApiOperation({ summary: 'Lấy dữ liệu khẩu phần thời gian thực cho màn hình bếp (KDS)' })
  async getKitchenKds(@Query('date') date: string | undefined, @CurrentUser() actor: any) {
    return this.attendanceService.getKitchenKdsData(date, Number(actor.tenantId) || 1);
  }

  @Get('attendance/coordination-notes')
  @ApiOperation({ summary: 'Lấy danh sách ghi chú phối hợp giữa GV và Bếp' })
  async getNotes(@Query() query: any) {
    return this.noteService.findAll(query);
  }

  @Post('attendance/coordination-notes')
  @ApiOperation({ summary: 'Tạo ghi chú phối hợp giữa GV và Bếp' })
  async createNote(
    @Body() dto: any,
    @CurrentUser('sub') userId: number,
  ) {
    return this.noteService.create(dto, userId);
  }

  @Put('attendance/coordination-notes/:id')
  @ApiOperation({ summary: 'Cập nhật ghi chú phối hợp' })
  async updateNote(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.noteService.update(id, body);
  }

  @Post('attendance/coordination-notes/:id/acknowledge')
  @ApiOperation({ summary: 'Tiếp nhận xử lý ghi chú phối hợp' })
  async acknowledgeNote(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.noteService.acknowledge(id, body);
  }

  @Post('attendance/coordination-notes/:id/resolve')
  @ApiOperation({ summary: 'Đánh dấu hoàn tất xử lý suất ăn' })
  async resolveNote(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.noteService.resolve(id, body);
  }

  @Delete('attendance/coordination-notes/:id')
  @ApiOperation({ summary: 'Xóa ghi chú phối hợp' })
  async deleteNote(@Param('id') id: string) {
    return this.noteService.delete(id);
  }

  @Get('snack-roster')
  @ApiOperation({
    summary:
      'Lấy danh sách trẻ đã đóng tiền ăn xế chiều 17h để Giáo viên điểm danh & gửi Bếp (Chặn CGDD)',
  })
  async getSnackRoster(@Query() query: SnackRosterQueryDto, @Req() req?: any) {
    return this.snackRosterService.findAll(query, req?.user);
  }

  @Put('snack-roster/:studentId/attendance')
  @ApiOperation({ summary: 'Giáo viên điểm danh ăn xế cho trẻ đã đóng tiền (PAID)' })
  async markSnackAttendance(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() body: { date?: string; isAttended: boolean; note?: string },
    @CurrentUser('sub') userId?: number,
  ) {
    return this.snackRosterService.markSnackAttendance(studentId, body, userId);
  }

  @Post('snack-roster/dispatch-kitchen')
  @ApiOperation({ summary: 'Giáo viên chốt và gửi danh sách trẻ đã đóng tiền ăn xế xuống Bếp' })
  async dispatchSnackRosterToKitchen(
    @Body() body: { classId?: string; date?: string; notes?: string },
    @CurrentUser('sub') userId?: number,
  ) {
    return this.snackRosterService.dispatchSnackRosterToKitchen(body, userId);
  }

  @Get('snack-roster/kitchen-portions')
  @ApiOperation({
    summary: 'Nhân viên Bếp nhận danh sách khẩu phần ăn xế từ Giáo viên gửi xuống (Chỉ trẻ đã đóng tiền)',
  })
  async getKitchenSnackPortions(@Query('date') date?: string) {
    return this.snackRosterService.getKitchenSnackPortions(date);
  }
}
