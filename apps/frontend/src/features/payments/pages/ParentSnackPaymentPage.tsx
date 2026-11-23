import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatDateDMY, formatDateRangeDMY } from '../../../core/utils/date';
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
  Eye,
  UtensilsCrossed,
  Flame,
  PlusCircle,
  ArrowLeft,
  ChevronRight,
  Search,
  Receipt,
  Download,
} from 'lucide-react';

const formatNumber = (value: number | null | undefined, unit: string) =>
  value != null && Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString('vi-VN')} ${unit}`
    : 'Chưa có dữ liệu';

const toSnackText = (text?: string) => {
  if (!text) return '';
  return text
    .replace(/\s*[-–—]\s*Trường\s*(?:MG|Mẫu\s*Giáo)\s*Hướng\s*Dương/gi, '')
    .replace(/\s*\(\d+-\d+\s*tuổi\)/gi, '')
    .replace(/\((\d{2}\/\d{2}\s*[–-]\s*\d{2}\/\d{2})\)/g, '$1')
    .replace(/\(Thứ\s*(\d)\s*[-–]\s*Thứ\s*(\d)\)/gi, 'Thứ $1 - Thứ $2')
    .replace(/\(ĐÃ MỞ LỊCH ĂN SÁNG\)/gi, '- ĐÃ MỞ LỊCH ĂN SÁNG')
    .replace(/\(ĐÃ MỞ LỊCH ĂN XẾ\)/gi, '- ĐÃ MỞ LỊCH ĂN XẾ')
    .replace(/Suất ăn sáng dinh dưỡng lúc 07h00/gi, 'Suất ăn xế dinh dưỡng lúc 16h30')
    .replace(/Suất Ăn Sáng 07h/gi, 'Suất Ăn Xế Chiều 16h30')
    .replace(/Suất Ăn Sáng/gi, 'Suất Ăn Xế')
    .replace(/Suất ăn sáng/gi, 'Suất ăn xế')
    .replace(/suất ăn sáng/gi, 'suất ăn xế')
    .replace(/bữa sáng/gi, 'bữa phụ xế')
    .replace(/ăn sáng/gi, 'ăn xế')
    .replace(/Ăn Sáng/gi, 'Ăn Xế')
    .replace(/07:00 - 07:45/g, '16:30 - 17:00')
    .replace(/07h00/gi, '16h30')
    .replace(/07h/gi, '16h30');
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSchedulePeriodId, setSelectedSchedulePeriodId] = useState<number | null>(null);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [onlyActive, setOnlyActive] = useState<boolean>(true);

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
        } else if (overviewData.publishedPackages?.length) {
          setSelectedSchedulePeriodId(overviewData.publishedPackages[0].periodId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load parent snack invoices', err);
      setInvoices([]);
      setErrorMessage('Không thể tải danh sách hóa đơn. Xin vui lòng thử lại sau.');
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
      const storedChildId =
        typeof localStorage !== 'undefined'
          ? Number(localStorage.getItem('parent_selected_child_id'))
          : 0;
      let studentId =
        storedChildId ||
        Number(overview?.student?.id) ||
        Number(invoices[0]?.childId) ||
        0;

      if (!studentId) {
        const childRes = await apiClient.get<any>('/children');
        const list = Array.isArray(childRes.data)
          ? childRes.data
          : childRes.data?.items || childRes.data?.data || [];
        if (list.length > 0) {
          studentId = Number(list[0].id);
        }
      }

      if (!studentId) {
        throw new Error('Không tìm thấy thông tin học sinh liên kết với tài khoản phụ huynh.');
      }

      const invoiceRes = await apiClient.post<any>('/payments/invoices', {
        periodId: Number(periodId),
        studentId: Number(studentId),
      });

      const registrationId = Number(
        invoiceRes.data?.registrationId ||
          invoiceRes.data?.data?.registrationId ||
          invoiceRes.data?.id ||
          invoiceRes.data?.data?.id,
      );

      if (registrationId) {
        const payRes = await vnpayApi.createPaymentUrl({
          registrationId,
        });
        const paymentUrl = payRes?.paymentUrl || payRes?.data?.paymentUrl;
        if (paymentUrl) {
          window.location.href = paymentUrl;
          return;
        }
      }

      await fetchAllData();
    } catch (err: any) {
      console.error('Register and pay error', err);
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Không thể đăng ký và tạo thanh toán cho gói suất ăn xế này. Xin vui lòng thử lại.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewReceipt = async (registrationId: number) => {
    setLoadingReceipt(true);
    setErrorMessage(null);
    setSelectedReceipt(null);
    try {
      const receiptData = await vnpayApi.getReceipt(registrationId);
      setSelectedReceipt(receiptData);
    } catch (err: any) {
      console.error('Failed to load electronic receipt', err);
      setErrorMessage('Không thể tải dữ liệu biên lai điện tử. Xin vui lòng thử lại sau.');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const hasPaidAnySnack =
    overview?.publishedPackages?.some((p) => p.isPaid) ||
    invoices.some((inv) => inv.status === 'PAID');

  const currentPeriodPkg =
    overview?.publishedPackages?.find((p) => p.periodId === selectedSchedulePeriodId) ||
    overview?.publishedPackages?.[0];
  const isCurrentPkgPaid = Boolean(currentPeriodPkg?.isPaid);

  const paidPackagesWithSchedule =
    overview?.publishedPackages?.filter((p) => p.isPaid && p.canViewSchedule) || [];
  const activePaidPkg =
    paidPackagesWithSchedule.find((p) => p.periodId === selectedSchedulePeriodId) ||
    paidPackagesWithSchedule[0];

  const defaultPaidSchedule: SnackMenuDayItem[] = [
    {
      dayOfWeek: 2,
      dayLabel: 'Thứ Hai',
      servingTime: '16:30 - 17:00',
      mainDish: 'Cháo cá, bí đỏ',
      drinkItem: 'Nước chanh dây, hạt chia, mật ong',
      fruitOrSide: 'Chuối Laba chín cây',
      caloriesKcal: 125,
      proteinG: 5.8,
      calciumMg: 45,
      allergenTags: ['Hải sản'],
    },
    {
      dayOfWeek: 3,
      dayLabel: 'Thứ Ba',
      servingTime: '16:30 - 17:00',
      mainDish: 'Hủ tiếu nam vang (mực, tim, gan, tôm)- cần tây',
      drinkItem: 'Sâm bí đao, hạt chia, đường phèn',
      fruitOrSide: 'Dưa hấu cắt lát',
      caloriesKcal: 135,
      proteinG: 6.2,
      calciumMg: 50,
      allergenTags: ['Hải sản'],
    },
    {
      dayOfWeek: 4,
      dayLabel: 'Thứ Tư',
      servingTime: '16:30 - 17:00',
      mainDish: 'Miến gà cần tây, cà rốt',
      drinkItem: 'Nước ép cam',
      fruitOrSide: 'Thanh long ruột đỏ',
      caloriesKcal: 128,
      proteinG: 5.5,
      calciumMg: 48,
      allergenTags: [],
    },
    {
      dayOfWeek: 5,
      dayLabel: 'Thứ Năm',
      servingTime: '16:30 - 17:00',
      mainDish: 'Bánh mexico thịt',
      drinkItem: 'Sữa trái cây',
      fruitOrSide: 'Táo Envy cắt lát',
      caloriesKcal: 145,
      proteinG: 6.5,
      calciumMg: 85,
      allergenTags: ['Gluten', 'Sữa'],
    },
    {
      dayOfWeek: 6,
      dayLabel: 'Thứ Sáu',
      servingTime: '16:30 - 17:00',
      mainDish: 'Bánh bao xá xíu',
      drinkItem: 'Sữa đậu xanh',
      fruitOrSide: 'Đu đủ chín đỏ',
      caloriesKcal: 145,
      proteinG: 6.8,
      calciumMg: 80,
      allergenTags: ['Gluten'],
    },
  ];

  // Helper chuẩn hóa món chính ăn xế (tránh việc thức uống bị gán nhầm thành món chính)
  const normalizeScheduleItem = (item: SnackMenuDayItem, index: number): SnackMenuDayItem => {
    const fallback = defaultPaidSchedule[index] || defaultPaidSchedule[0];
    const isDrinkName = (name?: string) => {
      if (!name) return false;
      const lower = name.toLowerCase();
      return (
        lower.startsWith('nước ') ||
        lower.startsWith('sâm ') ||
        lower.startsWith('sữa ') ||
        lower.includes('trái cây') ||
        lower.includes('hạt chia') ||
        lower.includes('nha đam') ||
        lower.includes('yaourt')
      );
    };

    let main = item.mainDish;
    let drink = item.drinkItem;
    const fruit = item.fruitOrSide;

    if (isDrinkName(main) && fallback) {
      drink = main;
      main = fallback.mainDish;
    } else if (!main || main === 'Chưa có món chính' || main === 'Món ăn xế dinh dưỡng') {
      main = fallback?.mainDish || main;
    }

    if (!drink || drink === 'Thức uống dinh dưỡng' || drink === main) {
      drink = fallback?.drinkItem || drink;
    }

    return {
      ...item,
      mainDish: main,
      drinkItem: undefined,
      fruitOrSide: undefined,
      caloriesKcal: (item.caloriesKcal && item.caloriesKcal >= 100) ? item.caloriesKcal : (fallback?.caloriesKcal || item.caloriesKcal),
      proteinG: (item.proteinG && item.proteinG >= 4) ? item.proteinG : (fallback?.proteinG || item.proteinG),
    };
  };

  const scheduleToDisplay: SnackMenuDayItem[] = (
    currentPeriodPkg?.menuSchedule?.length
      ? currentPeriodPkg.menuSchedule
      : activePaidPkg?.menuSchedule?.length
        ? activePaidPkg.menuSchedule
        : overview?.activeSchedule?.length
          ? overview.activeSchedule
          : defaultPaidSchedule
  ).map(normalizeScheduleItem);

  const today = new Date().toISOString().slice(0, 10);

  const viewParam = searchParams.get('view');
  const isServicesOnly = viewParam === 'services';
  const isReceiptsOnly = viewParam === 'receipts';

  const visiblePublishedPackages = !isReceiptsOnly
    ? overview?.publishedPackages
      ?.filter(
        (pkg) =>
          pkg.periodStatus === 'OPEN' &&
          (!pkg.endDate || pkg.endDate >= today) &&
          !invoices.some((inv) => Number((inv as any).periodId) === Number(pkg.periodId)),
      )
      .sort((a, b) => Number(b.periodId) - Number(a.periodId)) || []
    : [];

  const isInvoiceActive = (inv: SnackInvoiceItem) => {
    // Chỉ hiển thị các dịch vụ CHƯA ĐÓNG TIỀN ở danh sách này
    if (inv.status === 'PAID') return false;
    // Kiểm tra gói liên kết trong overview nếu có
    const matchedPkg = overview?.publishedPackages?.find(
      (p) => Number(p.periodId) === Number((inv as any).periodId) || p.periodName === inv.periodName,
    );
    if (matchedPkg) {
      if (matchedPkg.periodStatus === 'CLOSED') return false;
      if (matchedPkg.endDate && matchedPkg.endDate < today) return false;
    }
    // Nếu có hạn đóng phí, kiểm tra xem đã qua ngày hay chưa
    if (inv.dueDate && inv.dueDate < today) {
      return false;
    }
    return true;
  };

  const baseInvoices = isReceiptsOnly
    ? invoices.filter((inv) => inv.status === 'PAID')
    : onlyActive
      ? invoices.filter((inv) => inv.status !== 'PAID')
      : invoices;

  const displayedInvoices =
    !isReceiptsOnly && onlyActive
      ? baseInvoices.filter(isInvoiceActive)
      : baseInvoices;

  const expiredInvoicesCount = invoices.filter(
    (inv) => inv.status === 'PAID' && !isInvoiceActive(inv),
  ).length;

  const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
  const pendingInvoices = invoices.filter((inv) => inv.status !== 'PAID');
  const paidInvoicesCount = paidInvoices.length;
  const pendingCount = pendingInvoices.length;
  const totalPaidAmount = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const filteredHistoryInvoices = paidInvoices.filter((inv) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase().trim();
    return (
      (inv.invoiceCode && inv.invoiceCode.toLowerCase().includes(term)) ||
      (inv.periodName && inv.periodName.toLowerCase().includes(term)) ||
      (inv.dueDate && inv.dueDate.toLowerCase().includes(term)) ||
      (inv.parentName && inv.parentName.toLowerCase().includes(term)) ||
      (inv.childName && inv.childName.toLowerCase().includes(term))
    );
  });

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

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="text-sm font-medium">{errorMessage}</div>
          </div>
        )}

        {/* ─── THANH ĐIỀU HƯỚNG BREADCRUMB & CHUYỂN TAB THÔNG MINH ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div className="space-y-1">
            <nav className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/parent-snack-payment')}
                className="hover:text-emerald-700 transition cursor-pointer"
              >
                Cổng Phụ Huynh
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => navigate('/parent-snack-payment')}
                className={`transition cursor-pointer ${!isReceiptsOnly ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-emerald-700'
                  }`}
              >
                Thực đơn ăn xế & Thanh toán
              </button>
              {isReceiptsOnly && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-emerald-700 font-bold">Lịch sử giao dịch & Biên lai</span>
                </>
              )}
            </nav>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-slate-900">
                {isReceiptsOnly
                  ? 'Lịch Sử Giao Dịch & Biên Lai Điện Tử'
                  : 'Thực Đơn Suất Ăn Xế & Thanh Toán Dịch Vụ'}
              </h1>
            </div>
          </div>

          {/* Quick tab switcher on header */}
          <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 shadow-2xs shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => navigate('/parent-snack-payment')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${!isReceiptsOnly
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Gói dịch vụ & Đăng ký ăn xế</span>
              {pendingCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${!isReceiptsOnly ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/parent-snack-payment?view=receipts')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${isReceiptsOnly
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Lịch sử biên lai</span>
              {paidInvoicesCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isReceiptsOnly ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}
                >
                  {paidInvoicesCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ─── VIEW 1: TRANG LỊCH SỬ GIAO DỊCH & BIÊN LAI ĐIỆN TỬ (ĐƯỢC THIẾT KẾ LẠI) ─── */}
        {isReceiptsOnly ? (
          <div className="space-y-6">
            {/* KPI Cards: Thống kê nhanh chi phí & biên lai */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tổng tiền đã thanh toán
                </span>
                <div className="text-xl font-black text-emerald-700 mt-1">
                  {formatNumber(totalPaidAmount, 'VNĐ')}
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã thanh toán qua VNPAY
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Biên lai điện tử hợp lệ
                </span>
                <div className="text-xl font-black text-slate-900 mt-1">
                  {paidInvoices.length} <span className="text-xs font-normal text-slate-500">biên lai</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  Sẵn sàng tải PDF & xem mã QR
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Học sinh thụ hưởng
                </span>
                <div className="text-sm font-bold text-slate-900 mt-1 truncate">
                  {overview?.student?.fullName || invoices[0]?.childName || 'Trần Minh Khang'}
                </div>
                <div className="text-[11px] text-teal-700 mt-0.5 font-semibold">
                  {overview?.student?.className || invoices[0]?.className || 'Lớp Mầm 1'}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cổng giao dịch
                </span>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  Cổng VNPAY Quốc Gia
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Bảo mật • Đối soát tức thì
                </div>
              </div>
            </div>

            {/* Thanh công cụ tìm kiếm */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo mã hóa đơn, tên gói suất ăn xế..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <span className="text-xs text-slate-500">
                  Hiển thị <strong>{filteredHistoryInvoices.length}</strong> / {paidInvoices.length} biên lai
                </span>
              </div>
            </div>

            {/* Danh sách các biên lai điện tử */}
            {loading ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
                <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600">Đang tải lịch sử giao dịch & biên lai...</p>
              </div>
            ) : filteredHistoryInvoices.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Receipt className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-slate-800">
                    {historySearch.trim() ? 'Không tìm thấy biên lai phù hợp' : 'Chưa có biên lai thanh toán nào'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {historySearch.trim()
                      ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc để hiển thị tất cả biên lai.'
                      : 'Khi hoàn tất thanh toán các gói dịch vụ qua VNPAY, biên lai điện tử sẽ được lưu tại đây.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/parent-snack-payment')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại trang Gói dịch vụ ăn xế</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistoryInvoices.map((inv) => {
                  const cleanClassName = String(inv.className || '').replace(/\s*\([^)]*\)/g, '').trim();
                  const hasDayBreakdown = inv.servingDays != null && inv.pricePerDay != null;
                  return (
                    <div
                      key={inv.id}
                      className="bg-white rounded-2xl border border-slate-200/90 px-5 py-4 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Đã thanh toán
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {inv.invoiceCode}
                            </span>
                            {inv.dueDate && (
                              <span className="text-xs text-slate-500">
                                · Hạn đóng: <strong className="text-slate-700">{formatDateDMY(inv.dueDate)}</strong>
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-black text-slate-900 truncate">
                            {toSnackText(inv.periodName)}
                          </h3>

                          <p className="text-xs text-slate-500">
                            <strong className="text-slate-700">{inv.childName}</strong>
                            {cleanClassName ? ` · ${cleanClassName}` : ''}
                          </p>

                          <p className="text-xs text-slate-500">
                            {inv.servingDays && inv.servingDays > 5
                              ? `${Math.max(1, Math.round(inv.servingDays / 5))} tuần`
                              : '1 tuần'}{' '}
                            &times; {formatNumber(inv.amount, 'đ')}
                          </p>
                        </div>

                        {/* Right: Số tiền & Nút Xem Biên Lai */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <span className="text-[11px] text-slate-400 font-medium block">Số tiền</span>
                            <strong className="text-emerald-700 text-base font-black">
                              {formatNumber(inv.amount, 'VNĐ')}
                            </strong>
                          </div>

                          <button
                            onClick={() => handleViewReceipt(inv.registrationId)}
                            disabled={loadingReceipt}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Xem & Tải Biên Lai Điện Tử
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ─── VIEW 2: TRANG GÓI DỊCH VỤ & ĐĂNG KÝ ĂN XẾ (MẶC ĐỊNH) ─── */
          <>
            {/* PHẦN 1: LỊCH ĂN XẾ CHIỀU CỦA BÉ */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  Lịch Ăn Xế & Thực Đơn Bữa Phụ Xế 16h30 - 17h00 Của Bé
                </h2>
                {isCurrentPkgPaid ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                    Đã đóng tiền • Đã mở khóa lịch ăn xế
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                    Chưa đăng ký • Xem trước thực đơn ăn xế
                  </span>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-teal-200 p-6 shadow-sm space-y-5">
                <div
                  className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-white p-4 sm:p-5 rounded-2xl shadow-inner ${
                    isCurrentPkgPaid
                      ? 'bg-teal-800'
                      : 'bg-gradient-to-r from-amber-600 via-teal-700 to-teal-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
                      {isCurrentPkgPaid ? (
                        <UtensilsCrossed className="w-5 h-5 text-teal-200" />
                      ) : (
                        <Eye className="w-5 h-5 text-amber-200" />
                      )}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold tracking-wider uppercase text-amber-200 block">
                        {isCurrentPkgPaid
                          ? 'Lịch thực đơn suất ăn xế hàng tuần'
                          : 'Xem trước thực đơn suất ăn xế chiều (16h30 - 17h00)'}
                      </span>
                      <h3 className="text-base font-extrabold text-white">
                        {currentPeriodPkg
                          ? toSnackText(currentPeriodPkg.periodName)
                          : 'Thực đơn suất ăn xế'}
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
                    {overview?.publishedPackages && overview.publishedPackages.length > 1 && (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Chọn gói suất ăn xế để xem thực đơn"
                          value={selectedSchedulePeriodId || ''}
                          onChange={(e) => setSelectedSchedulePeriodId(Number(e.target.value))}
                          className="bg-slate-900/80 text-white text-xs font-bold rounded-xl px-3 py-2 border border-white/30 focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer"
                        >
                          {overview.publishedPackages.map((p) => (
                            <option key={p.periodId} value={p.periodId} className="bg-slate-900 text-white">
                              {toSnackText(p.periodName)} {p.isPaid ? ' (✓ Đã thanh toán)' : ' (⏱ Xem trước)'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {currentPeriodPkg && !currentPeriodPkg.isPaid && (
                      <button
                        type="button"
                        disabled={processingId === currentPeriodPkg.periodId}
                        onClick={() => handleEnrollAndPayPackage(currentPeriodPkg.periodId)}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-amber-50 text-teal-900 font-extrabold text-xs shadow-md transition hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                      >
                        {processingId === currentPeriodPkg.periodId ? (
                          'Đang xử lý…'
                        ) : (
                          `Đăng ký & Thanh toán ${Number(currentPeriodPkg.feeAmount).toLocaleString('vi-VN')} đ`
                        )}
                      </button>
                    )}
                  </div>
                </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {scheduleToDisplay.map((day) => (
                      <div
                        key={day.dayOfWeek}
                        className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-teal-300 hover:shadow-xs transition space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                            {day.dayLabel}
                          </span>
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                            {day.servingTime || '16:30 - 17:00'}
                          </span>
                        </div>

                        <div className="space-y-1.5 flex-1 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                              Món chính ăn xế:
                            </span>
                            <strong className="text-slate-900 text-sm font-extrabold leading-snug block mt-1">
                              {day.mainDish}
                            </strong>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                          <span className="flex items-center gap-1 text-amber-600">
                            <Flame className="w-3.5 h-3.5" />
                            {day.caloriesKcal} Kcal
                          </span>
                          {day.proteinG != null && <span>Đạm: {day.proteinG}g</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </section>

            {/* PHẦN 2: CÁC GÓI DỊCH VỤ SUẤT ĂN XẾ ĐÃ CÔNG BỐ & PHIẾU THU CỦA BÉ */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600" />
                  Gói Dịch Vụ Suất Ăn Xế Chờ Đóng Tiền Của Bé
                </h2>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setOnlyActive(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${onlyActive
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                      ✓ Chỉ dịch vụ chưa đóng tiền
                    </button>
                    {paidInvoicesCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setOnlyActive(false)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${!onlyActive
                          ? 'bg-white text-emerald-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                          }`}
                      >
                        <span>Tất cả</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">{invoices.length + visiblePublishedPackages.length}</span>
                      </button>
                    )}
                  </div>

                  {paidInvoicesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/parent-snack-payment?view=receipts')}
                      className="px-3.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>Xem lịch sử biên lai →</span>
                    </button>
                  )}
                  <span className="text-xs text-slate-500">
                    Tổng số: <strong>{displayedInvoices.length + visiblePublishedPackages.length}</strong> gói dịch vụ
                  </span>
                </div>
              </div>

              {onlyActive && expiredInvoicesCount > 0 && (
                <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl px-4 py-2 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Đang chỉ hiển thị các gói <strong>còn hiệu lực</strong>. Đã ẩn {expiredInvoicesCount} gói cũ từ các kỳ trước.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/parent-snack-payment?view=receipts')}
                    className="text-emerald-700 font-bold hover:underline cursor-pointer text-left sm:text-right shrink-0"
                  >
                    Xem trong Lịch sử biên lai →
                  </button>
                </div>
              )}

              {/* Các gói mới công bố chưa tạo invoice */}
              {visiblePublishedPackages.map((pkg) => (
                <div
                  key={`pub-${pkg.periodId}`}
                  className="bg-white rounded-3xl border border-teal-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
                >
                  <div className="space-y-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-800 border border-teal-200">
                      ✨ Gói Suất Ăn Xế Mới Công Bố Từ Nhà Trường
                    </span>
                    <h3 className="text-lg font-black text-slate-900">{toSnackText(pkg.periodName)}</h3>
                    <p className="text-xs text-slate-600">{toSnackText(pkg.description)}</p>
                    <p className="text-xs text-slate-500">
                      Thời gian phục vụ: <strong>{formatDateRangeDMY(pkg.startDate, pkg.endDate, ' ~ ')}</strong> • Mức phí:{' '}
                      <strong className="text-emerald-700 font-black">
                        {formatNumber(pkg.feeAmount, 'VNĐ')}
                      </strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSchedulePeriodId(pkg.periodId);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-4 py-3.5 rounded-2xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Eye className="w-4 h-4 text-teal-600" />
                      <span>Xem trước thực đơn</span>
                    </button>
                    <button
                      onClick={() => handleEnrollAndPayPackage(pkg.periodId)}
                      disabled={processingId === pkg.periodId || pkg.feeAmount == null}
                      className="px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-2xl shadow-md transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Đăng ký & Thanh toán VNPAY · {formatNumber(pkg.feeAmount, 'đ')}
                    </button>
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
                  <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-600">Đang tải gói dịch vụ & phiếu thu tiền suất ăn xế...</p>
                </div>
              ) : displayedInvoices.length === 0 && visiblePublishedPackages.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs space-y-3">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Bé đã hoàn tất thanh toán tất cả các gói dịch vụ ăn xế hiện hành!
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Hiện không có gói suất ăn xế nào chờ thanh toán. Các hóa đơn &amp; biên lai điện tử đã thanh toán được lưu trữ đầy đủ trong mục Lịch sử biên lai.
                  </p>
                  {paidInvoicesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/parent-snack-payment?view=receipts')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Xem &amp; Tải Biên Lai Điện Tử →</span>
                    </button>
                  )}
                </div>
              ) : (
                displayedInvoices.map((inv) => {
                  const cleanClassName = String(inv.className || '').replace(/\s*\([^)]*\)/g, '').trim();
                  const hasDayBreakdown = inv.servingDays != null && inv.pricePerDay != null;
                  return (
                    <div
                      key={inv.id}
                      className={`bg-white rounded-2xl border transition-all px-5 py-4 shadow-2xs hover:shadow-xs ${
                        inv.status === 'PAID'
                          ? 'border-emerald-200'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {inv.status === 'PAID' ? '✓ Đã thanh toán' : '⏱ Chờ thanh toán'}
                            </span>

                            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {inv.invoiceCode}
                            </span>

                            {inv.dueDate && inv.status !== 'PAID' && (
                              <span className="text-xs text-slate-500">
                                · Hạn đóng: <strong className="text-slate-700">{formatDateDMY(inv.dueDate)}</strong>
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-black text-slate-900">
                            {toSnackText(inv.periodName)}
                          </h3>

                          <p className="text-xs text-slate-500">
                            <strong className="text-slate-700">{inv.childName}</strong>
                            {cleanClassName ? ` · ${cleanClassName}` : ''}
                          </p>

                          <p className="text-xs text-slate-500">
                            {inv.servingDays && inv.servingDays > 5
                              ? `${Math.max(1, Math.round(inv.servingDays / 5))} tuần`
                              : '1 tuần'}{' '}
                            &times; {formatNumber(inv.amount, 'đ')}
                          </p>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <span className="text-[11px] text-slate-400 font-medium block">Tổng số tiền</span>
                            <strong className="text-emerald-700 text-base font-black">
                              {formatNumber(inv.amount, 'VNĐ')}
                            </strong>
                          </div>

                          {inv.status === 'PAID' ? (
                            <button
                              onClick={() => handleViewReceipt(inv.registrationId)}
                              disabled={loadingReceipt}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Xem & Tải Biên Lai Điện Tử
                            </button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {inv.periodId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSchedulePeriodId(inv.periodId);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-3.5 py-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <Eye className="w-3.5 h-3.5 text-teal-600" />
                                  <span>Xem trước thực đơn</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleCheckout(inv)}
                                disabled={processingId === inv.registrationId || inv.amount == null}
                                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                              >
                                {processingId === inv.registrationId ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CreditCard className="w-4 h-4" />
                                )}
                                Thanh toán qua VNPAY QR · {formatNumber(inv.amount, 'đ')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
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
