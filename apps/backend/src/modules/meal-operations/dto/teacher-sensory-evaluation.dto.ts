import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class TeacherSensoryEvaluationDto {
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsNotEmpty()
  @IsNumber()
  classId: number;

  @IsNotEmpty()
  @IsString()
  temperature: string; // e.g. 'ẤM NÓNG', 'BÌNH THƯỜNG', 'NGUỘI'

  @IsNotEmpty()
  @IsString()
  taste: string; // e.g. 'Vừa miệng trẻ', 'Hơi mặn', 'Hơi nhạt'

  @IsNotEmpty()
  @IsString()
  cleanliness: string; // e.g. 'Rất sạch sẽ', 'Đạt chuẩn', 'Cần cải thiện'

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsNumber()
  trayCountReceived?: number;

  @IsOptional()
  @IsNumber()
  plateWastePercent?: number;
}

