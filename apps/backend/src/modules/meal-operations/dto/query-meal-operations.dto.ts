import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMealOperationsDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  schoolId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  classId?: number;
}

