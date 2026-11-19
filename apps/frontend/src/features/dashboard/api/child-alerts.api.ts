import { apiClient } from '../../../core/api/axios';

// 1. School Manager Types
export interface UnresolvedAllergenConflictItem {
  id: string;
  type: string;
  studentId: string;
  studentName: string;
  className: string;
  allergen: string;
  dishToday: string;
  timeLimit: string;
  severity: 'CRITICAL';
  status: 'UNRESOLVED' | 'RESOLVED';
  message: string;
  recommendedAction: string;
}

export interface BroadAnomalyItem {
  id: string;
  type: string;
  classId: string;
  className: string;
  affectedCount: number;
  classSize: number;
  percentage: number;
  severity: 'CRITICAL';
  symptoms: string[];
  message: string;
  recommendedAction: string;
}

export interface OverduePaymentItem {
  id: string;
  type: string;
  studentId: string;
  studentName: string;
  className: string;
  periodName: string;
  amountVnd: number;
  overdueDays: number;
  severity: 'WARNING';
  message: string;
  recommendedAction: string;
}

export interface ParentComplaintItem {
  id: string;
  type: string;
  studentId: string;
  studentName: string;
  className: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  severity: 'WARNING';
  message: string;
  recommendedAction: string;
}

export interface SchoolManagerAlertsResponse {
  role: 'SCHOOL_MANAGER';
  scope: 'ALL_SCHOOL';
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  categories: {
    unresolvedAllergenConflicts: UnresolvedAllergenConflictItem[];
    broadAnomalies: BroadAnomalyItem[];
    overduePayments: OverduePaymentItem[];
    parentComplaints: ParentComplaintItem[];
  };
}

// 2. Nutritionist Types
export interface AllergenCrossMatchingItem {
  id: string;
  type: string;
  studentId: string;
  studentName: string;
  className: string;
  allergenName: string;
  menuDishName: string;
  proposedSubstitute: string;
  scheduledMealDate: string;
  severity: 'CRITICAL' | 'HIGH';
  status: string;
  message: string;
}

export interface GrowthRiskItem {
  id: string;
  type: string;
  studentId: string;
  studentName: string;
  className: string;
  currentWaz: number;
  currentHaz: number;
  currentBaz: number;
  previousStatus: string;
  consecutiveDropPeriods: number;
  severity: 'HIGH';
  diagnosis: string;
  recommendedAction: string;
}

export interface MicronutrientDeficitItem {
  id: string;
  type: string;
  ruleCode: string;
  nutrientName: string;
  actualValue: number;
  standardValue: string;
  menuPeriod: string;
  severity: 'WARNING';
  message: string;
  recommendedAction: string;
}

export interface NutritionistAlertsResponse {
  role: 'NUTRITIONIST';
  scope: 'ALL_SCHOOL_CLINICAL';
  totalAlerts: number;
  categories: {
    allergenCrossMatchingAlerts: AllergenCrossMatchingItem[];
    growthRiskAlerts: GrowthRiskItem[];
    micronutrientDeficitAlerts: MicronutrientDeficitItem[];
  };
}

// 3. Teacher Types
export interface TrayFlaggingItem {
  id: string;
  studentId: string;
  studentName: string;
  tableNumber: string;
  allergen: string;
  originalDish: string;
  substituteDish: string;
  labelTag: string;
  labelColor: string;
  severity: 'CRITICAL';
  isVerifiedByTeacher: boolean;
  message: string;
}

export interface PoorConsumptionItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  consecutiveDays: number;
  averageIntake: string;
  severity: 'WARNING';
  message: string;
  recommendedAction: string;
}

export interface MedicalMedicationItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  parentName: string;
  medicationNote: string;
  severity: 'INFO';
  isAcknowledged: boolean;
  submittedAt: string;
}

export interface TeacherAlertsResponse {
  role: 'TEACHER';
  scope: string;
  classId: string;
  className: string;
  totalAlerts: number;
  trayFlaggingAlerts: TrayFlaggingItem[];
  poorConsumptionAlerts: PoorConsumptionItem[];
  medicalMedicationRequests: MedicalMedicationItem[];
}

// 4. Parent Types
export interface ChildAlertDetail {
  childId: string;
  childName: string;
  studentCode: string;
  className: string;
  menuSafetyAlert: {
    status: string;
    badgeColor: string;
    title: string;
    content: string;
    isSafe: boolean;
  };
  dailyIntakeReport: {
    title: string;
    lunchStatus: string;
    snackStatus: string;
    teacherNote: string;
  };
  healthReminder: {
    title: string;
    nextMeasurementDate: string;
    latestWaz: number;
    statusLabel: string;
    nutritionistAdvice: string;
  };
}

export interface ParentAlertsResponse {
  role: 'PARENT';
  scope: 'MY_CHILDREN';
  totalChildren: number;
  children: ChildAlertDetail[];
}

export interface ResolveAlertPayload {
  alertId: string;
  alertType: string;
  resolutionAction: string;
  notes?: string;
}

export const childAlertsApi = {
  getSummary: async (): Promise<any> => {
    const res = await apiClient.get('/child-alerts/summary');
    return (res as any)?.data || res;
  },

  getSchoolManagerAlerts: async (): Promise<SchoolManagerAlertsResponse> => {
    const res = await apiClient.get('/child-alerts/school-manager');
    return (res as any)?.data || res;
  },

  getNutritionistAlerts: async (): Promise<NutritionistAlertsResponse> => {
    const res = await apiClient.get('/child-alerts/nutritionist');
    return (res as any)?.data || res;
  },

  getTeacherAlerts: async (classId?: string): Promise<TeacherAlertsResponse> => {
    const res = await apiClient.get('/child-alerts/teacher', {
      params: classId ? { classId } : undefined,
    });
    return (res as any)?.data || res;
  },

  getParentAlerts: async (studentId?: string): Promise<ParentAlertsResponse> => {
    const res = await apiClient.get('/child-alerts/parent', {
      params: studentId ? { studentId } : undefined,
    });
    return (res as any)?.data || res;
  },

  resolveAlert: async (payload: ResolveAlertPayload) => {
    const res = await apiClient.post('/child-alerts/resolve', payload);
    return (res as any)?.data || res;
  },
};

