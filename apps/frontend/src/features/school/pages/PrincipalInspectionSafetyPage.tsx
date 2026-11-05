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
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { foodSafetyApi } from "../../food-safety/api/food-safety.api";
import { downloadCsv, rowsOf } from "../../kitchen/utils/kitchen-operations";
import { normalizeSearch } from "../../kitchen/utils/kds-data";
import { schoolDate } from "../../menus/utils/published-menus";
import {
  Feedback,
  State,
  useSchoolResource,
  useSchoolAction,
} from "../components/SchoolUI";
import { InspectionDetail } from "../../kitchen/pages/KitchenInspectionsPage";

export function PrincipalInspectionSafetyPage() {
  const [activeTab, setActiveTab] = useState<"inspections" | "safety">("inspections");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("CHO_DUYET");
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  // Date cho báo cáo an toàn thực phẩm
  const [reportDate, setReportDate] = useState(schoolDate);

  // 1. Tải danh sách kiểm thực 3 bước
  const inspectionsResource = useSchoolResource(
    async () => rowsOf((await apiClient.get("/inspections")).data),
    [],
  );

  // 2. Tải báo cáo an toàn thực phẩm
  const safetyResource = useSchoolResource(
    () => foodSafetyApi.getComplianceReport(reportDate),
    [reportDate],
  );

  const action = useSchoolAction();
  const rawInspections: any[] = inspectionsResource.error ? [] : inspectionsResource.data || [];
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

  // Xuất CSV biên bản kiểm thực
  const exportInspectionsCsv = () => {
    downloadCsv("nhat-ky-kiem-thuc-3-buoc.csv", [
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

  // Xuất báo cáo an toàn thực phẩm JSON
  const exportSafetyDossier = () =>
    action.run(async () => {
      const data = await foodSafetyApi.exportComplianceDossier(reportDate);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `ho-so-an-toan-thuc-pham-${reportDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }, "Đã xuất hồ sơ tuân thủ an toàn thực phẩm.");

  const getStatusBadge = (approvalStatus: string) => {
    switch (approvalStatus) {
      case "DA_DUYET":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Đã duyệt
          </span>
        );
      case "CHO_DUYET":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Chờ duyệt
          </span>
        );
      case "YEU_CAU_CHUP_LAI":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Yêu cầu bổ sung
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {approvalStatus || "Chưa xác định"}
          </span>
        );
    }
  };

  const getStepStatusPill = (statusText?: string) => {
    if (statusText === "Đạt chuẩn") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3 h-3 text-emerald-600" />
          Đạt
        </span>
      );
    }
    if (statusText === "Không đạt") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <X className="w-3 h-3 text-rose-600" />
          Không đạt
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
        {statusText || "Chưa thực hiện"}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── 1. Header Banner Hợp Nhất ─── */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
              Ban Giám Hiệu • Quản Lý Bếp & ATTP
            </span>
            <span className="text-xs text-teal-200">Chuẩn Bộ Y Tế & Codex</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-8 h-8 text-amber-300" />
            Kiểm Thực 3 Bước & An Toàn Thực Phẩm
          </h1>
          <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
            Hợp nhất quy trình phê duyệt minh chứng kiểm thực bếp (trước, trong chế biến, trước ăn) và tra cứu hồ sơ tuân thủ an toàn thực phẩm, mẫu lưu 24h.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => {
              void inspectionsResource.reload();
              void safetyResource.reload();
            }}
            disabled={inspectionsResource.loading || safetyResource.loading}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm transition flex items-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                inspectionsResource.loading || safetyResource.loading ? "animate-spin" : ""
              }`}
            />
            Làm mới
          </button>
          {activeTab === "inspections" ? (
            <button
              onClick={exportInspectionsCsv}
              disabled={!filteredInspections.length}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Xuất Nhật Ký Kiểm Thực
            </button>
          ) : (
            <button
              onClick={() => void exportSafetyDossier()}
              disabled={action.busy || !safetyReport}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Xuất Báo Cáo ATTP
            </button>
          )}
        </div>
      </div>

      <Feedback error={action.error} message={action.message} />

      {/* ─── 2. Top KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tổng biên bản</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalInspections}</div>
          <p className="text-[11px] text-slate-400">Đã ghi nhận trong hệ thống</p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/20 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold">Chờ BGH duyệt</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{pendingCount}</div>
          <p className="text-[11px] text-amber-600 font-bold">
            {pendingCount > 0 ? "Cần kiểm tra minh chứng ngay" : "Tất cả đã được xử lý"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold">Biên bản đã duyệt</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{approvedCount}</div>
          <p className="text-[11px] text-emerald-600 font-bold">
            Đạt chuẩn 3 bước & lưu trữ
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Mẫu lưu thực phẩm 24h</span>
            <Thermometer className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{sampleCount}</div>
          <p className="text-[11px] text-slate-400">Ghi nhận theo ngày kiểm</p>
        </div>
      </div>

      {/* ─── 3. Tab Chuyển Đổi Hợp Nhất ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1">
        <button
          onClick={() => setActiveTab("inspections")}
          className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "inspections"
              ? "bg-teal-600 text-white shadow-md shadow-teal-600/25"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Phê Duyệt Kiểm Thực 3 Bước
          {pendingCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("safety")}
          className={`px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "safety"
              ? "bg-teal-600 text-white shadow-md shadow-teal-600/25"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Báo Cáo An Toàn & Minh Chứng Thực Tế
        </button>
      </div>

      {/* ─── 4. Nội Dung Tab 1: Phê Duyệt Kiểm Thực 3 Bước ─── */}
      {activeTab === "inspections" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                aria-label="Tìm biên bản"
                type="text"
                placeholder="Tìm mã biên bản, người kiểm, tên món…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                aria-label="Ngày kiểm thực"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              <select
                aria-label="Trạng thái phê duyệt"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="CHO_DUYET">Chờ duyệt (Pending)</option>
                <option value="DA_DUYET">Đã duyệt (Approved)</option>
                <option value="YEU_CAU_CHUP_LAI">Yêu cầu bổ sung</option>
              </select>

              {(search || date || status) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDate("");
                    setStatus("");
                  }}
                  className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>

          <State resource={inspectionsResource} empty={!filteredInspections.length} />

          {/* Table */}
          {!!filteredInspections.length && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                    <tr>
                      <th className="p-4">Mã Biên Bản</th>
                      <th className="p-4">Ngày / Bữa Ăn</th>
                      <th className="p-4">Người Kiểm</th>
                      <th className="p-4 text-center">Bước 1: Nhập Kho</th>
                      <th className="p-4 text-center">Bước 2: Chế Biến</th>
                      <th className="p-4 text-center">Bước 3: Trước Ăn</th>
                      <th className="p-4 text-center">Trạng Thái</th>
                      <th className="p-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInspections.map((r) => {
                      const idStr = String(r.id || "");
                      return (
                        <tr key={r.id} className="hover:bg-teal-50/20 transition">
                          <td className="p-4 font-mono font-bold text-slate-900">
                            {r.code}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-800">
                              {r.mealDate || r.date}
                            </div>
                            <div className="text-[11px] text-slate-500">{r.mealTime}</div>
                          </td>
                          <td className="p-4 text-slate-700 font-medium">
                            {r.performerName || "Bếp trưởng"}
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
                              Xem & Duyệt
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 5. Nội Dung Tab 2: Báo Cáo An Toàn & Minh Chứng Thực Tế ─── */}
      {activeTab === "safety" && (
        <div className="space-y-6">
          {/* Date Picker Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-teal-600" />
              <label className="text-xs font-bold text-slate-700">
                Chọn ngày kiểm thực để đối chiếu hồ sơ:
              </label>
              <input
                aria-label="Ngày kiểm thực"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <span className="text-xs text-slate-500">
              Chỉ số tuân thủ chung:{" "}
              <strong className="text-emerald-700 text-sm">
                {safetyReport?.overallComplianceRate ?? 100}%
              </strong>
            </span>
          </div>

          <State resource={safetyResource} />

          {/* Minh chứng ảnh thực tế */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-teal-600" />
              Ảnh Minh Chứng Kiểm Thực Ngày {reportDate}
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
                          alt={photo.title || "Minh chứng"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{photo.step}</span>
                        <span className="text-slate-500 text-[11px]">{photo.title}</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Chưa có ảnh minh chứng kiểm thực cho ngày {reportDate}.
              </div>
            )}
          </div>

          {/* Danh mục mẫu lưu thực phẩm 24h */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-teal-600" />
              Danh Sách Mẫu Lưu Thực Phẩm 24 Giờ Ngày {reportDate}
            </h3>

            {safetyReport?.sampleRetention24h?.samples?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                    <tr>
                      <th className="p-3">Mã Mẫu</th>
                      <th className="p-3">Tên Món Ăn</th>
                      <th className="p-3 text-center">Khối Lượng / Thể Tích</th>
                      <th className="p-3 text-center">Thời Gian Lưu</th>
                      <th className="p-3 text-center">Thời Gian Hủy</th>
                      <th className="p-3 text-center">Trạng Thái</th>
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
                          {s.weightOrVolume}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {s.storedAt?.slice(0, 16) || "—"}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {s.disposeAt?.slice(0, 16) || "—"}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            {s.status || "Đang lưu"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Chưa có mẫu lưu thực phẩm được ghi nhận cho ngày {reportDate}.
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

