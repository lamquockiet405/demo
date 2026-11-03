import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveAlertDto {
  @ApiProperty({ example: 'ALT-ALLERGEN-12', description: 'Mã định danh cảnh báo' })
  @IsString()
  @IsNotEmpty()
  alertId: string;

  @ApiProperty({
    example: 'ALLERGEN_CONFLICT',
    description: 'Loại cảnh báo (ALLERGEN_CONFLICT, BROAD_ANOMALY, OVERDUE_PAYMENT, PARENT_COMPLAINT, MEAL_TRAY, POOR_CONSUMPTION, MEDICATION)',
  })
  @IsString()
  @IsNotEmpty()
  alertType: string;

  @ApiProperty({
    example: 'CONFIRMED_SUBSTITUTE_DISH',
    description: 'Hành động xử lý (CONFIRMED_SUBSTITUTE_DISH, VERIFIED_TRAY_AT_TABLE, ACKNOWLEDGED_MEDICATION, DIRECTED_KITCHEN, SENT_PAYMENT_REMINDER, RESOLVED_COMPLAINT)',
  })
  @IsString()
  @IsNotEmpty()
  resolutionAction: string;

  @ApiPropertyOptional({
    example: 'Bếp đã chuẩn bị xong khay ăn riêng dán nhãn xanh: Thịt heo hấp hạt sen thay cho Trứng cuộn phô mai.',
    description: 'Ghi chú xác nhận xử lý',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

