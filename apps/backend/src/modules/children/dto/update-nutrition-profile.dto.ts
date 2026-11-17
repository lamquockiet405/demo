import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateNutritionProfileDto {
  @IsOptional() @IsString() @MaxLength(100) dietaryRegime?: string;
  @IsOptional() @IsString() @MaxLength(3000) dietaryNotes?: string;
  @IsOptional() @IsString() @MaxLength(3000) eatingHabits?: string;
  @IsOptional() @IsString() @MaxLength(3000) nutritionGoals?: string;
  @IsOptional() @IsNumber() @Min(0) targetEnergyKcal?: number | null;
}
