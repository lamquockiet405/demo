import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetDishesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dishType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAgeGroup?: string;

  @ApiPropertyOptional({ enum: ['ALL', 'SAFE', 'WARNING'] })
  @IsOptional()
  @IsString()
  allergenFilter?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean | string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
