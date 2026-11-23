import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
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
  CreditCard,
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
  useLanguage();
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
        activeTab="alerts"
        child={
          selectedChild
            ? {
              name: selectedChild.fullName,
              className: selectedChild.className || selectedChild.class?.name,
            }
            : undefined
        }
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-7 space-y-6 flex-1">
        {/* Action Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {children.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                <Baby className="w-4 h-4 text-teal-600" />
                <select
                  aria-label={translateText("Chọn học sinh")}
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
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

          <button
            type="button"
            onClick={() => void loadAlerts()}
            disabled={loading}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>{translateText("Làm mới")}</span>
          </button>
        </div>
        {/* Loading state */}
        {loading && (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="text-sm font-semibold">{translateText("Đang tổng hợp cảnh báo an toàn cho bé...")}</p>
          </div>
        )}

        {/* Error alert */}
        {error && !loading && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">
            {translateText(error)}
          </div>
        )}

        {!loading && activeAlertDetail && (
          <div className="space-y-6">
            {/* THÔNG BÁO NHẮC ĐÓNG PHÍ THỰC ĐƠN ĂN XẾ */}
            {activeAlertDetail.feeReminder?.hasPending && (
              <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-yellow-50/80 p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase text-amber-800 tracking-wider block">
                        {translateText("Thông Báo Đóng Phí Bán Trú")}
                      </span>
                      <h3 className="text-base font-black text-slate-900">
                        {translateText(activeAlertDetail.feeReminder.title)}
                      </h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-black text-amber-900">
                    {activeAlertDetail.feeReminder.lastRemindedAt
                      ? translateText("Đã có nhắc phí từ BGH")
                      : translateText("Chờ thanh toán")}
                  </span>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {translateText(activeAlertDetail.feeReminder.content)}
                </p>

                <div className="bg-white/80 rounded-2xl p-4 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">{translateText("Khoản tiền cần thanh toán:")}</span>
                    <span className="text-xl font-black text-amber-700">
                      {activeAlertDetail.feeReminder.feeAmount.toLocaleString(getLocale())} ₫
                    </span>
                    {activeAlertDetail.feeReminder.deadline && (
                      <span className="text-xs text-slate-500 ml-2">
                        {translateText("(Hạn chót: ")}{activeAlertDetail.feeReminder.deadline}{")"}
                      </span>
                    )}
                  </div>
                  <Link
                    to="/parent-snack-payment"
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition inline-flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{translateText("Thanh toán trực tuyến VNPAY")}</span>
                  </Link>
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
            {/* 1. AN TOÀN THỰC ĐƠN & DỊ ỨNG */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Utensils className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-teal-700 block">{translateText("Hồ sơ dị ứng")}</span>
                    <h3 className="text-base font-black text-slate-900">
                      {translateText(activeAlertDetail.menuSafetyAlert?.title || "Chưa có dữ liệu đối chiếu")}
                    </h3>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${activeAlertDetail.menuSafetyAlert?.isSafe
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                >
                  {translateText(activeAlertDetail.menuSafetyAlert?.isSafe ? "Đã đối chiếu" : "Chưa đối chiếu")}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {activeAlertDetail.menuSafetyAlert?.content}
              </p>

              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">{translateText("Lớp: ")}<strong>{activeAlertDetail.className}</strong>
                </span>
                <Link
                  to="/declare-allergy"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >{translateText("Kiểm tra hồ sơ dị ứng ")}<ExternalLink className="h-3 w-3" />
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
                    <span className="text-[11px] font-black uppercase text-sky-700 block">{translateText("Tình hình ăn uống tại lớp")}</span>
                    <h3 className="text-base font-black text-slate-900">
                      {translateText(activeAlertDetail.dailyIntakeReport?.title || "Báo cáo lượng ăn")}
                    </h3>
                  </div>
                </div>

              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">{translateText("Bữa trưa chính:")}</span>
                  <strong className="text-slate-900 font-bold">
                    {translateText(activeAlertDetail.dailyIntakeReport?.lunchStatus)}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">{translateText("Bữa phụ xế chiều:")}</span>
                  <strong className="text-slate-900 font-bold">
                    {translateText(activeAlertDetail.dailyIntakeReport?.snackStatus)}
                  </strong>
                </div>
                {activeAlertDetail.dailyIntakeReport?.teacherNote && activeAlertDetail.dailyIntakeReport.teacherNote !== 'Chưa có nhận xét của giáo viên' && (
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-emerald-950">
                    <span className="font-bold block mb-0.5">{translateText("Lời nhắn của cô giáo:")}</span>
                    <span>{translateText(activeAlertDetail.dailyIntakeReport.teacherNote)}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end text-xs">
                <Link
                  to="/child-menu-consumption"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >{translateText("Xem chi tiết suất ăn & thả tim ")}<ExternalLink className="h-3 w-3" />
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
                    <span className="text-[11px] font-black uppercase text-amber-700 block">{translateText("Sức khỏe & Thể trạng")}</span>
                    <h3 className="text-base font-black text-slate-900">
                      {translateText(activeAlertDetail.healthReminder?.title || "Theo dõi thể lực")}
                    </h3>
                  </div>
                </div>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{translateText("WAZ: ")}{activeAlertDetail.healthReminder?.latestWaz ?? translateText("Chưa có dữ liệu")}{activeAlertDetail.healthReminder?.latestWaz != null ? translateText(" SD") : ""}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">{translateText("Tình trạng thể chất:")}</span>
                  <span className="font-bold text-emerald-700">
                    {translateText(activeAlertDetail.healthReminder?.statusLabel)}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">{translateText("Lịch cân đo định kỳ kế tiếp:")}</span>
                  <strong className="text-slate-900 font-bold">
                    {activeAlertDetail.healthReminder?.nextMeasurementDate ? translateText(activeAlertDetail.healthReminder.nextMeasurementDate) : translateText("Chưa có lịch cân đo")}
                  </strong>
                </div>
              </div>

              <div className="pt-2 flex justify-end text-xs">
                <Link
                  to="/parent/growth"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >{translateText("Xem biểu đồ Z-score WHO ")}<ExternalLink className="h-3 w-3" />
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
                    <span className="text-[11px] font-black uppercase text-orange-700 block">{translateText("Tư vấn dinh dưỡng trẻ kén ăn")}</span>
                    <h3 className="text-base font-black text-slate-900">{translateText("Bổ sung dinh dưỡng tại gia đình")}</h3>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${pickyAdvice
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800"
                    }`}
                >
                  {translateText(pickyAdvice ? "Có tư vấn mới" : "Chưa có tư vấn")}
                </span>
              </div>

              {pickyAdvice ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-950">
                    <strong className="block mb-1 font-bold">{translateText(pickyAdvice.adviceTitle)}</strong>
                    <p className="leading-relaxed">{pickyAdvice.homeSupplementAdvice}</p>
                  </div>
                  {pickyAdvice.recommendedDishes?.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-semibold block mb-1">{translateText("Món ăn gợi ý tăng cường:")}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {pickyAdvice.recommendedDishes.map((dish, i) => (
                          <span
                            key={i}
                            className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-800 font-semibold"
                          >
                            {translateText(dish)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center text-xs text-slate-500">{translateText("Chưa có tư vấn dinh dưỡng cho bé.")}</div>
              )}

              <div className="pt-2 flex justify-end text-xs">
                <Link
                  to="/child-menu-consumption"
                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900"
                >{translateText("Xem thực đơn & xác nhận tư vấn ")}<ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

