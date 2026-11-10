import { IsOptional, IsString, IsArray, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DishEvaluationItem {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Type(() => Number)
  dishId: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  portionSizeG?: number;

  @ApiPropertyOptional({ example: 'MORNING_SNACK' })
  @IsOptional()
  @IsString()
  mealType?: string;
}

export class EvaluateMenuDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  menuId?: number;

  @ApiPropertyOptional({ example: 'MAU_GIAO', enum: ['NHA_TRE', 'MAU_GIAO'] })
  @IsOptional()
  @IsString()
  ageGroup?: string;

  @ApiPropertyOptional({ example: 'MAU_GIAO' })
  @IsOptional()
  @IsString()
  targetAgeGroup?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  ruleId?: string;

  @ApiPropertyOptional({ example: '2026-10-10' })
  @IsOptional()
  @IsString()
  targetDate?: string;

  @ApiPropertyOptional({ type: [DishEvaluationItem] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DishEvaluationItem)
  dishes?: DishEvaluationItem[];
}
