import React, { useState, useEffect, useCallback } from 'react';
import { downloadExcel } from '../../../core/utils/excel-export';
import {
  parentEvaluationSummaryApi,
  ParentEvaluationSummaryReport,
  DishRankingItem,
  RecipeImprovementRecord,
} from '../api/parent-evaluation-summary.api';
import {
  Star,
  Award,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  ChefHat,
  Filter,
  RefreshCw,
  Heart,
  MessageSquare,
  ShieldAlert,
  Send,
  BookOpen,
  TrendingUp,
  X,
  Sparkles,
  Building,
  UserCheck,
} from 'lucide-react';

export const ParentEvaluationSummaryReportPage: React.FC = () => {
  // Query Filter States
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [gradeLevel, setGradeLevel] = useState<string>('ALL');

  // Role View Toggle
  const [activeRoleView, setActiveRoleView] = useState<'SCHOOL_MANAGER' | 'NUTRITIONIST'>('SCHOOL_MANAGER');

  // Data & Loading States
  const [report, setReport] = useState<ParentEvaluationSummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals State
  const [selectedFeedbackForReply, setSelectedFeedbackForReply] = useState<any | null>(null);
  const [replyCategory, setReplyCategory] = useState<'NUTRITION_ADVICE' | 'MANAGEMENT_RESOLUTION'>('NUTRITION_ADVICE');
  const [replyText, setReplyText] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  // Recipe Improvement Modal
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState<boolean>(false);
  const [newRecipeDish, setNewRecipeDish] = useState<{ name: string; issue: string; plan: string; priority: string }>({
    name: '',
    issue: '',
    plan: '',
    priority: 'HIGH',
  });
  const [isSubmittingRecipe, setIsSubmittingRecipe] = useState<boolean>(false);

  // Export Modal
  const [exportData, setExportData] = useState<any | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await parentEvaluationSummaryApi.getSummaryReport({
        month,
        year,
        gradeLevel: gradeLevel !== 'ALL' ? gradeLevel : undefined,
      });
      setReport(data);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo tổng hợp đánh giá phụ huynh:', err);
    } finally {
      setIsLoading(false);
    }
  }, [month, year, gradeLevel]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Open Specialist Reply Modal
  const handleOpenReplyModal = (feedback: any, category: 'NUTRITION_ADVICE' | 'MANAGEMENT_RESOLUTION') => {
    setSelectedFeedbackForReply(feedback);
    setReplyCategory(category);
    if (category === 'NUTRITION_ADVICE') {
      setReplyText(
        `Cảm ơn phụ huynh đã đóng góp. Về mặt tiêu hóa và khẩu vị của bé ${feedback.studentName}, chuyên viên dinh dưỡng xin giải thích căn cứ khoa học và hướng dẫn điều chỉnh chế độ ăn uống tại nhà...`,
      );
    } else {
      setReplyText(
        `Ban Giám Hiệu nhà trường đã ghi nhận phản ánh của phụ huynh về bữa ăn của bé ${feedback.studentName}. Nhà trường đã chỉ đạo trực tiếp Quản lý Bếp và Giáo viên chủ nhiệm lớp để khắc phục ngay...`,
      );
    }
  };

  // Submit Specialist Reply
  const handleSubmitSpecialistReply = async () => {
    if (!selectedFeedbackForReply || !replyText.trim()) return;
    setIsSendingReply(true);
    try {
      await parentEvaluationSummaryApi.respondSpecialist(selectedFeedbackForReply.evaluationId, {
        responseContent: replyText.trim(),
        responseCategory: replyCategory,
        sendPushNotification: true,
      });
      showToast('Đã gửi phản hồi chuyên môn thành công và gửi thông báo tới phụ huynh qua ứng dụng KidMeal!');
      setSelectedFeedbackForReply(null);
      fetchReport();
    } catch (err) {
      console.error('Lỗi khi gửi phản hồi chuyên môn:', err);
      alert('Không thể lưu phản hồi. Vui lòng thử lại!');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Open Recipe Improvement Modal with Pre-filled Dish
  const handleOpenAddRecipeModal = (dish?: DishRankingItem) => {
    if (dish) {
      setNewRecipeDish({
        name: dish.dishName,
        issue: dish.primaryComment,
        plan: dish.actionNote,
        priority: 'HIGH',
      });
    } else {
      setNewRecipeDish({
        name: '',
        issue: '',
        plan: '',
        priority: 'HIGH',
      });
    }
    setIsRecipeModalOpen(true);
  };

  // Submit Recipe Improvement to Chef
  const handleSubmitRecipeImprovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeDish.name || !newRecipeDish.issue || !newRecipeDish.plan) {
      alert('Vui lòng điền đầy đủ thông tin món ăn, vấn đề phản ánh và kế hoạch điều chỉnh');
      return;
    }
    setIsSubmittingRecipe(true);
    try {
      await parentEvaluationSummaryApi.createRecipeImprovementLog({
        dishName: newRecipeDish.name,
        issueFeedback: newRecipeDish.issue,
        actionPlan: newRecipeDish.plan,
        priority: newRecipeDish.priority,
      });
      showToast('Đã chuyển yêu cầu vào Sổ tay Cải tiến Công thức Bếp trưởng thành công!');
      setIsRecipeModalOpen(false);
      fetchReport();
    } catch (err) {
      console.error('Lỗi khi thêm sổ tay cải tiến:', err);
      alert('Không thể lưu thông tin. Vui lòng thử lại!');
    } finally {
      setIsSubmittingRecipe(false);
    }
  };

  // Handle Official Export
  const handleExport = async () => {
    try {
      const res = await parentEvaluationSummaryApi.exportSummaryReport({ month, year });
      setExportData(res);
      setIsExportModalOpen(true);
    } catch (err) {
      console.error('Lỗi khi xuất báo cáo:', err);
      alert('Không thể xuất báo cáo. Vui lòng thử lại!');
    }
  };

  const handleDownloadExcel = async () => {
    if (!report) return alert('Chưa có dữ liệu báo cáo để tải Excel');
    await downloadExcel(
      `Bao_cao_danh_gia_phu_huynh_T${month}_${year}.xlsx`,
      [
        ['Chỉ số đánh giá', 'Kết quả'],
        ['Kỳ báo cáo', `Tháng ${month}/${year}`],
        ['Điểm CSAT Tổng thể', `${report.overallCsat.averageRating} / 5.0 ⭐`],
        ['Tỷ lệ hài lòng tích cực', `${report.overallCsat.positiveRate}%`],
        ['Số phụ huynh tham gia', `${report.overallCsat.respondingParentsCount} phụ huynh (${report.overallCsat.participationRate}%)`],
        ['Hiệu suất cam kết SLA', `${report.slaPerformance.responseRate}% (TB ${report.slaPerformance.averageResponseHours} giờ)`],
        ['Tổng phản hồi cần xử lý', report.slaPerformance.totalFeedbacks],
        ['Phản hồi xử lý quá hạn', report.slaPerformance.overdueCount],
      ],
      `Báo cáo đánh giá T${month}_${year}`
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="w-full">
        {/* Filter Bar, Actions & Role View Switcher */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Month / Year / Grade Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Filter className="w-4 h-4 text-slate-400" /> Bộ lọc:
            </div>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Toàn trường (4 Khối)</option>
              <option value="NHA_TRE">Khối Nhà Trẻ (18 - 36 tháng)</option>
              <option value="MAM">Khối Mầm (3 - 4 tuổi)</option>
              <option value="CHOI">Khối Chồi (4 - 5 tuổi)</option>
              <option value="LA">Khối Lá (5 - 6 tuổi)</option>
            </select>
          </div>

          {/* Action buttons & Role Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveRoleView('SCHOOL_MANAGER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeRoleView === 'SCHOOL_MANAGER'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-amber-600" /> BGH
              </button>
              <button
                onClick={() => setActiveRoleView('NUTRITIONIST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeRoleView === 'NUTRITIONIST'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5 text-emerald-600" /> Dinh dưỡng
              </button>
            </div>

            <button
              onClick={() => handleOpenAddRecipeModal()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <ChefHat className="w-3.5 h-3.5" /> Sổ tay Bếp trưởng ({report?.recipeImprovements.length || 0})
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Xuất Báo Cáo
            </button>
            <button
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Tải nhanh dữ liệu đánh giá ra Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Xuất Excel
            </button>
            <button
              onClick={fetchReport}
              disabled={isLoading}
              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition cursor-pointer"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ─── BLOCK 1: OVERALL CSAT & SENTIMENT CARDS ─── */}
        {report && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Điểm đánh giá trung bình */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>ĐIỂM CSAT TRUNG BÌNH</span>
                <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{report.overallCsat.averageRating}</span>
                <span className="text-xs font-bold text-slate-400">/ 5.0 ⭐</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md w-fit">
                <Award className="w-3.5 h-3.5" /> Đạt chuẩn xuất sắc ({report.overallCsat.totalEvaluations} lượt đánh giá)
              </div>
            </div>

            {/* 2. Tỷ lệ đánh giá tích cực */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>TỶ LỆ TÍCH CỰC (4 - 5 ⭐)</span>
                <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600">{report.overallCsat.positiveRate}%</span>
                <span className="text-xs text-slate-400">({report.overallCsat.positiveCount} lượt)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, report.overallCsat.positiveRate)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Mục tiêu KPI trường mầm non: ≥ 90%</p>
            </div>

            {/* 3. Tỷ lệ đánh giá tiêu cực (Cảnh báo đỏ nếu > 5%) */}
            <div
              className={`rounded-2xl p-5 border shadow-sm space-y-3 transition ${
                report.overallCsat.isNegativeAlert
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 animate-pulse'
                  : 'bg-white border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span className={report.overallCsat.isNegativeAlert ? 'text-rose-700' : ''}>TIÊU CỰC (≤ 2 ⭐)</span>
                <span
                  className={`p-1.5 rounded-lg ${
                    report.overallCsat.isNegativeAlert ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black ${
                    report.overallCsat.isNegativeAlert ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {report.overallCsat.negativeRate}%
                </span>
                <span className="text-xs text-slate-400">({report.overallCsat.negativeCount} phản ánh)</span>
              </div>
              {report.overallCsat.isNegativeAlert ? (
                <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1 bg-rose-100 px-2 py-0.5 rounded">
                  🚨 CẢNH BÁO ĐỎ: Vượt ngưỡng 5% cần BGH can thiệp ngay!
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  ✓ Trong ngưỡng kiểm soát an toàn (&lt; 5%)
                </div>
              )}
            </div>

            {/* 4. Tỷ lệ tham gia đánh giá */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>TỶ LỆ THAM GIA ĐÁNH GIÁ</span>
                <span className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                  <UserCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600">{report.overallCsat.participationRate}%</span>
                <span className="text-xs text-slate-400">
                  ({report.overallCsat.respondingParentsCount}/{report.overallCsat.totalEnrolledStudents} PH)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, report.overallCsat.participationRate)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Tỷ lệ phụ huynh tương tác cao</p>
            </div>
          </div>
        )}

        {/* ─── BLOCK 2: 4 QUALITY DIMENSIONS ─── */}
        {report && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Phân Tích 4 Khía Cạnh Chất Lượng Bữa Ăn (Quality Dimensions)
                </h2>
                <p className="text-xs text-slate-500">Đánh giá chuyên sâu về vị giác, độ tươi nóng, trình bày và định lượng khẩu phần</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {report.qualityDimensions.map((q) => (
                <div key={q.dimensionKey} className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{q.name}</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                      {q.satisfactionRate}% HÀI LÒNG
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= Math.round(q.averageScore)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-extrabold text-slate-700">{q.averageScore} / 5.0</span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic bg-white p-2.5 rounded-lg border border-slate-200/50">
                    "{q.questionPrompt}"
                  </p>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ý kiến tiêu biểu:</span>
                    <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                      {q.representativeRemarks.map((rem, idx) => (
                        <li key={idx} className="line-clamp-2">{rem}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── BLOCK 3: DISH POPULARITY RANKING (TOP FAVORITE VS TOP COMPLAINED) ─── */}
        {report && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 Món Được Yêu Thích Nhất */}
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-200/80 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                    <Heart className="w-4 h-4 fill-emerald-500 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Top 5 Món Được Yêu Thích Nhất</h3>
                    <p className="text-xs text-emerald-700 font-medium">Hành động: Giữ vững chất lượng & tăng tần suất</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                  Điểm ≥ 4.8 ⭐
                </span>
              </div>

              <div className="space-y-3">
                {report.dishRanking.topFavoriteDishes.map((dish, idx) => (
                  <div
                    key={dish.id}
                    className="p-3.5 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl border border-emerald-100 transition space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-slate-900">{dish.dishName}</span>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {dish.averageRating}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                      "{dish.primaryComment}"
                    </p>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-emerald-700 font-semibold">{dish.actionNote}</span>
                      <span className="text-slate-400 font-medium">{dish.praiseCount} lượt khen</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 Món Bị Phản Ánh Nhiều Nhất */}
            <div className="bg-white rounded-2xl shadow-sm border border-rose-200/80 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Top 5 Món Bị Phản Ánh Nhiều Nhất</h3>
                    <p className="text-xs text-rose-700 font-medium">Hành động: Bắt buộc cải tiến công thức Bếp trưởng</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg">
                  Cần can thiệp
                </span>
              </div>

              <div className="space-y-3">
                {report.dishRanking.topComplainedDishes.map((dish, idx) => (
                  <div
                    key={dish.id}
                    className="p-3.5 bg-rose-50/50 hover:bg-rose-50 rounded-xl border border-rose-200/70 transition space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-slate-900">{dish.dishName}</span>
                      </div>
                      <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                        {dish.complaintCount} phàn nàn ({dish.averageRating} ⭐)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                      "{dish.primaryComment}"
                    </p>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-rose-700 font-bold">{dish.actionNote}</span>
                      <button
                        onClick={() => handleOpenAddRecipeModal(dish)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold shadow-sm transition"
                      >
                        + Cải tiến công thức
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── BLOCK 4: RESPONSE RATE & SLA MONITORING ─── */}
        {report && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Hiệu Suất Xử Lý Khiếu Nại & Cam Kết SLA Phản Hồi Phụ Huynh
                </h2>
                <p className="text-xs text-slate-500">
                  Chuẩn dịch vụ: <strong>&lt; 4 giờ làm việc</strong> với đánh giá ≤ 2 sao (Khẩn cấp); <strong>&lt; 24 giờ</strong> với đánh giá thông thường
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
                  Tỷ lệ phản hồi: {report.slaPerformance.responseRate}%
                </span>
                {report.slaPerformance.overdueSlaCount > 0 ? (
                  <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-black rounded-lg animate-pulse">
                    ⚠️ {report.slaPerformance.overdueSlaCount} ca quá hạn SLA
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                    ✓ 0 ca quá hạn SLA
                  </span>
                )}
              </div>
            </div>

            {/* SLA Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">TỔNG Ý KIẾN TRONG KỲ</span>
                <p className="text-2xl font-black text-slate-900">{report.slaPerformance.totalReceived}</p>
                <p className="text-[11px] text-slate-500">
                  Đã trả lời: <span className="font-bold text-emerald-600">{report.slaPerformance.respondedCount}</span> | Chờ: <span className="font-bold text-amber-600">{report.slaPerformance.pendingCount}</span>
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">THỜI GIAN PHẢN HỒI TB</span>
                <p className="text-2xl font-black text-blue-600">{report.slaPerformance.averageResponseHours} giờ</p>
                <p className="text-[11px] text-emerald-600 font-semibold">✓ Đạt chuẩn SLA toàn trường</p>
              </div>

              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-1">
                <span className="text-[11px] font-bold text-amber-800">SLA KHẨN CẤP (≤ 2 ⭐)</span>
                <p className="text-2xl font-black text-amber-700">{report.slaPerformance.urgentSlaAvgHours} giờ</p>
                <p className="text-[11px] text-amber-900 font-medium">Chuẩn dịch vụ: &lt; 4 giờ làm việc</p>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-[11px] font-bold text-emerald-800">SLA THÔNG THƯỜNG (3-5 ⭐)</span>
                <p className="text-2xl font-black text-emerald-700">{report.slaPerformance.normalSlaAvgHours} giờ</p>
                <p className="text-[11px] text-emerald-900 font-medium">Chuẩn dịch vụ: &lt; 24 giờ</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── BLOCK 5: GRADE BREAKDOWN ─── */}
        {report && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-slate-600" />
              So Sánh Chỉ Số CSAT Theo 4 Khối Lớp (Đánh Giá Thi Đua Giáo Viên & Cấp Dưỡng)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Khối Lớp</th>
                    <th className="py-3 px-3">Sĩ Số</th>
                    <th className="py-3 px-3">PH Tham Gia</th>
                    <th className="py-3 px-3">Tỷ Lệ Tham Gia</th>
                    <th className="py-3 px-3">Điểm CSAT</th>
                    <th className="py-3 px-3">Tỷ Lệ Tích Cực</th>
                    <th className="py-3 px-3">Ý Kiến Tồn Đọng</th>
                    <th className="py-3 px-4">Xếp Loại Thi Đua</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {report.gradeBreakdown.map((g) => (
                    <tr key={g.gradeLevel} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{g.gradeName}</td>
                      <td className="py-3 px-3">{g.totalStudents} trẻ</td>
                      <td className="py-3 px-3">{g.respondingStudents} PH</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-blue-600">{g.participationRate}%</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-amber-600 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {g.averageRating}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-emerald-600">{g.positiveRate}%</span>
                      </td>
                      <td className="py-3 px-3">
                        {g.pendingIssueCount > 0 ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                            {g.pendingIssueCount} ca chờ
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[11px]">
                          {g.teacherDisciplineScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── BLOCK 6: RECENT FEEDBACKS & SPECIALIST RESPONSE TABLE ─── */}
        {report && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Danh Sách Ý Kiến Của Phụ Huynh & Hành Động Xử Lý
                </h2>
                <p className="text-xs text-slate-500">
                  Phân định rõ thẩm quyền: Dinh dưỡng trả lời chuyên môn khoa học; Ban Giám Hiệu chỉ đạo điều hành
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {report.recentFeedbacks.map((f) => (
                <div
                  key={f.evaluationId}
                  className={`p-4 rounded-xl border transition space-y-2.5 ${
                    f.isUrgent
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-xs text-slate-900">{f.studentName}</span>
                      <span className="text-[11px] text-slate-500">({f.className})</span>
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= f.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      {f.isUrgent && (
                        <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded">
                          SLA KHẨN CẤP &lt; 4H
                        </span>
                      )}
                      {f.isOverdue && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded border border-rose-300 animate-pulse">
                          ⚠️ QUÁ HẠN ({f.hoursElapsed}h)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {f.status === 'RESPONDED' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã trả lời ({f.respondedByName || 'Nhà trường'})
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md">
                          Đang chờ xử lý ({f.hoursElapsed}h trước)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comment */}
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/60 font-medium">
                    "{f.comment}"
                  </p>

                  {/* Previous Response if any */}
                  {f.responseContent && (
                    <div className="text-xs bg-emerald-50 text-emerald-950 p-3 rounded-lg border border-emerald-200/80 space-y-1">
                      <span className="font-bold text-[11px] text-emerald-800 block">
                        Phản hồi gửi phụ huynh ({f.respondedByName || 'Nhà trường'}):
                      </span>
                      <p>{f.responseContent}</p>
                    </div>
                  )}

                  {/* Action Buttons based on Role */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleOpenReplyModal(f, 'NUTRITION_ADVICE')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Tư vấn Dinh dưỡng Chuyên môn
                    </button>
                    <button
                      onClick={() => handleOpenReplyModal(f, 'MANAGEMENT_RESOLUTION')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Building className="w-3.5 h-3.5" /> Chỉ đạo Ban Giám Hiệu
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: SPECIALIST RESPONSE (NUTRITIONIST / PRINCIPAL) ─── */}
      {selectedFeedbackForReply && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {replyCategory === 'NUTRITION_ADVICE' ? (
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Building className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {replyCategory === 'NUTRITION_ADVICE'
                      ? 'Soạn Thảo Tư Vấn Dinh Dưỡng Khoa Học (Nutritionist)'
                      : 'Soạn Thảo Chỉ Đạo & Giải Quyết Khiếu Nại (School Manager)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Phản hồi phụ huynh bé: {selectedFeedbackForReply.studentName} ({selectedFeedbackForReply.className})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFeedbackForReply(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-500 block mb-1">Nội dung phụ huynh phản ánh:</span>
                <p className="text-slate-800 italic">"{selectedFeedbackForReply.comment}"</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Nội dung phản hồi chính thức từ Nhà trường / Chuyên viên Dinh dưỡng:
                </label>
                <textarea
                  rows={6}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium leading-relaxed"
                  placeholder="Nhập nội dung giải thích căn cứ dinh dưỡng, lời khuyên tại nhà hoặc cam kết khắc phục..."
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                <Send className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Hệ thống sẽ tự động gửi <strong>Push Notification</strong> tức thời tới tài khoản phụ huynh trên ứng dụng KidMeal.
                </span>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedFeedbackForReply(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSubmitSpecialistReply}
                disabled={isSendingReply || !replyText.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                {isSendingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gửi Phản Hồi Phụ Huynh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: CHEF RECIPE IMPROVEMENT LOG ─── */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Sổ Tay Cải Tiến Công Thức Nấu (Chỉ Đạo Bếp Trưởng)</h3>
                  <p className="text-xs text-slate-400">
                    Ghi nhận các món ăn bị phụ huynh phản ánh nhiều để Bếp trưởng điều chỉnh định lượng và kỹ thuật chế biến
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Form Add New */}
              <form onSubmit={handleSubmitRecipeImprovement} className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-xl space-y-3">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-600" /> Thêm món cần điều chỉnh công thức:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Tên món ăn</label>
                    <input
                      type="text"
                      value={newRecipeDish.name}
                      onChange={(e) => setNewRecipeDish({ ...newRecipeDish, name: e.target.value })}
                      placeholder="Ví dụ: Canh rau dền đỏ nấu tôm"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Mức độ ưu tiên</label>
                    <select
                      value={newRecipeDish.priority}
                      onChange={(e) => setNewRecipeDish({ ...newRecipeDish, priority: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    >
                      <option value="CRITICAL">Khẩn cấp (Nhiều phản ánh)</option>
                      <option value="HIGH">Cao</option>
                      <option value="NORMAL">Bình thường</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Vấn đề phản ánh từ phụ huynh</label>
                  <input
                    type="text"
                    value={newRecipeDish.issue}
                    onChange={(e) => setNewRecipeDish({ ...newRecipeDish, issue: e.target.value })}
                    placeholder="Ví dụ: Canh quá mặn, vượt chuẩn natri cho trẻ mầm non..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Hướng dẫn cải tiến chỉ đạo Bếp trưởng</label>
                  <textarea
                    rows={2}
                    value={newRecipeDish.plan}
                    onChange={(e) => setNewRecipeDish({ ...newRecipeDish, plan: e.target.value })}
                    placeholder="Ví dụ: Bắt buộc giảm 30% lượng muối i-ốt, ninh ngọt bằng nước hầm rau củ tự nhiên, đo độ mặn..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    required
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmittingRecipe}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    {isSubmittingRecipe ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChefHat className="w-3.5 h-3.5" />}
                    Lưu Vào Sổ Tay Bếp Trưởng
                  </button>
                </div>
              </form>

              {/* History List */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Danh sách món ăn đang theo dõi cải tiến công thức ({report?.recipeImprovements.length || 0}):
                </span>
                {report?.recipeImprovements.map((rec) => (
                  <div key={rec.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{rec.dishName}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          rec.priority === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rec.priority === 'CRITICAL' ? 'KHẨN CẤP' : 'ƯU TIÊN'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-700">Vấn đề:</span> {rec.issueFeedback}
                    </p>
                    <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200/60 font-medium">
                      <span className="font-bold">Chỉ đạo:</span> {rec.actionPlan}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Người tạo: {rec.createdByName} ({rec.createdByRole})</span>
                      <span>Trạng thái: <strong className="text-blue-600">{rec.status}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: EXPORT OFFICIAL REPORT ─── */}
      {isExportModalOpen && exportData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Xuất Báo Cáo Đánh Giá Phụ Huynh Chính Thức</h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="text-center space-y-1 border-b border-slate-200 pb-4">
                <h2 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  {exportData.institutionName}
                </h2>
                <h1 className="font-bold text-base text-emerald-700">
                  {exportData.reportTitle}
                </h1>
                <p className="text-slate-400 text-[11px]">
                  Thời điểm kết xuất: {new Date(exportData.issuedAt).toLocaleString('vi-VN')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Điểm CSAT Tổng thể:</span>
                  <span className="font-black text-lg text-slate-900">
                    {exportData.report.overallCsat.averageRating} / 5.0 ⭐
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tỷ lệ hài lòng tích cực:</span>
                  <span className="font-black text-lg text-emerald-600">
                    {exportData.report.overallCsat.positiveRate}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tỷ lệ phụ huynh tham gia:</span>
                  <span className="font-bold text-slate-800">
                    {exportData.report.overallCsat.participationRate}% ({exportData.report.overallCsat.respondingParentsCount} phụ huynh)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Hiệu suất cam kết SLA:</span>
                  <span className="font-bold text-blue-600">
                    {exportData.report.slaPerformance.responseRate}% (TB {exportData.report.slaPerformance.averageResponseHours} giờ)
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 grid grid-cols-2 text-center text-[11px] font-bold text-slate-600">
                <div>
                  <p className="mb-8">HIỆU TRƯỞNG</p>
                  <p className="text-slate-900">{exportData.executiveSignatures.principal}</p>
                </div>
                <div>
                  <p className="mb-8">CHUYÊN VIÊN DINH DƯỠNG</p>
                  <p className="text-slate-900">{exportData.executiveSignatures.nutritionSpecialist}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={handleDownloadExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-4 h-4" /> Tải file Excel (.xlsx)
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                In Báo Cáo / Lưu PDF
              </button>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

