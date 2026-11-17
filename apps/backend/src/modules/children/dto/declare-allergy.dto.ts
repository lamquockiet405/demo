import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeclareAllergyDto {
  @ApiPropertyOptional({ example: 1, description: 'ID dị ứng trong bảng allergens' })
  @IsOptional()
  allergenId?: any;

  @ApiPropertyOptional({ example: 'Thủy hải sản giáp xác (Tôm, Cua)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  customAllergenName?: string;

  @ApiPropertyOptional({ example: 'ALLERGY' })
  @IsOptional()
  @IsString()
  @IsIn(['ALLERGY', 'INTOLERANCE', 'RELIGIOUS_RESTRICTION', 'MEDICAL_RESTRICTION'])
  allergyType?: string;

  @ApiProperty({ example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH', 'MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'] })
  @IsNotEmpty({ message: 'Mức độ nghiêm trọng không được để trống' })
  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])
  severity: string;

  @ApiPropertyOptional({ example: 'Phát ban, sưng môi' })
  @IsOptional()
  @IsString()
  symptoms?: string;

  @ApiPropertyOptional({ example: 'Uống thuốc kháng histamin' })
  @IsOptional()
  @IsString()
  reactionTreatment?: string;

  @ApiPropertyOptional({ example: '2026-05-10' })
  @IsOptional()
  @IsDateString()
  diagnosedDate?: string;

  @ApiPropertyOptional({ example: 'Ghi chú thêm' })
  @IsOptional()
  @IsString()
  note?: string;
}
