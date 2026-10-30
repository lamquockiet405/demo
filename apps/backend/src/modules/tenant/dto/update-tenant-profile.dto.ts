import {
  IsString,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FoodSafetyLicenseDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  issueDate?: string;

  @IsString()
  @IsOptional()
  issuingAuthority?: string;
}

export class LegalRepresentativeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  title?: string;
}

export class BrandingDto {
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  logoName?: string;

  @IsString()
  @IsOptional()
  logoSize?: string;

  @IsString()
  @IsOptional()
  primaryColor?: string; // 'TEAL' | 'YELLOW' | 'ORANGE'
}

export class OperationalSettingsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mealTimes?: string[];

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  standardWeeklyCycleLength?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  foodRetentionHours?: number;

  @IsBoolean()
  @IsOptional()
  whoZscoreAutoCalc?: boolean;
}

export class UpdateTenantProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  principalName?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxChildren?: number;

  @IsString()
  @IsOptional()
  educationDepartmentCode?: string;

  @IsString()
  @IsOptional()
  schoolIdentifierSgd?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FoodSafetyLicenseDto)
  foodSafetyLicense?: FoodSafetyLicenseDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegalRepresentativeDto)
  legalRepresentative?: LegalRepresentativeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingDto)
  branding?: BrandingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperationalSettingsDto)
  operationalSettings?: OperationalSettingsDto;
}
