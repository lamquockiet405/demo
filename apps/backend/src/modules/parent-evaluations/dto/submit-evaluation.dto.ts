import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsIn,
  IsDateString,
  Min,
  Max,
  IsBoolean,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SubmitEvaluationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  studentId?: number | string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  childId?: number | string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  menuId?: number | string;

  @ApiPropertyOptional({
    example: "QUICK_EVALUATION",
    enum: ["QUICK_EVALUATION", "SCHOOL_PROPOSAL"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["QUICK_EVALUATION", "SCHOOL_PROPOSAL"])
  evaluationType?: string;

  @ApiPropertyOptional({ example: "TRUA" })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiProperty({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number = 5;

  @ApiPropertyOptional({ example: "Góp ý bữa ăn" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Bé ăn rất ngon miệng và thích món súp." })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: "Bé ăn rất ngon miệng" })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  likesInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDrafting?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentNameCustom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  childNameCustom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classNameCustom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  feedbackDate?: string;
}
