import { apiClient } from '../../../core/api/axios';

export interface AgingDebtItem {
  registrationId: number;
  studentId: number;
  studentName: string;
  className: string;
  parentName: string;
  parentPhone: string;
  amount: number;
  registeredAt: string;
  daysOverdue: number;
  status: string;
}

export interface StudentCreditItem {
  studentId: number;
  studentName: string;
  className: string;
  parentName: string;
  excusedDaysCount: number;
  refundAmount: number;
  status: 'CREDITED_NEXT_MONTH' | 'REFUNDED_CASH';
}

export interface GradeRevenueBreakdown {
  gradeLevel: string;
  gradeName: string;
  registeredCount: number;
  expectedRevenue: number;
  collectedRevenue: number;
  collectionRate: number;
}

export interface VnpayTransactionItem {
  transactionCode: string;
  studentName: string;
  className: string;
  parentName?: string;
  parentPhone?: string;
  packageName?: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  bankRef: string;
  status: 'MATCHED' | 'PENDING_CLEARING';
}

export interface SnackRevenueReportData {
  schoolName: string;
  period: {
    month: number;
    year: number;
    periodName: string;
    daysInMonth: number;
    serviceFeePerDay: number;
  };
  collectionSummary: {
    expectedRevenue: number;
    collectedRevenue: number;
    pendingDebtAmount: number;
    collectionRate: number;
    isTargetReached: boolean;
    targetRate: number;
    totalRegisteredStudents: number;
    paidStudents: number;
    pendingStudents: number;
  };
  attendanceReconciliation: {
    totalExcusedAbsences: number;
    refundPerSnack: number;
    totalRefundAmount: number;
    creditBalanceAppliedNextMonth: number;
    reconciliationStudents: StudentCreditItem[];
  };
  costStructure: {
    ingredientCost70Pct: {
      percentage: number;
      amount: number;
      description: string;
    };
    serviceCost20Pct: {
      percentage: number;
      amount: number;
      description: string;
    };
    paymentFeeAndAdmin10Pct: {
      percentage: number;
      amount: number;
      description: string;
    };
    netOperatingSurplus: number;
  };
  gradeBreakdown: GradeRevenueBreakdown[];
  agingDebts: AgingDebtItem[];
  vnpayTransactions: VnpayTransactionItem[];
}

export interface QuerySnackRevenueParams {
  month?: number;
  year?: number;
  serviceType?: string;
  schoolId?: number;
}

export interface SendDebtReminderPayload {
  registrationIds: number[];
  channel?: 'SMS' | 'APP_PUSH' | 'ALL';
  customMessage?: string;
}

export const snackRevenueApi = {
  getReport: async (params?: QuerySnackRevenueParams): Promise<SnackRevenueReportData> => {
    const res = await apiClient.get<SnackRevenueReportData>('/snack-revenue/report', { params });
    return res.data;
  },

  getAgingDebts: async (params?: QuerySnackRevenueParams): Promise<AgingDebtItem[]> => {
    const res = await apiClient.get<AgingDebtItem[]>('/snack-revenue/aging-debts', { params });
    return res.data;
  },

  sendDebtReminder: async (payload: SendDebtReminderPayload) => {
    const res = await apiClient.post('/snack-revenue/send-debt-reminder', payload);
    return res.data;
  },

  getReconciliationDetails: async (params?: QuerySnackRevenueParams) => {
    const res = await apiClient.get('/snack-revenue/reconciliation-details', { params });
    return res.data;
  },

  getVnpayReconciliation: async (params?: QuerySnackRevenueParams): Promise<VnpayTransactionItem[]> => {
    const res = await apiClient.get<VnpayTransactionItem[]>('/snack-revenue/vnpay-reconciliation', { params });
    return res.data;
  },

  exportFinancialReport: async (params?: QuerySnackRevenueParams) => {
    const res = await apiClient.get('/snack-revenue/export-financial-report', { params });
    return res.data;
  },
};

