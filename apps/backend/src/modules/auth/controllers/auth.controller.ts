import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { PasswordResetService } from '../services/password-reset.service';
import { LoginDto } from '../dto/login.dto';
import { QuickLoginDto } from '../dto/quick-login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { VerifyResetOtpDto } from '../dto/verify-reset-otp.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

/**
 * Tiếp nhận đăng nhập, làm mới token, tra cứu tài khoản và khôi phục mật khẩu.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * Xác thực, quyền hoặc @Public được khai báo riêng ở các endpoint bên dưới.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  /**
   * GET /auth/tenants: Lấy danh sách các trường mầm non (Công khai).
   * Chuyển xử lý sang AuthService.getTenants() và trả kết quả cho client.
   */
  @Public()
  @Get('tenants')
  @ApiOperation({ summary: 'Lấy danh sách các trường mầm non (Công khai)' })
  async getTenants() {
    return this.authService.getTenants();
  }

  /**
   * POST /auth/login: Đăng nhập tài khoản bằng Email / SĐT + Mật khẩu.
   * @param loginDto Dữ liệu body JSON, kiểu LoginDto.
   * @param tenantIdHeader Giá trị header x-tenant-id (tùy chọn).
   * Chuyển xử lý sang AuthService.login() và trả kết quả cho client.
   * ID trường lấy từ header x-tenant-id, chuyển thành số và dùng 1 nếu giá trị falsy.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập tài khoản bằng Email / SĐT + Mật khẩu' })
  async login(
    @Body() loginDto: LoginDto,
    @Headers('x-tenant-id') tenantIdHeader?: string,
  ) {
    const tenantId = Number(tenantIdHeader) || 1;
    return this.authService.login(loginDto, tenantId);
  }

  /**
   * POST /auth/quick-login: Đăng nhập nhanh theo Role (Chế độ phát triển & demo).
   * @param dto Dữ liệu body JSON, kiểu QuickLoginDto.
   * Chuyển xử lý sang AuthService.quickLogin() và trả kết quả cho client.
   */
  @Public()
  @Post('quick-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập nhanh theo Role (Chế độ phát triển & demo)' })
  async quickLogin(@Body() dto: QuickLoginDto) {
    return this.authService.quickLogin(dto);
  }

  /**
   * POST /auth/refresh: Làm mới Access Token bằng Refresh Token.
   * @param refreshToken Trường refreshToken trong body JSON.
   * Chuyển xử lý sang AuthService.refreshToken() và trả kết quả cho client.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * GET /auth/me: Lấy thông tin tài khoản hiện tại đang đăng nhập.
   * @param userId Trường sub của tài khoản đã xác thực.
   * Chuyển xử lý sang AuthService.getMe() và trả kết quả cho client.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại đang đăng nhập' })
  async getMe(@CurrentUser('sub') userId: number) {
    return this.authService.getMe(userId);
  }

  /**
   * POST /auth/change-password: Đổi mật khẩu tài khoản đang đăng nhập.
   * @param userId Trường sub của tài khoản đã xác thực.
   * @param dto Dữ liệu body JSON, kiểu ChangePasswordDto.
   * Chuyển xử lý sang AuthService.changePassword() và trả kết quả cho client.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu tài khoản đang đăng nhập' })
  async changePassword(
    @CurrentUser('sub') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  /**
   * POST /auth/forgot-password: Gửi yêu cầu khôi phục mật khẩu (Mã OTP gửi về Email).
   * @param dto Dữ liệu body JSON, kiểu ForgotPasswordDto.
   * Chuyển xử lý sang PasswordResetService.forgotPassword() và trả kết quả cho client.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi yêu cầu khôi phục mật khẩu (Mã OTP gửi về Email)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.forgotPassword(dto.email);
  }

  /**
   * POST /auth/verify-reset-otp: Xác thực mã OTP 6 số để nhận Reset Token.
   * @param dto Dữ liệu body JSON, kiểu VerifyResetOtpDto.
   * Chuyển xử lý sang PasswordResetService.verifyResetOtp() và trả kết quả cho client.
   */
  @Public()
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực mã OTP 6 số để nhận Reset Token' })
  async verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.passwordResetService.verifyResetOtp(dto.email, dto.otp);
  }

  /**
   * POST /auth/reset-password: Đặt lại mật khẩu mới bằng Reset Token.
   * @param dto Dữ liệu body JSON, kiểu ResetPasswordDto.
   * Chuyển xử lý sang PasswordResetService.resetPassword() và trả kết quả cho client.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu mới bằng Reset Token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
