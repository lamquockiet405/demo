import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  HeartPulse,
  UtensilsCrossed,
  CheckCircle2,
  X,
  Building2,
  Users,
  User,
  Coffee,
  Clock,
  Sparkles,
  FileCheck2,
  Flame,
  Scale,
  RefreshCw,
  BellRing,
  HelpCircle,
  Eye,
  Check,
  Send,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  PhoneCall,
  DollarSign,
} from 'lucide-react';
import {
  childAlertsApi,
  SchoolManagerAlertsResponse,
  NutritionistAlertsResponse,
  TeacherAlertsResponse,
  ParentAlertsResponse,
} from '../api/child-alerts.api';
import { useAuthStore } from '../../../core/stores/auth.store';

export const RoleSpecificChildAlertsPage: React.FC = () => {
  const { user } = useAuthStore();
  const userRoles = (user?.roles || []).map((r: any) =>
    typeof r === 'string' ? r.toUpperCase() : (r?.code || r?.name || '').toUpperCase()
  );

  const determineInitialRole = (): 'SCHOOL_MANAGER' | 'NUTRITIONIST' | 'TEACHER' | 'PARENT' => {
    if (userRoles.includes('PARENT')) return 'PARENT';
    if (userRoles.includes('TEACHER')) return 'TEACHER';
    if (userRoles.includes('NUTRITIONIST')) return 'NUTRITIONIST';
    return 'SCHOOL_MANAGER';
  };

  const [activeRole, setActiveRole] = useState<'SCHOOL_MANAGER' | 'NUTRITIONIST' | 'TEACHER' | 'PARENT'>(
    determineInitialRole
  );

  const [loading, setLoading] = useState(true);
  const [smData, setSmData] = useState<SchoolManagerAlertsResponse | null>(null);
  const [nutData, setNutData] = useState<NutritionistAlertsResponse | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherAlertsResponse | null>(null);
  const [parentData, setParentData] = useState<ParentAlertsResponse | null>(null);

  // Resolution Modal State
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolvePayload, setResolvePayload] = useState({
    alertId: '',
    alertType: '',
    title: '',
    resolutionAction: 'CONFIRMED',
    notes: '',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const [sm, nut, tch, par] = await Promise.all([
        childAlertsApi.getSchoolManagerAlerts(),
        childAlertsApi.getNutritionistAlerts(),
        childAlertsApi.getTeacherAlerts(),
        childAlertsApi.getParentAlerts(),
      ]);
      setSmData(sm);
      setNutData(nut);
      setTeacherData(tch);
      setParentData(par);
    } catch (err) {
      console.error('Failed to load role-specific child alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleOpenResolveModal = (alertId: string, alertType: string, title: string, defaultAction: string) => {
    setResolvePayload({
      alertId,
      alertType,
      title,
      resolutionAction: defaultAction,
      notes: '',
    });
    setIsResolveModalOpen(true);
  };

  const handleSubmitResolution = async () => {
    try {
      await childAlertsApi.resolveAlert({
        alertId: resolvePayload.alertId,
        alertType: resolvePayload.alertType,
        resolutionAction: resolvePayload.resolutionAction,
        notes: resolvePayload.notes,
      });
      setIsResolveModalOpen(false);
      showToast(`Đã ghi nhận xử lý cảnh báo [${resolvePayload.alertId}] thành công!`);
      loadAlerts();
    } catch (err) {
      showToast('Có lỗi xảy ra khi xử lý cảnh báo.');
    }
  };

  if (loading && !smData && !nutData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-600 font-medium text-sm">Đang quét & phân tầng cảnh báo sức khỏe trẻ em...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-semibold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner & Scoping Rule */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-400/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>UC93 – Phân Tầng Dữ Liệu Cảnh Báo Trẻ Em (Role-Specific Visibility Scoping)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Role-Specific Child Alerts Summary Center
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Nguyên tắc nghiệp vụ cốt lõi: Bảo mật sức khỏe & quyền riêng tư của trẻ (**Data Privacy & Child Safety**). Mỗi vai trò chỉ tiếp cận những cảnh báo thuộc đúng trách nhiệm và thẩm quyền giải quyết.
            </p>
          </div>

          {/* 4-ROLE SCOPE SWITCHER */}
          <div className="bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 flex flex-wrap gap-1 self-start md:self-auto shrink-0 shadow-inner">
            <button
              onClick={() => setActiveRole('SCHOOL_MANAGER')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeRole === 'SCHOOL_MANAGER'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Ban Giám Hiệu</span>
            </button>

            <button
              onClick={() => setActiveRole('NUTRITIONIST')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeRole === 'NUTRITIONIST'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Dinh Dưỡng</span>
            </button>

            <button
              onClick={() => setActiveRole('TEACHER')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeRole === 'TEACHER'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Giáo Viên</span>
            </button>

            <button
              onClick={() => setActiveRole('PARENT')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeRole === 'PARENT'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Phụ Huynh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* 1. ROLE A: SCHOOL MANAGER (BAN GIÁM HIỆU) – QUẢN TRỊ & XỬ LÝ KHỦNG HOẢNG   */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeRole === 'SCHOOL_MANAGER' && smData && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>Cảnh Báo Cấp Toàn Trường – Quản Trị & Xử Lý Khủng Hoảng</span>
              </h2>
              <p className="text-xs text-slate-500">
                Phạm vi: Toàn trường • Tổng cộng {smData.totalAlerts} cảnh báo ({smData.criticalCount} Khẩn cấp, {smData.warningCount} Cần lưu ý)
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              Scope: Toàn Trường
            </span>
          </div>

          {/* Grid 4 Categories of School Manager */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Xung đột dị ứng chưa xử lý trước 09h00 */}
            <div className="bg-white rounded-2xl p-5 border-2 border-rose-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping"></span>
                  <h3 className="font-bold text-sm text-rose-900 uppercase">
                    1. Xung Đột Dị Ứng Chưa Xử Lý (&lt; 09h00 Sáng)
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                  KHẨN CẤP
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Có trẻ dị ứng nặng nhưng Bếp/Chuyên viên dinh dưỡng chưa xác nhận món thay thế trước 09h00 sáng.
              </p>

              <div className="space-y-3">
                {smData.categories.unresolvedAllergenConflicts.map((conf) => (
                  <div key={conf.id} className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-xs text-slate-900">{conf.studentName}</strong>
                        <span className="text-[11px] text-slate-500 ml-2">({conf.className})</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                        Hạn chót: {conf.timeLimit}
                      </span>
                    </div>
                    <p className="text-xs text-rose-900 font-medium">
                      Dị ứng: <strong>{conf.allergen}</strong> • Món hôm nay: <strong>{conf.dishToday}</strong>
                    </p>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[11px] text-slate-500 italic">Trạng thái: Chưa có khay ăn thay thế</span>
                      <button
                        onClick={() =>
                          handleOpenResolveModal(
                            conf.id,
                            'ALLERGEN_CONFLICT',
                            `Chỉ đạo khẩn món thay thế cho ${conf.studentName}`,
                            'DIRECTED_KITCHEN_SAFE_SUBSTITUTE'
                          )
                        }
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                      >
                        Chỉ Đạo Bếp Khẩn Cấp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Cảnh báo bất thường diện rộng (>30% bỏ ăn/đau bụng) */}
            <div className="bg-white rounded-2xl p-5 border-2 border-amber-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-sm text-amber-900 uppercase">
                    2. Cảnh Báo Bất Thường Diện Rộng (&gt; 30% Bỏ Ăn)
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white">
                  DỊCH TỄ / NGỘ ĐỘC
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Một lớp học có trên 30% học sinh bỏ ăn hoặc báo đau bụng (Dấu hiệu ngộ độc thực phẩm hoặc dịch tễ).
              </p>

              <div className="space-y-3">
                {smData.categories.broadAnomalies.map((anom) => (
                  <div key={anom.id} className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">{anom.className}</span>
                      <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {anom.percentage}% bỏ ăn ({anom.affectedCount}/{anom.classSize} trẻ)
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{anom.message}</p>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] text-amber-800 font-semibold">
                        Triệu chứng: {anom.symptoms.join(', ')}
                      </span>
                      <button
                        onClick={() =>
                          handleOpenResolveModal(
                            anom.id,
                            'BROAD_ANOMALY',
                            `Kích hoạt quy trình an toàn thực phẩm lớp ${anom.className}`,
                            'ACTIVATED_FOOD_SAFETY_RESPONSE'
                          )
                        }
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                      >
                        Cử Y Tế &amp; Kiểm Tra Lưu Mẫu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Cảnh báo nợ phí dịch vụ bán trú/ăn xế */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 uppercase flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>3. Cảnh Báo Nợ Phí Dịch Vụ Bán Trú/Ăn Xế</span>
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                  Phòng Tài Vụ
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Danh sách các tài khoản quá hạn thanh toán để chỉ đạo phòng tài vụ đôn đốc.
              </p>

              <div className="space-y-2.5">
                {smData.categories.overduePayments.map((pay) => (
                  <div key={pay.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-slate-900 block">{pay.studentName} ({pay.className})</strong>
                      <span className="text-[11px] text-slate-500">
                        {pay.periodName} • Quá hạn {pay.overdueDays} ngày
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-rose-600">{pay.amountVnd.toLocaleString('vi-VN')} VND</div>
                      <button
                        onClick={() =>
                          handleOpenResolveModal(
                            pay.id,
                            'OVERDUE_PAYMENT',
                            `Đôn đốc đóng phí cho ${pay.studentName}`,
                            'SENT_VNPAY_REMINDER'
                          )
                        }
                        className="mt-1 px-2.5 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-700"
                      >
                        Gửi Đôn Đốc VNPAY
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Phản ánh từ phụ huynh */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 uppercase flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>4. Phản Ánh &amp; Khiếu Nại Từ Phụ Huynh</span>
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                  Chưa Giải Quyết
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tiếp nhận các đánh giá 1-2 sao về khẩu phần ăn chưa được nhà trường giải quyết.
              </p>

              <div className="space-y-2.5">
                {smData.categories.parentComplaints.map((comp) => (
                  <div key={comp.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <strong className="text-slate-900">{comp.studentName} ({comp.className})</strong>
                      <span className="text-amber-500 font-bold">★ {comp.rating}/5 sao</span>
                    </div>
                    <p className="text-slate-700 italic">"{comp.comment}"</p>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() =>
                          handleOpenResolveModal(
                            comp.id,
                            'PARENT_COMPLAINT',
                            `Xử lý khiếu nại phụ huynh của ${comp.studentName}`,
                            'ASSIGNED_RESOLUTION_TEAM'
                          )
                        }
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold"
                      >
                        Phân Công Phản Hồi Khiếu Nại
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* 2. ROLE B: NUTRITIONIST (CHUYÊN VIÊN DINH DƯỠNG) – LÂM SÀNG & AN TOÀN       */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeRole === 'NUTRITIONIST' && nutData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                <span>Cảnh Báo Kỹ Thuật Dinh Dưỡng &amp; An Toàn Thực Phẩm</span>
              </h2>
              <p className="text-xs text-slate-500">
                Phạm vi: Toàn trường / Chuyên môn kỹ thuật thực đơn, vi chất &amp; lâm sàng
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Scope: Chuyên Viên Dinh Dưỡng
            </span>
          </div>

          <div className="space-y-6">
            {/* Allergen Cross-Matching */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span>Cảnh Báo Xung Đột Chất Dị Ứng (Allergen Cross-Matching Alert)</span>
              </h3>
              <p className="text-xs text-slate-600">
                Hệ thống tự động quét thực đơn ngày mai và đối chiếu hồ sơ dị ứng toàn trường.
              </p>

              <div className="space-y-3">
                {nutData.categories.allergenCrossMatchingAlerts.map((alt) => (
                  <div key={alt.id} className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 text-sm">{alt.studentName}</strong>
                        <span className="text-slate-500">({alt.className})</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                          Dị ứng: {alt.allergenName}
                        </span>
                      </div>
                      <p className="text-slate-700">
                        Món có nguy cơ trong thực đơn: <strong className="text-rose-700">{alt.menuDishName}</strong>
                      </p>
                      <p className="text-emerald-700 font-semibold">
                        Gợi ý món thay thế an toàn: <strong>{alt.proposedSubstitute}</strong>
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        handleOpenResolveModal(
                          alt.id,
                          'ALLERGEN_CROSS_MATCHING',
                          `Xác nhận đổi món an toàn cho ${alt.studentName}`,
                          'ASSIGNED_SAFE_SUBSTITUTE_DISH'
                        )
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shrink-0 shadow-xs"
                    >
                      Ký Duyệt Món Thay Thế
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth Risk Alert */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-amber-600" />
                <span>Cảnh Báo Thể Trạng Suy Giảm (Growth Risk Alert - Sụt Cân Liên Tiếp 2 Kỳ)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nutData.categories.growthRiskAlerts.map((g) => (
                  <div key={g.id} className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-slate-900 text-sm">{g.studentName}</strong>
                        <span className="text-slate-500 ml-2">({g.className})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-800">
                        WAZ: {g.currentWaz} SD
                      </span>
                    </div>
                    <p className="text-slate-700">{g.diagnosis}</p>
                    <p className="text-emerald-800 font-medium">Khuyến nghị: {g.recommendedAction}</p>
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() =>
                          handleOpenResolveModal(
                            g.id,
                            'GROWTH_RISK',
                            `Thiết lập can thiệp thể trạng cho ${g.studentName}`,
                            'CREATED_CLINICAL_NUTRITION_PLAN'
                          )
                        }
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                      >
                        Lập Hồ Sơ Can Thiệp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Micronutrient Deficit Alert */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                <span>Cảnh Báo Thiếu Hụt Vi Chất Dài Hạn (Thông Tư 28/2016)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nutData.categories.micronutrientDeficitAlerts.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <strong className="text-indigo-900 text-sm">{m.nutrientName}</strong>
                      <span className="text-indigo-700 font-semibold">{m.menuPeriod}</span>
                    </div>
                    <p className="text-slate-700">{m.message}</p>
                    <p className="text-emerald-800 font-medium">Giải pháp: {m.recommendedAction}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* 3. ROLE C: TEACHER (GIÁO VIÊN ĐỨNG LỚP) – PHẠM VI LỚP HỌC                   */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeRole === 'TEACHER' && teacherData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Cảnh Báo Lớp Học – Giáo Viên Chủ Nhiệm {teacherData.className}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Phạm vi: Trong phạm vi lớp {teacherData.className} ({teacherData.totalAlerts} cảnh báo cần xử lý tại lớp)
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
              Scope: {teacherData.className}
            </span>
          </div>

          <div className="space-y-6">
            {/* 1. Khay ăn riêng dán nhãn xanh tại bàn */}
            <div className="bg-white rounded-2xl p-5 border-2 border-emerald-300 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                    <span>1. Cảnh Báo Dị Ứng Tại Bàn Ăn (Meal Tray Flagging)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Khi nhận khay ăn trưa/xế từ bếp, giáo viên đối chiếu danh sách và dán nhãn khay ăn riêng
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-black bg-emerald-600 text-white">
                  KHAY RIÊNG NHÃN XANH
                </span>
              </div>

              <div className="space-y-3">
                {teacherData.trayFlaggingAlerts.map((tray) => (
                  <div key={tray.id} className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-300 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 text-sm">{tray.studentName}</strong>
                        <span className="px-2 py-0.5 rounded font-black bg-emerald-700 text-white text-[11px]">
                          {tray.tableNumber}
                        </span>
                        <span className="text-rose-700 font-bold">Dị ứng: {tray.allergen}</span>
                      </div>
                      <p className="text-slate-700">
                        Khay riêng an toàn: <strong className="text-emerald-800">{tray.substituteDish}</strong> (thay cho {tray.originalDish})
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        handleOpenResolveModal(
                          tray.id,
                          'MEAL_TRAY',
                          `Xác nhận khay riêng cho ${tray.studentName}`,
                          'VERIFIED_TRAY_AT_TABLE'
                        )
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shrink-0 shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Đã Kiểm Tra Khay Tại Bàn</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Ăn uống kém 2 ngày liên tục & Đơn thuốc dặn dò */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Poor Consumption */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>2. Học Sinh Ăn Kém (&lt; 30% Khẩu Phần 2 Ngày)</span>
                </h3>
                <div className="space-y-3">
                  {teacherData.poorConsumptionAlerts.map((p) => (
                    <div key={p.id} className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <strong className="text-slate-900 text-sm">{p.studentName}</strong>
                        <span className="text-amber-700 font-bold">{p.consecutiveDays} ngày liên tiếp</span>
                      </div>
                      <p className="text-slate-600">{p.message}</p>
                      <p className="text-emerald-800 font-semibold">{p.recommendedAction}</p>
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => showToast(`Đã ghi nhận liên hệ phụ huynh bé ${p.studentName}`)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold"
                        >
                          Gọi Điện Trao Đổi Phụ Huynh
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medication Request */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-indigo-600" />
                  <span>3. Đơn Thuốc &amp; Dặn Dò Y Tế Từ Phụ Huynh</span>
                </h3>
                <div className="space-y-3">
                  {teacherData.medicalMedicationRequests.map((med) => (
                    <div key={med.id} className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <strong className="text-slate-900 text-sm">{med.studentName}</strong>
                        <span className="text-slate-500">{med.submittedAt}</span>
                      </div>
                      <p className="text-slate-700 font-medium italic">"{med.medicationNote}"</p>
                      <p className="text-[11px] text-slate-500">Người gửi: {med.parentName}</p>
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() =>
                            handleOpenResolveModal(
                              med.id,
                              'MEDICATION',
                              `Xác nhận đã cho ${med.studentName} uống thuốc/chăm sóc`,
                              'ACKNOWLEDGED_MEDICATION'
                            )
                          }
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold"
                        >
                          Xác Nhận Đã Chăm Sóc Theo Đơn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* 4. ROLE D: PARENT (PHỤ HUYNH HỌC SINH) – CHỈ DUY NHẤT CON MÌNH              */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeRole === 'PARENT' && parentData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <span>Cổng Thông Tin &amp; Cảnh Báo An Toàn Bữa Ăn Của Con</span>
              </h2>
              <p className="text-xs text-slate-500">
                Phạm vi: Bảo mật cá nhân hóa – Chỉ hiển thị thông tin con của bạn ({parentData.totalChildren} học sinh)
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Scope: Phụ Huynh Cá Nhân
            </span>
          </div>

          <div className="space-y-6">
            {parentData.children.map((c) => (
              <div key={c.childId} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-black text-lg flex items-center justify-center shadow-md">
                      {c.childName.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">{c.childName}</h3>
                      <p className="text-xs text-slate-500">
                        Mã học sinh: {c.studentCode} • Lớp: <strong>{c.className}</strong>
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                    Hồ sơ dinh dưỡng chuẩn
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Card 1: Cảnh báo an toàn thực đơn */}
                  <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>{c.menuSafetyAlert.title}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{c.menuSafetyAlert.content}</p>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 mt-1">
                      Đã tự động bảo vệ dị ứng
                    </span>
                  </div>

                  {/* Card 2: Báo cáo lượng ăn hôm nay */}
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 font-bold">
                      <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                      <span>{c.dailyIntakeReport.title}</span>
                    </div>
                    <div className="space-y-1 text-slate-700">
                      <div>• Bữa trưa: <strong>{c.dailyIntakeReport.lunchStatus}</strong></div>
                      <div>• Bữa xế: <strong>{c.dailyIntakeReport.snackStatus}</strong></div>
                    </div>
                    <p className="text-[11px] text-slate-500 italic mt-1 border-t border-amber-200 pt-1">
                      Cô nhận xét: "{c.dailyIntakeReport.teacherNote}"
                    </p>
                  </div>

                  {/* Card 3: Nhắc nhở y tế & thể trạng */}
                  <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold">
                      <Scale className="w-4 h-4 text-indigo-600" />
                      <span>{c.healthReminder.title}</span>
                    </div>
                    <p className="text-slate-700">
                      Lịch cân đo tiếp theo: <strong>{c.healthReminder.nextMeasurementDate}</strong>
                    </p>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {c.healthReminder.nutritionistAdvice}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: XÁC NHẬN / XỬ LÝ CẢNH BÁO                                            */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Xác Nhận Xử Lý Cảnh Báo
              </h3>
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-mono">ID: {resolvePayload.alertId}</span>
                <strong className="text-slate-900 block mt-0.5">{resolvePayload.title}</strong>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi Chú Xử Lý Thực Tế</label>
                <textarea
                  rows={3}
                  placeholder="Nhập chi tiết biện pháp đã thực hiện (VD: Bếp đã đổi sang thịt heo hấp, cô giáo đã kiểm tra khay tại bàn)..."
                  value={resolvePayload.notes}
                  onChange={(e) => setResolvePayload({ ...resolvePayload, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-xs text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={handleSubmitResolution}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Lưu &amp; Hoàn Tất Xử Lý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

