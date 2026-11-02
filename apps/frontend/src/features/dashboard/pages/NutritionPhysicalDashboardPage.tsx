import React, { useState, useEffect } from 'react';
import {
  Activity,
  HeartPulse,
  Scale,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  X,
  User,
  Users,
  ChevronRight,
  UtensilsCrossed,
  Flame,
  FileCheck2,
  Calendar,
  Building2,
  Download,
  DollarSign,
  MessageSquare,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  Award,
} from 'lucide-react';
import {
  nutritionPhysicalDashboardApi,
  SchoolManagerOverviewResponse,
  NutritionistClinicalOverviewResponse,
  AtRiskStudentItem,
} from '../api/nutrition-physical-dashboard.api';
import { useAuthStore } from '../../../core/stores/auth.store';

export const NutritionPhysicalDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const userRoles = (user?.roles || []).map((r: any) =>
    typeof r === 'string' ? r.toUpperCase() : (r?.code || r?.name || '').toUpperCase()
  );

  const isNutritionistRole = userRoles.includes('NUTRITIONIST');

  // Role Tab Switcher: 'SCHOOL_MANAGER' | 'NUTRITIONIST'
  const [activeRoleView, setActiveRoleView] = useState<'SCHOOL_MANAGER' | 'NUTRITIONIST'>(
    isNutritionistRole ? 'NUTRITIONIST' : 'SCHOOL_MANAGER'
  );

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [smData, setSmData] = useState<SchoolManagerOverviewResponse | null>(null);
  const [nutData, setNutData] = useState<NutritionistClinicalOverviewResponse | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('');

  // Action Modals State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    gradeCode: 'NHA_TRE',
    amountVnd: 15000000,
    notes: 'Kinh phí tăng cường sữa bột dinh dưỡng và bổ sung vi chất Canxi/D3 cho trẻ thấp còi',
    semester: 'Học kỳ 1 - Năm học 2026-2027',
  });

  const [isDietModalOpen, setIsDietModalOpen] = useState(false);
  const [selectedAtRiskChild, setSelectedAtRiskChild] = useState<AtRiskStudentItem | null>(null);
  const [dietForm, setDietForm] = useState({
    dietType: 'HIGH_CALORIE_MICRONUTRIENT',
    targetCalories: 750,
    adjustmentNotes: 'Bổ sung thêm 1 hũ sữa chua men sống vào bữa xế; tăng 20% đạm thịt gà/bò nạc trong bữa trưa.',
    extraSupplements: 'Canxi sinh học & Vitamin D3, Kẽm',
  });

  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [consultForm, setConsultForm] = useState({
    scheduledDate: '2026-11-12T09:00',
    consultationTopic: 'Tư vấn chế độ ăn dặm giàu vi chất & dinh dưỡng tăng trưởng tại gia đình',
    notes: 'Tư vấn trực tiếp tại phòng Y tế Dinh dưỡng hoặc trực tuyến qua app KidMeal',
  });

  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Fetch initial data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [smRes, nutRes] = await Promise.all([
        nutritionPhysicalDashboardApi.getSchoolManagerOverview(),
        nutritionPhysicalDashboardApi.getNutritionistClinicalOverview(selectedClassFilter || undefined),
      ]);
      setSmData(smRes);
      setNutData(nutRes);
    } catch (err) {
      console.error('Failed to load nutrition-physical dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedClassFilter]);

  // Handlers for School Manager Actions
  const handleApproveBudget = async () => {
    try {
      const res = await nutritionPhysicalDashboardApi.approveBudget(budgetForm);
      setIsBudgetModalOpen(false);
      showToast(`Phê duyệt thành công! Mã giao dịch: ${res.approvalCode}`);
    } catch (err: any) {
      showToast('Có lỗi xảy ra khi phê duyệt ngân sách.', 'error');
    }
  };

  const handleExportReport = async () => {
    try {
      const report = await nutritionPhysicalDashboardApi.exportNutritionReport();
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bao-Cao-Dinh-Duong-The-Luc-PGD-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Đã trích xuất báo cáo sơ kết PGD&ĐT thành công!');
    } catch (err) {
      showToast('Lỗi khi xuất báo cáo.', 'error');
    }
  };

  // Handlers for Nutritionist Actions
  const handleOpenDietModal = (child: AtRiskStudentItem) => {
    setSelectedAtRiskChild(child);
    if (child.classification.includes('OBESE') || child.classification.includes('OVERWEIGHT')) {
      setDietForm({
        dietType: 'LOW_FAT_HIGH_FIBER',
        targetCalories: 600,
        adjustmentNotes: 'Giảm 20% lượng cơm/tinh bột, thay thế bằng khoai lang luộc; tăng gấp đôi rau xanh và canh củ.',
        extraSupplements: 'Chất xơ hòa tan, Men tiêu hóa tự nhiên',
      });
    } else {
      setDietForm({
        dietType: 'HIGH_CALORIE_MICRONUTRIENT',
        targetCalories: 780,
        adjustmentNotes: 'Tăng 20% đạm thịt cá nạc, thêm dầu cá mè vào canh ấm, bổ sung 1 hộp sữa chua sau giấc ngủ trưa.',
        extraSupplements: 'Canxi sinh học & Vitamin D3, Kẽm',
      });
    }
    setIsDietModalOpen(true);
  };

  const handleSubmitPersonalizedDiet = async () => {
    if (!selectedAtRiskChild) return;
    try {
      const res = await nutritionPhysicalDashboardApi.createPersonalizedDiet({
        studentId: Number(selectedAtRiskChild.id),
        dietType: dietForm.dietType,
        adjustmentNotes: dietForm.adjustmentNotes,
        targetCalories: dietForm.targetCalories,
        extraSupplements: dietForm.extraSupplements.split(',').map((s) => s.trim()),
      });
      setIsDietModalOpen(false);
      showToast(`Đã thiết lập thực đơn can thiệp cho ${res.studentName} (Mã: ${res.dietPlanId})!`);
    } catch (err) {
      showToast('Lỗi khi lập thực đơn can thiệp.', 'error');
    }
  };

  const handleOpenConsultModal = (child: AtRiskStudentItem) => {
    setSelectedAtRiskChild(child);
    setConsultForm({
      scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      consultationTopic: `Tư vấn chế độ dinh dưỡng & thể lực cho bé ${child.fullName} (${child.diagnosis})`,
      notes: 'Tư vấn trực tiếp tại phòng Dinh dưỡng học đường hoặc qua cuộc gọi App',
    });
    setIsConsultModalOpen(true);
  };

  const handleSubmitConsultation = async () => {
    if (!selectedAtRiskChild) return;
    try {
      const res = await nutritionPhysicalDashboardApi.scheduleParentConsultation({
        studentId: Number(selectedAtRiskChild.id),
        scheduledDate: consultForm.scheduledDate,
        consultationTopic: consultForm.consultationTopic,
        notes: consultForm.notes,
      });
      setIsConsultModalOpen(false);
      showToast(`Đã gửi thông báo hẹn tư vấn tới phụ huynh của ${res.studentName}!`);
    } catch (err) {
      showToast('Lỗi khi đặt lịch tư vấn.', 'error');
    }
  };

  if (loading && !smData && !nutData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-600 font-medium text-sm">Đang nạp dữ liệu Chỉ huy Dinh dưỡng & Thể trạng...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium transition-all ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Top Banner & Dual-View Role Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>UC92 – Trung Tâm Chỉ Huy Dinh Dưỡng & Thể Trạng Thể Chất</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Executive & Clinical Nutrition Command Center
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Tích hợp 2 trục dữ liệu lớn: Nhân trắc học đối chiếu chuẩn tăng trưởng{' '}
              <strong className="text-emerald-300 font-semibold">WHO Z-score</strong> và Đảm bảo khẩu phần bữa ăn bán trú theo quy chuẩn{' '}
              <strong className="text-emerald-300 font-semibold">Thông tư 28/2016/TT-BGDĐT</strong>.
            </p>
          </div>

          {/* DUAL-VIEW SWITCHER BUTTONS */}
          <div className="bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/80 flex items-center self-start md:self-auto shrink-0 shadow-inner">
            <button
              onClick={() => setActiveRoleView('SCHOOL_MANAGER')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeRoleView === 'SCHOOL_MANAGER'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Góc nhìn Ban Giám Hiệu</span>
            </button>
            <button
              onClick={() => setActiveRoleView('NUTRITIONIST')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeRoleView === 'NUTRITIONIST'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Góc nhìn Chuyên Viên DD</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: SCHOOL MANAGER (BAN GIÁM HIỆU) – GÓC NHÌN QUẢN TRỊ & BÁO CÁO        */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeRoleView === 'SCHOOL_MANAGER' && smData && (
        <div className="space-y-8 animate-fadeIn">
          {/* Executive KPI Summary Cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>Chỉ Số Trọng Yếu Năm Học (Executive Growth KPIs)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Đối chiếu chỉ tiêu Bộ GD&ĐT & Viện Dinh Dưỡng Quốc Gia ({smData.kpis.evaluatedStudents}/{smData.kpis.totalStudents} học sinh đã kiểm tra)
                </p>
              </div>
              <button
                onClick={handleExportReport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất Báo Cáo PGD&ĐT</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Tỷ lệ phát triển bình thường */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phát triển bình thường</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700">
                    Mục tiêu &gt; 90%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-600">{smData.kpis.normalRate}%</span>
                  <span className="text-xs text-slate-500 font-medium">({smData.kpis.normalCount} trẻ)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, smData.kpis.normalRate)}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Đạt chuẩn chỉ tiêu chất lượng toàn trường</span>
                </p>
              </div>

              {/* KPI 2: Tỷ lệ suy dinh dưỡng */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suy dinh dưỡng</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700">
                    Mục tiêu &lt; 3%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">{smData.kpis.underweightRate}%</span>
                  <span className="text-xs text-slate-500 font-medium">
                    (Nhẹ cân {smData.kpis.underweightCount} | Thấp còi {smData.kpis.stuntedCount})
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, smData.kpis.underweightRate * 10)}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                  <span>Thể nhẹ cân: {smData.kpis.underweightRate}% • Thấp còi: {smData.kpis.stuntedRate}%</span>
                </p>
              </div>

              {/* KPI 3: Tỷ lệ thừa cân / béo phì */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thừa cân / Béo phì</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700">
                    Mục tiêu &lt; 5%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">{smData.kpis.overweightObeseRate}%</span>
                  <span className="text-xs text-slate-500 font-medium">({smData.kpis.overweightObeseCount} trẻ)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, smData.kpis.overweightObeseRate * 10)}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-indigo-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Dưới ngưỡng cảnh báo thừa cân học đường</span>
                </p>
              </div>

              {/* KPI 4: Tỷ lệ tuân thủ thực đơn */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tuân thủ Thực Đơn</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-800">
                    TT 28/2016
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-teal-700">{smData.kpis.menuComplianceRate}%</span>
                  <span className="text-xs text-slate-500 font-medium">Đạt chuẩn Bộ</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${smData.kpis.menuComplianceRate}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-teal-700 font-medium truncate">
                  {smData.kpis.menuComplianceStatus}
                </p>
              </div>
            </div>
          </div>

          {/* Grade Breakdown & Historical Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Phân bổ theo 4 Khối lớp */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Tổng Hợp Thể Trạng Theo Khối Lớp</h3>
                  <p className="text-xs text-slate-500">So sánh tỷ lệ phát triển thể lực giữa các khối</p>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  Năm học 2026-2027
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Khối Lớp</th>
                      <th className="py-3 px-3 text-center">Tổng Trẻ</th>
                      <th className="py-3 px-3 text-center">Đã Khảo Sát</th>
                      <th className="py-3 px-3 text-center text-emerald-700">Bình Thường (%)</th>
                      <th className="py-3 px-3 text-center text-amber-700">SDD Nhẹ Cân (%)</th>
                      <th className="py-3 px-3 text-center text-rose-700">Thấp Còi (%)</th>
                      <th className="py-3 px-3 text-center text-indigo-700">Thừa Cân/Béo Phì (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {smData.gradeBreakdown.map((grade) => (
                      <tr key={grade.gradeCode} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-3 font-bold text-slate-900">{grade.gradeName}</td>
                        <td className="py-3.5 px-3 text-center">{grade.totalStudents}</td>
                        <td className="py-3.5 px-3 text-center font-semibold">{grade.evaluatedStudents}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-emerald-600">
                          {grade.normalRate}%
                        </td>
                        <td className="py-3.5 px-3 text-center text-amber-600">
                          {grade.underweightRate}% <span className="text-[10px] text-slate-400">({grade.underweightCount})</span>
                        </td>
                        <td className="py-3.5 px-3 text-center text-rose-600">
                          {grade.stuntedRate}% <span className="text-[10px] text-slate-400">({grade.stuntedCount})</span>
                        </td>
                        <td className="py-3.5 px-3 text-center text-indigo-600">
                          {grade.overweightObeseRate}% <span className="text-[10px] text-slate-400">({grade.overweightObeseCount})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tiến độ & Xu hướng cải thiện dinh dưỡng */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Tiến Trình Cải Thiện Thể Lực</h3>
                <p className="text-xs text-slate-500">Xu hướng tỷ lệ bình thường qua 4 tháng học</p>
                <div className="mt-5 space-y-3.5">
                  {smData.historicalTrends.map((t, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600">{t.period}</span>
                        <span className="text-emerald-600 font-bold">{t.normalRate}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${t.normalRate}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 mt-4">
                <strong>Đánh giá điều hành:</strong> Tỷ lệ phát triển bình thường tăng đều từ 88.5% lên 93.1%, các thể suy dinh dưỡng giảm sâu dưới 3%.
              </div>
            </div>
          </div>

          {/* Hộp hành động tiếp theo của School Manager */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span>Hành Động Nghiệp Vụ Điều Hành Tiếp Theo</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-emerald-900">
                    Phê duyệt ngân sách bổ sung vi chất cho Khối Nhà trẻ
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Cấp kinh phí mua sữa cao năng lượng & vi chất canxi/D3 cho trẻ nhóm nhà trẻ.
                  </p>
                </div>
                <button
                  onClick={() => setIsBudgetModalOpen(true)}
                  className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs"
                >
                  Phê Duyệt Ngân Sách Ngay
                </button>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-indigo-900">
                    Họp chỉ đạo bếp và giáo viên về kế hoạch chăm sóc
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Rà soát quy chuẩn chia suất ăn, định lượng thực phẩm và hỗ trợ các bé ăn chậm.
                  </p>
                </div>
                <button
                  onClick={() => showToast('Đã gửi thông báo triệu tập họp chỉ đạo tới Bếp và GVCN!')}
                  className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition shadow-xs"
                >
                  Gửi Lịch Họp Chỉ Đạo
                </button>
              </div>

              <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 space-y-2 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-teal-900">
                    Xuất báo cáo sơ kết dinh dưỡng gửi Phòng Giáo dục
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Tải về biểu mẫu tổng hợp thể lực WHO & chất lượng bữa ăn bán trú.
                  </p>
                </div>
                <button
                  onClick={handleExportReport}
                  className="mt-3 w-full py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg transition shadow-xs"
                >
                  Tải Xuống Báo Cáo (.json/.xlsx)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: NUTRITIONIST (CHUYÊN VIÊN DINH DƯỠNG) – CAN THIỆP LÂM SÀNG          */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeRoleView === 'NUTRITIONIST' && nutData && (
        <div className="space-y-8 animate-fadeIn">
          {/* Thông tư 28 Nutritional Compliance Engine Panel */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h2 className="text-lg font-bold text-slate-800">
                    Bảo Đảm Dinh Dưỡng Bữa Ăn Bán Trú (Thông Tư 28/2016/TT-BGDĐT)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đánh giá năng lượng Calo, tỷ lệ sinh năng lượng P : L : G và đạm động vật trên thực đơn tuần
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ĐẠT CHUẨN THÔNG TƯ 28
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Calorie Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Năng Lượng TB / Ngày</span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Tối ưu
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {nutData.clinicalNutrition.dailyAvgCalories}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">Kcal / ngày</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Chuẩn quy định: <strong>{nutData.clinicalNutrition.targetCaloriesRange}</strong> ({nutData.clinicalNutrition.dailyCaloriesTargetPct})
                </p>
              </div>

              {/* P:L:G Ratio Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <span>Tỷ Lệ P : L : G (Đạm : Béo : Tinh bột)</span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Cân đối
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  <span className="text-emerald-700">{nutData.clinicalNutrition.plgRatio.proteinPct}%</span> :{' '}
                  <span className="text-amber-700">{nutData.clinicalNutrition.plgRatio.fatPct}%</span> :{' '}
                  <span className="text-sky-700">{nutData.clinicalNutrition.plgRatio.carbPct}%</span>
                </div>
                {/* 3-color Progress Bar */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-600 h-full"
                    style={{ width: `${nutData.clinicalNutrition.plgRatio.proteinPct}%` }}
                    title="Protein (Đạm)"
                  ></div>
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${nutData.clinicalNutrition.plgRatio.fatPct}%` }}
                    title="Lipid (Chất béo)"
                  ></div>
                  <div
                    className="bg-sky-500 h-full"
                    style={{ width: `${nutData.clinicalNutrition.plgRatio.carbPct}%` }}
                    title="Glucid (Bột đường)"
                  ></div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Chuẩn TT 28: <strong>{nutData.clinicalNutrition.plgRatio.standardRatio}</strong> ({nutData.clinicalNutrition.plgRatio.standardRange})
                </p>
              </div>

              {/* Animal Protein Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-rose-500" />
                    <span>Tỷ Lệ Đạm Động Vật</span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Đạt &gt; 50%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-700">
                    {nutData.clinicalNutrition.animalProtein.pct}%
                  </span>
                  <span className="text-xs text-slate-500 font-bold">/ tổng protein</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all"
                    style={{ width: `${nutData.clinicalNutrition.animalProtein.pct}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {nutData.clinicalNutrition.animalProtein.standardDescription}
                </p>
              </div>
            </div>

            {/* Micronutrients Progress Trackers */}
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Định Lượng Vi Chất Dinh Dưỡng Trọng Yếu
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {nutData.clinicalNutrition.micronutrients.map((micro) => (
                  <div key={micro.name} className="p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-1">
                    <span className="text-xs font-bold text-slate-800 block truncate">{micro.name}</span>
                    <div className="text-base font-black text-emerald-700">
                      {micro.actual} <span className="text-[11px] font-normal text-slate-500">{micro.unit}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">Chuẩn: {micro.standard}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* At-Risk Children Table (|Z| > 2 SD) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Danh Sách Trẻ Lệch Chuẩn Z-Score Cần Can Thiệp Lâm Sàng (|Z| &gt; 2 SD)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Bao gồm trẻ suy dinh dưỡng nhẹ cân, thấp còi, gầy còm và thừa cân/béo phì
                </p>
              </div>

              {/* Class Filter Dropdown */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-emerald-500"
                >
                  <option value="">Tất cả các lớp</option>
                  {nutData.classBreakdown.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.className} ({c.atRiskCount} trẻ nguy cơ)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {nutData.atRiskStudents.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-medium text-sm">
                Không phát hiện học sinh nào lệch chuẩn Z-Score trong danh sách đã chọn.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Học Sinh</th>
                      <th className="py-3 px-2">Lớp</th>
                      <th className="py-3 px-2 text-center">Thể Trọng</th>
                      <th className="py-3 px-2 text-center">Z-Score (WAZ/HAZ/BAZ)</th>
                      <th className="py-3 px-3">Chẩn Đoán Lâm Sàng</th>
                      <th className="py-3 px-3">Khuyến Nghị Can Thiệp</th>
                      <th className="py-3 px-3 text-right">Hành Động Chuyên Môn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {nutData.atRiskStudents.map((child) => (
                      <tr key={child.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <div>{child.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {child.studentCode} • {child.ageInMonths} tháng tuổi
                          </div>
                        </td>
                        <td className="py-3 px-2 font-semibold text-slate-700">{child.className}</td>
                        <td className="py-3 px-2 text-center">
                          <div>{child.weightKg} kg / {child.heightCm} cm</div>
                          <div className="text-[10px] text-slate-400">BMI: {child.bmi}</div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="font-mono text-[11px] font-bold">
                            <span className={child.waz < -2 ? 'text-amber-600' : 'text-slate-600'}>
                              W:{child.waz}
                            </span>{' '}
                            |{' '}
                            <span className={child.haz < -2 ? 'text-rose-600' : 'text-slate-600'}>
                              H:{child.haz}
                            </span>{' '}
                            |{' '}
                            <span className={child.baz > 2 || child.baz < -2 ? 'text-indigo-600' : 'text-slate-600'}>
                              B:{child.baz}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              child.classification.includes('OBESE') || child.classification.includes('OVERWEIGHT')
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {child.diagnosis}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs text-[11px]">
                          {child.recommendedAction}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenDietModal(child)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] transition shadow-2xs"
                            title="Lên Thực Đơn Can Thiệp Riêng"
                          >
                            Thực Đơn Can Thiệp
                          </button>
                          <button
                            onClick={() => handleOpenConsultModal(child)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-bold text-[11px] transition"
                            title="Hẹn Tư Vấn Phụ Huynh Qua App"
                          >
                            Hẹn Phụ Huynh
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Class Breakdown Details */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              Chi Tiết Dinh Dưỡng &amp; Tuân Thủ Từng Lớp Học
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nutData.classBreakdown.map((c) => (
                <div key={c.classId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{c.className}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {c.ageGroup === 'NHA_TRE' ? 'Nhà trẻ' : 'Mẫu giáo'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex justify-between">
                    <span>Sĩ số: <strong>{c.totalStudents}</strong></span>
                    <span>Đã đo: <strong>{c.evaluatedCount}</strong></span>
                    <span>
                      Nguy cơ:{' '}
                      <strong className={c.atRiskCount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {c.atRiskCount}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Mức tuân thủ thực đơn:</span>
                    <span className="font-bold text-emerald-700">{c.complianceRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Phê Duyệt Ngân Sách Vi Chất (School Manager)                       */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Phê Duyệt Ngân Sách Bổ Sung Vi Chất (School Manager)
              </h3>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Khối Lớp Hưởng Ngân Sách</label>
                <select
                  value={budgetForm.gradeCode}
                  onChange={(e) => setBudgetForm({ ...budgetForm, gradeCode: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                >
                  <option value="NHA_TRE">Khối Nhà Trẻ (12-36 tháng)</option>
                  <option value="MAM">Khối Mầm (3-4 tuổi)</option>
                  <option value="CHOI">Khối Chồi (4-5 tuổi)</option>
                  <option value="LA">Khối Lá (5-6 tuổi)</option>
                  <option value="TOAN_TRUONG">Toàn trường</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Số Tiền Ngân Sách (VND)</label>
                <input
                  type="number"
                  value={budgetForm.amountVnd}
                  onChange={(e) => setBudgetForm({ ...budgetForm, amountVnd: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium text-emerald-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi Chú Phê Duyệt</label>
                <textarea
                  rows={3}
                  value={budgetForm.notes}
                  onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-xs text-slate-600 hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleApproveBudget}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Xác Nhận Ký Duyệt Ngân Sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: Thực Đơn Can Thiệp Lâm Sàng (Nutritionist)                         */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {isDietModalOpen && selectedAtRiskChild && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Lập Thực Đơn Can Thiệp Cho {selectedAtRiskChild.fullName}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Lớp: {selectedAtRiskChild.className} • Chẩn đoán: {selectedAtRiskChild.diagnosis}
                </span>
              </div>
              <button
                onClick={() => setIsDietModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Loại Thực Đơn Can Thiệp</label>
                <select
                  value={dietForm.dietType}
                  onChange={(e) => setDietForm({ ...dietForm, dietType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                >
                  <option value="HIGH_CALORIE_MICRONUTRIENT">Cao Năng Lượng & Bổ Sung Vi Chất (Cho trẻ SDD/Thấp còi)</option>
                  <option value="LOW_FAT_HIGH_FIBER">Giảm Béo & Tăng Xơ Tự Nhiên (Cho trẻ thừa cân/Béo phì)</option>
                  <option value="CUSTOM">Chế Độ Dinh Dưỡng Đặc Biệt Tùy Chỉnh</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Năng Lượng Mục Tiêu (Kcal / Ngày)</label>
                <input
                  type="number"
                  value={dietForm.targetCalories}
                  onChange={(e) => setDietForm({ ...dietForm, targetCalories: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chi Tiết Điều Chỉnh Khẩu Phần Bếp</label>
                <textarea
                  rows={3}
                  value={dietForm.adjustmentNotes}
                  onChange={(e) => setDietForm({ ...dietForm, adjustmentNotes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Vi Chất Bổ Sung Thêm</label>
                <input
                  type="text"
                  value={dietForm.extraSupplements}
                  onChange={(e) => setDietForm({ ...dietForm, extraSupplements: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsDietModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-xs text-slate-600 hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleSubmitPersonalizedDiet}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Lưu & Chuyển Xuống Bếp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: Đặt Lịch Hẹn Tư Vấn Phụ Huynh Qua App (Nutritionist)               */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {isConsultModalOpen && selectedAtRiskChild && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Hẹn Lịch Tư Vấn Dinh Dưỡng Với Phụ Huynh
                </h3>
                <span className="text-[11px] text-slate-500">
                  Học sinh: {selectedAtRiskChild.fullName} • Lớp: {selectedAtRiskChild.className}
                </span>
              </div>
              <button
                onClick={() => setIsConsultModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Thời Gian Tư Vấn Dự Kiến</label>
                <input
                  type="datetime-local"
                  value={consultForm.scheduledDate}
                  onChange={(e) => setConsultForm({ ...consultForm, scheduledDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chủ Đề Buổi Tư Vấn</label>
                <input
                  type="text"
                  value={consultForm.consultationTopic}
                  onChange={(e) => setConsultForm({ ...consultForm, consultationTopic: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi Chú Cho Phụ Huynh</label>
                <textarea
                  rows={3}
                  value={consultForm.notes}
                  onChange={(e) => setConsultForm({ ...consultForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsConsultModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-xs text-slate-600 hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleSubmitConsultation}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Gửi Lời Mời Tới App Phụ Huynh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

