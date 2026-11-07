import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MEAL_DISTRIBUTION_AGE_GROUPS = ['NHA_TRE', 'MAU_GIAO'] as const;
export const MEAL_DISTRIBUTION_MEAL_TYPES = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'LATE_SNACK'] as const;

export class CreateMealDistributionDto {
  @ApiProperty({ description: 'Nhóm tuổi', enum: MEAL_DISTRIBUTION_AGE_GROUPS, example: 'MAU_GIAO' })
  @IsString()
  @IsIn(MEAL_DISTRIBUTION_AGE_GROUPS as unknown as string[])
  ageGroup: string;

  @ApiProperty({ description: 'Bữa ăn', enum: MEAL_DISTRIBUTION_MEAL_TYPES, example: 'LUNCH' })
  @IsString()
  @IsIn(MEAL_DISTRIBUTION_MEAL_TYPES as unknown as string[])
  mealType: string;

  @ApiProperty({ description: 'Tên bữa hiển thị', example: 'Bữa trưa chính' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mealLabel: string;

  @ApiPropertyOptional({ description: 'Giờ ăn (HH:MM)', example: '11:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ ăn phải có dạng HH:MM' })
  mealTime?: string | null;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  displayOrder?: number;

  @ApiProperty({ description: '% năng lượng cả ngày tối thiểu', example: 30 })
  @IsNumber()
  @Min(0)
  @Max(100)
  energyPctMin: number;

  @ApiProperty({ description: '% năng lượng cả ngày tối đa', example: 35 })
  @IsNumber()
  @Min(0)
  @Max(100)
  energyPctMax: number;

  @ApiPropertyOptional({ description: '% nhu cầu nước cả ngày tối thiểu', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  waterPctMin?: number | null;

  @ApiPropertyOptional({ description: '% nhu cầu nước cả ngày tối đa', example: 35 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  waterPctMax?: number | null;

  @ApiPropertyOptional({ description: 'Lượng nước tối thiểu (ml)', example: 450 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waterMlMin?: number | null;

  @ApiPropertyOptional({ description: 'Lượng nước tối đa (ml)', example: 600 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waterMlMax?: number | null;

  @ApiPropertyOptional({ description: 'Trạng thái', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class UpdateMealDistributionDto extends PartialType(CreateMealDistributionDto) {}

