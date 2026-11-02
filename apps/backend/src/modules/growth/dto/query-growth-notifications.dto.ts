import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryGrowthNotificationsDto {
  @ApiPropertyOptional({
    example: 'NUTRITIONIST',
    enum: ['PARENT', 'NUTRITIONIST', 'TEACHER', 'SCHOOL_MANAGER', 'ALL'],
    description: 'Vai trò xem thông báo để áp dụng phân quyền hiển thị (Visibility Scoping)',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 1, description: 'Mã lớp học (bắt buộc đối với Teacher)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  classId?: number;

  @ApiPropertyOptional({ example: 101, description: 'Mã học sinh (bắt buộc đối với Parent)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  studentId?: number;

  @ApiPropertyOptional({ example: 'ALL', enum: ['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'INFO'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({
    example: 'ALL',
    enum: ['ALL', 'DISPATCHED', 'READ', 'ACKNOWLEDGED', 'INTERVENTION_APPLIED', 'RESOLVED'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export interface GrowthNotificationItem {
  id: number;
  studentId: number;
  studentName: string;
  className: string;
  classId: number;
  gradeLevel: string;
  ageInMonths: number;
  notificationType:
    | 'ABNORMAL_ZSCORE'
    | 'WEIGHT_LOSS_FALTERING'
    | 'STUNTING_RISK'
    | 'OBESITY_RISK'
    | 'MEAL_DEFICIT';
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  targetRole: 'PARENT' | 'NUTRITIONIST' | 'TEACHER' | 'SCHOOL_MANAGER';
  title: string;
  message: string;
  metadata: {
    waz?: number;
    haz?: number;
    baz?: number;
    weightKg?: number;
    heightCm?: number;
    bmi?: number;
    previousWeightKg?: number;
    weightDeltaKg?: number;
    weightClassification?: string;
    heightClassification?: string;
    bmiClassification?: string;
    recommendationText?: string;
    interventionDietTitle?: string;
    approvedBudgetAmount?: number;
  };
  channels: ('APP_PUSH' | 'SMS' | 'MODAL_ALERT' | 'BADGE')[];
  slaTargetHours: number; // 24h for CRITICAL, 48h for HIGH
  hoursElapsed: number;
  isOverdue: boolean;
  status: 'DISPATCHED' | 'READ' | 'ACKNOWLEDGED' | 'INTERVENTION_APPLIED' | 'RESOLVED';
  statusLabel: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  consultationPreferredDate?: string;
  createdAt: string;
}

export interface ExecutiveGrowthHealthSummary {
  schoolId: number;
  schoolName: string;
  totalStudents: number;
  screenedStudents: number;
  normalDevelopmentRate: number; // KPI >= 90%
  underweightRate: number; // KPI < 3%
  stuntedRate: number; // KPI < 3%
  obesityRate: number; // KPI < 5%
  abnormalAlertCount: number;
  criticalCasesCount: number;
  interventionsAppliedCount: number;
  pendingInterventionsCount: number;
  kpiComplianceStatus: 'EXCELLENT' | 'COMPLIANT' | 'NEEDS_ACTION';
  topRiskClasses: {
    classId: number;
    className: string;
    gradeLevel: string;
    abnormalCount: number;
    underweightCount: number;
    obeseCount: number;
  }[];
}

