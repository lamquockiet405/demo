import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class SignInspectionDto {
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['STEP_1_RAW_CHECK', 'STEP_2_PROCESSING_CHECK', 'STEP_3_PRE_SERVING_CHECK', 'RETENTION_24H'])
  step: 'STEP_1_RAW_CHECK' | 'STEP_2_PROCESSING_CHECK' | 'STEP_3_PRE_SERVING_CHECK' | 'RETENTION_24H';

  @IsNotEmpty()
  @IsString()
  @IsIn(['KITCHEN_STAFF', 'MEDICAL_STAFF', 'SCHOOL_MANAGER'])
  role: 'KITCHEN_STAFF' | 'MEDICAL_STAFF' | 'SCHOOL_MANAGER';

  @IsNotEmpty()
  @IsString()
  signerName: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

