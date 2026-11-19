import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
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
import { formatDateDMY } from "../../../core/components/DateInput";

export const ParentGrowthMonitoringPage: React.FC = () => {
  useLanguage();
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
        reasons.push(`Chỉ số cân nặng: ${waz.toFixed(2)} (ngưỡng nhẹ cân so với độ tuổi).`);
        severity = waz < -3 ? "CRITICAL" : "HIGH";
      }
      if (isStunted) {
        reasons.push(`Chỉ số chiều cao: ${haz.toFixed(2)} (ngưỡng thấp còi so với độ tuổi).`);
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
        activeTab="growth"
        child={
          selectedChild
            ? {
                id: String(selectedChild.id),
                name: selectedChild.fullName,
                className: selectedChild.className || selectedChild.class?.name,
              }
            : undefined
        }
      />

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-7 space-y-6 flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/child-menu-consumption" className="hover:text-teal-700">{translateText("Cổng phụ huynh")}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-slate-700">{translateText("Theo dõi thể chất của bé")}</span>
        </div>

        {/* Page Hero */}
        <div className="rounded-3xl bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">{translateText("Theo dõi thể chất định kỳ")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Activity className="w-8 h-8 text-emerald-300" />{translateText("Theo Dõi Thể Chất Của Bé")}</h1>
            <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">{translateText("Xem lịch sử cân đo, chỉ số phát triển chiều cao, cân nặng, BMI và nhận cảnh báo thể trạng sớm của bé.")}</p>
          </div>

          {/* Child Selector */}
          {children.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-white min-w-[260px]">
              <label htmlFor="child-select" className="text-xs font-bold text-teal-100 block mb-1">{translateText("Chọn bé theo dõi:")}</label>
              <select
                id="child-select"
                aria-label={translateText("Chọn học sinh theo dõi")}
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full bg-white text-slate-900 font-bold rounded-xl px-3 py-2 text-sm outline-none cursor-pointer"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.className || c.class?.name || translateText("Lớp mầm non")})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {translateText(error)}
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
                  <span className="rounded-full bg-rose-100 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-rose-800">{translateText("Cảnh báo nguy cơ tăng trưởng")}</span>
                  <span className="text-xs font-bold text-slate-500">{translateText("Kỳ đo ngày: ")}{formatDateDMY(growthRiskAlert.latestRecord.measurementDate)}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {translateText(growthRiskAlert.title)}{translateText(" — Bé ")}{selectedChild?.fullName}
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {growthRiskAlert.reasons.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600"></span>
                      <strong>{translateText(r)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="pt-2 flex flex-wrap items-center gap-3">

                  <button
                    type="button"
                    onClick={() => setActiveTab("chart")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />{translateText(" Xem biểu đồ tăng trưởng")}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── THỐNG KÊ NHANH CHỈ SỐ GẦN NHẤT (UC81) ─── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">{translateText("Cân nặng gần nhất")}</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {translateText(latestRecord?.weightKg !== undefined ? `${latestRecord.weightKg} kg` : "—")}
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
                  {translateText(Math.abs(Number(latestRecord.weightKg) - Number(previousRecord.weightKg)).toFixed(1))}{translateText(" kg")}</span>
              )}
            </div>
            {latestRecord ? (
              <span className="mt-2 inline-block rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                {translateText(latestRecord.weightClassification || "Chuẩn theo độ tuổi")}
              </span>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">{translateText("Chiều cao gần nhất")}</span>
            <div className="mt-1">
              <span className="text-2xl font-black text-slate-900">
                {translateText(latestRecord?.heightCm !== undefined ? `${latestRecord.heightCm} cm` : "—")}
              </span>
            </div>
            {latestRecord ? (
              <span className="mt-2 inline-block rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                {translateText(latestRecord.heightClassification || "Chuẩn theo độ tuổi")}
              </span>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">{translateText("Chỉ số BMI")}</span>
            <div className="mt-1">
              <span className="text-2xl font-black text-slate-900">
                {translateText(latestRecord?.bmi !== undefined ? Number(latestRecord.bmi).toFixed(1) : "—")}
              </span>
            </div>
            {latestRecord ? (
              <span className="mt-2 inline-block rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                {translateText(latestRecord.bmiClassification || (latestRecord.bmi ? "Thể trạng cân đối" : "Chưa có số đo"))}
              </span>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">{translateText("Tình trạng thể chất")}</span>
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
                    <AlertTriangle className="h-3.5 w-3.5" />{translateText(" Có nguy cơ")}</>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />{translateText(" Phát triển bình thường")}</>
                )}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-2">
              {translateText(latestRecord?.measurementDate
                ? `Đo ngày ${formatDateDMY(latestRecord.measurementDate)}`
                : "Chưa có kỳ cân đo")}
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
            <TrendingUp className="h-4 w-4" />{translateText(" Biểu đồ tăng trưởng")}</button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "history"
                ? "border-teal-600 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="h-4 w-4" />{translateText(" Lịch sử cân đo")}</button>

        </div>

        {/* ─── NỘI DUNG TAB 1: BIỂU ĐỒ TĂNG TRƯỞNG ─── */}
        {activeTab === "chart" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">{translateText("Biểu đồ tăng trưởng của bé")}</h3>
                <p className="text-xs text-slate-500">{translateText("Theo dõi sự phát triển chiều cao, cân nặng và chỉ số BMI theo độ tuổi của bé.")}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <p className="text-sm font-semibold">{translateText("Đang tổng hợp dữ liệu đường cong tăng trưởng...")}</p>
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">{translateText("Bé chưa có dữ liệu cân đo định kỳ để vẽ biểu đồ. Nhà trường sẽ cập nhật sau các đợt khám sức khỏe.")}</div>
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
              <h3 className="text-lg font-black text-slate-900">{translateText("Lịch sử ghi nhận thể chất định kỳ của bé")}</h3>
              <p className="text-xs text-slate-500">{translateText("Tổng hợp các đợt cân đo thể chất do Y tế học đường và Giáo viên lớp thực hiện.")}</p>
            </div>

            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">{translateText("Chưa có bản ghi đo thể chất nào cho học sinh này.")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="py-3 px-4">{translateText("Ngày đo")}</th>
                      <th className="py-3 px-4">{translateText("Độ tuổi (tháng)")}</th>
                      <th className="py-3 px-4">{translateText("Cân nặng (kg)")}</th>
                      <th className="py-3 px-4">{translateText("Chiều cao (cm)")}</th>
                      <th className="py-3 px-4">{translateText("Chỉ số BMI")}</th>
                      <th className="py-3 px-4">{translateText("Đánh giá cân nặng")}</th>
                      <th className="py-3 px-4">{translateText("Đánh giá chiều cao")}</th>
                      <th className="py-3 px-4">{translateText("Thể trạng BMI")}</th>
                      <th className="py-3 px-4">{translateText("Đánh giá chung")}</th>
                      <th className="py-3 px-4">{translateText("Ghi chú sức khỏe")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {history.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatDateDMY(row.measurementDate)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{row.ageInMonths}{translateText(" tháng")}</td>
                        <td className="py-3 px-4 font-bold text-teal-800">{row.weightKg}{translateText(" kg")}</td>
                        <td className="py-3 px-4 font-bold text-sky-800">{row.heightCm}{translateText(" cm")}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {translateText(row.bmi ? Number(row.bmi).toFixed(1) : "—")}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              Number(row.waz) < -2
                                ? "bg-rose-100 text-rose-800"
                                : "bg-teal-50 text-teal-800"
                            }`}
                          >
                            {translateText(row.weightClassification || (Number(row.waz) < -2 ? "Nhẹ cân" : "Đạt chuẩn"))}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              Number(row.haz) < -2
                                ? "bg-rose-100 text-rose-800"
                                : "bg-sky-50 text-sky-800"
                            }`}
                          >
                            {translateText(row.heightClassification || (Number(row.haz) < -2 ? "Thấp còi" : "Đạt chuẩn"))}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              Number(row.baz) < -2 || Number(row.baz) > 2
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            {translateText(row.bmiClassification || (Number(row.baz) > 2 ? "Thừa cân" : Number(row.baz) < -2 ? "Gầy còm" : "Cân đối"))}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {translateText(row.overallNutritionalStatus || row.weightClassification || "Bình thường")}
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
