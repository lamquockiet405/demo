import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentUrlDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Mã bản ghi đăng ký ăn xế (SnackRegistration ID)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  registrationId?: number;

  @ApiPropertyOptional({
    example: 'INV-2026-0001',
    description: 'Mã hóa đơn (hỗ trợ tương thích ngược)',
  })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({
    example: 440000,
    description: 'Số tiền thanh toán (tùy chọn)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({
    example: 'Thanh toan phi an xe tre Tran Minh Khang thang 11',
    description: 'Nội dung thanh toán tiếng Việt không dấu (nếu để trống hệ thống tự sinh chuẩn VNPAY)',
  })
  @IsOptional()
  @IsString()
  orderInfo?: string;
}

