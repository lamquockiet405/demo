export interface ElectronicReceiptDto {
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
    paymentMethod: string; // 'VNPAY_QR' | 'VNPAY_ATM'
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

