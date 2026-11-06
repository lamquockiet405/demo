import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { GrowthService } from '../services/growth.service';
import { CreateGrowthRecordDto } from '../dto/create-growth-record.dto';
import { QueryGrowthRecordsDto } from '../dto/query-growth-records.dto';

/**
 * Quản lý các lần đo thể chất và dữ liệu theo dõi tăng trưởng của trẻ.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Growth & Health Monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('growth')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  /**
   * GET /growth: Danh sách hồ sơ tăng trưởng & Z-score.
   * @param query Bộ lọc trong query string.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant (tùy chọn).
   * Chuyển xử lý sang GrowthService.findAll() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Danh sách hồ sơ tăng trưởng & Z-score' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST', 'TEACHER', 'PARENT')
  async getRecords(
    @Query() query: QueryGrowthRecordsDto,
    @CurrentTenant() schoolId?: number,
  ) {
    return this.growthService.findAll(query, schoolId);
  }

  /**
   * GET /growth/child/:childId: Lịch sử phát triển thể chất của học sinh.
   * @param childId Giá trị childId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang GrowthService.getChildHistory() và trả kết quả cho client.
   */
  @Get('child/:childId')
  @ApiOperation({ summary: 'Lịch sử phát triển thể chất của học sinh' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST', 'TEACHER', 'PARENT')
  async getChildHistory(@Param('childId', ParseIntPipe) childId: number) {
    return this.growthService.getChildHistory(childId);
  }

  /**
   * GET /growth/class/:classId/overview: Tổng quan tình trạng dinh dưỡng của lớp học.
   * @param classId Giá trị classId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang GrowthService.getClassOverview() và trả kết quả cho client.
   */
  @Get('class/:classId/overview')
  @ApiOperation({ summary: 'Tổng quan tình trạng dinh dưỡng của lớp học' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST', 'TEACHER')
  async getClassOverview(@Param('classId', ParseIntPipe) classId: number) {
    return this.growthService.getClassOverview(classId);
  }

  /**
   * POST /growth: Ghi nhận chỉ số thể chất mới (chiều cao, cân nặng).
   * @param dto Dữ liệu body JSON, kiểu CreateGrowthRecordDto.
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang GrowthService.createRecord() và trả kết quả cho client.
   */
  @Post()
  @ApiOperation({ summary: 'Ghi nhận chỉ số thể chất mới (chiều cao, cân nặng)' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST', 'TEACHER')
  async createRecord(
    @Body() dto: CreateGrowthRecordDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.growthService.createRecord(dto, userId);
  }

  /**
   * PUT /growth/:id: Cập nhật chỉ số thể chất.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param dto Dữ liệu body JSON, kiểu Partial<CreateGrowthRecordDto>.
   * Chuyển xử lý sang GrowthService.updateRecord() và trả kết quả cho client.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật chỉ số thể chất' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST', 'TEACHER')
  async updateRecord(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateGrowthRecordDto>,
  ) {
    return this.growthService.updateRecord(id, dto);
  }

  /**
   * DELETE /growth/:id: Xóa chỉ số thể chất.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang GrowthService.deleteRecord() và trả kết quả cho client.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa chỉ số thể chất' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST')
  async deleteRecord(@Param('id', ParseIntPipe) id: number) {
    return this.growthService.deleteRecord(id);
  }

  /**
   * POST /growth/import: Nhập dữ liệu đo thể chất hàng loạt từ Excel/CSV.
   * @param items Trường items trong body JSON.
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang GrowthService.importRecords() và trả kết quả cho client.
   */
  @Post('import')
  @ApiOperation({ summary: 'Nhập dữ liệu đo thể chất hàng loạt từ Excel/CSV' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST')
  async importRecords(
    @Body('items') items: any[],
    @CurrentUser('id') userId?: number,
  ) {
    return this.growthService.importRecords(items || [], userId);
  }

  /**
   * GET /growth/export: Xuất báo cáo tăng trưởng.
   * @param classId Tham số classId trong query string (tùy chọn).
   * Chuyển xử lý sang GrowthService.exportReport() và trả kết quả cho client.
   */
  @Get('export')
  @ApiOperation({ summary: 'Xuất báo cáo tăng trưởng' })
  @Roles('SCHOOL_MANAGEMENT', 'NUTRITIONIST', 'TEACHER')
  async exportReport(@Query('classId') classId?: string) {
    return this.growthService.exportReport(classId);
  }
}
