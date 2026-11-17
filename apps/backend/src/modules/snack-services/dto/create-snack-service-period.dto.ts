import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSnackServicePeriodDto {
  @ApiPropertyOptional({ example: 'Dịch vụ ăn xế Tháng 11/2026' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'XGC-2026-T11' })
  @IsOptional()
  @IsString()
  periodCode?: string;

  @ApiPropertyOptional({ example: ['TODDLER', 'KINDERGARTEN_3_4Y'] })
  @IsOptional()
  @IsArray()
  appliedGrades?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isWholeSchool?: boolean;

  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsString()
  registrationStart?: string;

  @ApiPropertyOptional({ example: '2026-10-28' })
  @IsOptional()
  @IsString()
  registrationEnd?: string;

  @ApiPropertyOptional({ example: ['2026-11'] })
  @IsOptional()
  @IsArray()
  serviceMonths?: string[];

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @IsNumber()
  pricePerUnitPerDay?: number;

  @ApiPropertyOptional({ example: 'UNLIMITED', enum: ['UNLIMITED', 'LIMITED'] })
  @IsOptional()
  @IsIn(['UNLIMITED', 'LIMITED'])
  capacityMode?: 'UNLIMITED' | 'LIMITED';

  @ApiPropertyOptional({ example: 160 })
  @IsOptional()
  @IsNumber()
  kitchenCapacity?: number;

  @ApiPropertyOptional({ example: 160 })
  @IsOptional()
  @IsNumber()
  totalQuota?: number;

  @ApiPropertyOptional()
  @IsOptional()
  quotaPerGrade?: Record<string, number>;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoRefundEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoCloseEnabled?: boolean;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsNumber()
  autoCloseThresholdPercent?: number;

  @ApiPropertyOptional({ example: 'Thực đơn súp gà ngô non và sữa chua' })
  @IsOptional()
  @IsString()
  nutritionNotes?: string;

  @ApiPropertyOptional({ example: 'OPEN', enum: ['OPEN', 'DRAFT', 'ACTIVE', 'CLOSED'] })
  @IsOptional()
  @IsString()
  status?: string;

  // Legacy aliases for backward compatibility
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: '2026-10-28' })
  @IsOptional()
  @IsString()
  registrationDeadline?: string;

  @ApiPropertyOptional({ example: 440000 })
  @IsOptional()
  @IsNumber()
  feeAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weekNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPaymentLocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  snackServiceId?: string;
}
