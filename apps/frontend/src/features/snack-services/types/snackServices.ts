export interface SnackServiceItem {
  id: string;
  name: string;
  description: string;
  serviceType: string;
  billingCycle: string;
  pricePerUnit: number;
  monthlyEstimatedPrice: number;
  appliedGrade: string;
  registrationPeriod: string;
  appliedMonth: string;
  registeredCount: number;
  targetCount: number;
  percentage: number;
  progressNote: string;
  status: 'OPEN' | 'UPCOMING' | 'CLOSED';
  statusLabel: string;
  badges: string[];
  isActive: boolean;
}

export interface SnackServicesSummary {
  activeBatches: {
    total: number;
    open: number;
    upcoming: number;
    closed: number;
  };
  studentParticipation: {
    registered: number;
    total: number;
    percentage: number;
    remaining: number;
  };
  revenue: {
    expectedMonthly: number;
    collected: number;
    collectedPercentage: number;
  };
  satisfaction: {
    ratePercent: number;
    ratingScore: number;
    totalReviews: number;
  };
}

export interface SnackServicesResponse {
  success: boolean;
  summary: SnackServicesSummary;
  totalCount: number;
  data: SnackServiceItem[];
}

// UC56 Types
export interface SnackServiceListItem {
  id: string;
  name: string;
  serviceType: string;
  pricePerUnit: number;
}

export interface SnackServiceListResponse {
  success: boolean;
  data: SnackServiceListItem[];
}

export interface CreateSnackServicePeriodDto {
  snackServiceId: string;
  periodCode: string;
  appliedGrades: string[];
  isWholeSchool: boolean;
  registrationStart: string;
  registrationEnd: string;
  serviceMonths: string[];
  pricePerUnitPerDay: number;
  autoRefundEnabled: boolean;
  capacityMode: 'UNLIMITED' | 'LIMITED';
  kitchenCapacity?: number;
  totalQuota?: number;
  quotaPerGrade?: Record<string, number>;
  autoCloseEnabled: boolean;
  autoCloseThresholdPercent?: number;
  nutritionNotes?: string;
  status: 'DRAFT' | 'ACTIVE';
}

export interface CreatePeriodResponse {
  success: boolean;
  message: string;
  data: any;
}

// UC57 Types
export interface UpdateSnackServiceDto {
  name?: string;
  description?: string;
  serviceType?: string;
  billingCycle?: string;
  pricePerUnit?: number;
  isActive?: boolean;
  availableFrom?: string;
  availableTo?: string;
}

export interface SnackServiceDetailEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  serviceType: string;
  billingCycle: string;
  pricePerUnit: number;
  isActive: boolean;
  availableFrom: string;
  availableTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnackServiceDetailResponse {
  success: boolean;
  data: SnackServiceDetailEntity;
}

export interface UpdateSnackServiceResponse {
  success: boolean;
  message: string;
  data: SnackServiceDetailEntity;
}

// ======================== UC60 & UC61 Types ========================
export interface RosterItem {
  studentId: number;
  studentCode: string;
  fullName: string;
  avatar?: string;
  classId: number;
  className: string;
  ageGroup: string;
  snackServiceName: string;
  periodCode: string;
  pricePerDay: number;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'UNKNOWN';
  portionStatus: 'PENDING' | 'SERVED' | 'SKIPPED';
  hasAllergy: boolean;
  allergyNames: string[];
}

export interface RosterSummary {
  totalRegistered: number;
  presentToday: number;
  absentToday: number;
  servedCount: number;
  pendingCount: number;
  totalClasses: number;
}

export interface RosterResponse {
  success: boolean;
  period?: {
    id: string;
    periodCode: string;
    snackServiceName: string;
    serviceMonths: string[];
    status: string;
    pricePerUnitPerDay: number;
  };
  summary: RosterSummary;
  data: RosterItem[];
  classes: { id: number; name: string; ageGroup: string }[];
}

export interface RosterFilters {
  search: string;
  classId: string;
  ageGroup: string;
  attendanceStatus: string;
  portionStatus: string;
  allergyOnly: boolean;
}


