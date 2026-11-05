import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Baby,
  Calendar,
  Utensils,
  HeartPulse,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Loader2,
  RefreshCw,
  Bell,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ParentPortalTopNav } from "../../parent-evaluations/components/ParentPortalTopNav";
import {
  childAlertsApi,
  ParentAlertsResponse,
  ChildAlertDetail,
} from "../api/child-alerts.api";
import { nutritionAdviceApi, PickyEatingAdvice } from "../../nutrition/api/nutritionAdviceApi";
import { childrenApi, ChildItem } from "../../children/api/children.api";

export const ParentChildAlertsPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [alertsData, setAlertsData] = useState<ParentAlertsResponse | null>(null);
  const [pickyAdvice, setPickyAdvice] = useState<PickyEatingAdvice | null>(null);

  // 1. Tải danh sách con
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await childrenApi.getChildren({ limit: 50 });
        const list = Array.isArray(res) ? res : res.items || [];
        setChildren(list);
        if (list.length > 0) {
          setSelectedChildId(String(list[0].id));
        }
      } catch (err: any) {
        console.error("Lỗi khi tải danh sách con:", err);
      }
    };
    void fetchChildren();
  }, []);

  // 2. Tải cảnh báo tổng hợp & tư vấn dinh dưỡng
  const loadAlerts = useCallback(async (childId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, adviceRes] = await Promise.all([
        childAlertsApi.getParentAlerts(childId || undefined),
        childId ? nutritionAdviceApi.getChildAdvice(childId).catch(() => null) : null,
      ]);
      setAlertsData(alertsRes);
      if (adviceRes?.advice) {
        setPickyAdvice(adviceRes.advice);
      } else {
        setPickyAdvice(null);
      }
    } catch (err: any) {
      console.error("Lỗi khi tải tổng hợp cảnh báo của con:", err);
      setError(err.response?.data?.message || "Không thể tải dữ liệu cảnh báo từ máy chủ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      void loadAlerts(selectedChildId);
    }
  }, [selectedChildId, loadAlerts]);

  const selectedChild = children.find((c) => String(c.id) === String(selectedChildId)) || children[0];
  const activeAlertDetail: ChildAlertDetail | undefined =
    alertsData?.children?.find((c) => String(c.childId) === String(selectedChildId)) ||
    alertsData?.children?.[0];

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

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-7 space-y-6 flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/child-menu-consumption" className="hover:text-teal-700">
            Cổng phụ huynh
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-slate-700">Tổng hợp Cảnh báo của con (UC93)</span>
        </div>

        {/* Hero banner */}
        <div className="rounded-3xl bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
                UC93 • Giám sát an toàn trẻ em
              </span>
              <span className="text-xs text-teal-200">Bảo mật thông tin & cá nhân hóa</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Bell className="w-8 h-8 text-amber-300" />
              Tổng Hợp Cảnh Báo An Toàn & Sức Khỏe Của Bé
            </h1>
            <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
              Kiểm tra mức độ an toàn của thực đơn hôm nay theo hồ sơ dị ứng, báo cáo tiêu thụ lượng ăn của cô giáo, tình trạng phát triển thể chất và hướng dẫn dinh dưỡng.
            </p>
          </div>

          {/* Child Selector */}
          {children.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-white min-w-[260px]">
              <label htmlFor="alert-child-select" className="text-xs font-bold text-teal-100 block mb-1">
                Chọn bé theo dõi:
              </label>
              <select
                id="alert-child-select"
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

        {/* Loading state */}
        {loading && (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="text-sm font-semibold">Đang tổng hợp cảnh báo an toàn cho bé...</p>
          </div>
        )}

        {/* Error alert */}
        {error && !loading && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {!loading && activeAlertDetail && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* 1. AN TOÀN THỰC ĐƠN & DỊ ỨNG */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Utensils className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-teal-700 block">
                      An toàn thực đơn hôm nay
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      {activeAlertDetail.menuSafetyAlert?.title || "Thực đơn an toàn"}
                    </h3>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    activeAlertDetail.menuSafetyAlert?.isSafe
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-rose-100 text-rose-800 border border-rose-300"
                  }`}
                >
                  {activeAlertDetail.menuSafetyAlert?.isSafe ? "Đạt an toàn" : "Cần lưu ý"}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {activeAlertDetail.menuSafetyAlert?.content}
              </p>

              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Lớp: <strong>{activeAlertDetail.className}</strong>
                </span>
                <Link
                  to="/declare-allergy"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >
                  Kiểm tra hồ sơ dị ứng <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* 2. BÁO CÁO TIÊU THỤ LƯỢNG ĂN CỦA BÉ */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-sky-700 block">
                      Tình hình ăn uống tại lớp
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      {activeAlertDetail.dailyIntakeReport?.title || "Báo cáo lượng ăn"}
                    </h3>
                  </div>
                </div>

                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">
                  Giáo viên ghi nhận
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Bữa trưa chính:</span>
                  <strong className="text-slate-900 font-bold">
                    {activeAlertDetail.dailyIntakeReport?.lunchStatus}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Bữa phụ xế chiều:</span>
                  <strong className="text-slate-900 font-bold">
                    {activeAlertDetail.dailyIntakeReport?.snackStatus}
                  </strong>
                </div>
                {activeAlertDetail.dailyIntakeReport?.teacherNote && (
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-emerald-950">
                    <span className="font-bold block mb-0.5">Lời nhắn của cô giáo:</span>
                    <span>{activeAlertDetail.dailyIntakeReport.teacherNote}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end text-xs">
                <Link
                  to="/child-menu-consumption"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >
                  Xem chi tiết suất ăn & thả tim <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* 3. NHẮC NHỞ THỂ LỰC & LỊCH CÂN ĐO */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-amber-700 block">
                      Sức khỏe & Thể trạng
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      {activeAlertDetail.healthReminder?.title || "Theo dõi thể lực"}
                    </h3>
                  </div>
                </div>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                  WAZ: {activeAlertDetail.healthReminder?.latestWaz} SD
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Tình trạng thể chất:</span>
                  <span className="font-bold text-emerald-700">
                    {activeAlertDetail.healthReminder?.statusLabel}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Lịch cân đo định kỳ kế tiếp:</span>
                  <strong className="text-slate-900 font-bold">
                    {activeAlertDetail.healthReminder?.nextMeasurementDate}
                  </strong>
                </div>
                <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-200 text-teal-950">
                  <span className="font-bold block mb-0.5">Lời khuyên của chuyên gia dinh dưỡng:</span>
                  <span>{activeAlertDetail.healthReminder?.nutritionistAdvice}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end text-xs">
                <Link
                  to="/parent/growth"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >
                  Xem biểu đồ Z-score WHO <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* 4. TƯ VẤN KÉN ĂN / BỔ SUNG TẠI NHÀ (UC71) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-orange-700 block">
                      Tư vấn trẻ kén ăn • UC71
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      Bổ sung dinh dưỡng tại gia đình
                    </h3>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    pickyAdvice
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {pickyAdvice ? "Có tư vấn mới" : "Bé ăn ngoan"}
                </span>
              </div>

              {pickyAdvice ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-950">
                    <strong className="block mb-1 font-bold">{pickyAdvice.adviceTitle}</strong>
                    <p className="leading-relaxed">{pickyAdvice.homeSupplementAdvice}</p>
                  </div>
                  {pickyAdvice.recommendedDishes?.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-semibold block mb-1">
                        Món ăn gợi ý tăng cường:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {pickyAdvice.recommendedDishes.map((dish, i) => (
                          <span
                            key={i}
                            className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-800 font-semibold"
                          >
                            {dish}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center text-xs text-slate-500">
                  Bé có sức ăn tốt, hiện không có cảnh báo kén ăn hay biếng ăn cần tư vấn can thiệp.
                </div>
              )}

              <div className="pt-2 flex justify-end text-xs">
                <Link
                  to="/child-menu-consumption"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >
                  Xem thực đơn & xác nhận tư vấn <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

