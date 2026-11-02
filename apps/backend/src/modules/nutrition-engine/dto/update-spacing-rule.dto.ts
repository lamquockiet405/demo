import { PartialType } from '@nestjs/swagger';
import { CreateSpacingRuleDto } from './create-spacing-rule.dto';

export class UpdateSpacingRuleDto extends PartialType(CreateSpacingRuleDto) {}

