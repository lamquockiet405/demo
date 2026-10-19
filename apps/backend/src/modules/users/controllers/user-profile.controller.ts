import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
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
    @CurrentUser('sub') userId: number,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }
}
