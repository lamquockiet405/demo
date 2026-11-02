import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsIn,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateFrequencyRuleDto {
  @ApiProperty({ description: 'Tên quy tắc tần suất', example: 'Món chính bữa trưa tối đa 2 lần/chu kỳ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên quy tắc không được để trống' })
  @MaxLength(200)
  ruleName: string;

  @ApiProperty({ description: 'Khung giờ bữa ăn', example: 'LUNCH', enum: ['MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'ALL'] })
  @IsString()
  @IsIn(['MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'ALL'], { message: 'Khung giờ phải là MORNING_SNACK, LUNCH, AFTERNOON_SNACK hoặc ALL' })
  mealSlot: string;

  @ApiProperty({ description: 'Loại mục tiêu', example: 'DISH_CATEGORY', enum: ['DISH_CATEGORY', 'FOOD_GROUP'] })
  @IsString()
  @IsIn(['DISH_CATEGORY', 'FOOD_GROUP'], { message: 'targetType phải là DISH_CATEGORY hoặc FOOD_GROUP' })
  targetType: string;

  @ApiPropertyOptional({ description: 'ID danh mục món hoặc nhóm nguyên liệu' })
  @IsOptional()
  @IsInt()
  targetId?: number;

  @ApiProperty({ description: 'Mã đối tượng', example: 'MAIN' })
  @IsString()
  @IsNotEmpty({ message: 'targetCode không được để trống' })
  targetCode: string;

  @ApiProperty({ description: 'Tên hiển thị đối tượng', example: 'Món mặn (Món chính)' })
  @IsString()
  @IsNotEmpty({ message: 'targetName không được để trống' })
  targetName: string;

  @ApiPropertyOptional({ description: 'Lứa tuổi áp dụng', default: 'ALL' })
  @IsOptional()
  @IsString()
  ageGroup?: string;

  @ApiPropertyOptional({ description: 'Phạm vi chu kỳ', default: 'PER_CYCLE_4_WEEKS', enum: ['PER_DAY', 'PER_WEEK', 'PER_CYCLE_4_WEEKS'] })
  @IsOptional()
  @IsString()
  @IsIn(['PER_DAY', 'PER_WEEK', 'PER_CYCLE_4_WEEKS'])
  periodType?: string;

  @ApiProperty({ description: 'Số lần tối thiểu', default: 0 })
  @IsInt()
  @Min(0)
  minOccurrences: number;

  @ApiProperty({ description: 'Số lần tối đa', default: 2 })
  @IsInt()
  @Min(1, { message: 'Số lần tối đa phải lớn hơn hoặc bằng 1' })
  maxOccurrences: number;

  @ApiPropertyOptional({ description: 'Món bắt buộc có trong bữa', default: false })
  @IsOptional()
  @IsBoolean()
  isRequiredInMeal?: boolean;

  @ApiPropertyOptional({ description: 'Mức độ nghiêm ngặt', default: 'WARNING', enum: ['ERROR', 'WARNING', 'INFO'] })
  @IsOptional()
  @IsString()
  @IsIn(['ERROR', 'WARNING', 'INFO'])
  severity?: string;

  @ApiPropertyOptional({ description: 'Trạng thái kích hoạt', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Ghi chú nghiệp vụ' })
  @IsOptional()
  @IsString()
  note?: string;
}

