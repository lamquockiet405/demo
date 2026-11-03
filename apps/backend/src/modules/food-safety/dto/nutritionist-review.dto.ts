import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class NutritionistReviewDto {
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsNotEmpty()
  @IsString()
  dishName: string;

  @IsNotEmpty()
  @IsString()
  incidentDescription: string;

  @IsOptional()
  @IsString()
  chemicalOrAdditiveSafetyStatus?: string;

  @IsNotEmpty()
  @IsString()
  nutritionistAnalysis: string;

  @IsNotEmpty()
  @IsString()
  actionTaken: string;

  @IsNotEmpty()
  @IsString()
  reviewerName: string;
}

