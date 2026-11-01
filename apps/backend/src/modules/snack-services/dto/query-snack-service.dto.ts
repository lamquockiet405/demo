import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QuerySnackServiceDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên hoặc mô tả gói dịch vụ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái gói (ALL, OPEN, UPCOMING, CLOSED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Lọc theo khối lớp áp dụng (ALL, KINDERGARTEN_LARGE, TODDLER)' })
  @IsOptional()
  @IsString()
  grade?: string;
}

