import { apiClient } from '../../../core/api/axios';

export interface QueryParentEvaluationSummaryParams {
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  classId?: number;
  gradeLevel?: string;
  rating?: number;
  slaStatus?: string;
}

export interface OverallCsatSummary {
  averageRating: number;
  totalEvaluations: number;
  positiveRate: number;
  positiveCount: number;
  negativeRate: number;
  negativeCount: number;
  isNegativeAlert: boolean;
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
  isUrgent: boolean;
  slaTargetHours: number;
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

export interface RespondSpecialistPayload {
  responseContent: string;
  responseCategory?: 'NUTRITION_ADVICE' | 'MANAGEMENT_RESOLUTION' | 'GENERAL';
  sendPushNotification?: boolean;
}

export interface CreateRecipeImprovementPayload {
  dishId?: number;
  dishName: string;
  issueFeedback: string;
  actionPlan: string;
  priority?: string;
}

export const parentEvaluationSummaryApi = {
  getSummaryReport: async (
    params: QueryParentEvaluationSummaryParams,
  ): Promise<ParentEvaluationSummaryReport> => {
    const res = await apiClient.get('/parent-evaluations/summary-report', { params });
    return res.data;
  },

  respondSpecialist: async (
    evaluationId: number | string,
    payload: RespondSpecialistPayload,
  ): Promise<any> => {
    const res = await apiClient.post(
      `/parent-evaluations/${evaluationId}/respond-specialist`,
      payload,
    );
    return res.data;
  },

  createRecipeImprovementLog: async (
    payload: CreateRecipeImprovementPayload,
  ): Promise<RecipeImprovementRecord> => {
    const res = await apiClient.post('/parent-evaluations/recipe-improvement-log', payload);
    return res.data;
  },

  getRecipeImprovementLogs: async (): Promise<RecipeImprovementRecord[]> => {
    const res = await apiClient.get('/parent-evaluations/recipe-improvement-logs');
    return res.data;
  },

  exportSummaryReport: async (params: QueryParentEvaluationSummaryParams): Promise<any> => {
    const res = await apiClient.get('/parent-evaluations/summary-report/export', { params });
    return res.data;
  },
};

