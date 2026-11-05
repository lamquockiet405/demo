import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateTenantProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() domain?: string;
  @IsOptional() maxChildren?: number;
  @IsOptional() operationalSettings?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationDepartmentCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolIdentifierSgd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  foodSafetyLicense?: any;

  @ApiPropertyOptional()
  @IsOptional()
  legalRepresentative?: any;

  @ApiPropertyOptional()
  @IsOptional()
  branding?: any;
}
