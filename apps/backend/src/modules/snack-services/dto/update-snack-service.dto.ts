import { IsOptional, IsString, IsNumber, IsBoolean, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSnackServiceDto {
  @ApiPropertyOptional({ example: 'Gói Năng Lượng Chiều' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'AFTER_SCHOOL_SNACK', enum: ['AFTER_SCHOOL_SNACK', 'PREMIUM_MILK', 'ORGANIC_FRUIT', 'CUSTOM_NUTRITION'] })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({ example: 'MONTHLY', enum: ['PER_MEAL', 'WEEKLY', 'MONTHLY', 'SEMESTER'] })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @IsNumber()
  pricePerUnit?: number;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsString()
  availableFrom?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsString()
  availableTo?: string;

  @ApiPropertyOptional({ example: '2026-10-28' })
  @IsOptional()
  @IsString()
  registrationDeadline?: string;

  @ApiPropertyOptional({ example: 440000 })
  @IsOptional()
  @IsNumber()
  feeAmount?: number;

  @ApiPropertyOptional({ example: 'OPEN', enum: ['OPEN', 'CLOSED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Suất ăn xế chiều cung cấp năng lượng và vi chất cho trẻ' })
  @IsOptional()
  @IsString()
  description?: string;
}
