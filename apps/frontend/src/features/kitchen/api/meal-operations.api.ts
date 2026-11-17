import { apiClient } from '../../../core/api/axios';

export interface ClassBreakdownItem {
  classId: string;
  className: string;
  ageGroup: string;
  enrolled: number;
  presentLunch: number;
  presentSnack: number;
  excusedAbsence: number;
  unexcusedAbsence: number;
  specialDiet: number;
  specialDietChildren: Array<{
    studentId: number;
    studentName: string;
    allergenName: string;
    safeSubstitute: string;
  }>;
}

export interface DishWasteItem {
  dishCategory: string;
  dishName: string;
  wastePercent: number;
  flagged: boolean;
  consecutiveDays: number;
  warning?: string;
}

export interface MealOperationsReportData {
  date: string;
  schoolName: string;
  reconciliation: {
    totalEnrolledStudents: number;
    actualLunchCount: number;
    actualSnackCount: number;
    absentExcusedCount: number;
    absentUnexcusedCount: number;
    totalRefundAmountVnd: number;
    refundPerMealVnd: number;
    specialDietCount: number;
    classBreakdown: ClassBreakdownItem[];
  };
  foodSafetyInspection: {
    decisionStandard: string;
    step1RawCheck: {
      timeRange: string;
      supplierName: string;
      freshness: string;
      packagingIntegrity: string;
      transportTempC: number;
      result: string;
      inspectorName: string;
      checkedAt: string;
      notes: string;
    };
    step2ProcessingCheck: {
      timeRange: string;
      equipmentHygiene: string;
      oneWayKitchenCompliance: boolean;
      coreBoilingTempC: number;
      tempTarget: string;
      result: string;
      inspectorName: string;
      checkedAt: string;
      notes: string;
    };
    step3PreServingCheck: {
      timeRange: string;
      sensoryColorSmell: string;
      trayCount: number;
      result: string;
      inspectorName: string;
      checkedAt: string;
      notes: string;
    };
    sampleRetention24h: {
      fridgeUnit: string;
      storageTempC: number;
      tempRangeStandard: string;
      status: string;
      sampleCount: number;
      samples: Array<{
        dishName: string;
        sampleCode: string;
        weightOrVolume: string;
        isStandard: boolean;
        storedAt: string;
      }>;
      signatories: {
        kitchenHead: { signed: boolean; name: string; signedAt: string | null };
        medicalStaff: { signed: boolean; name: string; signedAt: string | null };
        schoolManager: { signed: boolean; name: string; signedAt: string | null };
      };
    };
  };
  consumptionAndPlateWaste: {
    schoolAverageConsumptionRate: number;
    portionDistribution: {
      full100Pct: number;
      twoThirds: number;
      half: number;
      lessThanOneThird: number;
    };
    dishWasteIndex: DishWasteItem[];
    teacherSensoryFeedback: Array<{
      classId: number;
      className: string;
      temperature: string;
      taste: string;
      cleanliness: string;
      trayCountReceived: number;
      plateWastePercent: number;
      comment: string;
      recordedAt: string;
    }>;
  };
}

export interface SignInspectionPayload {
  date: string;
  step: 'STEP_1_RAW_CHECK' | 'STEP_2_PROCESSING_CHECK' | 'STEP_3_PRE_SERVING_CHECK' | 'RETENTION_24H';
  role: 'KITCHEN_STAFF' | 'MEDICAL_STAFF' | 'SCHOOL_MANAGER';
  signerName: string;
  notes?: string;
}

export interface TeacherSensoryPayload {
  date: string;
  classId: number;
  temperature: string;
  taste: string;
  cleanliness: string;
  comment?: string;
  trayCountReceived?: number;
  plateWastePercent?: number;
}

export const mealOperationsApi = {
  getDailyReport: async (date?: string, schoolId?: number): Promise<MealOperationsReportData> => {
    const params: Record<string, any> = {};
    if (date) params.date = date;
    if (schoolId) params.schoolId = schoolId;
    const res = await apiClient.get<MealOperationsReportData>('/meal-operations/report', { params });
    return res.data;
  },

  signInspection: async (payload: SignInspectionPayload) => {
    const res = await apiClient.post('/meal-operations/sign-inspection', payload);
    return res.data;
  },

  submitTeacherSensory: async (payload: TeacherSensoryPayload) => {
    const res = await apiClient.post('/meal-operations/teacher-sensory', payload);
    return res.data;
  },

  exportReport: async (date?: string, schoolId?: number) => {
    const params: Record<string, any> = {};
    if (date) params.date = date;
    if (schoolId) params.schoolId = schoolId;
    const res = await apiClient.get('/meal-operations/export-report', { params });
    return res.data;
  },
};

