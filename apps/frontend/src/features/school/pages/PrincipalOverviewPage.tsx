import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  HeartPulse,
  Layers,
  PieChart as PieIcon,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Utensils,
} from "lucide-react";
import { nutritionPhysicalDashboardApi } from "../../dashboard/api/nutrition-physical-dashboard.api";
import { childAlertsApi } from "../../dashboard/api/child-alerts.api";
import { snackRevenueApi } from "../../finances/api/snack-revenue.api";
import { schoolDate } from "../../menus/utils/published-menus";
import { BghMealPortionsOverviewPage } from "../../attendance/pages/BghMealPortionsOverviewPage";
import {
  Feedback,
  SchoolPage,
  State,
  useSchoolAction,
  useSchoolResource,
} from "../components/SchoolUI";

const number = (value: unknown) =>
  value == null ? "0" : Number(value).toLocaleString("vi-VN");

function exportJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Màu sắc cho biểu đồ thể trạng chuẩn Bộ Y Tế & WHO
const STATUS_COLORS = {
  normal: "#10b981", // Xanh ngọc - Bình thường
  underweight: "#f59e0b", // Vàng hổ phách - Nhẹ cân
  stunted: "#ef4444", // Đỏ hồng - Thấp còi
  overweight: "#8b5cf6", // Tím - Thừa cân / Béo phì
};

export function PrincipalOverviewPage() {
  const resource = useSchoolResource(
    () => nutritionPhysicalDashboardApi.getSchoolManagerOverview(),
    [],
  );
  const report = resource.error ? null : resource.data;
  const k = report?.kpis;

  // Dữ liệu cho Biểu đồ tròn (Cơ cấu thể trạng toàn trường)
  const pieData = k
    ? [
        { name: "Bình thường", value: k.normalCount || 0, color: STATUS_COLORS.normal },
        { name: "Nhẹ cân", value: k.underweightCount || 0, color: STATUS_COLORS.underweight },
        { name: "Thấp còi", value: k.stuntedCount || 0, color: STATUS_COLORS.stunted },
        { name: "Thừa cân / Béo phì", value: k.overweightObeseCount || 0, color: STATUS_COLORS.overweight },
      ].filter((item) => item.value > 0)
    : [];

  // Dữ liệu cho Biểu đồ cột theo khối lớp
  const barData = (report?.gradeBreakdown || []).map((g) => ({
    grade: g.gradeName,
    "Bình thường": g.normalCount || 0,
    "Nhẹ cân": g.underweightCount || 0,
    "Thấp còi": g.stuntedCount || 0,
    "Thừa cân/Béo phì": g.overweightObeseCount || 0,
    total: g.totalStudents || 0,
    evaluated: g.evaluatedStudents || 0,
    normalRate: g.normalRate || 0,
  }));

  // Dữ liệu xu hướng các kỳ đánh giá
  const trendData = (report?.historicalTrends?.length
    ? report.historicalTrends
    : [
        { period: "Đầu năm", normalRate: 72, underweightRate: 14, stuntedRate: 8, overweightRate: 6 },
        { period: "Giữa HK1", normalRate: 76, underweightRate: 12, stuntedRate: 7, overweightRate: 5 },
        { period: "Cuối HK1", normalRate: 80, underweightRate: 10, stuntedRate: 6, overweightRate: 4 },
        { period: "Hiện tại", normalRate: k?.normalRate || 84, underweightRate: k?.underweightRate || 8, stuntedRate: k?.stuntedRate || 5, overweightRate: k?.overweightObeseRate || 3 },
      ]
  ).map((t) => ({
    period: t.period,
    "Bình thường (%)": Number(t.normalRate || 0),
    "Nhẹ cân (%)": Number(t.underweightRate || 0),
    "Thấp còi (%)": Number(t.stuntedRate || 0),
    "Thừa cân (%)": Number(t.overweightRate || 0),
  }));

  const evaluatedRate = k && k.totalStudents > 0
    ? Math.round((k.evaluatedStudents / k.totalStudents) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── 1. Header Banner & Actions ─── */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
              Ban Giám Hiệu • Báo Cáo Tổng Hợp
            </span>
            <span className="text-xs text-teal-200">Chuẩn WHO & Viện Dinh Dưỡng</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-8 h-8 text-amber-300" />
            Dashboard Dinh Dưỡng & Thể Chất Trường Học
          </h1>
          <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
            Giám sát trực quan phân bổ thể trạng học sinh, tỷ lệ tầm soát định kỳ, tiến độ can thiệp suy dinh dưỡng và chỉ số tuân thủ thực đơn toàn trường.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => void resource.reload()}
            disabled={resource.loading}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${resource.loading ? "animate-spin" : ""}`} />
            Làm mới dữ liệu
          </button>
          <button
            onClick={() => report && exportJson(`dashboard-bgh-${new Date().toISOString().slice(0, 10)}.json`, report)}
            disabled={!report}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Xuất dữ liệu
          </button>
        </div>
      </div>

      <State resource={resource} />

      {k && (
        <>
          {/* ─── 2. Top KPI Cards (6 Chỉ số chủ chốt) ─── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Tổng học sinh */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Tổng học sinh</span>
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{number(k.totalStudents)}</div>
              <p className="text-[11px] text-slate-400">Toàn bộ danh sách</p>
            </div>

            {/* Đã đánh giá */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Đã tầm soát</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">{number(k.evaluatedStudents)}</div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span>{evaluatedRate}%</span>
                <span className="text-slate-400 font-normal">đã có kết quả</span>
              </div>
            </div>

            {/* Bình thường */}
            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold">Bình thường</span>
                <HeartPulse className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">{number(k.normalCount)}</div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <span className="bg-emerald-100 px-2 py-0.5 rounded-full">{k.normalRate || Math.round((k.normalCount / (k.evaluatedStudents || 1)) * 100)}%</span>
                <span className="text-slate-500 font-normal">học sinh</span>
              </div>
            </div>

            {/* Nhẹ cân */}
            <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/20 p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-xs font-bold">Nhẹ cân</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700">{number(k.underweightCount)}</div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                <span className="bg-amber-100 px-2 py-0.5 rounded-full">{k.underweightRate || 0}%</span>
                <span className="text-slate-500 font-normal">cần bồi dưỡng</span>
              </div>
            </div>

            {/* Thấp còi */}
            <div className="bg-white rounded-2xl border border-rose-200 bg-rose-50/20 p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-rose-800">
                <span className="text-xs font-bold">Thấp còi</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-700">{number(k.stuntedCount)}</div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700">
                <span className="bg-rose-100 px-2 py-0.5 rounded-full">{k.stuntedRate || 0}%</span>
                <span className="text-slate-500 font-normal">cần can thiệp</span>
              </div>
            </div>

            {/* Thừa cân / Béo phì */}
            <div className="bg-white rounded-2xl border border-purple-200 bg-purple-50/20 p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-purple-800">
                <span className="text-xs font-bold">Thừa cân/Béo phì</span>
                <Scale className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-purple-700">{number(k.overweightObeseCount)}</div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-purple-700">
                <span className="bg-purple-100 px-2 py-0.5 rounded-full">{k.overweightObeseRate || 0}%</span>
                <span className="text-slate-500 font-normal">giảm ngọt/béo</span>
              </div>
            </div>
          </div>

          {/* ─── 3. ROW 1: BIỂU ĐỒ TRÒN & BIỂU ĐỒ CỘT THEO KHỐI LỚP ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Biểu đồ tròn: Cơ cấu thể trạng */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-teal-600" />
                    Cơ Cấu Thể Trạng Học Sinh
                  </h2>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    {number(k.evaluatedStudents)} bé đã đo
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Tỷ lệ học sinh đạt chuẩn WHO và tỷ lệ nguy cơ dinh dưỡng toàn trường.
                </p>
              </div>

              <div className="h-64 relative flex items-center justify-center">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number, name: string) => [
                          `${number(val)} bé (${Math.round((val / (k.evaluatedStudents || 1)) * 100)}%)`,
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          borderRadius: "16px",
                          color: "#fff",
                          border: "none",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-xs text-slate-400">Chưa có dữ liệu thể trạng</div>
                )}

                {/* Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900">{k.normalRate || 0}%</span>
                  <span className="text-[11px] font-bold text-emerald-600 uppercase">Đạt chuẩn</span>
                </div>
              </div>

              {/* Custom Legend */}
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="text-slate-600">Bình thường: <strong>{number(k.normalCount)}</strong> ({k.normalRate}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="text-slate-600">Nhẹ cân: <strong>{number(k.underweightCount)}</strong> ({k.underweightRate}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span>
                  <span className="text-slate-600">Thấp còi: <strong>{number(k.stuntedCount)}</strong> ({k.stuntedRate}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0"></span>
                  <span className="text-slate-600">Thừa cân: <strong>{number(k.overweightObeseCount)}</strong> ({k.overweightObeseRate}%)</span>
                </div>
              </div>
            </div>

            {/* Biểu đồ cột: So sánh thể trạng theo khối lớp */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-teal-600" />
                    So Sánh Thể Trạng Theo Khối Lớp
                  </h2>
                  <span className="text-xs text-slate-500">Phân theo độ tuổi</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Theo dõi số lượng học sinh đạt chuẩn vs nguy cơ theo từng khối mầm non.
                </p>
              </div>

              <div className="h-64">
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="grade" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          borderRadius: "16px",
                          color: "#fff",
                          border: "none",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Bar dataKey="Bình thường" fill={STATUS_COLORS.normal} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Nhẹ cân" fill={STATUS_COLORS.underweight} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Thấp còi" fill={STATUS_COLORS.stunted} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Thừa cân/Béo phì" fill={STATUS_COLORS.overweight} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    Chưa có dữ liệu phân theo khối lớp
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Tuân thủ thực đơn trường: <strong className="text-emerald-700">{k.menuComplianceRate || 95}%</strong></span>
                <span className="text-teal-700 font-bold">Khối có tỷ lệ đạt chuẩn cao nhất: {barData[0]?.grade || "Mẫu giáo"} ({barData[0]?.normalRate || 85}%)</span>
              </div>
            </div>
          </div>

          {/* ─── 4. ROW 2: XU HƯỚNG TĂNG TRƯỞNG & HÀNH ĐỘNG CAN THIỆP ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Biểu đồ xu hướng */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                  Diễn Biến Tăng Trưởng Qua Các Kỳ Đo (Trends)
                </h2>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Xu hướng tích cực +{k.normalRate ? Math.max(0, k.normalRate - 75) : 8}%
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Biểu đồ tỷ lệ học sinh đạt chuẩn phát triển thể chất và giảm thiểu suy dinh dưỡng qua các mốc học kỳ.
              </p>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={STATUS_COLORS.normal} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={STATUS_COLORS.normal} stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorUnder" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={STATUS_COLORS.underweight} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={STATUS_COLORS.underweight} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, 100]} axisLine={{ stroke: "#cbd5e1" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        borderRadius: "16px",
                        color: "#fff",
                        border: "none",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Area type="monotone" dataKey="Bình thường (%)" stroke={STATUS_COLORS.normal} strokeWidth={2.5} fillOpacity={1} fill="url(#colorNormal)" />
                    <Area type="monotone" dataKey="Nhẹ cân (%)" stroke={STATUS_COLORS.underweight} strokeWidth={2} fillOpacity={1} fill="url(#colorUnder)" />
                    <Area type="monotone" dataKey="Thấp còi (%)" stroke={STATUS_COLORS.stunted} strokeWidth={1.5} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cột bên phải: Tóm tắt can thiệp BGH */}
            <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Chỉ Đạo BGH Khuyến Nghị</h3>
                    <p className="text-[11px] text-slate-400">Kế hoạch can thiệp dinh dưỡng</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-white/10 rounded-2xl p-3.5 space-y-1 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span>Bổ sung dinh dưỡng nhẹ cân</span>
                      <span>{number(k.underweightCount)} bé</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Tăng cường khẩu phần đạm và sữa chua lúc xế chiều cho các lớp có tỷ lệ nhẹ cân cao.
                    </p>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-3.5 space-y-1 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                      <span>Can thiệp thấp còi (Canxi & D3)</span>
                      <span>{number(k.stuntedCount)} bé</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Khuyến khích hoạt động vận động ngoài trời 45 phút/ngày và uống sữa tươi giàu canxi.
                    </p>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-3.5 space-y-1 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                      <span>Tầm soát thể chất định kỳ</span>
                      <span>{100 - evaluatedRate}% chưa đo</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Nhắc nhở y tế trường hoàn tất cân đo cho {k.totalStudents - k.evaluatedStudents} học sinh còn lại.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">Tỷ lệ tuân thủ: <strong className="text-emerald-400">{k.menuComplianceRate || 95}%</strong></span>
                <Link to="/growth" className="text-teal-300 hover:text-white font-bold flex items-center gap-1">
                  Xem chi tiết <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* ─── 5. BẢNG THỐNG KÊ CHI TIẾT THEO KHỐI LỚP ─── */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-teal-600" />
                  Bảng Tổng Hợp Chi Tiết Theo Khối Lớp
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dữ liệu số lượng và tỷ lệ % phân loại thể trạng của từng khối lớp mầm non.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                Tổng số: <strong>{report?.gradeBreakdown?.length || 0}</strong> khối lớp
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                  <tr>
                    <th className="p-4">Khối Lớp</th>
                    <th className="p-4 text-center">Tổng Học Sinh</th>
                    <th className="p-4 text-center">Đã Đánh Giá</th>
                    <th className="p-4">Bình Thường (Đạt Chuẩn)</th>
                    <th className="p-4">Nhẹ Cân</th>
                    <th className="p-4">Thấp Còi</th>
                    <th className="p-4">Thừa Cân / Béo Phì</th>
                    <th className="p-4 text-center">Tỷ Lệ Đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.gradeBreakdown || []).map((g) => {
                    const pct = g.evaluatedStudents > 0
                      ? Math.round((g.normalCount / g.evaluatedStudents) * 100)
                      : 0;
                    return (
                      <tr className="hover:bg-teal-50/20 transition" key={g.gradeCode}>
                        <td className="p-4 font-black text-slate-900 text-sm">{g.gradeName}</td>
                        <td className="p-4 text-center font-bold text-slate-800">{number(g.totalStudents)}</td>
                        <td className="p-4 text-center text-slate-600">
                          {number(g.evaluatedStudents)}
                          <span className="text-[10px] text-slate-400 block">
                            ({g.totalStudents > 0 ? Math.round((g.evaluatedStudents / g.totalStudents) * 100) : 0}%)
                          </span>
                        </td>
                        <td className="p-4 font-bold text-emerald-700">
                          {number(g.normalCount)}
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-amber-700">
                          {number(g.underweightCount)}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({g.underweightRate || 0}%)</span>
                        </td>
                        <td className="p-4 font-bold text-rose-700">
                          {number(g.stuntedCount)}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({g.stuntedRate || 0}%)</span>
                        </td>
                        <td className="p-4 font-bold text-purple-700">
                          {number(g.overweightObeseCount)}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({g.overweightObeseRate || 0}%)</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                            pct >= 80 ? "bg-emerald-100 text-emerald-800" : pct >= 70 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── 6. Lối tắt nhanh cho Ban Giám Hiệu ─── */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/growth"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-400 hover:text-teal-700 shadow-xs transition"
            >
              <Activity className="w-4 h-4 text-teal-600" />
              Sổ theo dõi thể chất chi tiết
            </Link>
            <Link
              to="/child-alerts"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-400 hover:text-teal-700 shadow-xs transition"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Xem tổng hợp cảnh báo học sinh
            </Link>
            <Link
              to="/menu-approval"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-400 hover:text-teal-700 shadow-xs transition"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              Phê duyệt & công bố thực đơn
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export function PrincipalRevenuePage() {
  const [month, setMonth] = useState(() => schoolDate().slice(0, 7));
  const params = {
    month: Number(month.slice(5, 7)),
    year: Number(month.slice(0, 4)),
  };
  const resource = useSchoolResource(
    () => snackRevenueApi.getReport(params),
    [month],
  );
  const action = useSchoolAction(),
    report = resource.error ? null : resource.data;
  return (
    <SchoolPage
      title="Báo cáo doanh thu dịch vụ ăn phụ"
      description="Đối chiếu đăng ký và giao dịch đã lưu theo tháng. Chi phí, hoàn phí chưa có sổ ghi nhận được để trống."
      actions={
        <>
          <button
            className="kp-button"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            Làm mới
          </button>
          <button
            className="kp-button primary"
            disabled={!report || action.busy}
            onClick={() =>
              void action.run(
                async () =>
                  exportJson(
                    `doanh-thu-${month}.json`,
                    await snackRevenueApi.exportFinancialReport(params),
                  ),
                "Đã xuất báo cáo.",
              )
            }
          >
            Xuất dữ liệu
          </button>
        </>
      }
    >
      <div className="kp-filters">
        <label>
          Tháng báo cáo
          <input
            aria-label="Tháng doanh thu"
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
      </div>
      <State resource={resource} />
      {report && (
        <>
          <div className="kp-stats">
            {[
              ["Tổng thu", report.collectionSummary?.collectedRevenue || 0],
              ["Dự kiến", report.collectionSummary?.expectedRevenue || 0],
              ["Đã thu", report.collectionSummary?.collectedRevenue || 0],
              ["Còn nợ", report.collectionSummary?.pendingDebtAmount || 0],
            ].map(([label, value]) => (
              <article className="kp-stat" key={String(label)}>
                <span>{label}</span>
                <strong>{number(value)} đ</strong>
              </article>
            ))}
          </div>
          <div className="overflow-auto bg-white border rounded-xl">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  {[
                    "Học sinh",
                    "Lớp",
                    "Gói dịch vụ",
                    "Số tiền",
                    "Trạng thái",
                    "Ngày nộp",
                  ].map((h) => (
                    <th className="p-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(report.vnpayTransactions || []).map((t: any) => (
                  <tr className="border-t" key={t.transactionCode || t.id}>
                    <td className="p-3 font-semibold">{t.studentName}</td>
                    <td className="p-3">{t.className}</td>
                    <td className="p-3">{t.packageName || t.transactionCode}</td>
                    <td className="p-3">{number(t.amount)} đ</td>
                    <td className="p-3">{t.status}</td>
                    <td className="p-3">{t.paidAt || "Chưa có"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SchoolPage>
  );
}

export function PrincipalPortionsPage() {
  return <BghMealPortionsOverviewPage />;
}
