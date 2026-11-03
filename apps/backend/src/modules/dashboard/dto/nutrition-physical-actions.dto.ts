import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveBudgetDto {
  @ApiProperty({ example: 'NHA_TRE', description: 'Mã khối lớp áp dụng (NHA_TRE, MAM, CHOI, LA, TOAN_TRUONG)' })
  @IsString()
  @IsNotEmpty()
  gradeCode: string;

  @ApiProperty({ example: 15000000, description: 'Số tiền ngân sách bổ sung (VND)' })
  @IsNumber()
  @Min(0)
  amountVnd: number;

  @ApiPropertyOptional({ example: 'Ngân sách bổ sung sữa bột dinh dưỡng giàu Canxi & Vitamin D cho trẻ thấp còi' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 'Học kỳ 1 - 2026-2027' })
  @IsString()
  @IsOptional()
  semester?: string;
}

export class CreatePersonalizedDietDto {
  @ApiProperty({ example: 12, description: 'ID học sinh cần can thiệp dinh dưỡng' })
  @IsNumber()
  @IsNotEmpty()
  studentId: number;

  @ApiProperty({ example: 'HIGH_CALORIE_MICRONUTRIENT', description: 'Loại thực đơn can thiệp (HIGH_CALORIE_MICRONUTRIENT, LOW_FAT_HIGH_FIBER, CUSTOM)' })
  @IsString()
  @IsNotEmpty()
  dietType: string;

  @ApiProperty({ example: 'Bổ sung thêm 1 hũ sữa chua men sống vào bữa xế; tăng 20% đạm thịt gà/bò nạc trong bữa trưa.' })
  @IsString()
  @IsNotEmpty()
  adjustmentNotes: string;

  @ApiPropertyOptional({ example: 780, description: 'Mục tiêu năng lượng calo/ngày (Kcal)' })
  @IsNumber()
  @IsOptional()
  targetCalories?: number;

  @ApiPropertyOptional({ example: ['Canxi & D3', 'Kẽm vi lượng'], type: [String] })
  @IsOptional()
  extraSupplements?: string[];
}

export class ScheduleParentConsultationDto {
  @ApiProperty({ example: 12, description: 'ID học sinh' })
  @IsNumber()
  @IsNotEmpty()
  studentId: number;

  @ApiProperty({ example: '2026-11-10T09:00:00Z', description: 'Thời gian tư vấn dự kiến' })
  @IsString()
  @IsNotEmpty()
  scheduledDate: string;

  @ApiProperty({ example: 'Tư vấn chế độ ăn dặm giàu vi chất & thói quen ngủ nghỉ cho trẻ nhẹ cân', description: 'Chủ đề buổi tư vấn' })
  @IsString()
  @IsNotEmpty()
  consultationTopic: string;

  @ApiPropertyOptional({ example: 'Tư vấn trực tuyến qua app KidMeal hoặc trực tiếp tại phòng Y tế Dinh dưỡng' })
  @IsString()
  @IsOptional()
  notes?: string;
}

