import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsString, IsOptional, ArrayMinSize } from 'class-validator';

export class SubmitMenuDto {
  @ApiProperty({
    description: 'Chuyên viên Dinh dưỡng xác nhận ký số cam kết trách nhiệm chuyên môn',
    example: true,
  })
  @IsBoolean()
  commitmentSigned: boolean;

  @ApiProperty({
    description: 'Danh sách các mã cam kết trách nhiệm chuyên môn đã được xác nhận',
    example: [
      'COMMIT_TT28_NUTRITION',
      'COMMIT_QD1246_SAFETY',
      'COMMIT_ALLERGEN_SAFETY',
      'COMMIT_PROFESSIONAL_RESP',
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Bắt buộc phải xác nhận ít nhất một điều khoản cam kết chuyên môn' })
  commitmentItems: string[];

  @ApiProperty({
    description: 'Nội dung toàn văn bản cam kết chuyên môn của Chuyên viên Dinh dưỡng',
    example:
      'Tôi cam đoan thực đơn tuân thủ đầy đủ định mức Kcal, tỷ lệ P:L:G theo Thông tư 28/2016/TT-BGDĐT, bảo đảm an toàn thực phẩm theo Quyết định 1246/QĐ-BYT...',
  })
  @IsString()
  commitmentText: string;

  @ApiPropertyOptional({
    description: 'Giải trình chuyên môn lý do vượt ngưỡng hoặc can thiệp quy tắc (bắt buộc khi có cảnh báo)',
    example:
      'Món cá hồi được sắp xếp 2 lần/tuần nhằm bổ sung DHA và Omega-3 cho tuần lễ phát triển trí não học sinh lớp Lá.',
  })
  @IsOptional()
  @IsString()
  overrideJustification?: string;

  @ApiPropertyOptional({
    description: 'Ảnh chụp trạng thái cảnh báo / vi phạm tại thời điểm gửi duyệt',
    example: [{ ruleCode: 'FREQUENCY_EXCEEDED', message: 'Tần suất món cá vượt 1 lần' }],
  })
  @IsOptional()
  @IsArray()
  violationsSnapshot?: any[];
}

