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

export class CreateSpacingRuleDto {
  @ApiProperty({ description: 'Tên quy tắc giãn cách', example: 'Món mặn cách nhau tối thiểu 14 ngày' })
  @IsString()
  @IsNotEmpty({ message: 'Tên quy tắc không được để trống' })
  @MaxLength(200)
  ruleName: string;

  @ApiPropertyOptional({ description: 'Khung giờ bữa ăn', default: 'ALL' })
  @IsOptional()
  @IsString()
  mealSlot?: string;

  @ApiProperty({ description: 'Loại mục tiêu', example: 'DISH_CATEGORY', enum: ['DISH_CATEGORY', 'SPECIFIC_DISH'] })
  @IsString()
  @IsIn(['DISH_CATEGORY', 'SPECIFIC_DISH'])
  targetType: string;

  @ApiPropertyOptional({ description: 'ID danh mục món hoặc ID món' })
  @IsOptional()
  @IsInt()
  targetId?: number;

  @ApiPropertyOptional({ description: 'Tên món hoặc loại món', example: 'Món mặn' })
  @IsOptional()
  @IsString()
  targetName?: string;

  @ApiPropertyOptional({ description: 'Lứa tuổi áp dụng', default: 'ALL' })
  @IsOptional()
  @IsString()
  ageGroup?: string;

  @ApiProperty({ description: 'Số ngày giãn cách tối thiểu', default: 14 })
  @IsInt()
  @Min(1, { message: 'Số ngày giãn cách tối thiểu phải >= 1' })
  minSpacingDays: number;

  @ApiPropertyOptional({ description: 'Cấm lặp lại trong cùng tuần', default: true })
  @IsOptional()
  @IsBoolean()
  noRepeatInSameWeek?: boolean;

  @ApiPropertyOptional({ description: 'Cấm lặp lại trong cùng ngày', default: true })
  @IsOptional()
  @IsBoolean()
  noRepeatInSameDay?: boolean;

  @ApiPropertyOptional({ description: 'Thứ tự ưu tiên', default: 1 })
  @IsOptional()
  @IsInt()
  priorityOrder?: number;

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

