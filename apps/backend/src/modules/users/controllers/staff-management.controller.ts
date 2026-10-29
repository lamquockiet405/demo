import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { StaffManagementService } from '../services/staff-management.service';
import { CreateStaffDto } from '../dto/staff/create-staff.dto';
import { UpdateStaffDto } from '../dto/staff/update-staff.dto';
import { QueryStaffDto } from '../dto/staff/query-staff.dto';

@ApiTags('Staff Management')
@Controller('users/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PRINCIPAL', 'SUPER_ADMIN', 'SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT')
@ApiBearerAuth()
export class StaffManagementController {
  constructor(private readonly staffService: StaffManagementService) {}

  @Get()
  @ApiOperation({ summary: 'UC08 & UC11 - Xem và tìm kiếm/lọc danh sách tài khoản nhân sự' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách nhân sự thành công' })
  getStaffList(@CurrentTenant() tenantId: string, @Query() query: QueryStaffDto) {
    return this.staffService.getStaffList(tenantId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê số lượng nhân sự theo vai trò và trạng thái' })
  getStaffStats(@CurrentTenant() tenantId: string) {
    return this.staffService.getStaffStats(tenantId);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Lấy danh sách vai trò chuyên môn khả dụng trong trường' })
  getAvailableStaffRoles() {
    return this.staffService.getAvailableStaffRoles();
  }

  @Get(':id')
  @ApiOperation({ summary: 'UC08 - Xem thông tin chi tiết tài khoản nhân sự' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết nhân sự thành công' })
  getStaffById(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.staffService.getStaffById(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'UC09 - Tạo mới tài khoản nhân sự và gán vai trò' })
  @ApiResponse({ status: 201, description: 'Tạo tài khoản nhân sự thành công' })
  createStaff(@CurrentTenant() tenantId: string, @Body() createDto: CreateStaffDto) {
    return this.staffService.createStaff(tenantId, createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'UC10 - Cập nhật thông tin và vai trò nhân sự' })
  @ApiResponse({ status: 200, description: 'Cập nhật tài khoản nhân sự thành công' })
  updateStaff(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateStaffDto,
  ) {
    return this.staffService.updateStaff(tenantId, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa mềm tài khoản nhân sự' })
  softDeleteStaff(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
  ) {
    return this.staffService.softDeleteStaff(tenantId, currentUserId, id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Khôi phục tài khoản nhân sự đã xóa mềm' })
  restoreStaff(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.staffService.restoreStaff(tenantId, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Chuyển đổi trạng thái tài khoản nhân sự (ACTIVE/INACTIVE)' })
  toggleStaffStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
  ) {
    return this.staffService.toggleStaffStatus(tenantId, currentUserId, id);
  }
}
