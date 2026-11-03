import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecipeImprovementLogDto {
  @ApiPropertyOptional({ example: 12, description: 'Mã món ăn cần cải tiến' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dishId?: number;

  @ApiProperty({ example: 'Canh rau dền thịt băm', description: 'Tên món ăn' })
  @IsNotEmpty({ message: 'Tên món ăn không được để trống' })
  @IsString()
  dishName: string;

  @ApiProperty({
    example: 'Phụ huynh phản ánh canh quá mặn, vượt chuẩn natri cho trẻ mầm non',
    description: 'Vấn đề chuyên môn ghi nhận từ phụ huynh',
  })
  @IsNotEmpty({ message: 'Vấn đề phản ánh không được để trống' })
  @IsString()
  issueFeedback: string;

  @ApiProperty({
    example: 'Giảm 30% lượng muối i-ốt, ninh ngọt bằng nước hầm xương củ quả, thử vị trước khi xuất xưởng',
    description: 'Kế hoạch điều chỉnh công thức chỉ đạo Bếp trưởng',
  })
  @IsNotEmpty({ message: 'Kế hoạch hành động không được để trống' })
  @IsString()
  actionPlan: string;

  @ApiPropertyOptional({ example: 'HIGH', enum: ['NORMAL', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  priority?: string = 'HIGH';
}

