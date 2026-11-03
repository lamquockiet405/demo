import { PartialType } from '@nestjs/swagger';
import { CreateIntakeStandardDto } from './create-intake-standard.dto';

export class UpdateIntakeStandardDto extends PartialType(CreateIntakeStandardDto) {}

