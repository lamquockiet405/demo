import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { growthApi } from "../../growth/api/growth.api";
import { growthDispatchApi } from "../../growth/api/growth-dispatch.api";
import { WhoGrowthChart } from "../../growth/components/WhoGrowthChart";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import { downloadExcel } from "../../kitchen/utils/kitchen-operations";
import {
  HeartPulse,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Download,
  Users,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Calendar,
  X,
  Activity,
  Layers,
  ChevronRight,
  TrendingDown,
} from "lucide-react";
import {
  Feedback,
  State,
  useSchoolResource,
  useSchoolAction,
} from "../components/SchoolUI";

const statusLabelMap: Record<string, { label: string; color: string }> = {
  NORMAL: { label: "Bình thường", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  UNDERWEIGHT: { label: "Nhẹ cân", color: "bg-amber-100 text-amber-800 border-amber-200" },
  STUNTED: { label: "Thấp còi", color: "bg-rose-100 text-rose-800 border-rose-200" },
  OVERWEIGHT: { label: "Thừa cân", color: "bg-purple-100 text-purple-800 border-purple-200" },
  OBESE: { label: "Béo phì", color: "bg-purple-200 text-purple-900 border-purple-300" },
  WASTED: { label: "Gầy còm", color: "bg-rose-100 text-rose-800 border-rose-200" },
  SEVERELY_UNDERWEIGHT: { label: "Nhẹ cân nặng", color: "bg-rose-200 text-rose-900 border-rose-300" },
  SEVERELY_STUNTED: { label: "Thấp còi nặng", color: "bg-rose-200 text-rose-900 border-rose-300" },
  SEVERELY_WASTED: { label: "Gầy còm nặng", color: "bg-rose-200 text-rose-900 border-rose-300" },
};

export function PrincipalGrowthPage() {
  useLanguage();
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [selectedChildName, setSelectedChildName] = useState<string>("");

  const resource = useSchoolResource(
    () =>
      fetchKitchenCollection("/growth", {
        search,
        classId: classId || undefined,
        nutritionalStatus: status || undefined,
      }),
    [search, classId, status],
  );

  const classes = useSchoolResource(
    () => fetchKitchenCollection("/classes"),
    [],
  );

  const history = useSchoolResource(
    () =>
      selectedChildId
        ? growthApi.getChildHistory(selectedChildId)
        : Promise.resolve(null),
    [selectedChildId],
  );

  const action = useSchoolAction();
  const rows: any[] = resource.error ? [] : resource.data || [];

  // Tính toán nhanh số liệu KPI
  const totalRecords = rows.length;
  const normalCount = rows.filter((r) => r.overallNutritionalStatus === "NORMAL").length;
  const underweightCount = rows.filter(
    (r) =>
      r.overallNutritionalStatus === "UNDERWEIGHT" ||
      r.overallNutritionalStatus === "SEVERELY_UNDERWEIGHT" ||
      r.overallNutritionalStatus === "WASTED" ||
      r.overallNutritionalStatus === "SEVERELY_WASTED",
  ).length;
  const stuntedCount = rows.filter(
    (r) =>
      r.overallNutritionalStatus === "STUNTED" ||
      r.overallNutritionalStatus === "SEVERELY_STUNTED",
  ).length;
  const overweightCount = rows.filter(
    (r) =>
      r.overallNutritionalStatus === "OVERWEIGHT" ||
      r.overallNutritionalStatus === "OBESE",
  ).length;

  const exportReport = () =>
    action.run(async () => {
      const report = await growthApi.exportReport(classId || undefined);
      const exported = await downloadExcel("bao-cao-the-chat-who.xlsx", [
        [
          "Mã học sinh",
          "Họ tên",
          "Lớp",
          "Ngày đo",
          "Cân nặng (kg)",
          "Chiều cao (cm)",
          "BMI",
          "WAZ",
          "HAZ",
          "BAZ",
          "Phân loại thể trạng",
        ],
        ...report.items.map((r: any) => [
          r.studentCode,
          r.childName,
          r.className,
          r.measurementDate,
          r.weightKg,
          r.heightCm,
          r.bmi,
          r.waz,
          r.haz,
          r.baz,
          r.overallStatus,
        ]),
      ], 'Báo cáo phát triển thể chất WHO');
      if (!exported) throw new Error('Chưa xuất được báo cáo Excel.');
    }, "Đã xuất báo cáo phát triển thể chất.");

  const openChartModal = (childIdToView: string, childName: string) => {
    setSelectedChildId(childIdToView);
    setSelectedChildName(childName);
  };

  const closeChartModal = () => {
    setSelectedChildId("");
    setSelectedChildName("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── 1. Header Banner ─── */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">{translateText("Ban Giám Hiệu • Y Tế & Thể Chất")}</span>
            <span className="text-xs text-teal-200">{translateText("Chuẩn WHO LMS Growth Curves")}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <HeartPulse className="w-8 h-8 text-amber-300" />{translateText("Dữ Liệu Thể Chất Học Sinh & Biểu Đồ Tăng Trưởng WHO")}</h1>
          <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">{translateText("Theo dõi kết quả cân đo định kỳ, phân loại thể trạng theo chuẩn WHO và bấm ")}<strong>{translateText("\"Xem biểu đồ\"")}</strong>{translateText(" để kiểm tra đường cong tăng trưởng chi tiết từng học sinh.")}</p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => void resource.reload()}
            disabled={resource.loading}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${resource.loading ? "animate-spin" : ""}`} />{translateText("Làm mới")}</button>
          <button
            onClick={() => void exportReport()}
            disabled={action.busy}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />{translateText("Xuất Báo Cáo")}</button>
        </div>
      </div>

      <Feedback error={action.error || classes.error} message={action.message} />

      {/* ─── 2. KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{translateText("Tổng hồ sơ đo")}</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalRecords}</div>
          <p className="text-[11px] text-slate-400">{translateText("Đã cập nhật số đo")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold">{translateText("Bình thường (Chuẩn)")}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{normalCount}</div>
          <p className="text-[11px] text-emerald-600 font-bold">
            {totalRecords > 0 ? Math.round((normalCount / totalRecords) * 100) : 0}{translateText("% học sinh")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/20 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold">{translateText("Nhẹ cân / Gầy còm")}</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{underweightCount}</div>
          <p className="text-[11px] text-amber-600 font-bold">
            {totalRecords > 0 ? Math.round((underweightCount / totalRecords) * 100) : 0}{translateText("% cần bồi dưỡng")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-rose-200 bg-rose-50/20 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-xs font-bold">{translateText("Thấp còi")}</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">{stuntedCount}</div>
          <p className="text-[11px] text-rose-600 font-bold">
            {totalRecords > 0 ? Math.round((stuntedCount / totalRecords) * 100) : 0}{translateText("% cần can thiệp")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-purple-200 bg-purple-50/20 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-purple-800">
            <span className="text-xs font-bold">{translateText("Thừa cân / Béo phì")}</span>
            <Scale className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">{overweightCount}</div>
          <p className="text-[11px] text-purple-600 font-bold">
            {totalRecords > 0 ? Math.round((overweightCount / totalRecords) * 100) : 0}{translateText("% kiểm soát calo")}</p>
        </div>
      </div>

      {/* ─── 3. Search & Filter Bar ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            aria-label={translateText("Tìm dữ liệu thể chất")}
            type="text"
            placeholder={translateText("Tìm theo tên học sinh, mã học sinh…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            aria-label={translateText("Lớp")}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{translateText("Tất cả các lớp")}</option>
            {(classes.data || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label={translateText("Phân loại thể chất")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{translateText("Tất cả phân loại thể chất")}</option>
            <option value="NORMAL">{translateText("Bình thường (NORMAL)")}</option>
            <option value="UNDERWEIGHT">{translateText("Nhẹ cân (UNDERWEIGHT)")}</option>
            <option value="STUNTED">{translateText("Thấp còi (STUNTED)")}</option>
            <option value="OVERWEIGHT">{translateText("Thừa cân (OVERWEIGHT)")}</option>
            <option value="OBESE">{translateText("Béo phì (OBESE)")}</option>
            <option value="WASTED">{translateText("Gầy còm (WASTED)")}</option>
            <option value="SEVERELY_UNDERWEIGHT">{translateText("Nhẹ cân nặng (SEVERELY_UNDERWEIGHT)")}</option>
            <option value="SEVERELY_STUNTED">{translateText("Thấp còi nặng (SEVERELY_STUNTED)")}</option>
          </select>
        </div>
      </div>

      <State resource={resource} empty={!rows.length} />

      {/* ─── 4. Data Table ─── */}
      {!!rows.length && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />{translateText("Danh Sách Kết Quả Cân Đo Định Kỳ")}</h3>
            <span className="text-xs text-slate-500">{translateText("Bấm nút ")}<strong className="text-teal-700">{translateText("\"Xem biểu đồ\"")}</strong>{translateText(" để mở đồ thị WHO chi tiết")}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                <tr>
                  <th className="p-4">{translateText("Học Sinh")}</th>
                  <th className="p-4">{translateText("Lớp")}</th>
                  <th className="p-4">{translateText("Ngày Đo")}</th>
                  <th className="p-4 text-center">{translateText("Cân Nặng (kg)")}</th>
                  <th className="p-4 text-center">{translateText("Chiều Cao (cm)")}</th>
                  <th className="p-4 text-center">{translateText("BMI")}</th>
                  <th className="p-4 text-center">{translateText("Phân Loại Thể Trạng")}</th>
                  <th className="p-4 text-right">{translateText("Biểu Đồ Tăng Trưởng")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const statusInfo = statusLabelMap[r.overallNutritionalStatus] || {
                    label: r.overallNutritionalStatus || translateText("Chưa đánh giá"),
                    color: "bg-slate-100 text-slate-700 border-slate-200",
                  };
                  const childIdStr = String(r.childId || r.child?.id || "");
                  const childFullName = r.child?.fullName || translateText("Học sinh");

                  return (
                    <tr key={r.id} className="hover:bg-teal-50/20 transition">
                      <td className="p-4">
                        <div className="font-black text-slate-900 text-sm">{r.child?.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{r.child?.studentCode}</div>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        {r.child?.class?.name || "—"}
                      </td>
                      <td className="p-4 text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {translateText(r.measurementDate?.slice(0, 10) || "—")}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 text-sm">
                        {translateText(r.weightKg != null ? `${r.weightKg} kg` : "—")}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 text-sm">
                        {translateText(r.heightCm != null ? `${r.heightCm} cm` : "—")}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 text-sm">
                        {translateText(r.bmi != null ? r.bmi : "—")}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-[11px] font-black border ${statusInfo.color}`}
                        >
                          {translateText(statusInfo.label)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openChartModal(childIdStr, childFullName)}
                          className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-amber-300" />{translateText("Xem biểu đồ")}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 5. MODAL BIỂU ĐỒ THỂ CHẤT WHO NỔI BẬT (CHÍNH GIỮA MÀN HÌNH) ─── */}
      {selectedChildId && (
        <div
          className="fixed !m-0 inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={closeChartModal}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-teal-50 via-emerald-50 to-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <HeartPulse className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 uppercase tracking-wider">{translateText("Biểu Đồ Chuẩn WHO")}</span>
                    <span className="text-xs text-slate-500">{translateText("Mã: ")}<strong>{history.data?.child?.studentCode || "—"}</strong>
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-xl">
                    {history.data?.child?.fullName || selectedChildName}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={closeChartModal}
                className="rounded-2xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Thống kê đo đạc gần nhất */}
              {history.data?.latest && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">{translateText("Cân nặng gần nhất")}</span>
                    <strong className="text-slate-900 text-base font-black">
                      {translateText(history.data.latest.weightKg)}{translateText(" kg")}</strong>
                    <span className="text-[10px] text-slate-500 block">{translateText("WAZ: ")}{translateText(history.data.latest.waz ?? "—")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">{translateText("Chiều cao gần nhất")}</span>
                    <strong className="text-slate-900 text-base font-black">
                      {translateText(history.data.latest.heightCm)}{translateText(" cm")}</strong>
                    <span className="text-[10px] text-slate-500 block">{translateText("HAZ: ")}{translateText(history.data.latest.haz ?? "—")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">{translateText("Chỉ số BMI")}</span>
                    <strong className="text-slate-900 text-base font-black">
                      {translateText(history.data.latest.bmi)}{translateText(" kg/m²")}</strong>
                    <span className="text-[10px] text-slate-500 block">{translateText("BAZ: ")}{translateText(history.data.latest.baz ?? "—")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">{translateText("Đánh giá thể trạng")}</span>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-black mt-1 ${
                        history.data.latest.overallNutritionalStatus === "NORMAL"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {translateText(statusLabelMap[history.data.latest.overallNutritionalStatus]?.label ||
                        history.data.latest.overallNutritionalStatus)}
                    </span>
                  </div>
                </div>
              )}

              {/* Component Biểu đồ WhoGrowthChart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <State resource={history} />
                {history.data && !history.error && (
                  <WhoGrowthChart
                    child={history.data.child}
                    history={history.data.history}
                    defaultMetric="BMI"
                  />
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">{translateText("Đường cong tham chiếu LMS chuẩn Tổ chức Y tế Thế giới (WHO Child Growth Standards)")}</span>
              <button
                type="button"
                onClick={closeChartModal}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >{translateText("Đóng biểu đồ")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
