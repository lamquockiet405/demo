import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token xác thực đặt lại mật khẩu' })
  @IsNotEmpty({ message: 'Reset token không được để trống' })
  @IsString()
  resetToken: string;

  @ApiProperty({ example: 'NewSecret@2026', description: 'Mật khẩu mới (tối thiểu 8 ký tự)' })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  @IsString()
  newPassword: string;

  @ApiPropertyOptional({ example: 'NewSecret@2026', description: 'Xác nhận mật khẩu mới' })
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
