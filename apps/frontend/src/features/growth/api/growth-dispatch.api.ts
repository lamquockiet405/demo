import { apiClient } from '../../../core/api/axios';

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
  slaTargetHours: number;
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
  normalDevelopmentRate: number;
  underweightRate: number;
  stuntedRate: number;
  obesityRate: number;
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

export interface QueryGrowthNotificationsParams {
  role?: string;
  classId?: number;
  studentId?: number;
  severity?: string;
  status?: string;
}

export interface AcknowledgeNotificationPayload {
  notificationId: number;
  note?: string;
}

export interface AssignInterventionDietPayload {
  notificationId: number;
  interventionDietTitle: string;
  calorieAdjustmentKcal?: number;
  nutritionGuidance: string;
  recheckDate?: string;
}

export interface RequestConsultationPayload {
  notificationId: number;
  preferredDate: string;
  notes?: string;
}

export interface ApproveInterventionBudgetPayload {
  notificationIds: number[];
  approvedBudgetAmount: number;
  decisionNotes: string;
}

export const growthDispatchApi = {
  scanAndDispatch: async () => {
    const res = await apiClient.post<{
      scannedCount: number;
      abnormalCount: number;
      dispatchedNotificationsCount: number;
      summary: string;
    }>('/growth-notifications/scan-dispatch');
    return res.data;
  },

  getNotifications: async (params?: QueryGrowthNotificationsParams) => {
    const res = await apiClient.get<{
      data: GrowthNotificationItem[];
      total: number;
      roleScope: string;
    }>('/growth-notifications', { params });
    return res.data;
  },

  getExecutiveSummary: async () => {
    const res = await apiClient.get<ExecutiveGrowthHealthSummary>(
      '/growth-notifications/executive-summary',
    );
    return res.data;
  },

  acknowledge: async (id: number, note?: string) => {
    const res = await apiClient.put<GrowthNotificationItem>(
      `/growth-notifications/${id}/acknowledge`,
      { notificationId: id, note },
    );
    return res.data;
  },

  assignInterventionDiet: async (payload: AssignInterventionDietPayload) => {
    const res = await apiClient.post<GrowthNotificationItem>(
      '/growth-notifications/assign-intervention',
      payload,
    );
    return res.data;
  },

  requestConsultation: async (payload: RequestConsultationPayload) => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      consultationDate: string;
    }>('/growth-notifications/request-consultation', payload);
    return res.data;
  },

  approveBudget: async (payload: ApproveInterventionBudgetPayload) => {
    const res = await apiClient.post<{
      success: boolean;
      approvedCount: number;
      totalAmount: number;
      message: string;
    }>('/growth-notifications/approve-budget', payload);
    return res.data;
  },
};
