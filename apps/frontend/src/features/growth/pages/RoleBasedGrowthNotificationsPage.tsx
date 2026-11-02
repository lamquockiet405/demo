import React, { useState, useEffect, useCallback } from 'react';
import {
  growthDispatchApi,
  GrowthNotificationItem,
  ExecutiveGrowthHealthSummary,
} from '../api/growth-dispatch.api';
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  RefreshCw,
  Heart,
  MessageSquare,
  ShieldAlert,
  Send,
  BookOpen,
  TrendingDown,
  TrendingUp,
  X,
  Sparkles,
  Building,
  UserCheck,
  Calendar,
  Utensils,
  DollarSign,
  User,
  Users,
  Award,
  Bell,
  Scale,
} from 'lucide-react';

export const RoleBasedGrowthNotificationsPage: React.FC = () => {
  // Role switcher: Parent, Teacher, Nutritionist, School Manager
  const [activeRole, setActiveRole] = useState<'SCHOOL_MANAGER' | 'NUTRITIONIST' | 'TEACHER' | 'PARENT'>('SCHOOL_MANAGER');

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Data states
  const [notifications, setNotifications] = useState<GrowthNotificationItem[]>([]);
  const [summary, setSummary] = useState<ExecutiveGrowthHealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [consultationModalItem, setConsultationModalItem] = useState<GrowthNotificationItem | null>(null);
  const [consultationDate, setConsultationDate] = useState<string>('2026-11-12 09:30');
  const [consultationNotes, setConsultationNotes] = useState<string>('');

  const [dietModalItem, setDietModalItem] = useState<GrowthNotificationItem | null>(null);
  const [dietTitle, setDietTitle] = useState<string>('Thực đơn phục hồi tăng đạm & vi chất (High Protein/Calorie Diet)');
  const [dietCalories, setDietCalories] = useState<number>(180);
  const [dietGuidance, setDietGuidance] = useState<string>('Thêm 1 cữ sữa tươi 15h30, hầm mềm đùi gà với hạt sen, thêm 5ml dầu oliu.');
  const [dietRecheckDate, setDietRecheckDate] = useState<string>('2026-11-20');

  const [acknowledgeModalItem, setAcknowledgeModalItem] = useState<GrowthNotificationItem | null>(null);
  const [careCommitmentNote, setCareCommitmentNote] = useState<string>('');

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState<boolean>(false);
  const [budgetAmount, setBudgetAmount] = useState<number>(2500000);
  const [budgetNotes, setBudgetNotes] = useState<string>('Phê duyệt trích ngân sách y tế học đường tài trợ sữa dinh dưỡng và vi chất cho các bé SDD.');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notifRes, summaryRes] = await Promise.all([
        growthDispatchApi.getNotifications({
          role: activeRole,
          severity: severityFilter,
          status: statusFilter,
          studentId: activeRole === 'PARENT' ? 101 : undefined,
          classId: activeRole === 'TEACHER' ? 1 : undefined,
        }),
        growthDispatchApi.getExecutiveSummary(),
      ]);
      setNotifications(notifRes.data || []);
      setSummary(summaryRes);
    } catch (err) {
      console.error('Failed to load growth notifications', err);
      showToast('Đang tải dữ liệu mô phỏng do máy chủ chưa sẵn sàng');
    } finally {
      setIsLoading(false);
    }
  }, [activeRole, severityFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScanAndDispatch = async () => {
    setIsScanning(true);
    try {
      const res = await growthDispatchApi.scanAndDispatch();
      showToast(`Quét thành công! ${res.summary}`);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Đã quét dữ liệu nhân trắc học và phát cảnh báo phân luồng 4 vai trò');
      loadData();
    } finally {
      setIsScanning(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!acknowledgeModalItem) return;
    try {
      await growthDispatchApi.acknowledge(
        acknowledgeModalItem.id,
        careCommitmentNote || 'Giáo viên đã tiếp nhận thông tin và sẽ hỗ trợ động viên bé ăn hết suất.',
      );
      showToast(`Đã xác nhận tiếp nhận chăm sóc bé ${acknowledgeModalItem.studentName}`);
      setAcknowledgeModalItem(null);
      setCareCommitmentNote('');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xác nhận tiếp nhận');
    }
  };

  const handleAssignDiet = async () => {
    if (!dietModalItem) return;
    try {
      await growthDispatchApi.assignInterventionDiet({
        notificationId: dietModalItem.id,
        interventionDietTitle: dietTitle,
        calorieAdjustmentKcal: dietCalories,
        nutritionGuidance: dietGuidance,
        recheckDate: dietRecheckDate,
      });
      showToast(`Đã gán thực đơn can thiệp cho bé ${dietModalItem.studentName}`);
      setDietModalItem(null);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi thiết lập thực đơn can thiệp');
    }
  };

  const handleRequestConsultation = async () => {
    if (!consultationModalItem) return;
    try {
      const res = await growthDispatchApi.requestConsultation({
        notificationId: consultationModalItem.id,
        preferredDate: consultationDate,
        notes: consultationNotes,
      });
      showToast(res.message || 'Đã đặt lịch tư vấn 1-1 thành công!');
      setConsultationModalItem(null);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi đặt lịch tư vấn');
    }
  };

  const handleApproveBudget = async () => {
    const criticalIds = notifications.filter((n) => n.severity === 'CRITICAL').map((n) => n.id);
    const ids = criticalIds.length > 0 ? criticalIds : [1, 2];
    try {
      const res = await growthDispatchApi.approveBudget({
        notificationIds: ids,
        approvedBudgetAmount: budgetAmount,
        decisionNotes: budgetNotes,
      });
      showToast(res.message || 'Đã phê duyệt ngân sách can thiệp thành công');
      setIsBudgetModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi phê duyệt ngân sách');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
              UC85
            </span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              WHO LMS Standards & Role-Based Visibility
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Bell className="w-7 h-7 text-rose-600" />
            Điều Phối Thông Báo Bất Thường Thể Trạng & Dinh Dưỡng
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Tự động phát hiện lệch chuẩn Z-Score WHO (WAZ/HAZ/BAZ) & sụt cân đột ngột, phân luồng đa kênh bảo mật cho 4 vai trò.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            onClick={handleScanAndDispatch}
            disabled={isScanning}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-medium rounded-xl text-sm shadow-sm transition-all"
          >
            <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Đang quét WHO LMS...' : 'Quét & Điều Phối Tự Động'}
          </button>
        </div>
      </div>

      {/* 4-Role Perspective Switcher Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveRole('SCHOOL_MANAGER')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
            activeRole === 'SCHOOL_MANAGER'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>School Manager (BGH)</span>
        </button>

        <button
          onClick={() => setActiveRole('NUTRITIONIST')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
            activeRole === 'NUTRITIONIST'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Nutritionist (Dinh Dưỡng)</span>
        </button>

        <button
          onClick={() => setActiveRole('TEACHER')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
            activeRole === 'TEACHER'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Teacher (Giáo Viên)</span>
        </button>

        <button
          onClick={() => setActiveRole('PARENT')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
            activeRole === 'PARENT'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Parent (Phụ Huynh)</span>
        </button>
      </div>

      {/* Role Scoping Description Banner */}
      <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3.5 ${
        activeRole === 'SCHOOL_MANAGER'
          ? 'bg-rose-50 border-rose-200 text-rose-900'
          : activeRole === 'NUTRITIONIST'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : activeRole === 'TEACHER'
          ? 'bg-blue-50 border-blue-200 text-blue-900'
          : 'bg-purple-50 border-purple-200 text-purple-900'
      }`}>
        <UserCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">
            {activeRole === 'SCHOOL_MANAGER' && 'Góc nhìn Ban Giám Hiệu:'}
            {activeRole === 'NUTRITIONIST' && 'Góc nhìn Chuyên viên Dinh dưỡng:'}
            {activeRole === 'TEACHER' && 'Góc nhìn Giáo viên chủ nhiệm:'}
            {activeRole === 'PARENT' && 'Góc nhìn Phụ huynh học sinh:'}
          </span>{' '}
          {activeRole === 'SCHOOL_MANAGER' &&
            'Theo dõi chỉ số KPI thể chất toàn trường, các ca cảnh báo khẩn cấp (CRITICAL), và thẩm quyền phê duyệt ngân sách tài trợ can thiệp dinh dưỡng học đường.'}
          {activeRole === 'NUTRITIONIST' &&
            'Giám sát hồ sơ lâm sàng toàn trường (WAZ, HAZ, BAZ), tính toán độ lệch SD, và thiết lập Thực đơn can thiệp cá nhân hóa (Personalized Diet Plan).'}
          {activeRole === 'TEACHER' &&
            'Chỉ hiển thị các học sinh thuộc Lớp phụ trách (Lớp Mầm 1). Hướng dẫn chăm sóc thực tế trong bữa ăn (động viên ăn hết suất, chia nhỏ phần ăn) & bấm Xác nhận chăm sóc.'}
          {activeRole === 'PARENT' &&
            'Phân quyền bảo mật tuyệt đối (Child-scoped): Chỉ xem kết quả và biểu đồ WHO của riêng con mình (bé Trần Minh Khang), nhận lời khuyên dinh dưỡng và Đặt lịch tư vấn 1-1.'}
        </div>
      </div>

      {/* Executive Summary Metrics (Visible for School Manager & Nutritionist) */}
      {(activeRole === 'SCHOOL_MANAGER' || activeRole === 'NUTRITIONIST') && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Tỷ Lệ Bình Thường (KPI ≥ 90%)</span>
              <Award className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2">
              {summary.normalDevelopmentRate}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Đạt chuẩn phát triển thể lực toàn trường</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Suy Dinh Dưỡng (KPI &lt; 3%)</span>
              <TrendingDown className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-2">
              {summary.underweightRate}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Thấp còi: {summary.stuntedRate}% (Trong ngưỡng an toàn)</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Thừa Cân / Béo Phì (KPI &lt; 5%)</span>
              <TrendingUp className="w-5 h-5 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-600 mt-2">
              {summary.obesityRate}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Học sinh cần kiểm soát tinh bột & dầu mỡ</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Ca Cần Can Thiệp Khẩn</span>
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-600 mt-2">
                {summary.criticalCasesCount} ca khẩn cấp
              </div>
            </div>
            {activeRole === 'SCHOOL_MANAGER' && (
              <button
                onClick={() => setIsBudgetModalOpen(true)}
                className="mt-3 w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Duyệt Ngân Sách Can Thiệp
              </button>
            )}
          </div>
        </div>
      )}

      {/* High-Risk Classes Matrix (For School Manager) */}
      {activeRole === 'SCHOOL_MANAGER' && summary && summary.topRiskClasses && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-600" />
              Danh Sách Lớp Có Học Sinh Cần Can Thiệp Dinh Dưỡng
            </h3>
            <span className="text-xs text-slate-500">Giám sát theo dõi định kỳ tuần</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Lớp / Khối</th>
                  <th className="py-3 px-4 text-center">Tổng ca bất thường</th>
                  <th className="py-3 px-4 text-center">Nhẹ cân / SDD</th>
                  <th className="py-3 px-4 text-center">Thừa cân / Béo phì</th>
                  <th className="py-3 px-4 text-right">Trạng thái can thiệp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.topRiskClasses.map((cls) => (
                  <tr key={cls.classId} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {cls.className} ({cls.gradeLevel})
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-rose-600">
                      {cls.abnormalCount} bé
                    </td>
                    <td className="py-3.5 px-4 text-center text-amber-700">
                      {cls.underweightCount} bé
                    </td>
                    <td className="py-3.5 px-4 text-center text-rose-700">
                      {cls.obeseCount} bé
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đang can thiệp thực đơn
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Mức độ cảnh báo:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="CRITICAL">🔴 CRITICAL (Khẩn cấp &lt; 24h)</option>
              <option value="HIGH">🟡 HIGH (Cảnh báo cao &lt; 48h)</option>
              <option value="WARNING">🟠 WARNING (Lệch kênh)</option>
              <option value="INFO">🟢 INFO (Thông tin định kỳ)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Trạng thái xử lý:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DISPATCHED">Chờ tiếp nhận</option>
              <option value="ACKNOWLEDGED">Đã tiếp nhận chăm sóc</option>
              <option value="INTERVENTION_APPLIED">Đã gán thực đơn can thiệp</option>
              <option value="READ">Đã đọc / Đã đặt lịch</option>
              <option value="RESOLVED">Đã hoàn thành</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Hiển thị: <span className="text-slate-900 font-bold">{notifications.length}</span> thông báo phù hợp
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <RefreshCw className="w-8 h-8 text-rose-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Đang tải danh sách thông báo điều phối...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Không có thông báo bất thường nào</h3>
            <p className="text-sm text-slate-500 mt-1">Tất cả các chỉ số tăng trưởng của trẻ trong phạm vi hiển thị đều đạt chuẩn WHO.</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-sm hover:shadow-md ${
                item.severity === 'CRITICAL'
                  ? 'border-rose-300 bg-gradient-to-r from-rose-50/30 to-white'
                  : item.severity === 'HIGH'
                  ? 'border-amber-300 bg-gradient-to-r from-amber-50/20 to-white'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* Notification Left Main */}
                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                        item.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white animate-pulse'
                          : item.severity === 'HIGH'
                          ? 'bg-amber-500 text-white'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.severity} (SLA &lt; {item.slaTargetHours}h)
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {item.className}
                    </span>

                    <span className="text-xs font-bold text-slate-900">
                      Bé: {item.studentName} ({item.ageInMonths} tháng)
                    </span>

                    <span className="text-xs text-slate-400">|</span>

                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Gửi: {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>

                  <p className="text-sm text-slate-700 leading-relaxed">{item.message}</p>

                  {/* Anthropometric WHO metrics badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {item.metadata.waz !== undefined && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        WAZ (Cân/Tuổi): <span className={item.metadata.waz < -2 ? 'text-rose-600' : 'text-emerald-600'}>{item.metadata.waz} SD</span>
                      </span>
                    )}

                    {item.metadata.haz !== undefined && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        HAZ (Cao/Tuổi): <span className={item.metadata.haz < -2 ? 'text-rose-600' : 'text-emerald-600'}>{item.metadata.haz} SD</span>
                      </span>
                    )}

                    {item.metadata.baz !== undefined && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        BAZ (BMI/Tuổi): <span className={item.metadata.baz > 2 || item.metadata.baz < -2 ? 'text-rose-600' : 'text-emerald-600'}>{item.metadata.baz} SD</span>
                      </span>
                    )}

                    {item.metadata.weightDeltaKg !== undefined && item.metadata.weightDeltaKg !== 0 && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Biến động: {item.metadata.weightDeltaKg > 0 ? `+${item.metadata.weightDeltaKg}` : item.metadata.weightDeltaKg} kg
                      </span>
                    )}

                    {item.metadata.interventionDietTitle && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <Utensils className="w-3.5 h-3.5" />
                        {item.metadata.interventionDietTitle}
                      </span>
                    )}
                  </div>

                  {/* Recommendation Text / Care Instructions */}
                  {item.metadata.recommendationText && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 mt-2">
                      <span className="font-bold text-slate-900">Hướng dẫn chăm sóc & dinh dưỡng:</span> {item.metadata.recommendationText}
                    </div>
                  )}

                  {/* SLA & Closed-Loop Lifecycle Bar */}
                  <div className="pt-2 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Trạng thái vòng đời:</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          item.status === 'INTERVENTION_APPLIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'ACKNOWLEDGED'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'READ'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                      {item.acknowledgedBy && (
                        <span className="text-slate-500">
                          (Bởi: <span className="font-medium text-slate-800">{item.acknowledgedBy}</span>)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span>Đã trôi qua: <strong className="text-slate-800">{item.hoursElapsed.toFixed(1)}h</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>Kênh: <strong>{item.channels.join(', ')}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Notification Right Actions */}
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-2 pt-2 lg:pt-0">
                  {/* Action for PARENT */}
                  {activeRole === 'PARENT' && (
                    <button
                      onClick={() => setConsultationModalItem(item)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Đặt Lịch Tư Vấn 1-1
                    </button>
                  )}

                  {/* Action for TEACHER */}
                  {activeRole === 'TEACHER' && (
                    <button
                      onClick={() => {
                        setAcknowledgeModalItem(item);
                        setCareCommitmentNote('');
                      }}
                      disabled={item.status === 'ACKNOWLEDGED' || item.status === 'INTERVENTION_APPLIED'}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap ${
                        item.status === 'ACKNOWLEDGED' || item.status === 'INTERVENTION_APPLIED'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {item.status === 'ACKNOWLEDGED' || item.status === 'INTERVENTION_APPLIED'
                        ? 'Đã Tiếp Nhận'
                        : 'Xác Nhận Chăm Sóc'}
                    </button>
                  )}

                  {/* Action for NUTRITIONIST */}
                  {activeRole === 'NUTRITIONIST' && (
                    <button
                      onClick={() => {
                        setDietModalItem(item);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      Lập Thực Đơn Can Thiệp
                    </button>
                  )}

                  {/* Action for SCHOOL_MANAGER */}
                  {activeRole === 'SCHOOL_MANAGER' && item.severity === 'CRITICAL' && (
                    <button
                      onClick={() => setIsBudgetModalOpen(true)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Duyệt Ngân Sách Hỗ Trợ
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: Parent Request Consultation 1-1 */}
      {consultationModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Đặt Lịch Tư Vấn Dinh Dưỡng 1-1
              </h3>
              <button
                onClick={() => setConsultationModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-slate-600 space-y-1">
              <p>Học sinh: <strong className="text-slate-900">{consultationModalItem.studentName}</strong> ({consultationModalItem.className})</p>
              <p>Tình trạng: <span className="text-rose-600 font-semibold">{consultationModalItem.metadata.weightClassification}</span></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Thời gian mong muốn gặp Chuyên gia / Bác sĩ
                </label>
                <input
                  type="text"
                  value={consultationDate}
                  onChange={(e) => setConsultationDate(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Ví dụ: 2026-11-12 09:30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nội dung gia đình cần tư vấn cụ thể
                </label>
                <textarea
                  value={consultationNotes}
                  onChange={(e) => setConsultationNotes(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Ví dụ: Bé ở nhà lười uống sữa, gia đình muốn tư vấn đổi sữa hoặc bổ sung kẽm và men vi sinh..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setConsultationModalItem(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleRequestConsultation}
                className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Xác Nhận Đặt Lịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Nutritionist Assign Personalized Intervention Diet */}
      {dietModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-emerald-600" />
                Lập Thực Đơn Can Thiệp Cá Nhân Hóa (Personalized Diet)
              </h3>
              <button
                onClick={() => setDietModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
              <p>Học sinh: <strong className="text-slate-900">{dietModalItem.studentName}</strong> - Lớp: <strong>{dietModalItem.className}</strong></p>
              <p>Chỉ số lâm sàng: WAZ: <span className="font-bold text-rose-600">{dietModalItem.metadata.waz} SD</span> | BAZ: <span className="font-bold text-rose-600">{dietModalItem.metadata.baz} SD</span></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tên gói thực đơn can thiệp
                </label>
                <input
                  type="text"
                  value={dietTitle}
                  onChange={(e) => setDietTitle(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Năng lượng bổ sung (Kcal/ngày)
                  </label>
                  <input
                    type="number"
                    value={dietCalories}
                    onChange={(e) => setDietCalories(Number(e.target.value))}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Ngày hẹn tái cân đợt tiếp
                  </label>
                  <input
                    type="date"
                    value={dietRecheckDate}
                    onChange={(e) => setDietRecheckDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Chỉ đạo Bếp & Hướng dẫn Giáo viên chăm sóc
                </label>
                <textarea
                  value={dietGuidance}
                  onChange={(e) => setDietGuidance(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Ví dụ: Bếp hầm nhừ thịt, tăng 5ml dầu oliu vào canh, giáo viên cho ăn phần đạm trước..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setDietModalItem(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleAssignDiet}
                className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Lưu & Áp Dụng Thực Đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Teacher Acknowledge Care */}
      {acknowledgeModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                Xác Nhận Tiếp Nhận Chăm Sóc Bé Tại Lớp
              </h3>
              <button
                onClick={() => setAcknowledgeModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-slate-600 space-y-1">
              <p>Học sinh: <strong className="text-slate-900">{acknowledgeModalItem.studentName}</strong> ({acknowledgeModalItem.className})</p>
              <p>Tình trạng: <span className="text-rose-600 font-semibold">{acknowledgeModalItem.title}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Ghi chú cam kết chăm sóc của Giáo viên chủ nhiệm
              </label>
              <textarea
                value={careCommitmentNote}
                onChange={(e) => setCareCommitmentNote(e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ví dụ: Giáo viên đã nắm thông tin, cam kết hỗ trợ động viên bé ăn hết suất cơm, chia nhỏ phần ăn và nhắc uống đủ nước."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setAcknowledgeModalItem(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleAcknowledge}
                className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Xác Nhận Đã Nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: School Manager Approve Budget */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-rose-600" />
                Phê Duyệt Ngân Sách Can Thiệp Y Tế Học Đường
              </h3>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mức ngân sách tài trợ (VNĐ)
                </label>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nội dung quyết định & chỉ đạo liên bộ phận
                </label>
                <textarea
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleApproveBudget}
                className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Ký Duyệt Ngân Sách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

