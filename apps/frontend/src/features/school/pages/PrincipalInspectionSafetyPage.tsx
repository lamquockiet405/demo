import { downloadReportExcel } from '../../../core/utils/excel-export';
import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  FileCheck2,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Layers,
  Camera,
  Check,
  X,
  Thermometer,
  ClipboardCheck,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { foodSafetyApi } from "../../food-safety/api/food-safety.api";
import { downloadExcel, newestFirst, rowsOf } from "../../kitchen/utils/kitchen-operations";
import { normalizeSearch } from "../../kitchen/utils/kds-data";
import { schoolDate } from "../../menus/utils/published-menus";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";
import {
  Feedback,
  useSchoolResource,
  useSchoolAction,
} from "../components/SchoolUI";
import { InspectionDetail } from "../../kitchen/pages/KitchenInspectionsPage";

export function PrincipalInspectionSafetyPage() {
  useLanguage();
  const schoolBranding = useSchoolBranding();
  const retentionHours = schoolBranding.operationalSettings?.foodRetentionHours || 24;
  const [schoolName] = useState(
    () => localStorage.getItem("school_name") || "KidMeal"
  );

  const [activeTab, setActiveTab] = useState<"inspections" | "safety">("inspections");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  // Date cho báo cáo an toàn thực phẩm
  const [reportDate, setReportDate] = useState(schoolDate);

  // 1. Tải danh sách kiểm thực 3 bước
  const inspectionsResource = useSchoolResource(
    async () => newestFirst(rowsOf((await apiClient.get("/inspections")).data)),
    [],
  );

  // 2. Tải báo cáo an toàn thực phẩm
  const safetyResource = useSchoolResource(
    () => foodSafetyApi.getComplianceReport(reportDate),
    [reportDate],
  );

  const action = useSchoolAction();
  const rawInspections: any[] = inspectionsResource.error
    ? []
    : newestFirst(inspectionsResource.data || []);
  const safetyReport = safetyResource.error ? null : safetyResource.data;

  // Lọc danh sách kiểm thực
  const filteredInspections = useMemo(() => {
    return rawInspections.filter((r) => {
      const matchDate = !date || (r.mealDate || r.date) === date;
      const matchStatus = !status || r.approvalStatus === status;
      const matchSearch =
        !search ||
        normalizeSearch(
          `${r.code || ""} ${r.performerName || ""} ${(r.dishes || []).join(" ")}`,
        ).includes(normalizeSearch(search));
      return matchDate && matchStatus && matchSearch;
    });
  }, [rawInspections, date, status, search]);

  // Thống kê nhanh
  const totalInspections = rawInspections.length;
  const pendingCount = rawInspections.filter((r) => r.approvalStatus === "CHO_DUYET").length;
  const approvedCount = rawInspections.filter((r) => r.approvalStatus === "DA_DUYET").length;
  const sampleCount = safetyReport?.sampleRetention24h?.totalSamplesStored ?? 0;

  // Xuất Excel biên bản kiểm thực
  const exportInspectionsExcel = () => {
    downloadExcel("nhat-ky-kiem-thuc-3-buoc.xlsx", [
      [
        "Mã biên bản",
        "Ngày kiểm thực",
        "Bữa ăn",
        "Người kiểm",
        "Bước 1 (Nhập kho)",
        "Bước 2 (Chế biến)",
        "Bước 3 (Trước ăn)",
        "Trạng thái duyệt",
      ],
      ...filteredInspections.map((r) => [
        r.code,
        r.mealDate || r.date,
        r.mealTime,
        r.performerName,
        r.step1Status,
        r.step2Status,
        r.step3Status,
        r.approvalStatusLabel || r.approvalStatus || r.status,
      ]),
    ]);
  };

  // Xuất Excel an toàn thực phẩm
  const exportSafetyDossier = () =>
    action.run(async () => {
      const data = await foodSafetyApi.exportComplianceDossier(reportDate);
      if (!await downloadReportExcel(`ho-so-an-toan-thuc-pham-${reportDate}.xlsx`, 'Hồ sơ an toàn thực phẩm', data)) throw new Error('Chưa xuất được hồ sơ Excel.');
    }, "Đã xuất hồ sơ tuân thủ an toàn thực phẩm.");

  const getStatusBadge = (approvalStatus: string) => {
    switch (approvalStatus) {
      case "DA_DUYET":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {translateText("Đã duyệt")}
          </span>
        );
      case "CHO_DUYET":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            {translateText("Chờ duyệt")}
          </span>
        );
      case "YEU_CAU_CHUP_LAI":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            {translateText("Yêu cầu bổ sung")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {translateText(approvalStatus || "Chưa xác định")}
          </span>
        );
    }
  };

  const getStepStatusPill = (statusText?: string) => {
    if (statusText === "Đạt chuẩn") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3 h-3 text-emerald-600" />
          {translateText("Đạt")}
        </span>
      );
    }
    if (statusText === "Không đạt") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <X className="w-3 h-3 text-rose-600" />
          {translateText("Không đạt")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
        {translateText(statusText || "Chưa thực hiện")}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6">
      <Feedback error={action.error} message={action.message} />

      {/* ─── 2. Top KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng biên bản */}
        <div
          onClick={() => {
            setStatus("");
            setSearch("");
            setDate("");
          }}
          className={`bg-white rounded-2xl border p-4 shadow-xs space-y-1 cursor-pointer transition hover:border-teal-400 ${
            status === "" ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{translateText("Tổng biên bản")}</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalInspections}</div>
          <p className="text-[11px] text-slate-400">{translateText("Tất cả biên bản trong hệ thống")}</p>
        </div>

        {/* Card 2: Chờ BGH duyệt */}
        <div
          onClick={() => setStatus("CHO_DUYET")}
          className={`bg-white rounded-2xl border p-4 shadow-xs space-y-1 cursor-pointer transition hover:border-amber-400 ${
            status === "CHO_DUYET" ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold">{translateText("Chờ BGH duyệt")}</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700">{pendingCount}</div>
          <p className="text-[11px] text-amber-600 font-bold">
            {translateText(pendingCount > 0 ? "Cần kiểm tra minh chứng ngay" : "Tất cả đã được xử lý")}
          </p>
        </div>

        {/* Card 3: Biên bản đã duyệt */}
        <div
          onClick={() => setStatus("DA_DUYET")}
          className={`bg-white rounded-2xl border p-4 shadow-xs space-y-1 cursor-pointer transition hover:border-emerald-400 ${
            status === "DA_DUYET" ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold">{translateText("Biên bản đã duyệt")}</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700">{approvedCount}</div>
          <p className="text-[11px] text-emerald-600 font-bold">{translateText("Đạt chuẩn 3 bước & lưu trữ")}</p>
        </div>

        {/* Card 4: Mẫu lưu thực phẩm 24h */}
        <div
          onClick={() => setActiveTab("safety")}
          className={`bg-white rounded-2xl border p-4 shadow-xs space-y-1 cursor-pointer transition hover:border-blue-400 ${
            activeTab === "safety" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{translateText(`Mẫu lưu thực phẩm ${retentionHours}h`)}</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Thermometer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{sampleCount}</div>
          <p className="text-[11px] text-slate-400">{translateText("Xem báo cáo & ảnh đối chiếu")}</p>
        </div>
      </div>

      {/* ─── 3. Tab Chuyển Đổi Hợp Nhất ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab("inspections")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "inspections"
              ? "bg-teal-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>{translateText("Phê Duyệt Kiểm Thực 3 Bước")}</span>
          {pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
              {pendingCount}
            </span>
          )}
        </button>

      </div>

      {/* ─── 4. Nội Dung Tab 1: Phê Duyệt Kiểm Thực 3 Bước ─── */}
      {activeTab === "inspections" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Header Bảng: Thanh tìm kiếm & bộ lọc */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                aria-label={translateText("Tìm biên bản")}
                type="text"
                placeholder={translateText("Tìm mã biên bản, người kiểm, tên món…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  aria-label={translateText("Ngày kiểm thực")}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <select
                aria-label={translateText("Trạng thái phê duyệt")}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{translateText("Tất cả trạng thái")}</option>
                <option value="CHO_DUYET">{translateText("Chờ duyệt (Pending)")}</option>
                <option value="DA_DUYET">{translateText("Đã duyệt (Approved)")}</option>
                <option value="YEU_CAU_CHUP_LAI">{translateText("Yêu cầu bổ sung")}</option>
              </select>

              <button
                onClick={() => {
                  void inspectionsResource.reload();
                  void safetyResource.reload();
                }}
                disabled={inspectionsResource.loading || safetyResource.loading}
                className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title={translateText("Làm mới dữ liệu")}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    inspectionsResource.loading || safetyResource.loading ? "animate-spin text-teal-600" : ""
                  }`}
                />
              </button>

              <button
                onClick={exportInspectionsExcel}
                disabled={!filteredInspections.length}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>{translateText("Xuất Nhật Ký")}</span>
              </button>

              {(search || date || status) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDate("");
                    setStatus("");
                  }}
                  className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{translateText("Xóa bộ lọc")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Bảng Dữ Liệu */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                <tr>
                  <th className="p-4">{translateText("Mã Biên Bản")}</th>
                  <th className="p-4">{translateText("Ngày / Bữa Ăn")}</th>
                  <th className="p-4">{translateText("Người Kiểm")}</th>
                  <th className="p-4 text-center">{translateText("Bước 1: Nhập Kho")}</th>
                  <th className="p-4 text-center">{translateText("Bước 2: Chế Biến")}</th>
                  <th className="p-4 text-center">{translateText("Bước 3: Trước Ăn")}</th>
                  <th className="p-4 text-center">{translateText("Trạng Thái")}</th>
                  <th className="p-4 text-right">{translateText("Thao Tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspectionsResource.loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                      <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mx-auto mb-2" />
                      {translateText("Đang tải dữ liệu kiểm thực...")}
                    </td>
                  </tr>
                ) : filteredInspections.length > 0 ? (
                  filteredInspections.map((r) => {
                    const idStr = String(r.id || "");
                    return (
                      <tr key={r.id} className="hover:bg-teal-50/20 transition">
                        <td className="p-4 font-mono font-bold text-slate-900">
                          {translateText(r.code)}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">
                            {translateText(r.mealDate || r.date)}
                          </div>
                          <div className="text-[11px] text-slate-500">{translateText(r.mealTime)}</div>
                        </td>
                        <td className="p-4 text-slate-700 font-medium">
                          {r.performerName || translateText("Bếp trưởng")}
                        </td>
                        <td className="p-4 text-center">
                          {getStepStatusPill(r.step1Status)}
                        </td>
                        <td className="p-4 text-center">
                          {getStepStatusPill(r.step2Status)}
                        </td>
                        <td className="p-4 text-center">
                          {getStepStatusPill(r.step3Status)}
                        </td>
                        <td className="p-4 text-center">
                          {getStatusBadge(r.approvalStatus)}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setSelectedInspectionId(idStr)}
                            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-black transition inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{translateText("Xem & Duyệt")}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400">
                          <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 text-sm">
                            {translateText("Không tìm thấy biên bản kiểm thực")}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {translateText(
                              status === "CHO_DUYET"
                                ? "Hiện không có biên bản nào đang chờ BGH duyệt. Bạn có thể chọn xem tất cả biên bản đã ghi nhận."
                                : "Không có dữ liệu phù hợp với bộ lọc tìm kiếm hiện tại."
                            )}
                          </p>
                        </div>
                        {(search || date || status) && (
                          <button
                            onClick={() => {
                              setSearch("");
                              setDate("");
                              setStatus("");
                            }}
                            className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl transition cursor-pointer"
                          >
                            {translateText("Xem tất cả biên bản")} ({totalInspections})
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 5. Nội Dung Tab 2: Báo Cáo An Toàn & Minh Chứng Thực Tế ─── */}
      {activeTab === "safety" && (
        <div className="space-y-6">
          {/* Date Picker Bar */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-teal-600 shrink-0" />
              <label className="text-xs font-bold text-slate-700">
                {translateText("Chọn ngày kiểm thực để đối chiếu hồ sơ:")}
              </label>
              <input
                aria-label={translateText("Ngày kiểm thực")}
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{translateText("Chỉ số tuân thủ chung:")}</span>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                {safetyReport?.overallComplianceRate ?? 100}%
              </span>
            </div>
          </div>

          <Feedback error={safetyResource.error} />

          {/* Minh chứng ảnh thực tế */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-teal-600" />
              <span>{translateText("Ảnh Minh Chứng Kiểm Thực Ngày ")}{translateText(reportDate)}</span>
            </h3>

            {safetyReport?.inspection3Step?.photoAuditTrail?.samplePhotos?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {safetyReport.inspection3Step.photoAuditTrail.samplePhotos.map(
                  (photo: any, index: number) => (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 space-y-2 p-3 shadow-xs"
                    >
                      <div className="h-44 bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center">
                        <img
                          src={photo.imageUrl}
                          alt={translateText(photo.title || "Minh chứng")}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{translateText(photo.step)}</span>
                        <span className="text-slate-500 text-[11px]">{translateText(photo.title)}</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                {translateText("Chưa có ảnh minh chứng kiểm thực cho ngày ")}{translateText(reportDate)}.
              </div>
            )}
          </div>

          {/* Danh mục mẫu lưu thực phẩm 24h */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-teal-600" />
              <span>{translateText(`Danh Sách Mẫu Lưu Thực Phẩm ${retentionHours} Giờ Ngày `)}{translateText(reportDate)}</span>
            </h3>

            {safetyReport?.sampleRetention24h?.samples?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                    <tr>
                      <th className="p-3">{translateText("Mã Mẫu")}</th>
                      <th className="p-3">{translateText("Tên Món Ăn")}</th>
                      <th className="p-3 text-center">{translateText("Khối Lượng / Thể Tích")}</th>
                      <th className="p-3 text-center">{translateText("Thời Gian Lưu")}</th>
                      <th className="p-3 text-center">{translateText("Thời Gian Hủy")}</th>
                      <th className="p-3 text-center">{translateText("Trạng Thái")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {safetyReport.sampleRetention24h.samples.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {s.sampleCode}
                        </td>
                        <td className="p-3 font-bold text-slate-800">{s.dishName}</td>
                        <td className="p-3 text-center font-medium">
                          {translateText(s.weightOrVolume)}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {translateText(s.storedAt?.slice(0, 16) || "—")}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {translateText(s.disposeAt?.slice(0, 16) || "—")}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            {translateText(s.status || "Đang lưu")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                {translateText("Chưa có mẫu lưu thực phẩm được ghi nhận cho ngày ")}{translateText(reportDate)}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 6. Modal Phê Duyệt Chi Tiết Kiểm Thực 3 Bước ─── */}
      {selectedInspectionId && (
        <InspectionDetail
          id={selectedInspectionId}
          onClose={() => setSelectedInspectionId(null)}
          onSaved={async () => {
            await inspectionsResource.reload();
            await safetyResource.reload();
          }}
          mode="review"
        />
      )}
    </div>
  );
}
