import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserProfileService } from '../services/user-profile.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

/**
 * Cho người dùng xem và cập nhật hồ sơ cá nhân của tài khoản đang đăng nhập.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản trước khi thực thi các endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('User Profile')
@Controller('users/profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly profileService: UserProfileService) {}

  /**
   * GET /users/profile: Xem thông tin cá nhân của tài khoản đang đăng nhập.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang UserProfileService.getProfile() và trả kết quả cho client.
   */
  @Get()
  @ApiOperation({ summary: 'Xem thông tin cá nhân của tài khoản đang đăng nhập' })
  async getProfile(@CurrentUser('sub') userId: number) {
    return this.profileService.getProfile(userId);
  }

  /**
   * PATCH /users/profile: Cập nhật thông tin cá nhân (Họ tên, SĐT, Avatar).
   * @param userId Trường sub của tài khoản đã xác thực.
   * @param dto Dữ liệu body JSON, kiểu UpdateProfileDto.
   * Chuyển xử lý sang UserProfileService.updateProfile() và trả kết quả cho client.
   */
  @Patch()
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân (Họ tên, SĐT, Avatar)' })
  async updateProfile(
    @CurrentUser('sub') userId: number,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }
}
