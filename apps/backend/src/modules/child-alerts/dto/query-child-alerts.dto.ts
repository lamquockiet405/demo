import { IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryChildAlertsDto {
  @ApiPropertyOptional({ example: '1', description: 'ID lớp học (đối với Giáo viên hoặc lọc theo lớp)' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ example: '12', description: 'ID học sinh (đối với Phụ huynh hoặc lọc theo trẻ)' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ example: '2026-11-02', description: 'Ngày truy vấn cảnh báo (mặc định hôm nay)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: 'CRITICAL', description: 'Lọc theo mức độ nghiêm trọng (CRITICAL, HIGH, WARNING, INFO)' })
  @IsOptional()
  @IsString()
  severity?: string;
}

