import { IsOptional, IsString, IsNumber, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdjustDishDto {
  @ApiPropertyOptional({ description: 'ID ô món gốc trong phiên bản thực đơn hiện tại' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  menuDishId?: number;

  @ApiPropertyOptional({ example: 2, description: 'Thứ trong tuần: 1..7 hoặc 2..6' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: 'LUNCH', enum: ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'LATE_SNACK'] })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({ example: 'LUNCH' })
  @IsOptional()
  @IsString()
  mealTime?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  oldDishId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dishId?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  newDishId?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  substituteDishId?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  portionSizeG?: number;

  @ApiPropertyOptional({ example: 'Ghi chú chế độ ăn riêng' })
  @IsOptional()
  @IsString()
  specialDietNotes?: string;

  @ApiPropertyOptional({ example: true, description: 'Giữ nguyên món ăn gốc cho trẻ bình thường khi thêm món thay thế' })
  @IsOptional()
  @IsBoolean()
  keepOriginalDish?: boolean;
}
