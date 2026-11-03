import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAllergyDto {
  @ApiPropertyOptional()
  @IsOptional()
  allergenId?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customAllergenName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allergyType?: string;

  @ApiPropertyOptional({ example: 'MEDIUM' })
  @IsOptional()
  @IsString()
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
  @IsString()
  diagnosedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}
