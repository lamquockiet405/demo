import React, { useState, useMemo } from "react";
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
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
} from "recharts";
import { nutritionPhysicalDashboardApi } from "../../dashboard/api/nutrition-physical-dashboard.api";
import { childAlertsApi } from "../../dashboard/api/child-alerts.api";
import {
  HeartPulse,
  Users,
  AlertTriangle,
  Scale,
  RefreshCw,
  TrendingDown,
  ShieldAlert,
  Flame,
  Activity,
  Calendar,
  Layers,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  UtensilsCrossed,
  Info,
} from "lucide-react";
import {
  State,
  useSchoolResource,
} from "../../school/components/SchoolUI";

export function NutritionOverviewPage() {
  const resource = useSchoolResource(
    () => nutritionPhysicalDashboardApi.getNutritionistClinicalOverview(),
    [],
  );
  const data = resource.error ? null : resource.data;

  // Tính toán số liệu KPI
  const evaluatedTotal = useMemo(
    () => data?.classBreakdown?.reduce((n, c) => n + (c.evaluatedCount || 0), 0) || 0,
    [data],
  );
  const atRiskTotal = data?.atRiskStudents?.length || 0;
  const classesTotal = data?.classBreakdown?.length || 0;
  const avgCompliance = useMemo(() => {
    if (!data?.classBreakdown?.length) return 100;
    const sum = data.classBreakdown.reduce((s, c) => s + (c.complianceRate || 0), 0);
    return Math.round(sum / data.classBreakdown.length);
  }, [data]);

  // Dữ liệu biểu đồ năng lượng P - L - G
  const macroData = useMemo(() => {
    const macro = data?.clinicalNutrition?.plgRatio;
    return [
      { name: "Chất Đạm (Protein)", value: macro?.proteinPct || 14, color: "#10b981" },
      { name: "Chất Béo (Lipid)", value: macro?.fatPct || 28, color: "#f59e0b" },
      { name: "Đường Bột (Glucid)", value: macro?.carbPct || 58, color: "#0ea5e9" },
    ];
  }, [data]);

  // Dữ liệu biểu đồ so sánh theo lớp
  const classBarData = useMemo(() => {
    return (data?.classBreakdown || []).map((c) => ({
      name: c.className,
      atRisk: c.atRiskCount || 0,
      normal: Math.max(0, (c.evaluatedCount || 0) - (c.atRiskCount || 0)),
      total: c.totalStudents || 0,
    }));
  }, [data]);

  const getStatusBadge = (classification?: string) => {
    const cls = (classification || "").toUpperCase();
    if (cls.includes("STUNTED") || cls.includes("THẤP CÒI")) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
          Thấp còi (STUNTED)
        </span>
      );
    }
    if (cls.includes("UNDERWEIGHT") || cls.includes("NHẸ CÂN") || cls.includes("WASTED")) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
          Nhẹ cân (UNDERWEIGHT)
        </span>
      );
    }
    if (cls.includes("OVERWEIGHT") || cls.includes("THỪA CÂN") || cls.includes("OBESE")) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
          Thừa cân (OVERWEIGHT)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
        {classification || "Chưa đánh giá"}
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* ─── 1. Header Banner ─── */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-emerald-100 uppercase tracking-wider backdrop-blur-sm">
              Chuyên Gia Dinh Dưỡng • NutriKid
            </span>
            <span className="text-xs text-emerald-200">Giám sát lâm sàng & Thể trạng</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <HeartPulse className="w-8 h-8 text-amber-300" />
            Dashboard Dinh Dưỡng & Theo Dõi Thể Chất Trẻ
          </h1>
          <p className="text-sm text-emerald-100 max-w-2xl leading-relaxed">
            Tổng hợp dữ liệu cân đo, đánh giá nguy cơ phát triển theo chuẩn WHO, phân bổ năng lượng thực đơn và danh sách học sinh cần can thiệp.
          </p>
        </div>

        <button
          onClick={() => void resource.reload()}
          disabled={resource.loading}
          className="self-start md:self-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm transition flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${resource.loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      <State resource={resource} />

      {data && (
        <>
          {/* ─── 2. Top KPI Summary Cards ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Học sinh có số đo</span>
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-1">{evaluatedTotal}</div>
              <p className="text-[11px] text-slate-400">Đã cân đo trong kỳ</p>
            </div>

            <div className="bg-white rounded-2xl border border-rose-200 bg-rose-50/20 p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-rose-800">
                <span className="text-xs font-bold uppercase tracking-wider">Hồ sơ cần theo dõi</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-3xl font-black text-rose-700 mt-1">{atRiskTotal}</div>
              <p className="text-[11px] text-rose-600 font-bold">
                {evaluatedTotal > 0 ? Math.round((atRiskTotal / evaluatedTotal) * 100) : 0}% trẻ cần can thiệp dinh dưỡng
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider">Tuân thủ dinh dưỡng</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-700 mt-1">{avgCompliance}%</div>
              <p className="text-[11px] text-emerald-600 font-bold">Chuẩn Thông tư 28 Bộ GD&ĐT</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Lớp học theo dõi</span>
                <Layers className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-1">{classesTotal}</div>
              <p className="text-[11px] text-slate-400">Phân bố theo độ tuổi mầm non</p>
            </div>
          </div>

          {/* ─── 3. Visual Charts Section ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Donut Chart: Cơ cấu P-L-G */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    Cơ Cấu Năng Lượng Thực Đơn (P - L - G)
                  </h3>
                  <p className="text-[11px] text-slate-500">Tỷ lệ năng lượng thực tế tại trường</p>
                </div>
                <span className="text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  {data.clinicalNutrition?.dailyAvgCalories || 1250} Kcal
                </span>
              </div>

              <div className="h-56 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroData}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [`${val}%`, name]}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {data.clinicalNutrition?.plgRatio?.standardRatio || "14 : 28 : 58"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 mt-1">Chuẩn P:L:G</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                <div className="bg-emerald-50/60 rounded-xl p-2">
                  <span className="text-[10px] font-bold text-emerald-800 block">Đạm (P)</span>
                  <strong className="text-emerald-700 text-sm">{data.clinicalNutrition?.plgRatio?.proteinPct || 14}%</strong>
                </div>
                <div className="bg-amber-50/60 rounded-xl p-2">
                  <span className="text-[10px] font-bold text-amber-800 block">Béo (L)</span>
                  <strong className="text-amber-700 text-sm">{data.clinicalNutrition?.plgRatio?.fatPct || 28}%</strong>
                </div>
                <div className="bg-sky-50/60 rounded-xl p-2">
                  <span className="text-[10px] font-bold text-sky-800 block">Đường (G)</span>
                  <strong className="text-sky-700 text-sm">{data.clinicalNutrition?.plgRatio?.carbPct || 58}%</strong>
                </div>
              </div>
            </div>

            {/* Bar Chart: Phân bố theo lớp */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-600" />
                    Thống Kê Thể Trạng Học Sinh Theo Lớp
                  </h3>
                  <p className="text-[11px] text-slate-500">Đối chiếu tỷ lệ Đạt chuẩn vs Cần theo dõi</p>
                </div>
                <span className="text-xs text-slate-500">Tổng: <strong>{evaluatedTotal}</strong> học sinh</span>
              </div>

              <div className="h-56">
                {classBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classBarData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      />
                      <RechartsLegend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Bar dataKey="normal" name="Bình thường" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="atRisk" name="Cần theo dõi" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Chưa có số liệu theo lớp
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                Dữ liệu hỗ trợ Chuyên gia Dinh dưỡng lên kế hoạch điều chỉnh khẩu phần cho từng nhóm lớp
              </p>
            </div>
          </div>

          {/* ─── 4. Danh Sách Học Sinh Cần Theo Dõi (At Risk) ─── */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Danh Sách Học Sinh Cần Theo Dõi & Can Thiệp Dinh Dưỡng ({atRiskTotal})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Các trẻ có chỉ số thể chất (WAZ, HAZ, BAZ) ngoài ngưỡng chuẩn WHO
                  </p>
                </div>
              </div>

              <Link
                to="/nutritionist/growth"
                className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 self-start sm:self-auto"
              >
                Xem toàn bộ biểu đồ thể chất WHO
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {!data.atRiskStudents.length ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                Chưa có cảnh báo nguy cơ phát triển nào từ dữ liệu cân đo.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.atRiskStudents.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 bg-gradient-to-br from-white to-slate-50/60 rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">{c.fullName}</h4>
                          <span className="text-[11px] font-mono text-slate-500">{c.studentCode}</span>
                        </div>
                        {getStatusBadge(c.classification)}
                      </div>

                      <div className="text-xs font-semibold text-slate-700">
                        Lớp: <span className="text-teal-700">{c.className}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Cân nặng</span>
                          <strong>{c.weightKg != null ? `${c.weightKg} kg` : "—"}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Chiều cao</span>
                          <strong>{c.heightCm != null ? `${c.heightCm} cm` : "—"}</strong>
                        </div>
                      </div>

                      {c.diagnosis && (
                        <p className="text-xs text-rose-700 bg-rose-50/60 p-2 rounded-lg border border-rose-100">
                          <strong>Ghi nhận:</strong> {c.diagnosis}
                        </p>
                      )}
                    </div>

                    <Link
                      to="/nutritionist/growth"
                      className="w-full py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <Activity className="w-3.5 h-3.5 text-teal-600" />
                      Xem dữ liệu & biểu đồ tăng trưởng
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function NutritionAlertsPage() {
  const resource = useSchoolResource(
    () => childAlertsApi.getNutritionistAlerts(),
    [],
  );
  const rows: any[] = resource.error
    ? []
    : (Object.values(resource.data?.categories || {}).flat() as any[]);

  const totalAlerts = rows.length;

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* ─── 1. Header Banner ─── */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
              Cảnh Báo Lâm Sàng • NutriKid
            </span>
            <span className="text-xs text-teal-200">Dị ứng thực phẩm & Thể lực WHO</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-8 h-8 text-rose-300" />
            Tổng Hợp Cảnh Báo Trẻ & Nguy Cơ Dinh Dưỡng
          </h1>
          <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
            Tự động rà soát xung đột thành phần thực đơn với hồ sơ dị ứng của trẻ và phát hiện các trường hợp lệch chuẩn thể lực Z-score để kịp thời tư vấn.
          </p>
        </div>

        <button
          onClick={() => void resource.reload()}
          disabled={resource.loading}
          className="self-start md:self-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm transition flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${resource.loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      <State resource={resource} empty={!rows.length} />

      {/* ─── 2. Danh Sách Cảnh Báo Trực Quan ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            Danh Sách Cảnh Báo Đang Hoạt Động ({totalAlerts})
          </h3>
          <span className="text-xs text-slate-500">Cập nhật thời gian thực từ dữ liệu trường</span>
        </div>

        {!rows.length ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
            Hiện tại không có cảnh báo nguy cơ nào cần xử lý.
          </div>
        ) : (
          <div className="space-y-3.5">
            {rows.map((r, i) => {
              const isAllergy =
                (r.type || "").toUpperCase().includes("ALLERGY") ||
                Boolean(r.menuDishName);

              return (
                <div
                  key={r.id || i}
                  className={`p-5 rounded-2xl border transition space-y-3 ${
                    isAllergy
                      ? "border-rose-200 bg-rose-50/20 hover:border-rose-300"
                      : "border-amber-200 bg-amber-50/20 hover:border-amber-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isAllergy
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {isAllergy ? (
                          <ShieldAlert className="w-5 h-5" />
                        ) : (
                          <Activity className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">
                          {r.studentName}
                        </h4>
                        <span className="text-xs text-slate-500">
                          Lớp: <strong className="text-slate-700">{r.className}</strong>
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-black self-start sm:self-auto ${
                        isAllergy
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {isAllergy ? "Xung Đột Dị Ứng" : "Nguy Cơ Thể Lực WHO"}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-700 leading-relaxed pl-11">
                    {r.message || r.diagnosis || r.title}
                  </p>

                  {r.menuDishName && (
                    <div className="ml-11 text-xs text-rose-800 bg-white/80 border border-rose-200 p-2.5 rounded-xl font-semibold flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        Món ăn trong thực đơn bị ảnh hưởng: <strong>{r.menuDishName}</strong>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60 pl-11 text-xs">
                    <Link
                      to="/nutritionist/allergens"
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-teal-400 text-teal-800 rounded-xl font-bold transition shadow-xs"
                    >
                      Xem hồ sơ dị ứng
                    </Link>
                    <Link
                      to="/nutritionist/growth"
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-teal-400 text-teal-800 rounded-xl font-bold transition shadow-xs"
                    >
                      Xem biểu đồ số đo
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
