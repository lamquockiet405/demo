import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryParentEvaluationSummaryDto {
  @ApiPropertyOptional({ example: 11, description: 'Tháng báo cáo (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  month?: number;

  @ApiPropertyOptional({ example: 2026, description: 'Năm báo cáo' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Ngày bắt đầu kỳ báo cáo' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Ngày kết thúc kỳ báo cáo' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1, description: 'Mã lớp học' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  classId?: number;

  @ApiPropertyOptional({ example: 'ALL', enum: ['ALL', 'NHA_TRE', 'MAM', 'CHOI', 'LA'] })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({ example: 5, description: 'Lọc theo số sao đánh giá (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rating?: number;

  @ApiPropertyOptional({ example: 'ALL', enum: ['ALL', 'OVERDUE', 'PENDING', 'RESPONDED'] })
  @IsOptional()
  @IsString()
  slaStatus?: string;
}

export interface OverallCsatSummary {
  averageRating: number;
  totalEvaluations: number;
  positiveRate: number;
  positiveCount: number;
  negativeRate: number;
  negativeCount: number;
  isNegativeAlert: boolean; // Cảnh báo đỏ nếu negativeRate > 5%
  participationRate: number;
  totalEnrolledStudents: number;
  respondingParentsCount: number;
  benchmarkTargetText: string;
}

export interface QualityDimensionAnalysis {
  dimensionKey: 'TASTE_TEXTURE' | 'FRESHNESS_TEMP' | 'VISUAL_APPEAL' | 'PORTION_SIZE';
  name: string;
  vietnameseTitle: string;
  questionPrompt: string;
  averageScore: number;
  satisfactionRate: number;
  sampleFeedbackCount: number;
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT';
  representativeRemarks: string[];
}

export interface DishRankingItem {
  id: number;
  dishName: string;
  categoryName: string;
  averageRating: number;
  feedbackCount: number;
  complaintCount: number;
  praiseCount: number;
  primaryComment: string;
  actionRequired: 'INCREASE_FREQUENCY' | 'MANDATORY_RECIPE_IMPROVEMENT' | 'MAINTAIN';
  actionNote: string;
}

export interface DishPopularityRanking {
  topFavoriteDishes: DishRankingItem[];
  topComplainedDishes: DishRankingItem[];
}

export interface SlaPerformanceItem {
  evaluationId: number;
  studentId: number;
  studentName: string;
  className: string;
  rating: number;
  comment: string;
  createdAt: string;
  hoursElapsed: number;
  isUrgent: boolean; // rating <= 2
  slaTargetHours: number; // 4h khẩn cấp vs 24h thông thường
  isOverdue: boolean;
  status: 'PENDING' | 'RESPONDED';
  repliedAt?: string;
  responseContent?: string;
  respondedByName?: string;
}

export interface SlaPerformanceOverview {
  totalReceived: number;
  respondedCount: number;
  pendingCount: number;
  responseRate: number;
  averageResponseHours: number;
  urgentSlaAvgHours: number;
  normalSlaAvgHours: number;
  overdueSlaCount: number;
  urgentPendingCount: number;
  overdueItems: SlaPerformanceItem[];
}

export interface GradeCsatBreakdown {
  gradeLevel: 'NHA_TRE' | 'MAM' | 'CHOI' | 'LA';
  gradeName: string;
  totalStudents: number;
  respondingStudents: number;
  participationRate: number;
  totalEvaluations: number;
  averageRating: number;
  positiveRate: number;
  negativeRate: number;
  pendingIssueCount: number;
  teacherDisciplineScore: string;
}

export interface RecipeImprovementRecord {
  id: number;
  dishId?: number;
  dishName: string;
  issueFeedback: string;
  actionPlan: string;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  createdByRole: string;
  createdByName: string;
  createdAt: string;
  status: 'ASSIGNED_TO_CHEF' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface ParentEvaluationSummaryReport {
  periodTitle: string;
  startDate: string;
  endDate: string;
  overallCsat: OverallCsatSummary;
  qualityDimensions: QualityDimensionAnalysis[];
  dishRanking: DishPopularityRanking;
  slaPerformance: SlaPerformanceOverview;
  gradeBreakdown: GradeCsatBreakdown[];
  recipeImprovements: RecipeImprovementRecord[];
  recentFeedbacks: SlaPerformanceItem[];
}
