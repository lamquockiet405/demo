import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcknowledgeNotificationDto {
  @ApiProperty({ example: 1, description: 'Mã thông báo' })
  @Type(() => Number)
  @IsNumber()
  notificationId: number;

  @ApiPropertyOptional({
    example: 'Giáo viên đã tiếp nhận thông tin và sẽ hỗ trợ bé ăn hết suất, chia nhỏ phần ăn.',
    description: 'Ghi chú xác nhận của Giáo viên / Chuyên viên Dinh dưỡng',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignInterventionDietDto {
  @ApiProperty({ example: 1, description: 'Mã thông báo' })
  @Type(() => Number)
  @IsNumber()
  notificationId: number;

  @ApiProperty({
    example: 'Thực đơn phục hồi dinh dưỡng tăng đạm & vi chất (Personalized Diet Plan)',
    description: 'Tên thực đơn can thiệp cá nhân hóa',
  })
  @IsNotEmpty({ message: 'Tên thực đơn can thiệp không được để trống' })
  @IsString()
  interventionDietTitle: string;

  @ApiPropertyOptional({ example: 150, description: 'Mức năng lượng bổ sung mỗi ngày (Kcal)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  calorieAdjustmentKcal?: number = 150;

  @ApiProperty({
    example: 'Bổ sung thêm 1 hộp sữa năng lượng cao lúc 15h30, hầm nhừ thịt, tăng 5ml dầu hạt cải vào canh',
    description: 'Hướng dẫn chế biến cho Bếp và chăm sóc tại lớp',
  })
  @IsNotEmpty({ message: 'Hướng dẫn dinh dưỡng không được để trống' })
  @IsString()
  nutritionGuidance: string;

  @ApiPropertyOptional({ example: '2026-11-20', description: 'Ngày hẹn tái cân đợt tiếp theo' })
  @IsOptional()
  @IsString()
  recheckDate?: string;
}

export class RequestConsultationDto {
  @ApiProperty({ example: 1, description: 'Mã thông báo' })
  @Type(() => Number)
  @IsNumber()
  notificationId: number;

  @ApiProperty({ example: '2026-11-10 09:30', description: 'Thời gian mong muốn tư vấn với chuyên gia dinh dưỡng' })
  @IsNotEmpty({ message: 'Thời gian hẹn tư vấn không được để trống' })
  @IsString()
  preferredDate: string;

  @ApiPropertyOptional({
    example: 'Gia đình muốn được tư vấn thêm về chế độ ăn dặm bổ sung canxi và men vi sinh cho bé.',
    description: 'Ghi chú của phụ huynh',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveInterventionBudgetDto {
  @ApiProperty({ example: [1, 2], description: 'Danh sách mã thông báo phê duyệt hỗ trợ' })
  @IsArray()
  notificationIds: number[];

  @ApiProperty({ example: 2500000, description: 'Số tiền ngân sách phê duyệt (VNĐ)' })
  @Type(() => Number)
  @IsNumber()
  approvedBudgetAmount: number;

  @ApiProperty({
    example: 'Phê duyệt trích ngân sách y tế học đường tài trợ sữa phục hồi dinh dưỡng và bổ sung kẽm cho các bé SDD thể nhẹ cân.',
    description: 'Quyết định chỉ đạo của Ban Giám Hiệu',
  })
  @IsNotEmpty({ message: 'Nội dung quyết định không được để trống' })
  @IsString()
  decisionNotes: string;
}

