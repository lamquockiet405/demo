import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGrowthRecordDto {
  @ApiPropertyOptional({ example: 1, description: 'ID học sinh trong hệ thống' })
  @IsOptional()
  studentId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID hoặc mã định danh học sinh' })
  @IsOptional()
  childId?: number | string;

  @ApiPropertyOptional({ example: 'HS-2026-0001', description: 'Mã học sinh (hỗ trợ nhập Excel/CSV)' })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiPropertyOptional({ example: '2026-10-27', description: 'Ngày đo (mặc định hôm nay nếu để trống)' })
  @IsOptional()
  @IsString()
  measuredDate?: string;

  @ApiPropertyOptional({ example: '2026-10-27', description: 'Ngày đo alias (mặc định hôm nay nếu để trống)' })
  @IsOptional()
  @IsString()
  measurementDate?: string;

  @ApiProperty({ example: 102.5, description: 'Chiều cao (cm), giới hạn 40 cm - 150 cm' })
  @IsNotEmpty({ message: 'Chiều cao không được để trống' })
  @IsNumber({}, { message: 'Chiều cao phải là số' })
  @Min(40, { message: 'Chiều cao tối thiểu là 40 cm' })
  @Max(150, { message: 'Chiều cao tối đa là 150 cm' })
  heightCm: number;

  @ApiProperty({ example: 16.2, description: 'Cân nặng (kg), giới hạn 3 kg - 60 kg' })
  @IsNotEmpty({ message: 'Cân nặng không được để trống' })
  @IsNumber({}, { message: 'Cân nặng phải là số' })
  @Min(3, { message: 'Cân nặng tối thiểu là 3 kg' })
  @Max(60, { message: 'Cân nặng tối đa là 60 kg' })
  weightKg: number;

  @ApiPropertyOptional({ example: 'Bé ăn ngoan, thể trạng ổn định', description: 'Ghi chú sức khỏe' })
  @IsOptional()
  @IsString()
  healthNotes?: string;
}

