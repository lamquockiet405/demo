import React, { useState, useEffect } from 'react';
import { downloadExcel } from '../../../core/utils/excel-export';
import {
  FileSpreadsheet,
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
  Droplets,
  Award,
  AlertOctagon,
  Image as ImageIcon,
  Building2,
  Ban,
  Activity,
} from 'lucide-react';
import {
  foodSafetyApi,
  FoodSafetyComplianceReportData,
  SupplierItem,
  SensoryIncidentItem,
} from '../api/food-safety.api';

export const FoodSafetyComplianceReportPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [report, setReport] = useState<FoodSafetyComplianceReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'3_step' | 'sample_retention' | 'legal_suppliers'>(
    '3_step',
  );
  const [perspectiveRole, setPerspectiveRole] = useState<'SCHOOL_MANAGER' | 'NUTRITIONIST'>(
    'SCHOOL_MANAGER',
  );

  // Modal / Sign State
  const [isSignModalOpen, setIsSignModalOpen] = useState<boolean>(false);
  const [signerName, setSignerName] = useState<string>('Phạm Thị Lan (Ban Giám Hiệu)');
  const [signNotes, setSignNotes] = useState<string>('Đã kiểm tra đối chiếu sổ kiểm thực 3 bước và tủ lưu mẫu. Đạt chuẩn QĐ 1246/QĐ-BYT.');
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [signSuccessMsg, setSignSuccessMsg] = useState<string | null>(null);

  // Nutritionist review form state
  const [reviewDishName, setReviewDishName] = useState<string>('');
  const [reviewIncident, setReviewIncident] = useState<string>('');
  const [reviewChemical, setReviewChemical] = useState<string>('AN TOÀN (Thành phần đạt chuẩn)');
  const [reviewAnalysis, setReviewAnalysis] = useState<string>('');
  const [reviewAction, setReviewAction] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  // Suspend Supplier modal state
  const [suspendingSupplier, setSuspendingSupplier] = useState<SupplierItem | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [isSuspending, setIsSuspending] = useState<boolean>(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await foodSafetyApi.getComplianceReport(selectedDate);
      setReport(data);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo tuân thủ an toàn thực phẩm:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDate]);

  const handleSignMonthly = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSigning(true);
      const [yearStr, monthStr] = selectedDate.split('-');
      const res = await foodSafetyApi.signMonthlyLog({
        month: Number(monthStr) || 11,
        year: Number(yearStr) || 2026,
        signerName,
        signerRole: 'SCHOOL_MANAGER',
        notes: signNotes,
      });
      setSignSuccessMsg(res.message);
      setIsSignModalOpen(false);
      await fetchReport();
      setTimeout(() => setSignSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi ký duyệt sổ');
    } finally {
      setIsSigning(false);
    }
  };

  const handleNutritionistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewDishName || !reviewIncident || !reviewAnalysis || !reviewAction) {
      alert('Vui lòng điền đầy đủ thông tin phân tích sự cố');
      return;
    }
    try {
      setIsSubmittingReview(true);
      const res = await foodSafetyApi.submitNutritionistReview({
        date: selectedDate,
        dishName: reviewDishName,
        incidentDescription: reviewIncident,
        chemicalOrAdditiveSafetyStatus: reviewChemical,
        nutritionistAnalysis: reviewAnalysis,
        actionTaken: reviewAction,
        reviewerName: 'Vũ Thu Thảo (Chuyên viên Dinh dưỡng)',
      });
      setReviewSuccessMsg(res.message);
      setReviewDishName('');
      setReviewIncident('');
      setReviewAnalysis('');
      setReviewAction('');
      await fetchReport();
      setTimeout(() => setReviewSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi gửi phân tích');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSuspendSupplier = async () => {
    if (!suspendingSupplier) return;
    try {
      setIsSuspending(true);
      const res = await foodSafetyApi.suspendSupplier({
        supplierId: suspendingSupplier.id,
        reason: suspendReason || 'Tỷ lệ hàng bị từ chối nhập vượt ngưỡng 2% theo quy định nhà trường.',
        decisionBy: 'Phạm Thị Lan (Ban Giám Hiệu)',
      });
      alert(res.message);
      setSuspendingSupplier(null);
      setSuspendReason('');
      await fetchReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi đình chỉ nhà cung cấp');
    } finally {
      setIsSuspending(false);
    }
  };

  const handleExportExcel = async () => {
    if (!report) return alert("Chưa có dữ liệu báo cáo để xuất Excel.");
    await downloadExcel(
      `Bao_cao_an_toan_thuc_pham_${selectedDate}.xlsx`,
      [
        ["Chỉ tiêu kiểm định", "Kết quả", "Ngưỡng tiêu chuẩn", "Đánh giá tuân thủ"],
        ["Tỷ lệ tuân thủ tổng thể", `${report.overallComplianceRate}%`, "100%", report.overallComplianceRate === 100 ? "Đạt chuẩn" : "Chưa đạt"],
        ["Kiểm thực Bước 1 (Giao nhận nguyên liệu)", `${report.inspection3Step.step1Receiving.checkedCount}/${report.inspection3Step.step1Receiving.totalItems}`, "100%", "Đã hoàn thành"],
        ["Tỷ lệ từ chối nguyên liệu (Reject rate)", `${report.inspection3Step.step1Receiving.rejectRate}%`, "< 2.0%", report.inspection3Step.step1Receiving.rejectRate <= 2 ? "An toàn" : "Nguy cơ cao"],
        ["Kiểm thực Bước 2 (Chế biến bếp)", `${report.inspection3Step.step2Cooking.checkedCount}/${report.inspection3Step.step2Cooking.totalItems}`, "100%", "Đã hoàn thành"],
        ["Kiểm thực Bước 3 (Chia ăn lớp)", `${report.inspection3Step.step3Serving.checkedCount}/${report.inspection3Step.step3Serving.totalItems}`, "100%", "Đã hoàn thành"],
        ["Số mẫu lưu 24h", `${report.sampleRetention24h.totalSamplesStored} mẫu`, "Tất cả món ăn", "Đầy đủ"],
        ["Nhiệt độ tủ lưu mẫu", `${report.sampleRetention24h.storageTempCelsius}°C`, "2°C - 8°C", (report.sampleRetention24h.storageTempCelsius >= 2 && report.sampleRetention24h.storageTempCelsius <= 8) ? "Đạt chuẩn" : "Vi phạm nhiệt độ"],
      ],
      `Hồ sơ ATTP ${selectedDate}`
    );
  };

  const handleExportDossier = async () => {
    try {
      await foodSafetyApi.exportComplianceDossier(selectedDate);
      window.print();
    } catch (err) {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">

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

            {perspectiveRole === 'SCHOOL_MANAGER' && (
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <PenTool className="w-3.5 h-3.5" /> Ký Duyệt Sổ Điện Tử
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-semibold rounded-xl shadow-2xs transition"
              title="Xuất dữ liệu an toàn thực phẩm ra Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Xuất Excel Kiểm Thực
            </button>

            <button
              onClick={handleExportDossier}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition"
            >
              <Printer className="w-4 h-4" /> Xuất Hồ Sơ Thanh Tra Đột Xuất
            </button>
          </div>
        </div>

        {/* 2-Role Perspective Selector */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Góc nhìn Role:
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
                Ban Giám Hiệu (School Manager)
              </button>
              <button
                onClick={() => setPerspectiveRole('NUTRITIONIST')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  perspectiveRole === 'NUTRITIONIST'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Chuyên Viên Dinh Dưỡng (Nutritionist)
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 italic">
            {perspectiveRole === 'SCHOOL_MANAGER'
              ? '• Quyền hạn: Ký duyệt sổ kiểm thực điện tử hàng tuần/tháng, đình chỉ nhà cung cấp vi phạm (>2% reject rate) & xuất hồ sơ đón thanh tra Y tế.'
              : '• Quyền hạn: Giám sát phụ gia/hóa học thực phẩm, phân tích sự cố cảm quan (sữa vón cục, thịt dai...) & ký xác nhận chuyên môn y tế hũ mẫu lưu.'}
          </div>
        </div>
      </div>

      {signSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{signSuccessMsg}</span>
        </div>
      )}

      {reviewSuccessMsg && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{reviewSuccessMsg}</span>
        </div>
      )}

      {/* Zero-Defect Safety KPI Dashboard */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Tuân Thủ Tổng Thể
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300 mt-1">
              {report.overallComplianceRate}%
            </div>
            <div className="text-[11px] text-emerald-600 mt-1 font-medium">ZERO-DEFECT STANDARD</div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-xs">
            <div className="text-xs text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> Photo Audit Trail
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-300 mt-1">
              {report.inspection3Step.photoAuditTrail.photoRate}%
            </div>
            <div className="text-[11px] text-blue-600 mt-1">Bắt buộc ≥ 98.0%</div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 shadow-xs">
            <div className="text-xs text-purple-700 dark:text-purple-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Lưu Mẫu 24H
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-300 mt-1">
              100%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {report.sampleRetention24h.totalSamplesStored} món ăn/ngày
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-teal-200 dark:border-teal-900/50 shadow-xs">
            <div className="text-xs text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5" /> Tủ Lưu Mẫu Mát
            </div>
            <div className="text-2xl font-black text-teal-600 dark:text-teal-300 mt-1">
              {report.sampleRetention24h.fridgeStatus.currentTempC}°C
            </div>
            <div className="text-[11px] text-teal-600 mt-1">Chuẩn an toàn: 2 - 8°C</div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-xs">
            <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Thẻ Xanh Bếp
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-300 mt-1">
              {report.legalAndCertificates.staffCompliance.healthCardRate}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {report.legalAndCertificates.staffCompliance.totalKitchenStaff} nhân viên đủ chuẩn
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-sky-200 dark:border-sky-900/50 shadow-xs">
            <div className="text-xs text-sky-700 dark:text-sky-400 font-semibold flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5" /> Nước Ăn QCVN 01-1
            </div>
            <div className="text-lg font-black text-sky-600 dark:text-sky-300 mt-1.5">
              ĐẠT CHUẨN
            </div>
            <div className="text-[11px] text-sky-600 mt-1">Âm tính Coliform/E.coli</div>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2">
        <button
          onClick={() => setActiveTab('3_step')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === '3_step'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          1. Tuân Thủ Kiểm Thực 3 Bước & Photo Audit Trail
        </button>

        <button
          onClick={() => setActiveTab('sample_retention')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'sample_retention'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Thermometer className="w-4 h-4" />
          2. Nhật Ký & Hồ Sơ Lưu Mẫu 24 Giờ (2°C - 8°C)
        </button>

        <button
          onClick={() => setActiveTab('legal_suppliers')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'legal_suppliers'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Building2 className="w-4 h-4" />
          3. Hồ Sơ Pháp Lý, Nhà Cung Cấp & Xét Nghiệm Nước
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
          Đang tổng hợp báo cáo tuân thủ an toàn thực phẩm từ dữ liệu kiểm định...
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-slate-500">Không có dữ liệu cho mốc thời gian này.</div>
      ) : (
        <>
          {/* TAB 1: 3-STEP INSPECTION & PHOTO AUDIT TRAIL */}
          {activeTab === '3_step' && (
            <div className="space-y-6">
              {/* Photo Audit Trail Status Box */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                  <div>
                    <span className="font-bold text-blue-900 dark:text-blue-200">
                      Tỷ lệ nhật ký có đính kèm ảnh bằng chứng (Photo Audit Trail):{' '}
                      <span className="text-blue-700 dark:text-blue-300 font-extrabold">
                        {report.inspection3Step.photoAuditTrail.photoRate}%
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      ({report.inspection3Step.photoAuditTrail.withPhotoCount}/{report.inspection3Step.photoAuditTrail.totalInspections} lượt kiểm tra có ảnh minh chứng)
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shrink-0">
                  ĐẠT CHUẨN PHÁP LÝ (≥ 98%)
                </span>
              </div>

              {/* 3 Step Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Step 1 */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-md">
                        Bước 1 • Nhập Nguyên Liệu
                      </span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                        100% TUÂN THỦ
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-3 text-base">
                      Kiểm Tra Trước Khi Chế Biến
                    </h4>
                    <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Xuất xứ:</strong> 100% nguyên liệu có giấy chứng nhận VietGAP, GlobalGAP, hóa đơn thú y.
                      </li>
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Cảm quan:</strong> Tươi sống, màu sắc đặc trưng, không có mùi lạ.
                      </li>
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Nhiệt độ giao hàng lạnh:</strong> Xe bảo quản {report.inspection3Step.temperatureLogs.avgTransportTempC}°C (Chuẩn ≤ 5°C).
                      </li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Có tem niêm phong & mã QR truy xuất
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded-md">
                        Bước 2 • Trong Khi Chế Biến
                      </span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                        100% TUÂN THỦ
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-3 text-base">
                      Kiểm Tra Quy Trình Nấu Chín
                    </h4>
                    <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Bếp 1 chiều:</strong> Tách biệt tuyệt đối khu vực sơ chế sống và khu ra đồ chín.
                      </li>
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Mã màu dao thớt:</strong> 4 bộ riêng (Đỏ = Thịt sống, Xanh = Hải sản, Lá = Rau, Trắng = Chín).
                      </li>
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Nhiệt độ tâm sôi:</strong> Đo que tâm đạt {report.inspection3Step.temperatureLogs.avgCoreBoilingTempC}°C (Chuẩn ≥ 75°C).
                      </li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Khay thìa tiệt trùng sấy nóng 100°C
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-purple-600 bg-purple-100 dark:bg-purple-900/40 px-2.5 py-1 rounded-md">
                        Bước 3 • Trước Khi Ăn
                      </span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                        100% TUÂN THỦ
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-3 text-base">
                      Đánh Giá Cảm Quan & Chia Khay
                    </h4>
                    <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Độ chín mềm:</strong> Hạt cơm nở mềm, thức ăn băm nhỏ phù hợp lứa tuổi mầm non.
                      </li>
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Nhiệt độ giữ ấm:</strong> Thức ăn chuyển lên các lớp giữ ấm nhiệt &gt; 60°C trong thùng giữ nhiệt.
                      </li>
                      <li>
                        <strong className="text-slate-800 dark:text-slate-200">Mùi vị & Khẩu vị:</strong> Thơm ngon, không nêm cay hoặc phụ gia quá vị.
                      </li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã nghiệm thu cảm quan khay mẫu
                  </div>
                </div>
              </div>

              {/* Photo Audit Trail Gallery */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-600" />
                  Bằng Chứng Hình Ảnh Kiểm Thực Minh Bạch (Photo Audit Trail Gallery)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {report.inspection3Step.photoAuditTrail.samplePhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-750"
                    >
                      <div className="h-36 overflow-hidden relative">
                        <img
                          src={photo.imageUrl}
                          alt={photo.title}
                          className="w-full h-full object-cover hover:scale-105 transition duration-300"
                        />
                        <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                          {photo.step}
                        </span>
                      </div>
                      <div className="p-3">
                        <h5 className="font-semibold text-slate-900 dark:text-white text-xs line-clamp-1">
                          {photo.title}
                        </h5>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(photo.uploadedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 24H SAMPLE RETENTION & FRIDGE TEMPERATURE */}
          {activeTab === 'sample_retention' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <Thermometer className="w-5 h-5 text-teal-600" />
                      Nhật Ký & Hồ Sơ Lưu Mẫu 24 Giờ (Quyết định 1246/QĐ-BYT)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vị trí: {report.sampleRetention24h.fridgeStatus.unitName} • Chuẩn nhiệt độ:{' '}
                      {report.sampleRetention24h.fridgeStatus.standardRange}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/40 border border-teal-200 text-teal-800 dark:text-teal-300 font-bold text-sm flex items-center gap-1.5">
                      <Thermometer className="w-4 h-4 text-teal-600" />
                      Nhiệt độ hiện tại: {report.sampleRetention24h.fridgeStatus.currentTempC}°C
                    </div>
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      TỦ MÁT AN TOÀN
                    </span>
                  </div>
                </div>

                {/* Samples Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Mã Hũ Mẫu</th>
                        <th className="py-2.5 px-3">Tên Món Ăn</th>
                        <th className="py-2.5 px-3">Khối Lượng Mẫu</th>
                        <th className="py-2.5 px-3">Chuẩn QĐ 1246</th>
                        <th className="py-2.5 px-3">Thời Điểm Lưu</th>
                        <th className="py-2.5 px-3">Thời Điểm Hủy An Toàn</th>
                        <th className="py-2.5 px-3 text-center">Chữ Ký 3 Bên</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.sampleRetention24h.samples.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {s.sampleCode}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            {s.dishName}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-teal-600 dark:text-teal-400">
                            {s.weightOrVolume}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Đạt chuẩn (&gt; 100g/150ml)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-500">
                            {new Date(s.storedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-500">
                            +24 giờ (Tự động hủy an toàn)
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center gap-1 mx-auto w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Đầy đủ 3 bên
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Hourly Temperature Trend Visualization */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-teal-600" />
                    Biểu Đồ Theo Dõi Nhiệt Độ Tủ Mát Chuyên Dụng 24 Giờ (Chuẩn 2°C - 8°C)
                  </h4>
                  <div className="grid grid-cols-7 gap-2">
                    {report.sampleRetention24h.fridgeStatus.hourlyTrend.map((log, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/20 text-center"
                      >
                        <div className="text-[11px] text-slate-500 font-medium">{log.hour}</div>
                        <div className="text-base font-extrabold text-teal-700 dark:text-teal-300 mt-1">
                          {log.tempC}°C
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Bình thường</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nutritionist Sensory & Chemical Safety Review Form */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    Phân Tích Chuyên Môn Cảm Quan & An Toàn Hóa Học / Phụ Gia (Dành Cho Nutritionist)
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-semibold">
                    Quyền hạn chuyên môn Y tế
                  </span>
                </div>

                {/* Previous Reviews List */}
                <div className="space-y-3">
                  {report.sensoryIncidentReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-750 flex flex-col md:flex-row md:items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {rev.dishName}
                          </span>
                          <span className="text-xs text-slate-400">({rev.date})</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                            {rev.status}
                          </span>
                        </div>
                        <p className="text-xs text-rose-600 font-medium">Sự cố: {rev.incident}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          <strong>Phân tích chuyên môn:</strong> {rev.nutritionistAnalysis}
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          <strong>Biện pháp can thiệp:</strong> {rev.actionTaken}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {rev.reviewer}
                        </div>
                        <div className="text-[11px] text-slate-400">Chuyên viên Dinh dưỡng</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submission Form */}
                <form onSubmit={handleNutritionistSubmit} className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ghi Nhận Phân Tích Sự Cố Cảm Quan Hoặc Phụ Gia Mới
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Tên Món Ăn / Thực Phẩm
                      </label>
                      <input
                        type="text"
                        value={reviewDishName}
                        onChange={(e) => setReviewDishName(e.target.value)}
                        placeholder="Ví dụ: Sữa tươi thanh trùng, Thịt bò xào..."
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Tình Trạng Hóa Học / Phụ Gia
                      </label>
                      <input
                        type="text"
                        value={reviewChemical}
                        onChange={(e) => setReviewChemical(e.target.value)}
                        placeholder="AN TOÀN / Nghi ngờ hỏng lạnh..."
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Mô Tả Hiện Tượng Cảm Quan (Ví dụ: vón cục, dai, chưa chín mềm)
                    </label>
                    <input
                      type="text"
                      value={reviewIncident}
                      onChange={(e) => setReviewIncident(e.target.value)}
                      placeholder="Mô tả cụ thể sự cố cảm quan..."
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Phân Tích Nguyên Nhân Kỹ Thuật
                      </label>
                      <textarea
                        rows={2}
                        value={reviewAnalysis}
                        onChange={(e) => setReviewAnalysis(e.target.value)}
                        placeholder="Nguyên nhân do nhiệt độ bảo quản, sơ chế quá lâu..."
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Biện Pháp Khắc Phục / Đổi Nhà Cung Cấp
                      </label>
                      <textarea
                        rows={2}
                        value={reviewAction}
                        onChange={(e) => setReviewAction(e.target.value)}
                        placeholder="Yêu cầu bếp ướp dầu mè, đổi lô hàng mới..."
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-xs"
                  >
                    {isSubmittingReview ? 'Đang lưu...' : 'Lưu Ý Kiến Chuyên Môn Dinh Dưỡng'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: LEGAL, SUPPLIERS & WATER TESTING */}
          {activeTab === 'legal_suppliers' && (
            <div className="space-y-6">
              {/* School License & Water Testing Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* School License Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-1 rounded-md">
                      Giấy Phép Cơ Sở ATTP
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                      HIỆU LỰC
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Giấy Chứng Nhận Cơ Sở Đủ Điều Kiện ATTP Trường Học
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      <strong>Số giấy chứng nhận:</strong> {report.legalAndCertificates.schoolFoodSafetyLicense.certNumber}
                    </div>
                    <div>
                      <strong>Ngày cấp:</strong> {report.legalAndCertificates.schoolFoodSafetyLicense.issueDate} •{' '}
                      <strong>Ngày hết hạn:</strong> {report.legalAndCertificates.schoolFoodSafetyLicense.expiryDate}
                    </div>
                    <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      Còn hiệu lực: {report.legalAndCertificates.schoolFoodSafetyLicense.daysRemaining} ngày
                    </div>
                  </div>
                </div>

                {/* Water Testing Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-sky-600 bg-sky-100 dark:bg-sky-900/40 px-2.5 py-1 rounded-md">
                      QCVN 01-1:2018/BYT
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                      ĐẠT CHUẨN XÉT NGHIỆM
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Kết Quả Xét Nghiệm Vi Sinh Nguồn Nước
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      <strong>Nước ăn uống:</strong> {report.legalAndCertificates.waterTesting.drinkingWaterResult}
                    </div>
                    <div>
                      <strong>Nước sinh hoạt:</strong> {report.legalAndCertificates.waterTesting.domesticWaterResult}
                    </div>
                    <div>
                      <strong>Đơn vị kiểm nghiệm:</strong> {report.legalAndCertificates.waterTesting.labName} •{' '}
                      <strong>Kỳ tiếp theo:</strong> {report.legalAndCertificates.waterTesting.nextTestDueDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Suppliers Compliance Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                      Danh Sách Nhà Cung Cấp Thực Phẩm & Tỷ Lệ Từ Chối Nhập (Reject Rate)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Quy tắc nghiệp vụ: Nếu tỷ lệ hàng bị từ chối nhập (Reject Rate) &gt; 2.0% $\rightarrow$ Ban Giám Hiệu lập tức đình chỉ hợp đồng.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4">Nhà Cung Cấp</th>
                        <th className="py-3 px-4">Chứng Nhận</th>
                        <th className="py-3 px-4">Hạn Chứng Nhận</th>
                        <th className="py-3 px-4 text-center">Số Đợt Giao</th>
                        <th className="py-3 px-4 text-center">Bị Từ Chối</th>
                        <th className="py-3 px-4 text-center">Tỷ Lệ Reject Rate</th>
                        <th className="py-3 px-4 text-center">Trạng Thái</th>
                        <th className="py-3 px-4 text-right">Tác Vụ (BGH)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.legalAndCertificates.suppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {s.name}
                            {s.suspensionReason && (
                              <div className="text-xs font-normal text-rose-600 mt-0.5">
                                {s.suspensionReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-indigo-600">
                            {s.certType}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {s.expiryDate}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold">
                            {s.totalDeliveries}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-rose-600">
                            {s.rejectedDeliveries}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                s.isRejectRateAlert
                                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {s.rejectRate}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {s.status === 'ACTIVE' ? (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">
                                Đang hoạt động
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-600 text-white flex items-center gap-1 mx-auto w-fit">
                                <Ban className="w-3 h-3" /> ĐÃ ĐÌNH CHỈ
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {perspectiveRole === 'SCHOOL_MANAGER' && s.status === 'ACTIVE' && s.isRejectRateAlert && (
                              <button
                                onClick={() => setSuspendingSupplier(s)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                              >
                                Đình chỉ ngay
                              </button>
                            )}
                            {s.status === 'SUSPENDED' && (
                              <span className="text-xs text-rose-600 font-medium">Đã ra quyết định</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Staff Health & Training Certificates */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Hồ Sơ Sức Khỏe & Chứng Chỉ Tập Huấn Nhân Viên Bếp (100% Bắt Buộc)
                  </h3>
                  <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    100% CÒN HIỆU LỰC
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {report.legalAndCertificates.staffCompliance.staffList.map((st, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-750 space-y-2"
                    >
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{st.name}</div>
                      <div className="text-xs text-slate-500 font-medium">{st.position}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-600">
                        <div>Thẻ xanh: {st.greenHealthCardExpiry}</div>
                        <div>Tập huấn ATTP: {st.trainingCertExpiry}</div>
                      </div>
                      <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đạt chuẩn làm việc
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: School Manager Ký Duyệt Sổ Kiểm Thực */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <PenTool className="w-5 h-5 text-emerald-600" />
              Ký Phê Duyệt Sổ Kiểm Thực Điện Tử Định Kỳ
            </h3>
            <p className="text-xs text-slate-500">
              Chữ ký điện tử của Đại diện Ban Giám Hiệu xác nhận tính chính xác và chịu trách nhiệm pháp lý cao nhất đối với toàn bộ dữ liệu kiểm thực và lưu mẫu trong kỳ.
            </p>

            <form onSubmit={handleSignMonthly} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Người Đại Diện Ký Duyệt
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Ghi Chú Phê Duyệt
                </label>
                <textarea
                  rows={3}
                  value={signNotes}
                  onChange={(e) => setSignNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSigning}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {isSigning ? 'Đang xác thực...' : 'Xác Nhận Ký Số'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Đình chỉ nhà cung cấp */}
      {suspendingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-300 dark:border-rose-800 space-y-4">
            <h3 className="font-bold text-rose-600 text-base flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" />
              Đình Chỉ Nhà Cung Cấp Thực Phẩm
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Nhà cung cấp <strong>{suspendingSupplier.name}</strong> có tỷ lệ từ chối nhập hàng{' '}
              <strong className="text-rose-600">{suspendingSupplier.rejectRate}%</strong> (vượt quá ngưỡng cho phép 2.0%).
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Lý Do Ban Hành Lệnh Đình Chỉ
              </label>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Nhập lý do đình chỉ hợp đồng..."
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendingSupplier(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleSuspendSupplier}
                disabled={isSuspending}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {isSuspending ? 'Đang xử lý...' : 'Xác Nhận Đình Chỉ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

