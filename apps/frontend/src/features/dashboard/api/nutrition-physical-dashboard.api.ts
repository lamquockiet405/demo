import { apiClient } from '../../../core/api/axios';

export interface SchoolManagerKpiSummary {
  totalStudents: number;
  evaluatedStudents: number;
  normalCount: number;
  normalRate: number;
  normalTarget: number;
  normalStatus: 'PASS' | 'WARNING' | 'ALERT';
  underweightCount: number;
  underweightRate: number;
  underweightTarget: number;
  underweightStatus: 'PASS' | 'WARNING' | 'ALERT';
  stuntedCount: number;
  stuntedRate: number;
  stuntedTarget: number;
  stuntedStatus: 'PASS' | 'WARNING' | 'ALERT';
  overweightObeseCount: number;
  overweightObeseRate: number;
  overweightObeseTarget: number;
  overweightObeseStatus: 'PASS' | 'WARNING' | 'ALERT';
  menuComplianceRate: number;
  menuComplianceStatus: string;
}

export interface GradeBreakdownItem {
  gradeCode: string;
  gradeName: string;
  totalStudents: number;
  evaluatedStudents: number;
  normalCount: number;
  normalRate: number;
  underweightCount: number;
  underweightRate: number;
  stuntedCount: number;
  stuntedRate: number;
  overweightObeseCount: number;
  overweightObeseRate: number;
}

export interface HistoricalTrendItem {
  period: string;
  normalRate: number;
  underweightRate: number;
  stuntedRate: number;
  overweightRate: number;
}

export interface ExecutiveActionItem {
  id: string;
  title: string;
  description: string;
  status: string;
  recommendedAmountVnd?: number;
}

export interface SchoolManagerOverviewResponse {
  kpis: SchoolManagerKpiSummary;
  gradeBreakdown: GradeBreakdownItem[];
  historicalTrends: HistoricalTrendItem[];
  executiveActions: ExecutiveActionItem[];
}

export interface MicronutrientStatus {
  name: string;
  actual: number;
  unit: string;
  standard: string;
  status: 'OPTIMAL' | 'DEFICIT' | 'EXCESS';
}

export interface ClinicalNutrition {
  dailyAvgCalories: number;
  targetCaloriesRange: string;
  dailyCaloriesTargetPct: string;
  caloriesStatus: string;
  plgRatio: {
    proteinPct: number;
    fatPct: number;
    carbPct: number;
    standardRatio: string;
    standardRange: string;
    ratioStatus: string;
  };
  animalProtein: {
    pct: number;
    targetPct: number;
    status: string;
    standardDescription: string;
  };
  micronutrients: MicronutrientStatus[];
}

export interface AtRiskStudentItem {
  id: string;
  fullName: string;
  studentCode: string;
  className: string;
  ageInMonths: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  bmi: number;
  waz: number;
  haz: number;
  baz: number;
  classification: string;
  diagnosis: string;
  recommendedAction: string;
  measuredDate: string;
}

export interface ClassBreakdownItem {
  classId: string;
  className: string;
  ageGroup: string;
  totalStudents: number;
  evaluatedCount: number;
  atRiskCount: number;
  avgCalories: number;
  complianceRate: number;
}

export interface NutritionistClinicalOverviewResponse {
  clinicalNutrition: ClinicalNutrition;
  atRiskStudents: AtRiskStudentItem[];
  classBreakdown: ClassBreakdownItem[];
}

export interface ApproveBudgetPayload {
  gradeCode: string;
  amountVnd: number;
  notes?: string;
  semester?: string;
}

export interface CreatePersonalizedDietPayload {
  studentId: number;
  dietType: string;
  adjustmentNotes: string;
  targetCalories?: number;
  extraSupplements?: string[];
}

export interface ScheduleParentConsultationPayload {
  studentId: number;
  scheduledDate: string;
  consultationTopic: string;
  notes?: string;
}

export const nutritionPhysicalDashboardApi = {
  getSchoolManagerOverview: async (): Promise<SchoolManagerOverviewResponse> => {
    const res = await apiClient.get('/dashboard/nutrition-physical/school-manager');
    return (res as any)?.data || res;
  },

  getNutritionistClinicalOverview: async (classId?: string): Promise<NutritionistClinicalOverviewResponse> => {
    const res = await apiClient.get('/dashboard/nutrition-physical/nutritionist', {
      params: classId ? { classId } : undefined,
    });
    return (res as any)?.data || res;
  },

  approveBudget: async (payload: ApproveBudgetPayload) => {
    const res = await apiClient.post('/dashboard/nutrition-physical/action/budget', payload);
    return (res as any)?.data || res;
  },

  createPersonalizedDiet: async (payload: CreatePersonalizedDietPayload) => {
    const res = await apiClient.post('/dashboard/nutrition-physical/action/diet', payload);
    return (res as any)?.data || res;
  },

  scheduleParentConsultation: async (payload: ScheduleParentConsultationPayload) => {
    const res = await apiClient.post('/dashboard/nutrition-physical/action/consult', payload);
    return (res as any)?.data || res;
  },

  exportNutritionReport: async (semester?: string) => {
    const res = await apiClient.get('/dashboard/nutrition-physical/export-report', {
      params: semester ? { semester } : undefined,
    });
    return (res as any)?.data || res;
  },
};

