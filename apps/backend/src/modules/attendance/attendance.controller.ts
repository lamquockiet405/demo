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

/**
 * Quản lý điểm danh ăn, đánh giá sau bữa và phối hợp giữa giáo viên với bếp.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản trước khi thực thi các endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
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

  /**
   * GET /attendance/classes: Lấy danh sách các lớp để giáo viên chọn điểm danh.
   * Chuyển xử lý sang AttendanceService.getClasses() và trả kết quả cho client.
   */
  @Get('attendance/classes')
  @ApiOperation({ summary: 'Lấy danh sách các lớp để giáo viên chọn điểm danh' })
  async getClasses() {
    return this.attendanceService.getClasses();
  }

  /**
   * GET /attendance/school-summary: Tổng hợp sĩ số toàn trường trong ngày.
   * @param date Tham số date trong query string (tùy chọn).
   * Chuyển xử lý sang AttendanceService.getSchoolHeadcountSummary() và trả kết quả cho client.
   */
  @Get('attendance/school-summary')
  @ApiOperation({ summary: 'Tổng hợp sĩ số toàn trường trong ngày' })
  async getSchoolSummary(@Query('date') date?: string) {
    return this.attendanceService.getSchoolHeadcountSummary(date);
  }

  /**
   * GET /attendance: Lấy danh sách điểm danh bữa ăn của lớp.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang AttendanceService.getAttendanceList() và trả kết quả cho client.
   */
  @Get('attendance')
  @ApiOperation({ summary: 'Lấy danh sách điểm danh bữa ăn của lớp' })
  async getAttendanceList(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.getAttendanceList(query);
  }

  /**
   * PUT /attendance/child/:childId: Cập nhật điểm danh ăn bán trú cho 1 học sinh.
   * @param childId Giá trị childId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateMealAttendanceDto.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang AttendanceService.updateChildAttendance() và trả kết quả cho client.
   */
  @Put('attendance/child/:childId')
  @ApiOperation({ summary: 'Cập nhật điểm danh ăn bán trú cho 1 học sinh' })
  async updateChildAttendance(
    @Param('childId', ParseIntPipe) childId: number,
    @Body() dto: UpdateMealAttendanceDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.updateChildAttendance(childId, dto, userId);
  }

  /**
   * POST /attendance/mark-all: Điểm danh nhanh có mặt ăn toàn bộ cả lớp.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang AttendanceService.markAllPresent() và trả kết quả cho client.
   */
  @Post('attendance/mark-all')
  @ApiOperation({ summary: 'Điểm danh nhanh có mặt ăn toàn bộ cả lớp' })
  async markAllPresent(
    @Body() body: { classId: string; date: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.markAllPresent(body, userId);
  }

  /**
   * POST /attendance/sync-morning: Đồng bộ sĩ số từ điểm danh đón trẻ buổi sáng.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang AttendanceService.syncFromMorning() và trả kết quả cho client.
   */
  @Post('attendance/sync-morning')
  @ApiOperation({ summary: 'Đồng bộ sĩ số từ điểm danh đón trẻ buổi sáng' })
  async syncMorning(
    @Body() body: { classId: string; date: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.syncFromMorning(body, userId);
  }

  /**
   * POST /attendance/lock-kitchen: Khóa / Mở khóa sĩ số chốt số suất ăn gửi xuống bếp.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang AttendanceService.lockAndSendToKitchen() và trả kết quả cho client.
   */
  @Post('attendance/lock-kitchen')
  @ApiOperation({ summary: 'Khóa / Mở khóa sĩ số chốt số suất ăn gửi xuống bếp' })
  async lockKitchen(@Body() body: { classId: string; date: string; notes?: string; isLocked?: boolean }) {
    return this.attendanceService.lockAndSendToKitchen(body);
  }

  /**
   * POST /attendance/kitchen/status: Cập nhật trạng thái chế biến / chia khay / xuất khay của nhà bếp.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang AttendanceService.updateKitchenStatus() và trả kết quả cho client.
   */
  @Post('attendance/kitchen/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái chế biến / chia khay / xuất khay của nhà bếp' })
  async updateKitchenStatus(
    @Body() body: { classId: string; status: string; date?: string; actorName?: string },
  ) {
    return this.attendanceService.updateKitchenStatus(body);
  }

  /**
   * GET /attendance/evaluation: Lấy danh sách đánh giá mức độ ăn sau bữa.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang AttendanceService.getEvaluationList() và trả kết quả cho client.
   */
  @Get('attendance/evaluation')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá mức độ ăn sau bữa' })
  async getEvaluationList(@Query() query: MealEvaluationQueryDto) {
    return this.attendanceService.getEvaluationList(query);
  }

  /**
   * PUT /attendance/evaluation/child/:childId: Đánh giá mức độ ăn của 1 trẻ (FULL, PARTIAL, NONE).
   * @param childId Giá trị childId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu UpdateMealEvaluationDto.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang AttendanceService.updateChildEvaluation() và trả kết quả cho client.
   */
  @Put('attendance/evaluation/child/:childId')
  @ApiOperation({ summary: 'Đánh giá mức độ ăn của 1 trẻ (FULL, PARTIAL, NONE)' })
  async updateChildEvaluation(
    @Param('childId', ParseIntPipe) childId: number,
    @Body() dto: UpdateMealEvaluationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.updateChildEvaluation(childId, dto, userId);
  }

  /**
   * POST /attendance/evaluation/batch: Cập nhật hàng loạt mức độ ăn cho lớp.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang AttendanceService.batchUpdatePortion() và trả kết quả cho client.
   */
  @Post('attendance/evaluation/batch')
  @ApiOperation({ summary: 'Cập nhật hàng loạt mức độ ăn cho lớp' })
  async batchUpdateEvaluation(
    @Body() body: { classId: string; date: string; portionConsumed: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.attendanceService.batchUpdatePortion(body, userId);
  }

  /**
   * PUT /attendance/evaluation/sensory: Lưu đánh giá cảm quan chất lượng món ăn của giáo viên.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang AttendanceService.updateSensoryEvaluation() và trả kết quả cho client.
   */
  @Put('attendance/evaluation/sensory')
  @ApiOperation({ summary: 'Lưu đánh giá cảm quan chất lượng món ăn của giáo viên' })
  async updateSensory(@Body() body: any) {
    return this.attendanceService.updateSensoryEvaluation(body);
  }

  /**
   * POST /attendance/evaluation/lock: Khóa và hoàn tất đánh giá bữa ăn.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang AttendanceService.lockAndSendEvaluation() và trả kết quả cho client.
   */
  @Post('attendance/evaluation/lock')
  @ApiOperation({ summary: 'Khóa và hoàn tất đánh giá bữa ăn' })
  async lockEvaluation(@Body() body: any) {
    return this.attendanceService.lockAndSendEvaluation(body);
  }

  /**
   * GET /attendance/history: Xem và lọc lịch sử điểm danh và sức ăn.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang AttendanceHistoryService.getHistoryList() và trả kết quả cho client.
   */
  @Get('attendance/history')
  @ApiOperation({ summary: 'Xem và lọc lịch sử điểm danh và sức ăn' })
  async getHistory(@Query() query: AttendanceHistoryFilterDto) {
    return this.historyService.getHistoryList(query);
  }

  /**
   * GET /attendance/kitchen-kds: Lấy dữ liệu khẩu phần thời gian thực cho màn hình bếp (KDS).
   * @param date Tham số date trong query string.
   * @param actor Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang AttendanceService.getKitchenKdsData() và trả kết quả cho client.
   */
  @Get('attendance/kitchen-kds')
  @ApiOperation({ summary: 'Lấy dữ liệu khẩu phần thời gian thực cho màn hình bếp (KDS)' })
  async getKitchenKds(@Query('date') date: string | undefined, @CurrentUser() actor: any) {
    return this.attendanceService.getKitchenKdsData(date, Number(actor.tenantId) || 1);
  }

  /**
   * GET /attendance/coordination-notes: Lấy danh sách ghi chú phối hợp giữa GV và Bếp.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang MealCoordinationService.findAll() và trả kết quả cho client.
   */
  @Get('attendance/coordination-notes')
  @ApiOperation({ summary: 'Lấy danh sách ghi chú phối hợp giữa GV và Bếp' })
  async getNotes(@Query() query: any) {
    return this.noteService.findAll(query);
  }

  /**
   * POST /attendance/coordination-notes: Tạo ghi chú phối hợp giữa GV và Bếp.
   * @param dto Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang MealCoordinationService.create() và trả kết quả cho client.
   */
  @Post('attendance/coordination-notes')
  @ApiOperation({ summary: 'Tạo ghi chú phối hợp giữa GV và Bếp' })
  async createNote(
    @Body() dto: any,
    @CurrentUser('sub') userId: number,
  ) {
    return this.noteService.create(dto, userId);
  }

  /**
   * PUT /attendance/coordination-notes/:id: Cập nhật ghi chú phối hợp.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang MealCoordinationService.update() và trả kết quả cho client.
   */
  @Put('attendance/coordination-notes/:id')
  @ApiOperation({ summary: 'Cập nhật ghi chú phối hợp' })
  async updateNote(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.noteService.update(id, body);
  }

  /**
   * POST /attendance/coordination-notes/:id/acknowledge: Tiếp nhận xử lý ghi chú phối hợp.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang MealCoordinationService.acknowledge() và trả kết quả cho client.
   */
  @Post('attendance/coordination-notes/:id/acknowledge')
  @ApiOperation({ summary: 'Tiếp nhận xử lý ghi chú phối hợp' })
  async acknowledgeNote(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.noteService.acknowledge(id, body);
  }

  /**
   * POST /attendance/coordination-notes/:id/resolve: Đánh dấu hoàn tất xử lý suất ăn.
   * @param id Giá trị id trên URL.
   * @param body Dữ liệu body JSON.
   * Chuyển xử lý sang MealCoordinationService.resolve() và trả kết quả cho client.
   */
  @Post('attendance/coordination-notes/:id/resolve')
  @ApiOperation({ summary: 'Đánh dấu hoàn tất xử lý suất ăn' })
  async resolveNote(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.noteService.resolve(id, body);
  }

  /**
   * DELETE /attendance/coordination-notes/:id: Xóa ghi chú phối hợp.
   * @param id Giá trị id trên URL.
   * Chuyển xử lý sang MealCoordinationService.delete() và trả kết quả cho client.
   */
  @Delete('attendance/coordination-notes/:id')
  @ApiOperation({ summary: 'Xóa ghi chú phối hợp' })
  async deleteNote(@Param('id') id: string) {
    return this.noteService.delete(id);
  }

  /**
   * GET /snack-roster: Lấy danh sách trẻ đã đóng tiền ăn xế chiều 17h để Giáo viên điểm danh & gửi Bếp (Chặn CGDD).
   * @param query Bộ lọc trong query string.
   * @param req HTTP request để đọc thông tin người dùng, header hoặc địa chỉ IP (tùy chọn).
   * Chuyển xử lý sang SnackRosterService.findAll() và trả kết quả cho client.
   */
  @Get('snack-roster')
  @ApiOperation({
    summary:
      'Lấy danh sách trẻ đã đóng tiền ăn xế chiều 17h để Giáo viên điểm danh & gửi Bếp (Chặn CGDD)',
  })
  async getSnackRoster(@Query() query: SnackRosterQueryDto, @Req() req?: any) {
    return this.snackRosterService.findAll(query, req?.user);
  }

  /**
   * PUT /snack-roster/:studentId/attendance: Giáo viên điểm danh ăn xế cho trẻ đã đóng tiền (PAID).
   * @param studentId Giá trị studentId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang SnackRosterService.markSnackAttendance() và trả kết quả cho client.
   */
  @Put('snack-roster/:studentId/attendance')
  @ApiOperation({ summary: 'Giáo viên điểm danh ăn xế cho trẻ đã đóng tiền (PAID)' })
  async markSnackAttendance(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() body: { date?: string; isAttended: boolean; note?: string },
    @CurrentUser('sub') userId?: number,
  ) {
    return this.snackRosterService.markSnackAttendance(studentId, body, userId);
  }

  /**
   * POST /snack-roster/dispatch-kitchen: Giáo viên chốt và gửi danh sách trẻ đã đóng tiền ăn xế xuống Bếp.
   * @param body Dữ liệu body JSON.
   * @param userId Trường sub của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang SnackRosterService.dispatchSnackRosterToKitchen() và trả kết quả cho client.
   */
  @Post('snack-roster/dispatch-kitchen')
  @ApiOperation({ summary: 'Giáo viên chốt và gửi danh sách trẻ đã đóng tiền ăn xế xuống Bếp' })
  async dispatchSnackRosterToKitchen(
    @Body() body: { classId?: string; date?: string; notes?: string },
    @CurrentUser('sub') userId?: number,
  ) {
    return this.snackRosterService.dispatchSnackRosterToKitchen(body, userId);
  }

  /**
   * GET /snack-roster/kitchen-portions: Nhân viên Bếp nhận danh sách khẩu phần ăn xế từ Giáo viên gửi xuống (Chỉ trẻ đã đóng tiền).
   * @param date Tham số date trong query string (tùy chọn).
   * Chuyển xử lý sang SnackRosterService.getKitchenSnackPortions() và trả kết quả cho client.
   */
  @Get('snack-roster/kitchen-portions')
  @ApiOperation({
    summary: 'Nhân viên Bếp nhận danh sách khẩu phần ăn xế từ Giáo viên gửi xuống (Chỉ trẻ đã đóng tiền)',
  })
  async getKitchenSnackPortions(@Query('date') date?: string) {
    return this.snackRosterService.getKitchenSnackPortions(date);
  }
}
