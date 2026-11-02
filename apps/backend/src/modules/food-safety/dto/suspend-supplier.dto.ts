import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SuspendSupplierDto {
  @IsNotEmpty()
  @IsNumber()
  supplierId: number;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsString()
  decisionBy: string;
}

