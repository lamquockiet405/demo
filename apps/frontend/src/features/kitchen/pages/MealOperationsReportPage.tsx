import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Thermometer,
  Users,
  UtensilsCrossed,
  FileText,
  Layers,
  ChefHat,
  Calendar,
  BadgePercent,
  RefreshCw,
  Check,
  ChevronRight,
  DollarSign,
  Printer,
  Sparkles,
  HeartPulse,
  PenTool,
  Info,
} from 'lucide-react';
import {
  mealOperationsApi,
  MealOperationsReportData,
  ClassBreakdownItem,
  DishWasteItem,
} from '../api/meal-operations.api';

export const MealOperationsReportPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [report, setReport] = useState<MealOperationsReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'food_safety' | 'plate_waste'>(
    'reconciliation',
  );
  const [perspectiveRole, setPerspectiveRole] = useState<'SCHOOL_MANAGER' | 'KITCHEN_STAFF' | 'TEACHER'>(
    'SCHOOL_MANAGER',
  );

  // Modal / Feedback state
  const [signingStep, setSigningStep] = useState<string | null>(null);
  const [signRole, setSignRole] = useState<'KITCHEN_STAFF' | 'MEDICAL_STAFF' | 'SCHOOL_MANAGER'>('SCHOOL_MANAGER');
  const [signerName, setSignerName] = useState<string>('Phạm Thị Lan (Ban Giám Hiệu)');
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [signMessage, setSignMessage] = useState<string | null>(null);

  // Teacher feedback form state
  const [teacherClassId, setTeacherClassId] = useState<number>(1);
  const [teacherTemp, setTeacherTemp] = useState<string>('ẤM NÓNG');
  const [teacherTaste, setTeacherTaste] = useState<string>('Vừa miệng trẻ');
  const [teacherClean, setTeacherClean] = useState<string>('Rất sạch sẽ');
  const [teacherTrays, setTeacherTrays] = useState<number>(18);
  const [teacherWaste, setTeacherWaste] = useState<number>(5);
  const [teacherComment, setTeacherComment] = useState<string>('');
  const [isSubmittingTeacher, setIsSubmittingTeacher] = useState<boolean>(false);
  const [teacherSuccessMsg, setTeacherSuccessMsg] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await mealOperationsApi.getDailyReport(selectedDate);
      setReport(data);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo vận hành bữa ăn:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDate]);

  const handleSign = async (step: any) => {
    try {
      setIsSigning(true);
      const res = await mealOperationsApi.signInspection({
        date: selectedDate,
        step,
        role: signRole,
        signerName,
        notes: 'Nghiệm thu đạt chuẩn kỹ thuật ATTP theo QĐ 1246/QĐ-BYT',
      });
      setSignMessage(res.message);
      setSigningStep(null);
      await fetchReport();
      setTimeout(() => setSignMessage(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi khi ký duyệt');
    } finally {
      setIsSigning(false);
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingTeacher(true);
      const res = await mealOperationsApi.submitTeacherSensory({
        date: selectedDate,
        classId: teacherClassId,
        temperature: teacherTemp,
        taste: teacherTaste,
        cleanliness: teacherClean,
        trayCountReceived: teacherTrays,
        plateWastePercent: teacherWaste,
        comment: teacherComment,
      });
      setTeacherSuccessMsg(res.message);
      setTeacherComment('');
      await fetchReport();
      setTimeout(() => setTeacherSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi gửi phản hồi cảm quan');
    } finally {
      setIsSubmittingTeacher(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await mealOperationsApi.exportReport(selectedDate);
      window.print();
    } catch (err) {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> UC94 • Vận Hành Chu Trình Khép Kín
              </span>
              <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
                QĐ 1246/QĐ-BYT
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
              Báo Cáo Vận Hành Bữa Ăn & Bán Trú
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Khớp nối quân số thực tế, biên bản kiểm thực 3 bước & quản trị thất thoát thức ăn (Plate Waste).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
              <Calendar className="w-4 h-4 text-slate-500 ml-1.5" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 border-none focus:outline-none"
              />
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg shadow-xs hover:bg-slate-50"
              >
                Hôm nay
              </button>
            </div>

            <button
              onClick={fetchReport}
              title="Làm mới dữ liệu"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition"
            >
              <Printer className="w-4 h-4" /> Xuất Hồ Sơ Thanh Tra
            </button>
          </div>
        </div>

        {/* 3-Role Perspective Selector */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Góc nhìn theo Role:
            </span>
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-700/80 rounded-xl">
              <button
                onClick={() => setPerspectiveRole('SCHOOL_MANAGER')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  perspectiveRole === 'SCHOOL_MANAGER'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Ban Giám Hiệu
              </button>
              <button
                onClick={() => setPerspectiveRole('KITCHEN_STAFF')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  perspectiveRole === 'KITCHEN_STAFF'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Nhà Bếp / Bếp Trưởng
              </button>
              <button
                onClick={() => setPerspectiveRole('TEACHER')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  perspectiveRole === 'TEACHER'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Giáo Viên Lớp
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 italic">
            {perspectiveRole === 'SCHOOL_MANAGER' && '• Trọng tâm: Đối soát tài chính hoàn tiền & pháp lý kiểm thực đón thanh tra Y tế.'}
            {perspectiveRole === 'KITCHEN_STAFF' && '• Trọng tâm: Chốt số suất nấu lúc 08h30, nhiệt độ lưu mẫu 2-8°C & giảm tỷ lệ cơm canh thừa.'}
            {perspectiveRole === 'TEACHER' && '• Trọng tâm: Xác nhận khay ăn, lưu ý trẻ dị ứng & gửi nhận xét cảm quan bữa ăn của lớp.'}
          </div>
        </div>

        {/* Closed-Loop Daily Timeline */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
            <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 08h30 • Chốt Quân Số
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">
              GV điểm danh $\rightarrow$ Bếp nhận Official Headcount
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
            <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5" /> 09h00 • Kiểm Thực 1-2
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">
              Nhập nguyên liệu & Nhiệt độ sôi tâm &gt; 75°C
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
            <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 11h00 • Kiểm Thực 3 & Lưu Mẫu
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">
              Chia suất, hũ mẫu &gt; 100g, tủ mát 2 - 8°C
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
            <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <UtensilsCrossed className="w-3.5 h-3.5" /> 14h00 • Báo Cáo Plate Waste
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">
              Tổng hợp tỷ lệ ăn thừa & cảnh báo đổi vị món
            </div>
          </div>
        </div>
      </div>

      {signMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{signMessage}</span>
        </div>
      )}

      {teacherSuccessMsg && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{teacherSuccessMsg}</span>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'reconciliation'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Users className="w-4 h-4" />
          Khối 1: Cân Đối Suất Ăn & Tài Chính Hoàn Phí
        </button>

        <button
          onClick={() => setActiveTab('food_safety')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'food_safety'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Khối 2: Biên Bản Kiểm Thực 3 Bước & Tủ Lưu Mẫu 24h
        </button>

        <button
          onClick={() => setActiveTab('plate_waste')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'plate_waste'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          Khối 3: Báo Cáo Tiêu Thụ & Quản Trị Thức Ăn Thừa
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
          Đang tổng hợp dữ liệu vận hành từ hệ thống điểm danh và nhà bếp...
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-slate-500">Không có dữ liệu báo cáo cho ngày này.</div>
      ) : (
        <>
          {/* TAB 1: MEAL RECONCILIATION & FINANCE */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Tổng Sĩ Số Học Sinh</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {report.reconciliation.totalEnrolledStudents}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Toàn trường</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-xs">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Suất Ăn Trưa Thực Tế</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                    {report.reconciliation.actualLunchCount}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Đã chốt lúc 08h30</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-xs">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Suất Ăn Xế Chiều</div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                    {report.reconciliation.actualSnackCount}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Đăng ký & có mặt</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Nghỉ Có Phép (&lt;08h)</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {report.reconciliation.absentExcusedCount}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Đủ điều kiện hoàn phí</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-xs">
                  <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">Tổng Tiền Hoàn Phí</div>
                  <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                    {report.reconciliation.totalRefundAmountVnd.toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-xs text-slate-400 mt-1">35.000 đ/suất</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 shadow-xs">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Suất Ăn Kiêng / Dị Ứng</div>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                    {report.reconciliation.specialDietCount}
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Thực đơn thay thế an toàn</div>
                </div>
              </div>

              {/* Breakdown Table by Class */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Cân Đối Sĩ Số Suất Ăn Từng Lớp Học (Official Class Reconciliation)
                  </h3>
                  <span className="text-xs text-slate-500">Dữ liệu đồng bộ trực tiếp từ phòng học</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Lớp Học</th>
                        <th className="py-3 px-4">Khối</th>
                        <th className="py-3 px-4 text-center">Sĩ Số</th>
                        <th className="py-3 px-4 text-center">Ăn Trưa</th>
                        <th className="py-3 px-4 text-center">Ăn Xế</th>
                        <th className="py-3 px-4 text-center">Vắng Có Phép</th>
                        <th className="py-3 px-4 text-center">Ăn Kiêng / Dị Ứng</th>
                        <th className="py-3 px-4 text-right">Hoàn Tiền (đ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.reconciliation.classBreakdown.map((c) => (
                        <tr key={c.classId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                            {c.className}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                            {c.ageGroup}
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium text-slate-700 dark:text-slate-300">
                            {c.enrolled}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-blue-600 dark:text-blue-400">
                            {c.presentLunch}
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium text-amber-600 dark:text-amber-400">
                            {c.presentSnack}
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium text-emerald-600 dark:text-emerald-400">
                            {c.excusedAbsence > 0 ? `+${c.excusedAbsence}` : '0'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {c.specialDiet > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                {c.specialDiet} bé
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                            {(c.excusedAbsence * report.reconciliation.refundPerMealVnd).toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-700/40 font-bold border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td className="py-3 px-4" colSpan={2}>Tổng Cộng Toàn Trường</td>
                        <td className="py-3 px-4 text-center">{report.reconciliation.totalEnrolledStudents}</td>
                        <td className="py-3 px-4 text-center text-blue-600 dark:text-blue-400">{report.reconciliation.actualLunchCount}</td>
                        <td className="py-3 px-4 text-center text-amber-600 dark:text-amber-400">{report.reconciliation.actualSnackCount}</td>
                        <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400">{report.reconciliation.absentExcusedCount}</td>
                        <td className="py-3 px-4 text-center text-purple-600 dark:text-purple-400">{report.reconciliation.specialDietCount}</td>
                        <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                          {report.reconciliation.totalRefundAmountVnd.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Special Diet Separate Cooking List */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <UtensilsCrossed className="w-4 h-4 text-purple-600" />
                  Danh Sách Chế Biến Khẩu Phần Thay Thế Cho Trẻ Dị Ứng (Special Substitute Meals)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.reconciliation.classBreakdown.flatMap((c) =>
                    c.specialDietChildren.map((child) => (
                      <div
                        key={child.studentId}
                        className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 flex items-start justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {child.studentName} <span className="text-xs font-normal text-slate-500">({c.className})</span>
                          </div>
                          <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                            Dị ứng: {child.allergenName}
                          </div>
                          <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Món thay thế: {child.safeSubstitute}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-md bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 font-medium">
                          Nấu riêng
                        </span>
                      </div>
                    )),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 3-STEP FOOD INSPECTION & 24H SAMPLE RETENTION */}
          {activeTab === 'food_safety' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span className="font-semibold text-indigo-950 dark:text-indigo-200">
                    Tuân thủ tiêu chuẩn an toàn thực phẩm: {report.foodSafetyInspection.decisionStandard}
                  </span>
                </div>
                <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold">
                  ĐẠT CHUẨN 100%
                </span>
              </div>

              {/* 3 Step Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Step 1 */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-md">
                        Bước 1 • 06h30 - 07h30
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300">
                        {report.foodSafetyInspection.step1RawCheck.result}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-3 text-base">
                      Kiểm Tra Nguyên Liệu Nhập
                    </h4>
                    <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Nhà cung cấp:</span>{' '}
                        {report.foodSafetyInspection.step1RawCheck.supplierName}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Độ tươi sống:</span>{' '}
                        {report.foodSafetyInspection.step1RawCheck.freshness}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Bao bì niêm phong:</span>{' '}
                        {report.foodSafetyInspection.step1RawCheck.packagingIntegrity}
                      </div>
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                        <Thermometer className="w-3.5 h-3.5" />
                        Nhiệt độ thùng xe đông lạnh: {report.foodSafetyInspection.step1RawCheck.transportTempC}°C
                      </div>
                      <div className="text-slate-500 italic mt-1">
                        Ghi chú: {report.foodSafetyInspection.step1RawCheck.notes}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Người kiểm:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {report.foodSafetyInspection.step1RawCheck.inspectorName}
                    </span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded-md">
                        Bước 2 • 08h30 - 10h00
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300">
                        {report.foodSafetyInspection.step2ProcessingCheck.result}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-3 text-base">
                      Kiểm Tra Trong Chế Biến
                    </h4>
                    <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Vệ sinh trang thiết bị:</span>{' '}
                        {report.foodSafetyInspection.step2ProcessingCheck.equipmentHygiene}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Quy trình bếp 1 chiều:</span>{' '}
                        {report.foodSafetyInspection.step2ProcessingCheck.oneWayKitchenCompliance ? 'Đạt chuẩn tách biệt khu sống/chín' : 'Chưa đạt'}
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-emerald-600" />
                        Nhiệt độ tâm thực phẩm sôi: {report.foodSafetyInspection.step2ProcessingCheck.coreBoilingTempC}°C
                        <span className="text-xs font-normal">(&gt; 75°C chuẩn)</span>
                      </div>
                      <div className="text-slate-500 italic mt-1">
                        Ghi chú: {report.foodSafetyInspection.step2ProcessingCheck.notes}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Người kiểm:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {report.foodSafetyInspection.step2ProcessingCheck.inspectorName}
                    </span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-purple-600 bg-purple-100 dark:bg-purple-900/40 px-2.5 py-1 rounded-md">
                        Bước 3 • 10h45 - 11h15
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300">
                        {report.foodSafetyInspection.step3PreServingCheck.result}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-3 text-base">
                      Cảm Quan Trước Khi Ăn & Chia Khay
                    </h4>
                    <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Đánh giá cảm quan:</span>{' '}
                        {report.foodSafetyInspection.step3PreServingCheck.sensoryColorSmell}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Số lượng khay xuất:</span>{' '}
                        <span className="font-bold text-indigo-600">{report.foodSafetyInspection.step3PreServingCheck.trayCount} khay</span>
                      </div>
                      <div className="text-slate-500 italic mt-1">
                        Ghi chú: {report.foodSafetyInspection.step3PreServingCheck.notes}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Người kiểm:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {report.foodSafetyInspection.step3PreServingCheck.inspectorName}
                    </span>
                  </div>
                </div>
              </div>

              {/* 24-Hour Food Sample Retention Section */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <Thermometer className="w-5 h-5 text-indigo-600" />
                      Nhật Ký Lưu Mẫu Thức Ăn 24 Giờ (Chuyên Dụng Tủ Mát 2 - 8°C)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vị trí: {report.foodSafetyInspection.sampleRetention24h.fridgeUnit} • Tiêu chuẩn:{' '}
                      {report.foodSafetyInspection.sampleRetention24h.tempRangeStandard}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/40 border border-blue-200 text-blue-800 dark:text-blue-300 font-bold text-sm flex items-center gap-1.5">
                      <Thermometer className="w-4 h-4 text-blue-600" />
                      Nhiệt độ hiện tại: {report.foodSafetyInspection.sampleRetention24h.storageTempC}°C
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      ĐẠT CHUẨN LƯU
                    </span>
                  </div>
                </div>

                {/* Samples Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Mã Hũ Niêm Phong</th>
                        <th className="py-2.5 px-3">Tên Món Ăn</th>
                        <th className="py-2.5 px-3">Khối Lượng Mẫu</th>
                        <th className="py-2.5 px-3">Tiêu Chuẩn QĐ 1246</th>
                        <th className="py-2.5 px-3">Thời Điểm Lưu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.foodSafetyInspection.sampleRetention24h.samples.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {s.sampleCode}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            {s.dishName}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                            {s.weightOrVolume}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Đạt chuẩn (&gt; 100g)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-500">
                            {new Date(s.storedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3-Party Electronic Signatures */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                    Chữ Ký Điện Tử 3 Bên Xác Nhận Biên Bản Kiểm Thực & Lưu Mẫu (3-Party E-Signature)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Kitchen Head */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-750">
                      <div className="text-xs text-slate-500">Bên 1 • Nhà Bếp</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-1">
                        {report.foodSafetyInspection.sampleRetention24h.signatories.kitchenHead.name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã ký xác nhận
                      </div>
                    </div>

                    {/* Medical Staff */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-750">
                      <div className="text-xs text-slate-500">Bên 2 • Cán Bộ Y Tế</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-1">
                        {report.foodSafetyInspection.sampleRetention24h.signatories.medicalStaff.name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã ký nghiệm thu
                      </div>
                    </div>

                    {/* School Manager */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-750 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500">Bên 3 • Ban Giám Hiệu</div>
                        <div className="font-bold text-slate-900 dark:text-white mt-1">
                          {report.foodSafetyInspection.sampleRetention24h.signatories.schoolManager.name}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã ký duyệt
                        </div>
                      </div>
                      <button
                        onClick={() => handleSign('STEP_3_PRE_SERVING_CHECK')}
                        disabled={isSigning}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-xs"
                      >
                        {isSigning ? 'Đang ký...' : 'Ký duyệt lại'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONSUMPTION & PLATE WASTE MANAGEMENT */}
          {activeTab === 'plate_waste' && (
            <div className="space-y-6">
              {/* Overall Consumption Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Tỷ Lệ Tiêu Thụ Toàn Trường</div>
                  <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                    {report.consumptionAndPlateWaste.schoolAverageConsumptionRate}%
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{ width: `${report.consumptionAndPlateWaste.schoolAverageConsumptionRate}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Ăn Hết Suất (100%)</div>
                  <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
                    {report.consumptionAndPlateWaste.portionDistribution.full100Pct}%
                  </div>
                  <div className="text-xs text-slate-400 mt-2">Trẻ ăn hết khẩu phần trưa</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Ăn 2/3 Suất</div>
                  <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                    {report.consumptionAndPlateWaste.portionDistribution.twoThirds}%
                  </div>
                  <div className="text-xs text-slate-400 mt-2">Trẻ ăn phần lớn khẩu phần</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Ăn Dưới 1/3 Hoặc Bỏ Suất</div>
                  <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
                    {report.consumptionAndPlateWaste.portionDistribution.lessThanOneThird}%
                  </div>
                  <div className="text-xs text-rose-500 font-medium mt-2">Cần cô giáo dặm thêm</div>
                </div>
              </div>

              {/* Dish Waste Index & 3-Day Rule Warning */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <BadgePercent className="w-5 h-5 text-indigo-600" />
                      Chỉ Số Thức Ăn Thừa Từng Món (Dish Waste Index)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Quy tắc nghiệp vụ: Nếu món thừa &gt; 25% trong 3 ngày liên tục $\rightarrow$ Cảnh báo đỏ điều chỉnh gia vị / cắt thái.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {report.consumptionAndPlateWaste.dishWasteIndex.map((dish, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        dish.flagged
                          ? 'border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase text-slate-500">
                            {dish.dishCategory}
                          </span>
                          {dish.flagged ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-600 text-white flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Cảnh Báo Đỏ
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-600">Đạt chuẩn</span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white mt-2 text-sm">
                          {dish.dishName}
                        </h4>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className={`text-2xl font-black ${dish.flagged ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                            {dish.wastePercent}%
                          </span>
                          <span className="text-xs text-slate-500">tỷ lệ thừa khay</span>
                        </div>
                      </div>

                      {dish.warning && (
                        <div className="mt-3 p-2.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 text-xs font-medium">
                          {dish.warning}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Teacher Sensory Evaluation Table & Interactive Form */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Table of teacher evaluations */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Đánh Giá Cảm Quan Nhanh Từ Giáo Viên Các Lớp
                  </h3>
                  <div className="space-y-3">
                    {report.consumptionAndPlateWaste.teacherSensoryFeedback.map((fb, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {fb.className}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs mt-1 text-slate-600 dark:text-slate-300">
                            <span>Độ ấm: <strong className="text-amber-600">{fb.temperature}</strong></span>
                            <span>Khẩu vị: <strong>{fb.taste}</strong></span>
                            <span>Khay ăn: <strong>{fb.cleanliness}</strong></span>
                            <span>Nhận: <strong>{fb.trayCountReceived} khay</strong></span>
                          </div>
                          <p className="text-xs text-slate-500 italic mt-1.5">
                            "{fb.comment}"
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 shrink-0">
                          {new Date(fb.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form to submit feedback (For Teacher Role) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 mb-3">
                    <PenTool className="w-4 h-4 text-indigo-600" />
                    Giáo Viên Gửi Đánh Giá Cảm Quan Của Lớp
                  </h3>
                  <form onSubmit={handleTeacherSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Chọn Lớp Học
                      </label>
                      <select
                        value={teacherClassId}
                        onChange={(e) => setTeacherClassId(Number(e.target.value))}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                      >
                        {report.reconciliation.classBreakdown.map((c) => (
                          <option key={c.classId} value={c.classId}>
                            {c.className}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Độ Ấm
                        </label>
                        <select
                          value={teacherTemp}
                          onChange={(e) => setTeacherTemp(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                        >
                          <option value="ẤM NÓNG">ẤM NÓNG</option>
                          <option value="ẤM VỪA">ẤM VỪA</option>
                          <option value="NGUỘI">NGUỘI (Cần hâm lại)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Khẩu Vị
                        </label>
                        <select
                          value={teacherTaste}
                          onChange={(e) => setTeacherTaste(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                        >
                          <option value="Vừa miệng trẻ">Vừa miệng trẻ</option>
                          <option value="Hơi nhạt">Hơi nhạt</option>
                          <option value="Hơi mặn">Hơi mặn</option>
                          <option value="Rau hơi cứng">Rau hơi cứng</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Ghi Chú Về Bếp
                      </label>
                      <textarea
                        rows={3}
                        value={teacherComment}
                        onChange={(e) => setTeacherComment(e.target.value)}
                        placeholder="Ví dụ: Các bé thích món thịt rim, ăn hết sạch cơm..."
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingTeacher}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition shadow-xs"
                    >
                      {isSubmittingTeacher ? 'Đang gửi...' : 'Gửi Đánh Giá Nhanh Về Bếp'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

