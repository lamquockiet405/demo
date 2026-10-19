import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { UpdateTenantProfileDto } from '../dto/update-tenant-profile.dto';
import { UploadLogoDto } from '../dto/upload-logo.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';

@ApiTags('Tenant Configuration')
@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * UC07: Xem thông tin cấu hình trường học
   * Cho phép Hiệu trưởng, Quản trị viên, Chuyên viên Dinh dưỡng xem
   */
  @Get('profile')
  @Roles('PRINCIPAL', 'SUPER_ADMIN', 'NUTRITIONIST')
  @ApiOperation({ summary: 'UC07 - Xem thông tin cấu hình trường mầm non & pháp lý ATTP' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin cấu hình trường học thành công' })
  async getProfile(@CurrentTenant() tenantId: string) {
    return this.tenantService.getTenantProfile(tenantId);
  }

  /**
   * UC07: Cập nhật thông tin trường học & pháp lý ATTP
   * Chỉ Hiệu trưởng / Ban Giám Hiệu và SuperAdmin được phép chỉnh sửa
   */
  @Patch('profile')
  @Roles('PRINCIPAL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'UC07 - Cập nhật thông tin trường học & pháp lý ATTP' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin cấu hình trường học thành công' })
  async updateProfile(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantProfileDto,
  ) {
    return this.tenantService.updateTenantProfile(tenantId, dto);
  }

  /**
   * UC07: Tải lên Logo trường học với kiểm duyệt định dạng và dung lượng
   * Chỉ Hiệu trưởng / Ban Giám Hiệu được quyền cập nhật nhận diện
   */
  @Post('upload-logo')
  @Roles('PRINCIPAL', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC07 - Tải lên Logo nhận diện trường học (SVG/PNG/JPG <= 2MB)' })
  @ApiResponse({ status: 200, description: 'Tải lên logo thành công' })
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @Body() dto: UploadLogoDto,
  ) {
    return this.tenantService.uploadLogo(tenantId, dto);
  }

  /**
   * UC07: Đồng bộ dữ liệu với Cơ sở dữ liệu ngành của Bộ GD&ĐT
   */
  @Post('sync-education-db')
  @Roles('PRINCIPAL', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC07 - Đồng bộ dữ liệu với CSDL ngành của Bộ GD&ĐT' })
  @ApiResponse({ status: 200, description: 'Đồng bộ dữ liệu thành công' })
  async syncEducationDb(@CurrentTenant() tenantId: string) {
    return this.tenantService.syncEducationDb(tenantId);
  }
}
