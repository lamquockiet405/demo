import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmAdviceDto {
  @ApiPropertyOptional({ example: 'Mẹ đã chuẩn bị súp bí đỏ hạt sen cho bé tối nay, cảm ơn bác sĩ dinh dưỡng!' })
  @IsOptional()
  @IsString()
  parentFeedback?: string;
}

