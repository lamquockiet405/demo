export interface SnackMenuDayItem {
  dayOfWeek: number;
  dayLabel: string;
  servingTime: string;
  mainDish: string;
  drinkItem: string;
  fruitOrSide: string;
  caloriesKcal: number;
  proteinG: number;
  calciumMg: number;
  allergenTags: string[];
  nutritionNote?: string;
}

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
  paidCount?: number;
  totalRevenue?: number;
  menuSchedule?: SnackMenuDayItem[];
  hidePaymentInfo?: boolean;
}

export interface ParentSnackPackageItem {
  periodId: number;
  periodName: string;
  description: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  servingDays: number;
  pricePerDay: number;
  feeAmount: number;
  periodStatus: string;
  registrationId: number | null;
  paymentStatus: 'PAID' | 'PENDING' | 'NOT_REGISTERED' | string;
  isPaid: boolean;
  canViewSchedule: boolean;
  menuSchedule: SnackMenuDayItem[];
}

export interface ParentSnackOverviewResponse {
  success: boolean;
  student: {
    id: number;
    fullName: string;
    studentCode: string;
    className: string;
  };
  hasPaidAnyPackage: boolean;
  activeSchedule: SnackMenuDayItem[];
  paidPackageName: string | null;
  publishedPackages: ParentSnackPackageItem[];
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
  hidePaymentInfo?: boolean;
}

// UC56 Types
export interface SnackServiceListItem {
  id: string;
  name: string;
  description?: string;
  serviceType: string;
  billingCycle?: string;
  pricePerUnit: number;
  isActive?: boolean;
  enrolledCount?: number;
}

export interface SnackServiceListResponse {
  success: boolean;
  data: SnackServiceListItem[];
}

export interface CreateSnackServicePeriodDto {
  name?: string;
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
  status: 'DRAFT' | 'ACTIVE' | 'OPEN';
}

export interface CreatePeriodResponse {
  success: boolean;
  message: string;
  warning?: string;
  data: any;
}

// UC57 Types
export interface UpdateSnackServiceDto {
  name?: string;
  description?: string;
  serviceType?: string;
  billingCycle?: string;
  pricePerUnit?: number;
  feeAmount?: number;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  status?: string;
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
  paidCount?: number;
  availableFrom: string;
  availableTo: string | null;
  createdAt: string;
  updatedAt: string;
  menuSchedule?: SnackMenuDayItem[];
}

export interface SnackServiceDetailResponse {
  success: boolean;
  data: SnackServiceDetailEntity;
}

export interface UpdateSnackServiceResponse {
  success: boolean;
  message: string;
  warning?: string;
  data: SnackServiceDetailEntity;
}

// UC61 Types - Đăng ký dịch vụ ăn xế (Kiểm tra quy tắc dị ứng)
export interface RegisterSnackServiceDto {
  periodId: number;
  studentId: number;
  parentId?: number;
  acceptRisk?: boolean;
  dietaryNote?: string;
  paymentMethod?: string;
  markAsPaid?: boolean;
}

export interface CheckAllergyResponse {
  success: boolean;
  hasAllergy: boolean;
  isConflict: boolean;
  isDangerous: boolean;
  severity: 'NONE' | 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH';
  conflictingAllergens: string[];
  allergyNames: string[];
  warning?: string;
  statusMessage: string;
}

export interface AvailableStudentItem {
  id: string;
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  className: string;
  classId?: string;
  hasAllergy: boolean;
  allergies: Array<{
    allergenName: string;
    allergenCode: string;
    severity: string;
    note?: string;
  }>;
  isRegistered: boolean;
}

export interface AvailableStudentsResponse {
  success: boolean;
  data: AvailableStudentItem[];
}

export interface RegisterSnackServiceResponse {
  success: boolean;
  message: string;
  warning?: string;
  isExisting?: boolean;
  data: {
    id: string;
    periodId: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    className: string;
    parentId: string;
    status: string;
    feeAmount: number;
    hasAllergy: boolean;
    allergyNames: string[];
    registeredAt: string;
  };
}
