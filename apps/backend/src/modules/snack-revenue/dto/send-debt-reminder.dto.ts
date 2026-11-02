import { IsNotEmpty, IsNumber, IsString, IsOptional, IsArray } from 'class-validator';

export class SendDebtReminderDto {
  @IsNotEmpty()
  @IsArray()
  registrationIds: number[];

  @IsOptional()
  @IsString()
  channel?: 'SMS' | 'APP_PUSH' | 'ALL';

  @IsOptional()
  @IsString()
  customMessage?: string;
}

