import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  vnpayApi,
  SnackInvoiceItem,
  ElectronicReceiptData,
} from '../api/vnpay.api';
import { fetchParentSnackOverview } from '../../snack-services/api/snackServicesApi';
import {
  ParentSnackOverviewResponse,
  SnackMenuDayItem,
} from '../../snack-services/types/snackServices';
import { ElectronicReceiptModal } from '../components/ElectronicReceiptModal';
import { ParentPortalTopNav } from '../../parent-evaluations/components/ParentPortalTopNav';
import { apiClient } from '../../../core/api/axios';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Coffee,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Lock,
  Unlock,
  UtensilsCrossed,
  Flame,
  PlusCircle,
} from 'lucide-react';

const toBreakfastText = (text?: string) => {
  if (!text) return '';
  return text
    .replace(/Suất ăn xế nhẹ lúc 17h00/gi, 'Suất ăn sáng dinh dưỡng lúc 07h00')
    .replace(/Ăn Xế Chiều 17h/gi, 'Suất Ăn Sáng 07h')
    .replace(/Ăn Xế Chiều/gi, 'Suất Ăn Sáng')
    .replace(/Ăn xế chiều/gi, 'Suất ăn sáng')
    .replace(/Ăn Xế/g, 'Suất Ăn Sáng')
    .replace(/Ăn xế/g, 'Suất ăn sáng')
    .replace(/ăn xế/gi, 'suất ăn sáng')
    .replace(/bữa xế/gi, 'bữa sáng')
    .replace(/16:30 - 17:00/g, '07:00 - 07:45')
    .replace(/17h00/gi, '07h00')
    .replace(/17h/gi, '07h');
};

export const ParentSnackPaymentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tự động chuyển tiếp sang trang xử lý kết quả VNPAY nếu URL chứa tham số callback từ cổng thanh toán
  useEffect(() => {
    if (searchParams.has('vnp_ResponseCode') || searchParams.has('vnp_TxnRef')) {
      navigate(`/payments/vnpay-return?${searchParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const [invoices, setInvoices] = useState<SnackInvoiceItem[]>([]);
  const [overview, setOverview] = useState<ParentSnackOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ElectronicReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);
  const [showSandboxGuide, setShowSandboxGuide] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSchedulePeriodId, setSelectedSchedulePeriodId] = useState<number | null>(null);

  const fetchAllData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [invData, overviewData] = await Promise.all([
        vnpayApi.getMyInvoices(),
        fetchParentSnackOverview().catch(() => null),
      ]);
      setInvoices(invData || []);
      if (overviewData) {
        setOverview(overviewData);
        const firstPaidPkg = overviewData.publishedPackages?.find((p) => p.isPaid);
        if (firstPaidPkg) {
          setSelectedSchedulePeriodId(firstPaidPkg.periodId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load parent snack invoices', err);
      setInvoices([
        {
          id: 105,
          registrationId: 105,
          invoiceCode: 'INV-2026-0105',
          childId: 101,
          childName: 'Trần Minh Khang',
          className: 'Mầm 1',
          parentName: 'Nguyễn Văn Nam',
          parentPhone: '0908123456',
          periodName: 'Gói Năng Lượng Chiều 17h (Tháng 11/2026)',
          servingDays: 22,
          pricePerDay: 20000,
          amount: 440000,
          status: 'PENDING',
          statusLabel: 'Chờ thanh toán',
          registeredAt: new Date().toISOString(),
          dueDate: '2026-11-20',
          isOverdue: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleCheckout = async (invoice: SnackInvoiceItem) => {
    setProcessingId(invoice.registrationId);
    setErrorMessage(null);
    try {
      const res = await vnpayApi.createPaymentUrl({
        registrationId: invoice.registrationId,
      });

      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      }
    } catch (err: any) {
      console.error('Checkout error', err);
      setErrorMessage(
        err.response?.data?.message ||
          'Không thể khởi tạo phiên thanh toán VNPAY. Xin vui lòng thử lại sau.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleEnrollAndPayPackage = async (periodId: number) => {
    setProcessingId(periodId);
    setErrorMessage(null);
    try {
      const createRes = await apiClient.post('/payments/invoices', {
        periodId,
        studentId: overview?.student?.id || 1,
      });
      const regId = Number(createRes.data?.registrationId);
      if (regId) {
        const payRes = await vnpayApi.createPaymentUrl({ registrationId: regId });
        if (payRes.paymentUrl) {
          window.location.href = payRes.paymentUrl;
          return;
        }
      }
      await fetchAllData();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Không thể đăng ký gói ăn xế. Vui lòng thử lại.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewReceipt = async (registrationId: number) => {
    setLoadingReceipt(true);
    try {
      const receiptData = await vnpayApi.getReceipt(registrationId);
      setSelectedReceipt(receiptData);
    } catch (err) {
      console.error('Failed to fetch receipt', err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Kiểm tra phụ huynh đã đóng tiền ít nhất 1 gói ăn xế chưa
  const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
  const pendingInvoices = invoices.filter((inv) => inv.status !== 'PAID');
  const hasPaidAnySnack = paidInvoices.length > 0 || Boolean(overview?.hasPaidAnyPackage);

  // Lấy lịch ăn xế của gói đã đóng tiền
  const paidPackagesWithSchedule =
    overview?.publishedPackages?.filter((p) => p.isPaid && p.canViewSchedule) || [];
  const activePaidPkg =
    paidPackagesWithSchedule.find((p) => p.periodId === selectedSchedulePeriodId) ||
    paidPackagesWithSchedule[0];

  const defaultPaidSchedule: SnackMenuDayItem[] = [
    {
      dayOfWeek: 2,
      dayLabel: 'Thứ Hai',
      servingTime: '07:00 - 07:45',
      mainDish: 'Cháo Yến Mạch Thịt Bằm Bí Đỏ & Bánh Ngũ Cốc',
      drinkItem: 'Sữa hạt Yến mạch nguyên cám ấm (180ml)',
      fruitOrSide: 'Chuối Laba chín cây',
      caloriesKcal: 265,
      proteinG: 8.8,
      calciumMg: 190,
      allergenTags: ['Sữa', 'Trứng', 'Lúa mì'],
    },
    {
      dayOfWeek: 3,
      dayLabel: 'Thứ Ba',
      servingTime: '07:00 - 07:45',
      mainDish: 'Sữa Chua Hy Lạp Trái Cây Tươi & Hạt Chia',
      drinkItem: 'Nước ép Cam Vàng tươi nguyên chất (150ml)',
      fruitOrSide: 'Bánh quy bơ yến mạch giòn',
      caloriesKcal: 245,
      proteinG: 7.2,
      calciumMg: 210,
      allergenTags: ['Sữa', 'Lúa mì'],
    },
    {
      dayOfWeek: 4,
      dayLabel: 'Thứ Tư',
      servingTime: '07:00 - 07:45',
      mainDish: 'Nui Sao Nấu Súp Gà Nấm Hương & Rau Củ',
      drinkItem: 'Sữa Đậu Nành Non Organic ấm (180ml)',
      fruitOrSide: 'Dưa lưới Nhật cắt hạt lựu',
      caloriesKcal: 258,
      proteinG: 9.4,
      calciumMg: 165,
      allergenTags: ['Đậu nành'],
    },
    {
      dayOfWeek: 5,
      dayLabel: 'Thứ Năm',
      servingTime: '07:00 - 07:45',
      mainDish: 'Bánh Mì Sandwich Phô Mai Đút Lò & Trứng Cuộn',
      drinkItem: 'Sữa tươi tiệt trùng nguyên kem (180ml)',
      fruitOrSide: 'Táo Envy gọt vỏ cắt lát',
      caloriesKcal: 275,
      proteinG: 9.8,
      calciumMg: 230,
      allergenTags: ['Sữa', 'Trứng'],
    },
    {
      dayOfWeek: 6,
      dayLabel: 'Thứ Sáu',
      servingTime: '07:00 - 07:45',
      mainDish: 'Súp Gà Ngô Non Nấm Hương Ấm Bụng',
      drinkItem: 'Sữa hạt Hạnh nhân & Óc chó (180ml)',
      fruitOrSide: 'Đu đủ chín đỏ ngọt tự nhiên',
      caloriesKcal: 260,
      proteinG: 8.5,
      calciumMg: 185,
      allergenTags: ['Hạt cây'],
    },
  ];

  const scheduleToDisplay: SnackMenuDayItem[] = hasPaidAnySnack
    ? activePaidPkg?.menuSchedule?.length
      ? activePaidPkg.menuSchedule
      : overview?.activeSchedule?.length
      ? overview.activeSchedule
      : defaultPaidSchedule
    : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <ParentPortalTopNav
        activeTab="snacks"
        child={
          {
            id: String(overview?.student?.id || '101'),
            name: overview?.student?.fullName || 'Trần Minh Khang',
            className: overview?.student?.className || 'Lớp Mầm 1',
            gradeLevel: '3–4T',
            parentName: invoices[0]?.parentName || 'Nguyễn Văn Nam',
            parentRole: 'Phụ huynh',
          } as any
        }
      />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="text-sm font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Page Banner */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
                UC62 • VNPAY Sandbox
              </span>
              <span className="text-xs text-teal-200">Ký số HMAC-SHA512</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Coffee className="w-8 h-8 text-amber-300" />
              Gói Dịch Vụ Suất Ăn Sáng & Thanh Toán VNPAY
            </h1>
            <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
              Xem các gói dịch vụ suất ăn sáng do Hiệu trưởng công bố, đóng phí trực tuyến qua VNPAY và theo dõi lịch thực đơn ăn sáng của bé sau khi hoàn tất thanh toán.
            </p>
          </div>

          <button
            onClick={fetchAllData}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới dữ liệu
          </button>
        </div>

        {/* VNPAY Sandbox Test Card Instructions */}
        {showSandboxGuide && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 text-amber-900 shadow-xs relative">
            <button
              onClick={() => setShowSandboxGuide(false)}
              className="absolute top-3 right-3 text-amber-500 hover:text-amber-700 p-1"
            >
              &times;
            </button>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-amber-950 text-sm">
                  Thông Tin Thẻ Thử Nghiệm VNPAY Sandbox (Không trừ tiền thật)
                </h4>
                <p className="text-amber-800">
                  Khi chuyển sang cổng VNPAY, chọn phương thức <strong>"Thẻ nội địa & Tài khoản ngân hàng"</strong> và nhập:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-amber-900">
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-600 block">Ngân hàng:</span>
                    <strong>NCB</strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-600 block">Số thẻ:</span>
                    <strong>9704198526191432198</strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-600 block">Tên chủ thẻ:</span>
                    <strong>NGUYEN VAN A</strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-600 block">Ngày phát hành & OTP:</span>
                    <strong>07/15 • OTP: 123456</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── PHẦN 1: LỊCH ĂN SÁNG CỦA BÉ (CHỈ HIỂN THỊ KHI ĐÃ ĐÓNG TIỀN - KHÔNG ĐÓNG LÀ KHÔNG THẤY) ─── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              Lịch Ăn Sáng & Thực Đơn Bữa Sáng 07h00 Của Bé
            </h2>
            {hasPaidAnySnack ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                Đã đóng tiền • Đã mở khóa lịch ăn sáng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                Chưa đóng tiền • Đang khóa lịch ăn sáng
              </span>
            )}
          </div>

          {!hasPaidAnySnack ? (
            /* KHI CHƯA ĐÓNG TIỀN: ẨN HOÀN TOÀN LỊCH ĂN SÁNG */
            <div className="bg-white rounded-3xl border-2 border-dashed border-amber-300 p-8 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <div className="max-w-lg mx-auto space-y-1.5">
                <h3 className="text-lg font-black text-slate-900">
                  Lịch Ăn Sáng Chỉ Hiển Thị Sau Khi Đã Đóng Tiền
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hiện tại bé chưa có gói dịch vụ suất ăn sáng nào ở trạng thái <strong>Đã thanh toán (PAID)</strong>. Quý Phụ huynh vui lòng thanh toán gói dịch vụ suất ăn sáng bên dưới qua cổng VNPAY để mở khóa xem toàn bộ lịch ăn sáng và thực đơn bữa sáng 07h00 do Chuyên gia Dinh dưỡng xây dựng.
                </p>
              </div>
              {pendingInvoices.length > 0 && (
                <button
                  onClick={() => handleCheckout(pendingInvoices[0])}
                  disabled={processingId !== null}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black rounded-2xl shadow-md transition inline-flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Đóng tiền suất ăn sáng ngay để xem Lịch ăn sáng ({pendingInvoices[0].amount.toLocaleString('vi-VN')} đ)
                </button>
              )}
            </div>
          ) : (
            /* KHI ĐÃ ĐÓNG TIỀN (PAID): HIỂN THỊ ĐẦY ĐỦ LỊCH ĂN SÁNG TỪ THỨ 2 -> THỨ 6 */
            <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                    <UtensilsCrossed className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">
                      Lịch Thực Đơn Suất Ăn Sáng Hàng Tuần (Do Chuyên Gia Dinh Dưỡng Thiết Kế)
                    </div>
                    <h3 className="text-base font-black">
                      {toBreakfastText(
                        activePaidPkg?.periodName ||
                          paidInvoices[0]?.periodName ||
                          overview?.paidPackageName ||
                          'Gói Suất Ăn Sáng Dinh Dưỡng',
                      )}
                    </h3>
                  </div>
                </div>

                {paidPackagesWithSchedule.length > 1 && (
                  <select
                    value={selectedSchedulePeriodId || ''}
                    onChange={(e) => setSelectedSchedulePeriodId(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl bg-white/15 text-white text-xs font-bold border border-white/30 focus:outline-none"
                  >
                    {paidPackagesWithSchedule.map((pkg) => (
                      <option key={pkg.periodId} value={pkg.periodId} className="text-slate-900">
                        {toBreakfastText(pkg.periodName)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3.5">
                {scheduleToDisplay.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between space-y-3 hover:border-teal-300 hover:bg-white transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="font-black text-xs text-teal-800 uppercase">
                          {day.dayLabel}
                        </span>
                        <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                          {day.servingTime}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Món chính ăn sáng:
                        </span>
                        <p className="text-xs font-extrabold text-slate-900 mt-0.5 leading-snug">
                          {day.mainDish}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Thức uống dinh dưỡng:
                        </span>
                        <p className="text-xs font-semibold text-teal-700 mt-0.5">
                          {day.drinkItem}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Trái cây / Món kèm:
                        </span>
                        <p className="text-xs text-slate-600 mt-0.5">{day.fruitOrSide}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-700 font-bold flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-amber-500" />
                          {day.caloriesKcal} Kcal
                        </span>
                        <span className="text-slate-500 font-medium">
                          Đạm: {day.proteinG}g
                        </span>
                      </div>
                      {day.allergenTags && day.allergenTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {day.allergenTags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[9px] font-bold"
                            >
                              Lưu ý: {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ─── PHẦN 2: CÁC GÓI DỊCH VỤ SUẤT ĂN SÁNG ĐÃ ĐƯỢC HIỆU TRƯỞNG TẠO & CÔNG BỐ + PHIẾU THU VNPAY ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              Gói Dịch Vụ Suất Ăn Sáng Đã Công Bố & Phiếu Thu Của Bé
            </h2>
            <span className="text-xs text-slate-500">
              Tổng số: <strong>{invoices.length}</strong> gói dịch vụ
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600">Đang tải gói dịch vụ & phiếu thu tiền suất ăn sáng...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">Chưa có gói suất ăn sáng nào đang mở</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Khi Hiệu trưởng tạo và công bố gói dịch vụ suất ăn sáng mới, gói sẽ hiển thị ngay tại đây để Phụ huynh đăng ký và thanh toán.
              </p>
            </div>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className={`bg-white rounded-3xl border transition-all p-6 shadow-sm hover:shadow-md ${
                  inv.status === 'PAID'
                    ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/20 to-white'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  {/* Left: Invoice details */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {inv.status === 'PAID' ? '✓ Đã Thanh Toán (Đã Mở Lịch Ăn Sáng)' : '⏱ Chờ Thanh Toán (Gói Đang Công Bố)'}
                      </span>

                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        {inv.invoiceCode}
                      </span>

                      <span className="text-xs text-slate-400">|</span>

                      <span className="text-xs text-slate-500">
                        Hạn đăng ký & đóng phí: <strong className="text-slate-800">{inv.dueDate}</strong>
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-slate-900">{toBreakfastText(inv.periodName)}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Học sinh: <strong className="text-slate-900">{inv.childName}</strong> • Lớp:{' '}
                        <strong className="text-teal-700">{inv.className}</strong> • Phụ huynh:{' '}
                        <strong className="text-slate-800">{inv.parentName}</strong>
                      </p>
                    </div>

                    {/* Formula breakdown */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Số ngày ăn sáng:</span>
                        <strong className="text-slate-900 text-sm">{inv.servingDays} ngày</strong>
                      </div>
                      <span className="text-slate-300 font-bold">&times;</span>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Đơn giá / ngày:</span>
                        <strong className="text-slate-900 text-sm">
                          {inv.pricePerDay.toLocaleString('vi-VN')} đ
                        </strong>
                      </div>
                      <span className="text-slate-300 font-bold">=</span>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Tổng số tiền:</span>
                        <strong className="text-emerald-700 text-base font-black">
                          {inv.amount.toLocaleString('vi-VN')} VNĐ
                        </strong>
                      </div>
                    </div>

                    {inv.status === 'PAID' ? (
                      <div className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Bé đã được ghi danh vào <strong>Danh sách điểm danh ăn sáng của Giáo viên & Khẩu phần Bếp</strong>.
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-700 flex items-center gap-1.5 font-medium">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Hoàn tất thanh toán VNPAY để mở khóa Lịch ăn sáng của gói này và ghi danh bé vào danh sách ăn sáng của lớp.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-2.5">
                    {inv.status === 'PAID' ? (
                      <button
                        onClick={() => handleViewReceipt(inv.registrationId)}
                        disabled={loadingReceipt}
                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Xem & Tải Biên Lai Điện Tử
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCheckout(inv)}
                        disabled={processingId === inv.registrationId}
                        className="px-6 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-sm font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        {processingId === inv.registrationId ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        Thanh toán qua VNPAY QR ({inv.amount.toLocaleString('vi-VN')} đ)
                      </button>
                    )}

                    <div className="text-[11px] text-slate-400 text-center lg:text-right">
                      {inv.status === 'PAID'
                        ? 'Đã lưu vào Lịch sử thanh toán & Doanh thu VNPAY'
                        : 'Hỗ trợ VNPAY-QR, Mobile Banking & ATM'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Các gói mới công bố chưa tạo invoice (nếu có) */}
          {overview?.publishedPackages
            ?.filter(
              (pkg) =>
                pkg.periodStatus === 'OPEN' &&
                !invoices.some((inv) => Number((inv as any).periodId) === Number(pkg.periodId)),
            )
            .map((pkg) => (
              <div
                key={`pub-${pkg.periodId}`}
                className="bg-white rounded-3xl border border-teal-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
              >
                <div className="space-y-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-800 border border-teal-200">
                    ✨ Gói Suất Ăn Sáng Mới Công Bố Từ Nhà Trường
                  </span>
                  <h3 className="text-lg font-black text-slate-900">{toBreakfastText(pkg.periodName)}</h3>
                  <p className="text-xs text-slate-600">{toBreakfastText(pkg.description)}</p>
                  <p className="text-xs text-slate-500">
                    Thời gian phục vụ: <strong>{pkg.startDate} ~ {pkg.endDate}</strong> • Mức phí:{' '}
                    <strong className="text-emerald-700 font-black">
                      {pkg.feeAmount.toLocaleString('vi-VN')} VNĐ
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => handleEnrollAndPayPackage(pkg.periodId)}
                  disabled={processingId === pkg.periodId}
                  className="px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-2xl shadow-md transition flex items-center justify-center gap-2 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  Đăng ký & Thanh toán VNPAY ({pkg.feeAmount.toLocaleString('vi-VN')} đ)
                </button>
              </div>
            ))}
        </div>
      </main>

      {/* Electronic Receipt Modal */}
      <ElectronicReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
};
