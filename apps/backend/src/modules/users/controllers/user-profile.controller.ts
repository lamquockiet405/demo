import { Controller, Get, Patch, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserProfileService } from '../services/user-profile.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('User Profile')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly profileService: UserProfileService) {}

  @Get('profile')
  @ApiOperation({ summary: 'UC05 - Xem thông tin cá nhân của tài khoản đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin cá nhân thành công' })
  async getProfile(@CurrentUser('sub') userId: number) {
    return this.profileService.getProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'UC06 - Cập nhật thông tin cá nhân (Họ tên, SĐT, Avatar)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin cá nhân thành công' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    const roles: string[] = (user?.roles || []).map((r: any) =>
      typeof r === 'string' ? r.toUpperCase() : (r.code || '').toUpperCase(),
    );
    const isPrincipal = roles.some((r) =>
      ['PRINCIPAL', 'SCHOOL_MANAGEMENT'].includes(r),
    );
    const hasOtherRole = roles.some((r) =>
      ['NUTRITIONIST', 'TEACHER', 'KITCHEN_STAFF', 'PARENT'].includes(r),
    );
    if (isPrincipal && !hasOtherRole) {
      throw new ForbiddenException(
        'Hiệu trưởng không sử dụng chức năng chỉnh sửa hồ sơ cá nhân mà thực hiện Cấu hình thông tin trường học (Configure School Information)',
      );
    }

    const userId = user?.id || user?.sub;
    return this.profileService.updateProfile(userId, dto);
  }
}
