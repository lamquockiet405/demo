import React, { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  FileText,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { fetchSnackServicesList, createSnackServicePeriod } from '../api/snackServicesApi';
import { SnackServiceListItem, CreateSnackServicePeriodDto } from '../types/snackServices';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GRADE_OPTIONS = [
  { value: 'TODDLER_1_2Y', label: 'Nhà trẻ (1.5-3T)', shortLabel: 'Nhà trẻ' },
  { value: 'KINDERGARTEN_3_4Y', label: 'Mầm (3-4T)', shortLabel: 'Mầm' },
  { value: 'KINDERGARTEN_4_5Y', label: 'Chồi (4-5T)', shortLabel: 'Chồi' },
  { value: 'KINDERGARTEN_5_6Y', label: 'Lá (5-6T)', shortLabel: 'Lá' },
];

const generatePeriodCode = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const suffix = String(Math.floor(10 + Math.random() * 89));
  return `XGC-${year}-T${month}-${suffix}`;
};

const getAvailableMonths = () => {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
    months.push({ value: val, label });
  }
  return months;
};

export const CreateSnackServicePeriodModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const availableMonths = getAvailableMonths();

  // Data loading
  const [servicesList, setServicesList] = useState<SnackServiceListItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form state - Section 1
  const [selectedServiceId, setSelectedServiceId] = useState('template-1');
  const [packageName, setPackageName] = useState(
    'Gói Suất Ăn Sáng Dinh Dưỡng - Sữa hạt & Bánh tươi',
  );
  const [periodCode, setPeriodCode] = useState(generatePeriodCode());
  const [appliedGrades, setAppliedGrades] = useState<string[]>(
    GRADE_OPTIONS.map((g) => g.value),
  );
  const [isWholeSchool, setIsWholeSchool] = useState(true);
  const [registrationStart, setRegistrationStart] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [registrationEnd, setRegistrationEnd] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  );
  const [serviceMonths, setServiceMonths] = useState<string[]>(() =>
    availableMonths.length > 0 ? [availableMonths[0].value] : ['2026-11'],
  );
  const [pricePerDay, setPricePerDay] = useState<number>(25000);
  const [autoRefund, setAutoRefund] = useState(true);

  // Form state - Section 2
  const [capacityMode, setCapacityMode] = useState<'UNLIMITED' | 'LIMITED'>('UNLIMITED');
  const [kitchenCapacity, setKitchenCapacity] = useState<number>(90);
  const [totalQuota, setTotalQuota] = useState<number>(90);
  const [quotaPerGrade, setQuotaPerGrade] = useState<Record<string, number>>({});
  const [autoClose, setAutoClose] = useState(false);
  const [autoCloseThreshold, setAutoCloseThreshold] = useState<number>(90);

  // Form state - Section 3
  const [nutritionNotes, setNutritionNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadServices();
      setSubmitMessage(null);
      setPeriodCode(generatePeriodCode());
      setRegistrationStart(new Date().toISOString().slice(0, 10));
      setRegistrationEnd(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
      if (availableMonths.length > 0 && serviceMonths.length === 0) {
        setServiceMonths([availableMonths[0].value]);
      }
      if (appliedGrades.length === 0) {
        setAppliedGrades(GRADE_OPTIONS.map((g) => g.value));
        setIsWholeSchool(true);
      }
    }
  }, [isOpen]);

  const loadServices = async () => {
    try {
      const res = await fetchSnackServicesList();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? (res as any)
        : [];
      if (list.length > 0) {
        setServicesList(list);
        setSelectedServiceId(String(list[0].id));
        if (!packageName.trim()) {
          setPackageName(list[0].name);
        }
        if (!pricePerDay || pricePerDay <= 0) {
          setPricePerDay(Number(list[0].pricePerUnit) || 25000);
        }
      }
    } catch (err) {
      console.error('Error loading services list:', err);
    }
  };

  const handleServiceTemplateSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const service = servicesList.find((s) => String(s.id) === String(serviceId));
    if (service) {
      setPackageName(service.name);
      setPricePerDay(Number(service.pricePerUnit) || 25000);
      if (service.description) {
        setNutritionNotes(service.description);
      }
    }
  };

  const toggleGrade = (grade: string) => {
    setAppliedGrades((prev) => {
      const next = prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade];
      setIsWholeSchool(next.length === GRADE_OPTIONS.length);
      return next;
    });
  };

  const toggleMonth = (month: string) => {
    setServiceMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month],
    );
  };

  const handleWholeSchool = (checked: boolean) => {
    setIsWholeSchool(checked);
    if (checked) {
      setAppliedGrades(GRADE_OPTIONS.map((g) => g.value));
    } else {
      setAppliedGrades([]);
    }
  };

  const monthlyEstimate = (pricePerDay || 0) * 22;

  const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount || 0);

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE' | 'OPEN') => {
    const trimmedName = packageName.trim();
    if (!trimmedName) {
      setSubmitMessage({ type: 'error', text: 'Vui lòng nhập hoặc chọn tên gói suất ăn sáng.' });
      return;
    }
    if (appliedGrades.length === 0) {
      setSubmitMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 khối lớp áp dụng.' });
      return;
    }
    if (!registrationStart || !registrationEnd) {
      setSubmitMessage({ type: 'error', text: 'Vui lòng chọn thời gian nhận đơn.' });
      return;
    }
    if (new Date(registrationEnd).getTime() <= new Date(registrationStart).getTime()) {
      setSubmitMessage({ type: 'error', text: 'Ngày kết thúc phải sau ngày bắt đầu' });
      return;
    }
    if (serviceMonths.length === 0) {
      setSubmitMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 tháng phục vụ' });
      return;
    }
    if (capacityMode === 'LIMITED' && (!totalQuota || totalQuota <= 0)) {
      setSubmitMessage({ type: 'error', text: 'Vui lòng nhập tổng chỉ tiêu' });
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const dto: CreateSnackServicePeriodDto = {
        name: trimmedName,
        snackServiceId: selectedServiceId || 'custom',
        periodCode: periodCode.trim() || generatePeriodCode(),
        appliedGrades,
        isWholeSchool,
        registrationStart,
        registrationEnd,
        serviceMonths,
        pricePerUnitPerDay: Number(pricePerDay) || 20000,
        autoRefundEnabled: autoRefund,
        capacityMode,
        kitchenCapacity: capacityMode === 'LIMITED' ? kitchenCapacity : undefined,
        totalQuota: capacityMode === 'LIMITED' ? totalQuota : undefined,
        quotaPerGrade: capacityMode === 'LIMITED' ? quotaPerGrade : undefined,
        autoCloseEnabled: autoClose,
        autoCloseThresholdPercent: autoClose ? autoCloseThreshold : undefined,
        nutritionNotes: nutritionNotes.trim() || undefined,
        status: status === 'ACTIVE' ? 'OPEN' : status,
      };

      const res = await createSnackServicePeriod(dto);
      if (res && (res.success || (res as any).id || (res as any).data)) {
        setSubmitMessage({
          type: 'success',
          text:
            res.message ||
            `Đã tạo gói "${trimmedName}" thành công và công bố cho phụ huynh đăng ký!`,
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 900);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setSubmitMessage({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - Right Panel */}
      <div
        className="relative w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
        style={{ animation: 'slideInRight 0.3s ease-out' }}
      >
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500 text-white flex items-center justify-center shadow-sm">
                <Calendar className="w-4 h-4" />
              </div>
              Tạo Đợt Đăng Ký Suất Ăn Sáng
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 ml-10">
              Cấu hình gói dịch vụ suất ăn sáng mới, đơn giá và công bố cho phụ huynh đăng ký & thanh toán VNPAY
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          {/* ====== SECTION 1: Cấu hình thời gian & Đơn giá ====== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Cấu hình thời gian & Đơn giá dịch vụ
              </h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold ml-auto">
                Bắt buộc
              </span>
            </div>

            {/* Tên gói & Mã đợt */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-[11px] font-bold text-slate-600">
                  Tên gói dịch vụ suất ăn sáng * (Có thể nhập tên mới hoặc chọn mẫu)
                </label>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="Nhập tên gói suất ăn sáng (VD: Gói Suất Ăn Sáng Tháng 11/2026)..."
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                />
                {servicesList.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                      Chọn mẫu nhanh:
                    </span>
                    <select
                      value={selectedServiceId}
                      onChange={(e) => handleServiceTemplateSelect(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:border-teal-500"
                    >
                      {servicesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatVND(s.pricePerUnit)}đ/ngày)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  Mã đợt đăng ký *
                </label>
                <input
                  type="text"
                  value={periodCode}
                  onChange={(e) => setPeriodCode(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  placeholder="XGC-2026-T11"
                />
              </div>
            </div>

            {/* Khối lớp áp dụng */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-2">
                Khối lớp áp dụng *
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {GRADE_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleGrade(g.value)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                      appliedGrades.includes(g.value)
                        ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-600'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
                <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWholeSchool}
                    onChange={(e) => handleWholeSchool(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-teal-500 focus:ring-teal-500/20"
                  />
                  <span className="text-[11px] font-semibold text-slate-500">
                    Toàn trường (Áp dụng tất cả khối)
                  </span>
                </label>
              </div>
            </div>

            {/* Thời gian nhận đơn & tháng phục vụ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  Bắt đầu nhận đơn *
                </label>
                <input
                  type="date"
                  value={registrationStart}
                  onChange={(e) => setRegistrationStart(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  Kết thúc nhận đơn *
                </label>
                <input
                  type="date"
                  value={registrationEnd}
                  onChange={(e) => setRegistrationEnd(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  Tháng phục vụ bữa sáng *
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableMonths.slice(0, 3).map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => toggleMonth(m.value)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                        serviceMonths.includes(m.value)
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Đơn giá */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                Đơn giá / suất/bé/ngày *
              </label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="number"
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition pr-16"
                    min={0}
                    step={1000}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                    đ / ngày
                  </span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
                  <p className="text-[10px] font-bold text-amber-600 uppercase">
                    Dự tính/tháng (22 ngày)
                  </p>
                  <p className="text-sm font-black text-amber-700 mt-0.5">
                    {formatVND(monthlyEstimate)}{' '}
                    <span className="text-[10px] font-normal text-amber-500">
                      đ/tháng 1 trẻ
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Auto refund toggle */}
            <div className="flex items-start gap-3 p-3 bg-sky-50/80 border border-sky-200 rounded-xl">
              <input
                type="checkbox"
                checked={autoRefund}
                onChange={(e) => setAutoRefund(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-500/20 mt-0.5"
              />
              <div>
                <p className="text-[11px] font-bold text-slate-700">
                  Chính sách hoàn tiền khi trẻ nghỉ có báo trước:{' '}
                  <span className="text-teal-600">Bảng giá hoàn tiền gợi ý ▸</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Tự động hoàn tiền khi phụ huynh hoàn thành xin nghỉ trước thời hạn: không tính phí bữa sáng ngày đó
                </p>
              </div>
            </div>
          </div>

          {/* ====== SECTION 2: Giới hạn học sinh & Công suất ====== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Cấu hình giới hạn học sinh & Công suất
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold ml-auto">
                Công suất bếp
              </span>
            </div>

            {/* Capacity mode */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-2">
                Cơ chế nhận chỗ đăng ký
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="capacityMode"
                    value="UNLIMITED"
                    checked={capacityMode === 'UNLIMITED'}
                    onChange={() => setCapacityMode('UNLIMITED')}
                    className="w-4 h-4 text-teal-500 focus:ring-teal-500/20"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Không giới hạn (Phục vụ tối đa theo nhu cầu)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setCapacityMode('LIMITED')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                    capacityMode === 'LIMITED'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  Giới hạn số lượng theo công suất bếp
                </button>
              </div>
            </div>

            {capacityMode === 'LIMITED' && (
              <div className="space-y-3 pl-2 border-l-2 border-teal-200 ml-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                      Chỉ tiêu hiện tại toàn trường (suất) =
                    </label>
                    <input
                      type="number"
                      value={totalQuota}
                      onChange={(e) => setTotalQuota(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                      Công suất bếp (suất)
                    </label>
                    <input
                      type="number"
                      value={kitchenCapacity}
                      onChange={(e) => setKitchenCapacity(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-2">
                    Phân bổ chỉ tiêu suất ăn sáng theo khối lớp:
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {GRADE_OPTIONS.map((g) => (
                      <div key={g.value}>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Khối {g.shortLabel}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={quotaPerGrade[g.value] || ''}
                            onChange={(e) =>
                              setQuotaPerGrade((prev) => ({
                                ...prev,
                                [g.value]: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                            min={0}
                            placeholder="0"
                          />
                          <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                            suất
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ====== SECTION 3: Ghi chú ====== */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Ghi chú dinh dưỡng & Mô tả gói dịch vụ:
              </h3>
            </div>

            <textarea
              value={nutritionNotes}
              onChange={(e) => setNutritionNotes(e.target.value)}
              rows={3}
              placeholder="Gói sữa hạt yến mạch nguyên cám kết hợp bánh nướng tươi mỗi buổi sáng 07h00..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition resize-none"
            />

            {/* Info notices */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                <Zap className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-emerald-700 font-medium">
                  <strong>Sau khi bấm "Kích hoạt & Mở đợt đăng ký"</strong>, gói dịch vụ sẽ có trạng thái <strong>Đang công bố (OPEN)</strong> và hiển thị ngay bên trang <strong>/parent-snack-payment</strong> để Phụ huynh đăng ký & thanh toán qua VNPAY.
                </p>
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                <Shield className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-700 font-medium">
                  Chuyên gia Dinh dưỡng (CGDD) có thể thiết kế lịch thực đơn Thứ 2 – Thứ 6 cho gói này ngay sau khi tạo.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Message */}
          {submitMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold ${
                submitMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {submitMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span>{submitMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-200 bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Hủy bỏ / Quay lại
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSubmit('DRAFT')}
              disabled={submitting}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Lưu bản nháp
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('OPEN')}
              disabled={submitting}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {submitting ? 'Đang xử lý...' : 'Kích hoạt & Mở đợt đăng ký'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
