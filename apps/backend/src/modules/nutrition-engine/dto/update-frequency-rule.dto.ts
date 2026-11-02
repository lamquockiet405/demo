import { PartialType } from '@nestjs/swagger';
import { CreateFrequencyRuleDto } from './create-frequency-rule.dto';

export class UpdateFrequencyRuleDto extends PartialType(CreateFrequencyRuleDto) {}

