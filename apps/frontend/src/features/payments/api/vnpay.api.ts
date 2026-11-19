import { apiClient } from '../../../core/api/axios';

export interface SnackInvoiceItem {
  id: number;
  registrationId: number;
  invoiceCode: string;
  childId: number;
  childName: string;
  className: string;
  parentName: string;
  parentPhone: string;
  periodName: string;
  servingDays: number;
  pricePerDay: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  statusLabel: string;
  registeredAt: string;
  dueDate: string;
  isOverdue: boolean;
}

export interface ElectronicReceiptData {
  receiptNumber: string;
  invoiceCode: string;
  registrationId: number;
  schoolName: string;
  schoolAddress: string;
  schoolTaxCode: string;
  schoolHotline: string;
  student: {
    id: number;
    fullName: string;
    studentCode: string;
    className: string;
    gradeLevel: string;
  };
  payer: {
    fullName: string;
    phoneNumber: string;
    relation: string;
  };
  serviceDetails: {
    periodName: string;
    serviceName: string;
    servingDays: number;
    unitPricePerDay: number;
    totalAmount: number;
    amountInWords: string;
  };
  paymentInfo: {
    paymentMethod: string;
    vnpayTransactionNo: string;
    bankTransactionNo: string;
    bankCode: string;
    cardType: string;
    payDate: string;
    status: 'PAID';
  };
  digitalSignature: {
    signedBy: string;
    signedAt: string;
    verificationHash: string;
  };
}

export const vnpayApi = {
  getMyInvoices: async (): Promise<SnackInvoiceItem[]> => {
    const res = await apiClient.get<any>('/payments/my-invoices');
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.data)) return raw.data;
    return [];
  },

  createPaymentUrl: async (payload: { registrationId: number; orderInfo?: string; returnUrl?: string }) => {
    const finalPayload = {
      returnUrl: typeof window !== 'undefined' ? `${window.location.origin}/payments/vnpay-return` : undefined,
      ...payload,
    };
    const res = await apiClient.post<any>('/payments/create-url', finalPayload);
    const raw = res.data;
    if (raw && typeof raw === 'object' && 'paymentUrl' in raw) return raw;
    if (raw?.data && typeof raw.data === 'object' && 'paymentUrl' in raw.data) return raw.data;
    return raw;
  },

  verifyReturnUrl: async (params: Record<string, string>) => {
    const res = await apiClient.get<any>('/payments/vnpay-return', { params });
    const raw = res.data;
    if (raw && typeof raw === 'object' && 'isSuccess' in raw) return raw;
    if (raw?.data && typeof raw.data === 'object' && 'isSuccess' in raw.data) return raw.data;
    return raw;
  },

  getReceipt: async (registrationId: number): Promise<ElectronicReceiptData> => {
    const res = await apiClient.get<any>(
      `/payments/receipt/${registrationId}`,
    );
    const raw = res.data;
    if (raw && typeof raw === 'object' && 'receiptNumber' in raw) return raw;
    if (raw?.data && typeof raw.data === 'object' && 'receiptNumber' in raw.data) return raw.data;
    return raw;
  },
};

