import { IsNotEmpty, IsNumber, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendHomeSupplementAdviceDto {
  @ApiProperty({ example: 2 })
  @IsNotEmpty()
  @IsNumber()
  studentId: number;

  @ApiPropertyOptional({ example: 'MODERATE', enum: ['MILD', 'MODERATE', 'SEVERE'] })
  @IsOptional()
  @IsString()
  severityLevel?: string;

  @ApiProperty({ example: 'Tư vấn dinh dưỡng bổ sung tại nhà cho bé Trần Phương Linh' })
  @IsNotEmpty()
  @IsString()
  adviceTitle: string;

  @ApiPropertyOptional({ example: ['Ăn chậm, để thừa 75% cơm và rau', 'Bất dung nạp sữa bò'] })
  @IsOptional()
  @IsArray()
  pickySymptoms?: string[];

  @ApiProperty({ example: 'Chia nhỏ bữa ăn buổi tối, bổ sung súp bí đỏ hạt sen và sữa hạt giàu kẽm...' })
  @IsNotEmpty()
  @IsString()
  homeSupplementAdvice: string;

  @ApiPropertyOptional({ example: ['Súp bí đỏ thịt bằm', 'Sinh tố bơ chuối sữa hạt', 'Canh sườn hầm cà rốt'] })
  @IsOptional()
  @IsArray()
  recommendedDishes?: string[];

  @ApiPropertyOptional({ example: ['Kẽm (Zinc)', 'Canxi (Calcium)', 'Chất xơ (Fiber)'] })
  @IsOptional()
  @IsArray()
  micronutrientsFocus?: string[];
}

