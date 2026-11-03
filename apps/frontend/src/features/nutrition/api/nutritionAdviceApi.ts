import { apiClient } from '../../../core/api/axios';

export interface PickyEatingChildItem {
  studentId: number;
  studentCode: string;
  fullName: string;
  className: string;
  classId: string;
  ageLabel: string;
  gender: string;
  totalMealsTracked: number;
  lowIntakeMealsCount: number;
  averageConsumptionRate: number;
  severityLevel: 'SEVERE' | 'MODERATE' | 'MILD' | 'NORMAL';
  severityLabel: string;
  pickySymptoms: string[];
  allergies: string[];
  teacherNotes: string[];
  parentName: string;
  parentPhone: string;
  parentRelationship: string;
  suggestedAdviceTitle?: string;
  suggestedHomeAdvice?: string;
  micronutrientsFocus: string[];
  recommendedDishes: string[];
  adviceStatus: 'NOT_SENT' | 'SENT' | 'PARENT_CONFIRMED';
  adviceStatusLabel: string;
  latestAdvice?: {
    id: string;
    adviceTitle: string;
    adviceDate: string;
    homeSupplementAdvice: string;
    status: string;
    parentFeedback?: string;
    parentConfirmedAt?: string;
    creatorName: string;
  } | null;
}

export interface PickyEatingClassOption {
  id: string;
  name: string;
  ageGroup?: string;
}

export interface PickyEatingDetectResponse {
  success: boolean;
  summary: {
    totalDetected: number;
    severeCount: number;
    moderateCount: number;
    mildCount: number;
    advisedCount: number;
    confirmedCount: number;
  };
  classes?: PickyEatingClassOption[];
  items: PickyEatingChildItem[];
}

export interface SendAdvicePayload {
  studentId: number;
  severityLevel?: string;
  adviceTitle: string;
  pickySymptoms?: string[];
  homeSupplementAdvice: string;
  recommendedDishes?: string[];
  micronutrientsFocus?: string[];
}

export interface PickyEatingAdvice {
  id: string;
  studentId: string | number;
  adviceDate: string;
  severityLevel: 'MILD' | 'MODERATE' | 'SEVERE';
  pickySymptoms: string[];
  adviceTitle: string;
  homeSupplementAdvice: string;
  recommendedDishes: string[];
  micronutrientsFocus: string[];
  status: 'DRAFT' | 'SENT' | 'PARENT_CONFIRMED';
  parentFeedback?: string;
  parentConfirmedAt?: string;
  createdAt?: string;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface ChildAdviceResponse {
  hasAdvice: boolean;
  advice: PickyEatingAdvice | null;
}

export const nutritionAdviceApi = {
  detectPickyEating: async (classId?: string, search?: string): Promise<PickyEatingDetectResponse> => {
    const res = await apiClient.get('/nutrition-advice/detect', {
      params: { classId: classId !== 'ALL' ? classId : undefined, search: search?.trim() || undefined },
    });
    return res.data;
  },

  sendAdvice: async (payload: SendAdvicePayload) => {
    const res = await apiClient.post('/nutrition-advice/send', payload);
    return res.data;
  },

  getChildAdvice: async (childId?: string): Promise<ChildAdviceResponse> => {
    const res = await apiClient.get('/nutrition-advice/child-advice', {
      params: childId ? { childId } : undefined,
    });
    return res.data;
  },

  confirmAdvice: async (adviceId: string | number, parentFeedback?: string): Promise<PickyEatingAdvice> => {
    const res = await apiClient.post(`/nutrition-advice/${adviceId}/confirm`, {
      parentFeedback,
    });
    return res.data?.advice || res.data;
  },

  getHistory: async (studentId?: number) => {
    const res = await apiClient.get('/nutrition-advice/history', {
      params: studentId ? { studentId } : undefined,
    });
    return res.data;
  },
};
