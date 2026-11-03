import { apiClient } from '../../../core/api/axios';
import {
  AttendanceResponse,
  ClassItem,
  MealOption,
  MealEvaluationResponse,
  PortionType,
  SchoolHeadcountSummaryResponse
} from '../types';

export interface DispatchKitchenRosterResponse {
  success: boolean;
  date: string;
  classId: string;
  dispatchedAt: string;
  totalPaidStudents: number;
  presentPaidCount: number;
  absentPaidCount: number;
  dispatchedSnackPortions: number;
  standardPortions: number;
  allergyReplacementPortions: number;
  kitchenPortions: {
    totalPortionsToPrepare: number;
    standardPortions: number;
    allergySecurePortions: number;
  };
  message: string;
}

export interface KitchenSnackPortionsResponse {
  success: boolean;
  date: string;
  totalPaidStudents: number;
  totalSnackPortionsToPrepare: number;
  totalPortionsToPrepare: number;
  standardPortions: number;
  specialAllergyPortions: number;
  allergySecurePortions: number;
  students?: any[];
  todaySnackMenu?: {
    servingTime: string;
    mainDish: string;
    drinkItem: string;
    fruitOrSide: string;
    caloriesKcal: number;
  };
  classPortions?: any[];
}

export const attendanceApi = {
  getClasses: async (): Promise<ClassItem[]> => {
    const res = await apiClient.get('/attendance/classes');
    return Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
  },

  getSchoolHeadcountSummary: async (date?: string): Promise<SchoolHeadcountSummaryResponse> => {
    const res = await apiClient.get('/attendance/school-summary', { params: { date } });
    return res.data;
  },

  getAttendanceList: async (params: {
    classId?: string;
    date?: string;
    mealFilter?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AttendanceResponse> => {
    const res = await apiClient.get('/attendance', { params });
    return res.data;
  },

  updateChildAttendance: async (
    childId: string,
    data: {
      date: string;
      mealOption: MealOption;
      notes?: string;
    },
  ) => {
    const res = await apiClient.put(`/attendance/child/${childId}`, data);
    return res.data;
  },

  markAllPresent: async (data: {
    classId: string;
    date: string;
    mealOption?: MealOption;
  }) => {
    const res = await apiClient.post('/attendance/mark-all', data);
    return res.data;
  },

  syncFromMorning: async (data: {
    classId: string;
    date: string;
  }) => {
    const res = await apiClient.post('/attendance/sync-morning', data);
    return res.data;
  },

  lockAndSendToKitchen: async (data: {
    classId: string;
    date: string;
    notes?: string;
    isLocked?: boolean;
  }) => {
    const res = await apiClient.post('/attendance/lock-kitchen', data);
    return res.data;
  },

  // =========================================================================
  // UC62: ĐÁNH GIÁ MỨC ĐỘ ĂN CỦA TRẺ SAU BỮA API
  // =========================================================================

  getEvaluationList: async (params: {
    classId?: string;
    date?: string;
    mealType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<MealEvaluationResponse> => {
    const res = await apiClient.get('/attendance/evaluation', { params });
    return res.data;
  },

  updateChildEvaluation: async (
    childId: string,
    data: {
      date: string;
      mealType?: string;
      portionConsumed: PortionType;
      waterIntake?: string;
      notes?: string;
      syncStatus?: string;
    },
  ) => {
    const res = await apiClient.put(`/attendance/evaluation/child/${childId}`, data);
    return res.data;
  },

  batchUpdatePortion: async (data: {
    classId: string;
    date: string;
    mealType?: string;
    childIds?: string[];
    portionConsumed: PortionType;
  }) => {
    const res = await apiClient.post('/attendance/evaluation/batch', data);
    return res.data;
  },

  updateSensoryEvaluation: async (data: {
    classId: string;
    date: string;
    mealType?: string;
    softnessScore?: number;
    temperatureScore?: number;
    excitementScore?: number;
    foodSafetyChecked?: boolean;
    chefFeedback?: string;
    isLocked?: boolean;
  }) => {
    const res = await apiClient.put('/attendance/evaluation/sensory', data);
    return res.data;
  },

  lockAndSendEvaluation: async (data: {
    classId: string;
    date: string;
    mealType?: string;
    chefFeedback?: string;
  }) => {
    const res = await apiClient.post('/attendance/evaluation/lock', data);
    return res.data;
  },

  // =========================================================================
  // UC63: XEM LỊCH SỬ ĐIỂM DANH VÀ SỨC ĂN
  // =========================================================================

  getHistoryList: async (params: {
    classId?: string;
    startDate?: string;
    endDate?: string;
    period?: 'week' | 'month' | 'semester' | 'custom';
    status?: string;
    search?: string;
    viewMode?: 'table' | 'by_child';
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get('/attendance/history', { params });
    return res.data;
  },

  // =========================================================================
  // VIEW & FILTER SNACK SERVICE ROSTER (TEACHER & KITCHEN)
  // =========================================================================

  getSnackRoster: async (params: {
    search?: string;
    gradeLevel?: string;
    classId?: string;
    date?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get('/snack-roster', { params });
    return res.data;
  },

  markSnackAttendance: async (
    studentId: string,
    data: {
      date?: string;
      isAttended: boolean;
      note?: string;
    },
  ) => {
    const res = await apiClient.put(`/snack-roster/${studentId}/attendance`, data);
    return res.data;
  },

  dispatchSnackRosterToKitchen: async (data: {
    classId?: string;
    date?: string;
    notes?: string;
  }) => {
    const res = await apiClient.post('/snack-roster/dispatch-kitchen', data);
    return res.data;
  },

  getKitchenSnackPortions: async (date?: string) => {
    const res = await apiClient.get('/snack-roster/kitchen-portions', { params: { date } });
    return res.data;
  },

  // =========================================================================
  // SYNC REAL-TIME MEAL PORTIONS (WEBSOCKET) - KDS APIS
  // =========================================================================

  getKitchenKdsData: async (date?: string) => {
    const res = await apiClient.get('/attendance/kitchen-kds', { params: { date } });
    return res.data;
  },

  updateKitchenStatus: async (data: {
    classId: string;
    status: 'WAITING' | 'PREPARING' | 'PORTIONING' | 'READY_DELIVERY' | 'DELIVERED' | 'COMPLETED';
    actorName?: string;
  }) => {
    const res = await apiClient.post('/attendance/kitchen/status', data);
    return res.data;
  },

  // =========================================================================
  // FOOD SAFETY 3-STEP INSPECTION & 24H SAMPLE RETENTION APIS
  // =========================================================================

  getFoodSafetyLogs: async () => {
    const res = await apiClient.get('/inspections');
    return res.data;
  },

  createFoodSafetyLog: async (data: any) => {
    const res = await apiClient.post('/inspections/step1', data);
    return res.data;
  },

  getSampleRetentionRecords: async () => {
    const res = await apiClient.get('/inspections/samples');
    return res.data;
  },

  createSampleRetentionRecord: async (data: any) => {
    const res = await apiClient.post('/inspections/samples', data);
    return res.data;
  },

  disposeSampleRetentionRecord: async (id: string) => {
    const res = await apiClient.patch(`/inspections/samples/${id}/dispose`);
    return res.data;
  },
};
