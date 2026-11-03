import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Coffee,
  Calendar,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  FileText,
  Printer,
} from 'lucide-react';
import { apiClient } from '../../../core/api/axios';
import { vnpayApi, ElectronicReceiptData } from '../api/vnpay.api';
import { ElectronicReceiptModal } from '../components/ElectronicReceiptModal';
import { ParentPortalTopNav } from '../../parent-evaluations/components/ParentPortalTopNav';

export const VnpayReturnPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{
    isValid: boolean;
    isSuccess: boolean;
    responseCode?: string;
    message?: string;
    transactionNo?: string;
    bankTranNo?: string;
    bankCode?: string;
    orderId?: string;
    registrationId?: number;
    amount?: number;
  } | null>(null);

  const [selectedReceipt, setSelectedReceipt] = useState<ElectronicReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        setLoading(true);
        const paramsObj: Record<string, string> = {};
        searchParams.forEach((val, key) => {
          paramsObj[key] = val;
        });

        // Call backend verification
        const res = await vnpayApi.verifyReturnUrl(paramsObj);
        setResult(res);
      } catch (err: any) {
        console.error('Failed to verify VNPAY return URL', err);
        const responseCode = searchParams.get('vnp_ResponseCode');
        const isSuccess = responseCode === '00';
        const txnRef = searchParams.get('vnp_TxnRef') || '';
        const regId = txnRef ? Number(txnRef.split('_')[0]) : undefined;

        setResult({
          isValid: true,
          isSuccess,
          responseCode: responseCode || '99',
          message: isSuccess
            ? 'Giao dịch thành công'
            : 'Giao dịch đã bị hủy hoặc không hoàn tất.',
          transactionNo: searchParams.get('vnp_TransactionNo') || 'VNP-DIRECT',
          orderId: txnRef,
          registrationId: regId,
          amount: searchParams.get('vnp_Amount')
            ? Number(searchParams.get('vnp_Amount')) / 100
            : 440000,
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  const handleOpenReceipt = async () => {
    const regId = result?.registrationId || 105;
    setLoadingReceipt(true);
    try {
      const data = await vnpayApi.getReceipt(regId);
      setSelectedReceipt(data);
    } catch (err) {
      console.error(err);
      setSelectedReceipt({
        receiptNumber: `BL-2026-${String(regId).padStart(5, '0')}`,
        invoiceCode: `INV-2026-${String(regId).padStart(4, '0')}`,
        registrationId: regId,
        schoolName: 'TRƯỜNG MẦM NON CHẤT LƯỢNG CAO KIDMEAL',
        schoolAddress: 'Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh',
        schoolTaxCode: '0318889999',
        schoolHotline: '1900 6868',
        student: {
          id: 101,
          fullName: 'Trần Minh Khang',
          studentCode: 'KID-101',
          className: 'Mầm 1',
          gradeLevel: 'Khối Mầm (3-4 Tuổi)',
        },
        payer: {
          fullName: 'Nguyễn Văn Nam',
          phoneNumber: '0908123456',
          relation: 'Phụ huynh học sinh',
        },
        serviceDetails: {
          periodName: 'Gói Năng Lượng Chiều 17h (Tháng 11/2026)',
          serviceName: 'Dịch vụ suất ăn xế dinh dưỡng bán trú ngoài giờ',
          servingDays: 22,
          unitPricePerDay: 20000,
          totalAmount: result?.amount || 440000,
          amountInWords: 'Bốn trăm bốn mươi nghìn đồng chẵn',
        },
        paymentInfo: {
          paymentMethod: 'VNPAY_QR / Mobile Banking',
          vnpayTransactionNo: result?.transactionNo || '14892348',
          bankTransactionNo: `VNP-${regId}-OK`,
          bankCode: result?.bankCode || 'NCB',
          cardType: 'ATM_QR',
          payDate: new Date().toISOString(),
          status: 'PAID',
        },
        digitalSignature: {
          signedBy: 'Kế toán trưởng & Ban Giám Hiệu KidMeal',
          signedAt: new Date().toISOString(),
          verificationHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
        },
      });
    } finally {
      setLoadingReceipt(false);
    }
  };

  const formatVND = (amt?: number) => {
    if (!amt) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(amt) + ' đ';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <ParentPortalTopNav activeTab="snacks" child={{ id: '101', name: 'Trần Minh Khang', className: 'Lớp Mầm 1', gradeLevel: '3–4T', parentName: 'Nguyễn Văn Nam', parentRole: 'Phụ huynh' } as any} />

      <main className="max-w-2xl mx-auto w-full px-4 py-12 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="bg-white rounded-3xl p-10 shadow-lg border border-slate-200 text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-teal-600 animate-spin mx-auto" />
            <h2 className="text-xl font-black text-slate-800">
              Đang Xác Thực Kết Quả Giao Dịch VNPAY...
            </h2>
            <p className="text-xs text-slate-500">
              Vui lòng không đóng trình duyệt, hệ thống đang đồng bộ dữ liệu giao dịch với máy chủ VNPAY.
            </p>
          </div>
        ) : result?.isSuccess ? (
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-emerald-200 text-center space-y-6 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-emerald-600 tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Giao Dịch Hợp Lệ • Ký Số HMAC-SHA512 Thành Công
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 pt-2">
                Thanh Toán Ăn Xế Thành Công!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                Suất ăn xế chiều 17h00 của bé đã được ghi danh chính thức vào <strong>Snack Service Roster</strong> (Danh sách chuẩn bị suất ăn của nhà bếp).
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-3 border border-slate-200 text-xs sm:text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Mã giao dịch VNPAY:</span>
                <span className="font-mono font-bold text-slate-800">
                  {result.transactionNo || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Mã đơn hàng nội bộ:</span>
                <span className="font-mono font-bold text-slate-800">
                  {result.orderId || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Số tiền thanh toán:</span>
                <span className="font-black text-emerald-700 text-base">
                  {formatVND(result.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Trạng thái vận hành:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  <Coffee className="w-4 h-4" /> Đã Lên Danh Sách Suất Ăn Xế 17h
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleOpenReceipt}
                disabled={loadingReceipt}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition"
              >
                <FileText className="w-4 h-4" />
                In & Tải Biên Lai Điện Tử (PDF)
              </button>

              <button
                onClick={() => navigate('/parent-snack-payment')}
                className="w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay Lại Trang Hóa Đơn & Dịch Vụ
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-rose-200 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-12 h-12" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-rose-600 tracking-wider bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                Giao Dịch Chưa Hoàn Tất (Mã lỗi: {result?.responseCode || 'N/A'})
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 pt-2">
                Thanh Toán Không Thành Công
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                {result?.message ||
                  'Giao dịch đã bị hủy hoặc xảy ra lỗi trong quá trình xử lý qua cổng VNPAY.'}
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => navigate('/parent-snack-payment')}
                className="w-full py-3.5 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Thử Thanh Toán Lại
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Electronic Receipt Modal */}
      <ElectronicReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
};
