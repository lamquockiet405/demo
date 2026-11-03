import { apiClient } from '../../../core/api/axios';

export interface SupplierItem {
  id: number;
  name: string;
  certType: string;
  certNumber: string;
  expiryDate: string;
  totalDeliveries: number;
  rejectedDeliveries: number;
  rejectRate: number;
  isRejectRateAlert: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'UNDER_REVIEW';
  suspensionReason?: string;
}

export interface SensoryIncidentItem {
  id: number;
  date: string;
  dishName: string;
  incident: string;
  chemicalOrAdditiveSafetyStatus: string;
  nutritionistAnalysis: string;
  actionTaken: string;
  reviewer: string;
  status: 'RESOLVED' | 'PENDING';
}

export interface FoodSafetyComplianceReportData {
  schoolName: string;
  reportPeriod: {
    month: number;
    year: number;
    targetDate: string;
  };
  overallComplianceRate: number;
  zeroDefectStatus: 'COMPLIANT' | 'WARNING' | 'ALERT';
  inspection3Step: {
    decisionStandard: string;
    step1RawCheckCompliance: number;
    step2ProcessingCheckCompliance: number;
    step3PreServingCheckCompliance: number;
    photoAuditTrail: {
      totalInspections: number;
      withPhotoCount: number;
      photoRate: number;
      isCompliant: boolean;
      threshold: number;
      samplePhotos: Array<{
        step: string;
        title: string;
        imageUrl: string;
        uploadedAt: string;
      }>;
    };
    temperatureLogs: {
      avgTransportTempC: number;
      avgCoreBoilingTempC: number;
      minCoreBoilingTempC: number;
      coreTempThreshold: number;
    };
  };
  sampleRetention24h: {
    decisionStandard: string;
    sampleRetentionRate: number;
    totalSamplesStored: number;
    standardWeightComplianceRate: number;
    fridgeStatus: {
      unitName: string;
      currentTempC: number;
      standardRange: string;
      powerStatus: 'NORMAL' | 'OUTAGE';
      isRedAlert: boolean;
      hourlyTrend: Array<{ hour: string; tempC: number; status: string }>;
    };
    samples: Array<{
      id: string;
      sampleCode: string;
      dishName: string;
      weightOrVolume: string;
      isStandard: boolean;
      storedAt: string;
      disposeAt: string;
      status: string;
      tripartiteSigned: boolean;
    }>;
  };
  legalAndCertificates: {
    schoolFoodSafetyLicense: {
      certNumber: string;
      issueDate: string;
      expiryDate: string;
      status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
      daysRemaining: number;
    };
    staffCompliance: {
      totalKitchenStaff: number;
      validHealthCardCount: number;
      healthCardRate: number;
      validTrainingCertCount: number;
      trainingCertRate: number;
      expiringWithin30Days: number;
      staffList: Array<{
        name: string;
        position: string;
        greenHealthCardExpiry: string;
        trainingCertExpiry: string;
        status: string;
      }>;
    };
    waterTesting: {
      lastTestDate: string;
      standardRef: string;
      drinkingWaterResult: string;
      domesticWaterResult: string;
      nextTestDueDate: string;
      labName: string;
      isCompliant: boolean;
    };
    suppliers: SupplierItem[];
  };
  sensoryIncidentReviews: SensoryIncidentItem[];
  monthlySignatures: {
    isSigned: boolean;
    signedBy?: string;
    signedRole?: string;
    signedAt?: string;
    notes?: string;
  };
}

export interface SignMonthlyLogPayload {
  month: number;
  year: number;
  signerName: string;
  signerRole: 'SCHOOL_MANAGER' | 'PRINCIPAL' | 'SUPER_ADMIN';
  notes?: string;
}

export interface NutritionistReviewPayload {
  date: string;
  dishName: string;
  incidentDescription: string;
  chemicalOrAdditiveSafetyStatus?: string;
  nutritionistAnalysis: string;
  actionTaken: string;
  reviewerName: string;
}

export interface SuspendSupplierPayload {
  supplierId: number;
  reason: string;
  decisionBy: string;
}

export const foodSafetyApi = {
  getComplianceReport: async (
    date?: string,
    month?: number,
    year?: number,
    schoolId?: number,
  ): Promise<FoodSafetyComplianceReportData> => {
    const params: Record<string, any> = {};
    if (date) params.date = date;
    if (month) params.month = month;
    if (year) params.year = year;
    if (schoolId) params.schoolId = schoolId;
    const res = await apiClient.get<FoodSafetyComplianceReportData>('/food-safety/compliance-report', { params });
    return res.data;
  },

  signMonthlyLog: async (payload: SignMonthlyLogPayload) => {
    const res = await apiClient.post('/food-safety/sign-monthly-log', payload);
    return res.data;
  },

  submitNutritionistReview: async (payload: NutritionistReviewPayload) => {
    const res = await apiClient.post('/food-safety/nutritionist-review', payload);
    return res.data;
  },

  suspendSupplier: async (payload: SuspendSupplierPayload) => {
    const res = await apiClient.post('/food-safety/suspend-supplier', payload);
    return res.data;
  },

  exportComplianceDossier: async (date?: string, month?: number, year?: number) => {
    const params: Record<string, any> = {};
    if (date) params.date = date;
    if (month) params.month = month;
    if (year) params.year = year;
    const res = await apiClient.get('/food-safety/export-compliance-dossier', { params });
    return res.data;
  },
};

