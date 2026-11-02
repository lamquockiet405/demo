import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespondSpecialistDto {
  @ApiProperty({
    example: 'Cảm ơn phụ huynh đã đóng góp. Về mặt tiêu hóa, bé có thể nhạy cảm với đạm sữa bò...',
    description: 'Nội dung phản hồi từ chuyên gia Dinh dưỡng hoặc Ban Giám Hiệu',
  })
  @IsNotEmpty({ message: 'Nội dung phản hồi không được để trống' })
  @IsString()
  responseContent: string;

  @ApiPropertyOptional({
    example: 'NUTRITION_ADVICE',
    enum: ['NUTRITION_ADVICE', 'MANAGEMENT_RESOLUTION', 'GENERAL'],
    description: 'Phân loại phản hồi chuyên môn',
  })
  @IsOptional()
  @IsString()
  responseCategory?: string = 'NUTRITION_ADVICE';

  @ApiPropertyOptional({ example: true, description: 'Gửi push notification tới phụ huynh qua app' })
  @IsOptional()
  @IsBoolean()
  sendPushNotification?: boolean = true;

  @ApiPropertyOptional({ example: false, description: 'Lưu dạng bản nháp' })
  @IsOptional()
  @IsBoolean()
  isDrafting?: boolean = false;
}

