import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceHistoryFilterDto {
  @ApiPropertyOptional({ description: 'ID lớp học (UUID hoặc số)' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['week', 'month', 'semester', 'custom'], description: 'Khoảng thời gian chọn nhanh' })
  @IsOptional()
  @IsString()
  period?: 'week' | 'month' | 'semester' | 'custom';

  @ApiPropertyOptional({
    description: 'Bộ lọc trạng thái',
    enum: [
      'ALL',
      'PRESENT',
      'LUNCH_ONLY',
      'ABSENT',
      'SPECIAL_NOTE',
      'PORTION_ALL',
      'PORTION_HALF',
      'PORTION_NONE',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm tên học sinh hoặc mã học sinh' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Loại bữa ăn (LUNCH, BREAKFAST, AFTERNOON_SNACK...)' })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({ enum: ['table', 'by_child'], description: 'Chế độ xem' })
  @IsOptional()
  @IsString()
  viewMode?: 'table' | 'by_child';

  @ApiPropertyOptional({ default: 1, description: 'Số trang' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Số lượng mục trên một trang' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
