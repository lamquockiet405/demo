import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGrowthRecordDto {
  @ApiPropertyOptional({ example: '2026-10-27', description: 'Ngày đo (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  measuredDate?: string;

  @ApiPropertyOptional({ example: '2026-10-27', description: 'Ngày đo alias (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  measurementDate?: string;

  @ApiPropertyOptional({ example: 102.5, description: 'Chiều cao mới (cm), từ 40 cm đến 150 cm' })
  @IsOptional()
  @IsNumber({}, { message: 'Chiều cao phải là số' })
  @Min(40, { message: 'Chiều cao tối thiểu là 40 cm' })
  @Max(150, { message: 'Chiều cao tối đa là 150 cm' })
  heightCm?: number;

  @ApiPropertyOptional({ example: 16.2, description: 'Cân nặng mới (kg), từ 3 kg đến 60 kg' })
  @IsOptional()
  @IsNumber({}, { message: 'Cân nặng phải là số' })
  @Min(3, { message: 'Cân nặng tối thiểu là 3 kg' })
  @Max(60, { message: 'Cân nặng tối đa là 60 kg' })
  weightKg?: number;

  @ApiPropertyOptional({ example: 'Điều chỉnh số liệu sau khi đo lại bằng thước chuẩn', description: 'Ghi chú điều chỉnh' })
  @IsOptional()
  @IsString()
  healthNotes?: string;
}
