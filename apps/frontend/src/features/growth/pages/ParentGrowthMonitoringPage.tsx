import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Baby,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ParentPortalTopNav } from "../../parent-evaluations/components/ParentPortalTopNav";
import { WhoGrowthChart } from "../components/WhoGrowthChart";
import { growthApi, GrowthRecordItem } from "../api/growth.api";
import { childrenApi, ChildItem } from "../../children/api/children.api";

export const ParentGrowthMonitoringPage: React.FC = () => {
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [selectedChild, setSelectedChild] = useState<ChildItem | null>(null);

  const [history, setHistory] = useState<GrowthRecordItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"chart" | "history">("chart");


  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await childrenApi.getChildren({ limit: 50 });
        const list = Array.isArray(res) ? res : res.items || [];
        setChildren(list);
        if (list.length > 0) {
          setSelectedChildId(String(list[0].id));
          setSelectedChild(list[0]);
        }
      } catch (err: any) {
        console.error("Lỗi khi tải danh sách con:", err);
        setError("Không thể tải danh sách học sinh của phụ huynh.");
      }
    };
    void fetchChildren();
  }, []);

  // 2. Tải dữ liệu thể chất & thông báo tăng trưởng của bé được chọn
  const loadChildGrowthData = useCallback(async (childId: string) => {
    if (!childId) return;
    setLoading(true);
    setError(null);
    try {
      const historyRes = await growthApi.getChildHistory(childId);

      const sortedHistory = (historyRes?.history || []).sort(
        (a, b) => new Date(a.measurementDate).getTime() - new Date(b.measurementDate).getTime(),
      );
      setHistory(sortedHistory);
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu thể chất:", err);
      setError("Không thể tải dữ liệu thể chất từ máy chủ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      const found = children.find((c) => String(c.id) === String(selectedChildId));
      if (found) setSelectedChild(found);
      void loadChildGrowthData(selectedChildId);
    }
  }, [selectedChildId, children, loadChildGrowthData]);

  // Phân tích chỉ số gần nhất
  const latestRecord = history.length > 0 ? history[history.length - 1] : null;
  const previousRecord = history.length > 1 ? history[history.length - 2] : null;

  // Cảnh báo nguy cơ tăng trưởng (UC84)
  const growthRiskAlert = useMemo(() => {
    if (!latestRecord) return null;
    const waz = Number(latestRecord.waz);
    const haz = Number(latestRecord.haz);
    const baz = Number(latestRecord.baz);

    const isUnderweight = waz < -2;
    const isStunted = haz < -2;
    const isWasted = baz < -2;
    const isObese = baz > 2;

    const isWeightLossFaltering =
      previousRecord &&
      Number(latestRecord.weightKg) < Number(previousRecord.weightKg);

    if (isUnderweight || isStunted || isWasted || isObese || isWeightLossFaltering) {
      let title = "Cảnh báo nguy cơ tăng trưởng & thể trạng";
      let severity: "CRITICAL" | "HIGH" | "WARNING" = "WARNING";
      const reasons: string[] = [];

      if (isUnderweight) {
        reasons.push(`Chỉ số WAZ = ${waz.toFixed(2)} (ngưỡng nhẹ cân so với chuẩn WHO).`);
        severity = waz < -3 ? "CRITICAL" : "HIGH";
      }
      if (isStunted) {
        reasons.push(`Chỉ số HAZ = ${haz.toFixed(2)} (ngưỡng thấp còi so với chuẩn WHO).`);
        severity = haz < -3 ? "CRITICAL" : "HIGH";
      }
      if (isWasted) {
        reasons.push(`Chỉ số BAZ = ${baz.toFixed(2)} (ngưỡng gầy còm cần theo dõi).`);
        severity = "HIGH";
      }
      if (isObese) {
        reasons.push(`Chỉ số BAZ = ${baz.toFixed(2)} (ngưỡng thừa cân / béo phì).`);
        severity = "WARNING";
      }
      if (isWeightLossFaltering) {
        reasons.push(
          `Cân nặng giảm từ ${previousRecord?.weightKg} kg xuống ${latestRecord.weightKg} kg so với kỳ đo trước.`,
        );
        severity = "HIGH";
      }

      return {
        title,
        severity,
        reasons,
        latestRecord,
      };
    }
    return null;
  }, [latestRecord, previousRecord]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <ParentPortalTopNav
        activeTab="menu-consumption"
        child={
          selectedChild
            ? {
                name: selectedChild.fullName,
                className: selectedChild.className || selectedChild.class?.name,
              }
            : undefined
        }
      />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-7 space-y-6 flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/child-menu-consumption" className="hover:text-teal-700">
            Cổng phụ huynh
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-slate-700">Thể chất & Tăng trưởng WHO (UC81, 83, 84)</span>
        </div>

        {/* Page Hero */}
        <div className="rounded-3xl bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
                Chuẩn tăng trưởng WHO • Bộ Y Tế
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Activity className="w-8 h-8 text-emerald-300" />
              Theo Dõi Thể Chất & Biểu Đồ Z-Score Của Bé
            </h1>
            <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
              Xem lịch sử cân đo, chỉ số độ lệch chuẩn WHO (WAZ, HAZ, BAZ) và nhận cảnh báo nguy cơ tăng trưởng sớm của bé.
            </p>
          </div>

          {/* Child Selector */}
          {children.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-white min-w-[260px]">
              <label htmlFor="child-select" className="text-xs font-bold text-teal-100 block mb-1">
                Chọn bé theo dõi:
              </label>
              <select
                id="child-select"
                aria-label="Chọn học sinh theo dõi"
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full bg-white text-slate-900 font-bold rounded-xl px-3 py-2 text-sm outline-none cursor-pointer"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.className || c.class?.name || "Lớp mầm non"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {/* ─── CẢNH BÁO NGUY CƠ TĂNG TRƯỞNG (UC84: Growth Risk Alert) ─── */}
        {growthRiskAlert && (
          <div className="rounded-3xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 p-6 shadow-md animate-in fade-in">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-rose-100 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-rose-800">
                    UC84 • Cảnh báo tăng trưởng
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Kỳ đo ngày: {growthRiskAlert.latestRecord.measurementDate}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {growthRiskAlert.title} — Bé {selectedChild?.fullName}
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {growthRiskAlert.reasons.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600"></span>
                      <strong>{r}</strong>
                    </li>
                  ))}
                </ul>
                <div className="pt-2 flex flex-wrap items-center gap-3">

                  <button
                    type="button"
                    onClick={() => setActiveTab("chart")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Xem đường cong tăng trưởng WHO
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── THỐNG KÊ NHANH CHỈ SỐ GẦN NHẤT (UC81) ─── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Cân nặng gần nhất</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {latestRecord?.weightKg !== undefined ? `${latestRecord.weightKg} kg` : "—"}
              </span>
              {previousRecord && latestRecord && (
                <span
                  className={`text-xs font-bold flex items-center ${
                    Number(latestRecord.weightKg) >= Number(previousRecord.weightKg)
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {Number(latestRecord.weightKg) >= Number(previousRecord.weightKg) ? (
                    <TrendingUp className="h-3 w-3 inline mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 inline mr-0.5" />
                  )}
                  {Math.abs(Number(latestRecord.weightKg) - Number(previousRecord.weightKg)).toFixed(1)} kg
                </span>
              )}
            </div>
            <span className="mt-2 inline-block rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">
              WAZ: {latestRecord?.waz !== undefined ? Number(latestRecord.waz).toFixed(2) : "—"} SD
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Chiều cao gần nhất</span>
            <div className="mt-1">
              <span className="text-2xl font-black text-slate-900">
                {latestRecord?.heightCm !== undefined ? `${latestRecord.heightCm} cm` : "—"}
              </span>
            </div>
            <span className="mt-2 inline-block rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
              HAZ: {latestRecord?.haz !== undefined ? Number(latestRecord.haz).toFixed(2) : "—"} SD
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Chỉ số BMI</span>
            <div className="mt-1">
              <span className="text-2xl font-black text-slate-900">
                {latestRecord?.bmi !== undefined ? Number(latestRecord.bmi).toFixed(1) : "—"}
              </span>
            </div>
            <span className="mt-2 inline-block rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              BAZ: {latestRecord?.baz !== undefined ? Number(latestRecord.baz).toFixed(2) : "—"} SD
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Tình trạng thể chất</span>
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                  growthRiskAlert
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
              >
                {growthRiskAlert ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" /> Có nguy cơ
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Phát triển bình thường
                  </>
                )}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-2">
              {latestRecord?.measurementDate
                ? `Đo ngày ${latestRecord.measurementDate}`
                : "Chưa có kỳ cân đo"}
            </span>
          </div>
        </div>

        {/* ─── TABS ĐIỀU HƯỚNG ─── */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("chart")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "chart"
                ? "border-teal-600 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <TrendingUp className="h-4 w-4" /> Biểu đồ WHO & Z-Score (UC83)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "history"
                ? "border-teal-600 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="h-4 w-4" /> Lịch sử cân đo (UC81)
          </button>

        </div>

        {/* ─── NỘI DUNG TAB 1: BIỂU ĐỒ WHO (UC83) ─── */}
        {activeTab === "chart" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Biểu đồ tăng trưởng theo chuẩn WHO (LMS Standards)
                </h3>
                <p className="text-xs text-slate-500">
                  Đường cong bách phân vị và độ lệch chuẩn (SD: -3, -2, 0, +2, +3) theo độ tuổi của bé.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <p className="text-sm font-semibold">Đang tổng hợp dữ liệu đường cong tăng trưởng...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                Bé chưa có dữ liệu cân đo định kỳ để vẽ biểu đồ. Nhà trường sẽ cập nhật sau các đợt khám sức khỏe.
              </div>
            ) : (
              <WhoGrowthChart
                child={
                  selectedChild
                    ? {
                        fullName: selectedChild.fullName,
                        gender: selectedChild.gender,
                        dateOfBirth: selectedChild.dateOfBirth,
                      }
                    : null
                }
                history={history}
              />
            )}
          </div>
        )}

        {/* ─── NỘI DUNG TAB 2: LỊCH SỬ CÂN ĐO (UC81) ─── */}
        {activeTab === "history" && (
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">
                Lịch sử ghi nhận thể chất định kỳ của bé (UC81)
              </h3>
              <p className="text-xs text-slate-500">
                Tổng hợp các đợt cân đo thể chất do Y tế học đường và Giáo viên lớp thực hiện.
              </p>
            </div>

            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                Chưa có bản ghi đo thể chất nào cho học sinh này.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="py-3 px-4">Ngày đo</th>
                      <th className="py-3 px-4">Độ tuổi (tháng)</th>
                      <th className="py-3 px-4">Cân nặng (kg)</th>
                      <th className="py-3 px-4">Chiều cao (cm)</th>
                      <th className="py-3 px-4">Chỉ số BMI</th>
                      <th className="py-3 px-4">WAZ (Cân/tuổi)</th>
                      <th className="py-3 px-4">HAZ (Cao/tuổi)</th>
                      <th className="py-3 px-4">BAZ (BMI/tuổi)</th>
                      <th className="py-3 px-4">Đánh giá chung</th>
                      <th className="py-3 px-4">Ghi chú sức khỏe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {history.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {row.measurementDate}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{row.ageInMonths} tháng</td>
                        <td className="py-3 px-4 font-bold text-teal-800">{row.weightKg} kg</td>
                        <td className="py-3 px-4 font-bold text-sky-800">{row.heightCm} cm</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {row.bmi ? Number(row.bmi).toFixed(1) : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              Number(row.waz) < -2
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.waz !== undefined ? Number(row.waz).toFixed(2) : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              Number(row.haz) < -2
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.haz !== undefined ? Number(row.haz).toFixed(2) : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              Number(row.baz) < -2 || Number(row.baz) > 2
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.baz !== undefined ? Number(row.baz).toFixed(2) : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {row.overallNutritionalStatus || row.weightClassification || "Bình thường"}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {row.healthNotes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

    </div>
  );
};
