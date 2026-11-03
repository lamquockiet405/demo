import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAllergyDto {
  @ApiPropertyOptional()
  @IsOptional()
  allergenId?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  customAllergenName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['ALLERGY', 'INTOLERANCE', 'RELIGIOUS_RESTRICTION', 'MEDICAL_RESTRICTION'])
  allergyType?: string;

  @ApiPropertyOptional({ example: 'MEDIUM' })
  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  symptoms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reactionTreatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  diagnosedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
