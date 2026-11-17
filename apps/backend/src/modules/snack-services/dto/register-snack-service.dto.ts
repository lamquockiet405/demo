import { IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterSnackServiceDto {
  @ApiProperty({ description: 'ID kỳ đăng ký dịch vụ ăn xế', example: 1 })
  @IsNotEmpty({ message: 'Vui lòng chọn đợt đăng ký ăn xế' })
  @IsNumber({}, { message: 'periodId phải là số' })
  periodId: number;

  @ApiProperty({ description: 'ID học sinh đăng ký', example: 1 })
  @IsNotEmpty({ message: 'Vui lòng chọn học sinh' })
  @IsNumber({}, { message: 'studentId phải là số' })
  studentId: number;

  @ApiPropertyOptional({ description: 'ID phụ huynh (nếu để trống tự động lấy từ quan hệ học sinh hoặc user đăng nhập)', example: 13 })
  @IsOptional()
  @IsNumber()
  parentId?: number;

  @ApiPropertyOptional({ description: 'Xác nhận chấp nhận rủi ro dị ứng thực phẩm', example: false })
  @IsOptional()
  @IsBoolean()
  acceptRisk?: boolean;

  @ApiPropertyOptional({ description: 'Ghi chú chế độ ăn / yêu cầu cho bếp', example: 'Bé không ăn cay' })
  @IsOptional()
  @IsString()
  dietaryNote?: string;

  @ApiPropertyOptional({ description: 'Phương thức thanh toán', example: 'VNPAY', enum: ['VNPAY', 'CASH', 'TRANSFER'] })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Quản lý trường đánh dấu đã thanh toán ngay', example: false })
  @IsOptional()
  @IsBoolean()
  markAsPaid?: boolean;
}

