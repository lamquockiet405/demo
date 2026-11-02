import { IsNotEmpty, IsNumber, IsString, IsOptional, IsIn } from 'class-validator';

export class SignMonthlyLogDto {
  @IsNotEmpty()
  @IsNumber()
  month: number;

  @IsNotEmpty()
  @IsNumber()
  year: number;

  @IsNotEmpty()
  @IsString()
  signerName: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN'])
  signerRole: 'SCHOOL_MANAGER' | 'PRINCIPAL' | 'SUPER_ADMIN';

  @IsOptional()
  @IsString()
  notes?: string;
}

