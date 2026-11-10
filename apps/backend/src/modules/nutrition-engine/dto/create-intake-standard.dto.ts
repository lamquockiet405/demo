import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateIntakeStandardDto {
  @ApiProperty({ description: 'Tên chuẩn định mức', example: 'Định mức dinh dưỡng Mầm non bán trú (3-6 tuổi)' })
  @IsString()
  @IsNotEmpty({ message: 'Tên định mức không được để trống' })
  @MaxLength(200)
  standardName: string;

  @ApiProperty({ description: 'Lứa tuổi áp dụng', example: 'MAU_GIAO' })
  @IsString()
  @IsNotEmpty()
  ageGroup: string;

  @ApiPropertyOptional({ description: 'Giới tính', default: 'ALL', enum: ['MALE', 'FEMALE', 'ALL'] })
  @IsOptional()
  @IsString()
  @IsIn(['MALE', 'FEMALE', 'ALL'])
  gender?: string;

  @ApiPropertyOptional({ description: 'Phạm vi bữa ăn', default: 'DAYBOARDING', enum: ['ALL_DAY', 'DAYBOARDING', 'LUNCH_ONLY'] })
  @IsOptional()
  @IsString()
  @IsIn(['ALL_DAY', 'DAYBOARDING', 'LUNCH_ONLY'])
  mealScope?: string;

  @ApiProperty({ description: 'Năng lượng tối thiểu (Kcal)', example: 615 })
  @IsNumber()
  @Min(0)
  energyKcalMin: number;

  @ApiProperty({ description: 'Năng lượng tối đa (Kcal)', example: 726 })
  @IsNumber()
  @Min(0)
  energyKcalMax: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ Protein tối thiểu (%)', default: 13 })
  @IsOptional()
  @IsNumber()
  proteinRatioMin?: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ Protein tối đa (%)', default: 20 })
  @IsOptional()
  @IsNumber()
  proteinRatioMax?: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ Lipid tối thiểu (%)', default: 25 })
  @IsOptional()
  @IsNumber()
  lipidRatioMin?: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ Lipid tối đa (%)', default: 35 })
  @IsOptional()
  @IsNumber()
  lipidRatioMax?: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ Glucid tối thiểu (%)', default: 52 })
  @IsOptional()
  @IsNumber()
  carbohydrateRatioMin?: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ Glucid tối đa (%)', default: 60 })
  @IsOptional()
  @IsNumber()
  carbohydrateRatioMax?: number;

  @ApiPropertyOptional({ description: 'Chất xơ tối thiểu (g)' })
  @IsOptional()
  @IsNumber()
  fiberGMin?: number | null;

  @ApiPropertyOptional({ description: 'Chất xơ tối đa (g)' })
  @IsOptional()
  @IsNumber()
  fiberGMax?: number | null;

  @ApiPropertyOptional({ description: 'Canxi tối thiểu (mg)', example: 350 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calciumMgMin?: number | null;

  @ApiPropertyOptional({ description: 'Mức hấp thu sắt', default: '10%', enum: ['10%', '15%'] })
  @IsOptional()
  @IsString()
  @IsIn(['10%', '15%'])
  ironAbsorptionRate?: string | null;

  @ApiPropertyOptional({ description: 'Sắt tối thiểu (mg)', example: 4.8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ironMgMin?: number | null;

  @ApiPropertyOptional({ description: 'Mức hấp thu kẽm', default: 'MEDIUM', enum: ['POOR', 'MEDIUM', 'GOOD'] })
  @IsOptional()
  @IsString()
  @IsIn(['POOR', 'MEDIUM', 'GOOD'])
  zincAbsorptionLevel?: string | null;

  @ApiPropertyOptional({ description: 'Kẽm tối thiểu (mg)', example: 3.3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  zincMgMin?: number | null;

  @ApiPropertyOptional({ description: 'Vitamin A tối thiểu (µg RAE)', example: 250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vitaminARaeMcgMin?: number | null;

  @ApiPropertyOptional({ description: 'Trạng thái', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}

