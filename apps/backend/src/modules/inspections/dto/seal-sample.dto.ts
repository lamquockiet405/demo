import { IsInt, IsNumber, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SealSampleDto {
  @ApiProperty({ example: 'Thịt bò xào đậu cô ve' })
  @IsNotEmpty()
  @IsString()
  dishName: string;

  @ApiPropertyOptional({ description: 'Món hiện tại; tên món vẫn được lưu làm bản chụp lịch sử' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dishId?: number;

  @ApiProperty({ example: '2025-09-08' })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiPropertyOptional({ example: 'MẪU-20250908-01' })
  @IsOptional()
  @IsString()
  sampleCode?: string;

  @ApiPropertyOptional({ example: 'Nhiệt độ lưu trữ 4°C, niêm phong kín' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 150.0 })
  @IsOptional()
  @IsNumber()
  sampleWeightG?: number;

  @ApiPropertyOptional({ example: 3.8 })
  @IsOptional()
  @IsNumber()
  storageTemp?: number;

  @ApiPropertyOptional({ example: 'Nguyễn Văn Cường' })
  @IsOptional()
  @IsString()
  collectorName?: string;

  @ApiPropertyOptional({ example: 'Tủ lưu mẫu số 1' })
  @IsOptional()
  @IsString()
  fridgeUnit?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
