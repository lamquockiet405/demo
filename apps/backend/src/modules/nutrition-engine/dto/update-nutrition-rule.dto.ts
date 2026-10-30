import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateNutritionRuleDto } from './create-nutrition-rule.dto';

export class UpdateNutritionRuleDto extends PartialType(CreateNutritionRuleDto) {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}
