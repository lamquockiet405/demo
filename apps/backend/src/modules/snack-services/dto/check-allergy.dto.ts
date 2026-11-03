import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CheckSnackAllergyDto {
  @ApiProperty({ description: 'ID kỳ đăng ký dịch vụ ăn xế', example: 1 })
  @IsNotEmpty({ message: 'periodId không được để trống' })
  @Type(() => Number)
  @IsNumber()
  periodId: number;

  @ApiProperty({ description: 'ID học sinh cần kiểm tra dị ứng', example: 1 })
  @IsNotEmpty({ message: 'studentId không được để trống' })
  @Type(() => Number)
  @IsNumber()
  studentId: number;
}

