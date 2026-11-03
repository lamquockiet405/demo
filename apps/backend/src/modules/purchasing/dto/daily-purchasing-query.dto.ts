import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyPurchasingQueryDto {
  @ApiPropertyOptional({ description: 'Ngày cần tính toán đi chợ (YYYY-MM-DD), mặc định là hôm nay' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ca ăn: ALL, LUNCH, AFTERNOON_SNACK, MORNING_SNACK', default: 'ALL' })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({ description: 'Tùy chỉnh số lượng suất ăn (nếu không truyền sẽ lấy tổng số học sinh các lớp)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  customPortions?: number;

  @ApiPropertyOptional({ description: 'ID thực đơn tuần cụ thể (tùy chọn)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  menuId?: number;
}

