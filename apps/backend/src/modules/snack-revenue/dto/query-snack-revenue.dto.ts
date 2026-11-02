import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QuerySnackRevenueDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  serviceType?: string; // e.g. 'ALL', 'FULL_MONTH', 'FLEXIBLE_3_DAYS'

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  periodId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  schoolId?: number;
}

