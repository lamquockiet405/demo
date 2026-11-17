import { normalizeSearch } from '../../../core/utils/search';
import { getLocale, t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect, useRef } from "react";
import {
  vnpayApi,
  SnackInvoiceItem,
  ElectronicReceiptData,
} from "../api/vnpay.api";
import { fetchParentSnackOverview } from "../../snack-services/api/snackServicesApi";
import {
  ParentSnackOverviewResponse,
  SnackMenuDayItem,
} from "../../snack-services/types/snackServices";
import { ElectronicReceiptModal } from "../components/ElectronicReceiptModal";
import { ParentPortalTopNav } from "../../parent-evaluations/components/ParentPortalTopNav";
import { apiClient } from "../../../core/api/axios";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Coffee,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Lock,
  Unlock,
  UtensilsCrossed,
  Flame,
  PlusCircle,
  Search,
  BellRing,
} from "lucide-react";

const formatNumber = (value: number | null | undefined, unit: string) =>
  value != null && Number.isFinite(value)
    ? `${value.toLocaleString(getLocale())} ${unit}`
    : "Chưa có dữ liệu";

const toSnackText = (text?: string) => text || "";

const getWeeklyBilling = (invoice: SnackInvoiceItem) => {
  const servingDays = Number(invoice.servingDays) || 5;
  const weeks = Math.max(1, Math.ceil(servingDays / 5));
  const total = Number(invoice.amount) || 0;
  return {
    weeks,
    pricePerWeek: total > 0 ? total / weeks : (Number(invoice.pricePerDay) || 0) * 5,
  };
};

export const ParentSnackPaymentPage: React.FC = () => {
  useLanguage();
  const [invoices, setInvoices] = useState<SnackInvoiceItem[]>([]);
  const [overview, setOverview] = useState<ParentSnackOverviewResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedReceipt, setSelectedReceipt] =
    useState<ElectronicReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);
  const [showSandboxGuide, setShowSandboxGuide] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSchedulePeriodId, setSelectedSchedulePeriodId] = useState<
    number | null
  >(null);
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");

  const latestRequest = useRef(0);

  const fetchAllData = async (showLoading = true) => {
    const requestId = ++latestRequest.current;
    if (showLoading) setLoading(true);
    setErrorMessage(null);
    try {
      const [invoiceResult, overviewResult] = await Promise.allSettled([
        vnpayApi.getMyInvoices(),
        fetchParentSnackOverview(),
      ]);
      if (requestId !== latestRequest.current) return;
      setInvoices(invoiceResult.status === "fulfilled" ? invoiceResult.value : []);
      const overviewData = overviewResult.status === "fulfilled" ? overviewResult.value : null;
      setOverview(overviewData);
      const paidPackages = overviewData?.publishedPackages?.filter((p) => p.isPaid) || [];
      setSelectedSchedulePeriodId((previous) =>
        paidPackages.some((p) => p.periodId === previous)
          ? previous
          : paidPackages[0]?.periodId ?? null,
      );
      if (overviewResult.status === "rejected") {
        setErrorMessage("Không thể tải các gói ăn xế đã công bố. Vui lòng bấm Làm mới dữ liệu để thử lại.");
      } else if (invoiceResult.status === "rejected") {
        setErrorMessage("Không thể tải hóa đơn ăn xế của bé. Vui lòng bấm Làm mới dữ liệu để thử lại.");
      }
    } catch (err: any) {
      console.error("Failed to load parent snack invoices", err);
      setInvoices([]);
      setErrorMessage(
        err.response?.data?.message ||
          "Không thể tải dữ liệu hóa đơn ăn phụ. Vui lòng thử lại sau.",
      );
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllData();
    const refresh = () => {
      if (document.visibilityState === "visible") void fetchAllData(false);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      latestRequest.current++;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, []);

  const handleCheckout = async (invoice: SnackInvoiceItem) => {
    setProcessingId(invoice.registrationId);
    setErrorMessage(null);
    try {
      const res = await vnpayApi.createPaymentUrl({
        registrationId: invoice.registrationId,
      });

      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        throw new Error("Máy chủ chưa trả về đường dẫn thanh toán VNPAY.");
      }
    } catch (err: any) {
      console.error("Checkout error", err);
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Không thể khởi tạo phiên thanh toán VNPAY. Xin vui lòng thử lại sau.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleEnrollAndPayPackage = async (periodId: number) => {
    setProcessingId(periodId);
    setErrorMessage(null);
    try {
      if (!overview?.student?.id) {
        throw new Error("Chưa tìm thấy hồ sơ của bé để đăng ký. Vui lòng liên hệ nhà trường.");
      }
      const createRes = await apiClient.post("/payments/invoices", {
        periodId,
        studentId: overview.student.id,
      });
      const regId = Number(createRes.data?.registrationId);
      if (regId) {
        const payRes = await vnpayApi.createPaymentUrl({
          registrationId: regId,
        });
        if (payRes.paymentUrl) {
          window.location.href = payRes.paymentUrl;
          return;
        }
      }
      throw new Error("Máy chủ chưa trả về đường dẫn thanh toán VNPAY.");
    } catch (err: any) {
      await fetchAllData(false);
      setErrorMessage(
        err.response?.data?.message ||
          err.message || "Không thể đăng ký gói ăn xế. Vui lòng thử lại.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewReceipt = async (registrationId: number) => {
    setLoadingReceipt(true);
    try {
      const receiptData = await vnpayApi.getReceipt(registrationId);
      setSelectedReceipt(receiptData);
    } catch (err) {
      console.error("Failed to fetch receipt", err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Kiểm tra phụ huynh đã đóng tiền ít nhất 1 gói ăn xế chưa
  const paidInvoices = invoices.filter((inv) => inv.status === "PAID");
  const pendingInvoices = invoices.filter((inv) => inv.status !== "PAID");
  const hasPaidAnySnack =
    paidInvoices.length > 0 || Boolean(overview?.hasPaidAnyPackage);

  // Lấy lịch ăn xế của gói đã đóng tiền
  const paidPackagesWithSchedule =
    overview?.publishedPackages?.filter((p) => p.isPaid && p.canViewSchedule) ||
    [];
  const activePaidPkg =
    paidPackagesWithSchedule.find(
      (p) => p.periodId === selectedSchedulePeriodId,
    ) || paidPackagesWithSchedule[0];

  const scheduleToDisplay: SnackMenuDayItem[] = hasPaidAnySnack
    ? activePaidPkg?.menuSchedule?.length
      ? activePaidPkg.menuSchedule
      : overview?.activeSchedule?.length
        ? overview.activeSchedule
        : []
    : [];

  const filteredInvoices = invoices.filter((inv) => {
    const q = normalizeSearch(searchKeyword.trim());
    const matchSearch =
      !q ||
      normalizeSearch(inv.periodName).includes(q) ||
      normalizeSearch(inv.invoiceCode).includes(q) ||
      normalizeSearch(inv.childName).includes(q);
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PAID" && inv.status === "PAID") ||
      (statusFilter === "PENDING" && inv.status !== "PAID");
    return matchSearch && matchStatus;
  });

  const availablePublishedPackages = (overview?.publishedPackages || [])
    .filter(
      (pkg) =>
        statusFilter !== "PAID" && pkg.periodStatus === "OPEN" &&
        !invoices.some(
          (inv) => Number(inv.periodId) === Number(pkg.periodId),
        ),
    )
    .filter((pkg) => {
      const q = normalizeSearch(searchKeyword.trim());
      return (
        !q ||
        normalizeSearch(pkg.periodName).includes(q) ||
        normalizeSearch(pkg.description).includes(q)
      );
    })
    .sort((a, b) => b.periodId - a.periodId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <ParentPortalTopNav
        activeTab="snacks"
        child={
          {
            id: String(overview?.student?.id || "1"),
            name: overview?.student?.fullName || "Hồ sơ của bé",
            className: overview?.student?.className || "Lớp mầm non",
            gradeLevel: "Mẫu giáo",
            parentName: invoices[0]?.parentName || "Phụ huynh",
            parentRole: "Phụ huynh",
          } as any
        }
      />

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-7 space-y-6 flex-1">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="text-sm font-medium">{translateText(errorMessage)}</div>
          </div>
        )}

        {/* Page Banner */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">{translateText("UC62 • VNPAY Sandbox")}</span>
              <span className="text-xs text-teal-200">{translateText("Ký số HMAC-SHA512")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Coffee className="w-8 h-8 text-amber-300" />{translateText("Gói Dịch Vụ Suất Ăn Xế & Thanh Toán")}</h1>
            <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">{translateText("Xem các gói dịch vụ suất ăn xế do Hiệu trưởng công bố, đóng phí trực tuyến qua VNPAY và theo dõi lịch thực đơn ăn xế của bé sau khi hoàn tất thanh toán.")}</p>
          </div>

          <button
          onClick={() => void fetchAllData()}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />{translateText("Làm mới dữ liệu")}</button>
        </div>

        {/* VNPAY Sandbox Test Card Instructions */}

        {/* ─── PHẦN 1: LỊCH ĂN SÁNG CỦA BÉ (CHỈ HIỂN THỊ KHI ĐÃ ĐÓNG TIỀN - KHÔNG ĐÓNG LÀ KHÔNG THẤY) ─── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />{translateText("Lịch Ăn Xế & Thực Đơn Ăn Xế 16h30 Của Bé")}</h2>
            {hasPaidAnySnack ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />{translateText("Đã đóng tiền • Đã mở khóa lịch ăn xế")}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <Lock className="w-3.5 h-3.5 text-rose-600" />{translateText("Chưa đóng tiền • Đang khóa lịch ăn xế")}</span>
            )}
          </div>

          {!hasPaidAnySnack ? (
            /* KHI CHƯA ĐÓNG TIỀN: ẨN HOÀN TOÀN LỊCH ĂN SÁNG */
            <div className="bg-white rounded-3xl border-2 border-dashed border-amber-300 p-8 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <div className="max-w-lg mx-auto space-y-1.5">
                <h3 className="text-lg font-black text-slate-900">{translateText("Lịch Ăn Xế Chỉ Hiển Thị Sau Khi Đã Đóng Tiền")}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{translateText("Hiện tại bé chưa có gói dịch vụ suất ăn xế nào ở trạng thái")}{" "}
                  <strong>{translateText("Đã thanh toán (PAID)")}</strong>{translateText(". Quý Phụ huynh vui lòng thanh toán gói dịch vụ suất ăn xế bên dưới qua cổng VNPAY để mở khóa xem toàn bộ lịch ăn xế và thực đơn ăn xế do Chuyên gia Dinh dưỡng xây dựng.")}</p>
              </div>
              {pendingInvoices.length > 0 && (
                pendingInvoices[0].isPaymentLocked || pendingInvoices[0].periodStatus === "LOCKED" ? (
                  <button
                    disabled
                    className="px-6 py-3 bg-slate-200 text-slate-500 text-xs font-black rounded-2xl shadow-none cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4 text-slate-400" />
                    {translateText("Dịch vụ này đã bị khóa - Không thể đóng tiền")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(pendingInvoices[0])}
                    disabled={processingId !== null || pendingInvoices[0].amount == null}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black rounded-2xl shadow-md transition inline-flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />{translateText("Đóng tiền suất ăn xế ngay để xem Lịch ăn xế (")}{translateText(formatNumber(pendingInvoices[0].amount, "đ"))})
                  </button>
                )
              )}
            </div>
          ) : (
            /* KHI ĐÃ ĐÓNG TIỀN (PAID): HIỂN THỊ ĐẦY ĐỦ LỊCH ĂN SÁNG TỪ THỨ 2 -> THỨ 6 */
            <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                    <UtensilsCrossed className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">{translateText("Lịch Thực Đơn Suất Ăn Xế Hàng Tuần (Do Chuyên Gia Dinh Dưỡng Thiết Kế)")}</div>
                    <h3 className="text-base font-black">
                      {translateText(toSnackText(
                        activePaidPkg?.periodName ||
                          paidInvoices[0]?.periodName ||
                          overview?.paidPackageName ||
                          "Gói Suất Ăn Xế Dinh Dưỡng",
                      ))}
                    </h3>
                  </div>
                </div>

                {paidPackagesWithSchedule.length > 1 && (
                  <select
                    value={selectedSchedulePeriodId || ""}
                    onChange={(e) =>
                      setSelectedSchedulePeriodId(Number(e.target.value))
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/15 text-white text-xs font-bold border border-white/30 focus:outline-none"
                  >
                    {paidPackagesWithSchedule.map((pkg) => (
                      <option
                        key={pkg.periodId}
                        value={pkg.periodId}
                        className="text-slate-900"
                      >
                        {translateText(toSnackText(pkg.periodName))}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3.5">
                {scheduleToDisplay.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between space-y-3 hover:border-teal-300 hover:bg-white transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="font-black text-xs text-teal-800 uppercase">
                          {translateText(day.dayLabel)}
                        </span>
                        <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                          {translateText(day.servingTime)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">{translateText("Món chính ăn xế:")}</span>
                        <p className="text-xs font-extrabold text-slate-900 mt-0.5 leading-snug">
                          {translateText(day.mainDish)}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">{translateText("Thức uống dinh dưỡng:")}</span>
                        <p className="text-xs font-semibold text-teal-700 mt-0.5">
                          {translateText(day.drinkItem)}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">{translateText("Trái cây / Món kèm:")}</span>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {translateText(day.fruitOrSide)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-700 font-bold flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-amber-500" />
                          {day.caloriesKcal}{translateText(" Kcal")}</span>
                        <span className="text-slate-500 font-medium">{translateText("Đạm: ")}{day.proteinG}{translateText("g")}</span>
                      </div>
                      {day.allergenTags && day.allergenTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {day.allergenTags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[9px] font-bold"
                            >{translateText("Lưu ý: ")}{translateText(tag)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ─── PHẦN 2: CÁC GÓI DỊCH VỤ SUẤT ĂN SÁNG ĐÃ ĐƯỢC HIỆU TRƯỞNG TẠO & CÔNG BỐ + PHIẾU THU VNPAY ─── */}
        <div className="space-y-4">
          {/* CẢNH BÁO NHẮC PHÍ TỪ BAN GIÁM HIỆU */}
          {invoices.some((inv) => inv.status !== "PAID" && (inv.lastRemindedAt || (inv.reminderCount && inv.reminderCount > 0))) && (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <BellRing className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/30 uppercase tracking-wider">
                      {translateText("Thông Báo Nhắc Phí")}
                    </span>
                    <span className="text-xs text-amber-100 font-semibold">
                      {translateText("Từ Ban Giám Hiệu")}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1">
                    {translateText("Nhà trường xin nhắc lịch hoàn tất thanh toán tiền ăn xế cho các hóa đơn đang chờ. Quý phụ huynh vui lòng thanh toán trực tuyến qua VNPAY để nhà trường chuẩn bị phần ăn chu đáo cho bé.")}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />{translateText("Gói Dịch Vụ Suất Ăn Xế Đã Công Bố & Phiếu Thu Của Bé")}</h2>
              <span className="text-xs text-slate-500">{translateText("Tìm thấy: ")}<strong>{filteredInvoices.length + availablePublishedPackages.length}</strong>{translateText(" gói dịch vụ")}</span>
            </div>

            {/* STT 56-57: Search & Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder={translateText("Tìm gói, mã hóa đơn...")}
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 w-44 sm:w-56"
                />
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    statusFilter === "ALL"
                      ? "bg-white text-teal-800 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >{translateText("Tất cả")}</button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("PENDING")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    statusFilter === "PENDING"
                      ? "bg-white text-amber-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >{translateText("Chờ thanh toán")}</button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("PAID")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    statusFilter === "PAID"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >{translateText("Đã thanh toán")}</button>
              </div>
            </div>
          </div>

          {/* Các gói mới công bố chưa tạo invoice (nếu có và phù hợp bộ lọc) */}
          {!loading &&
            availablePublishedPackages.map((pkg) => (
              <div
                key={`pub-${pkg.periodId}`}
                className="bg-white rounded-3xl border border-teal-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
              >
                <div className="space-y-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-800 border border-teal-200">{translateText("✨ Gói Suất Ăn Xế Mới Công Bố Từ Nhà Trường")}</span>
                  <h3 className="text-lg font-black text-slate-900">
                    {translateText(toSnackText(pkg.periodName))}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {translateText(toSnackText(pkg.description))}
                  </p>
                  <p className="text-xs text-slate-500">{translateText("Thời gian phục vụ:")}{" "}
                    <strong>
                      {translateText(pkg.startDate)} ~ {translateText(pkg.endDate)}
                    </strong>{" "}{translateText("• Mức phí:")}{" "}
                    <strong className="text-emerald-700 font-black">
                      {translateText(formatNumber(pkg.feeAmount, "VNĐ"))}
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => handleEnrollAndPayPackage(pkg.periodId)}
                  disabled={processingId === pkg.periodId || pkg.feeAmount == null}
                  className="px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-2xl shadow-md transition flex items-center justify-center gap-2 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />{translateText("Đăng ký & Thanh toán VNPAY (")}{translateText(formatNumber(pkg.feeAmount, "đ"))})
                </button>
              </div>
            ))}

          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600">{translateText("Đang tải gói dịch vụ & phiếu thu tiền suất ăn xế...")}</p>
            </div>
          ) : filteredInvoices.length === 0 && availablePublishedPackages.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">{translateText("Không tìm thấy gói suất ăn xế nào phù hợp")}</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {translateText(searchKeyword || statusFilter !== "ALL"
                  ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái để xem các gói dịch vụ khác."
                  : "Khi Hiệu trưởng tạo và công bố gói dịch vụ suất ăn xế mới, gói sẽ hiển thị ngay tại đây để Phụ huynh đăng ký và thanh toán.")}
              </p>
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className={`bg-white rounded-3xl border transition-all p-6 shadow-sm hover:shadow-md ${
                  inv.status === "PAID"
                    ? "border-emerald-200 bg-gradient-to-r from-emerald-50/20 to-white"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  {/* Left: Invoice details */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {translateText(inv.status === "PAID"
                          ? "✓ Đã Thanh Toán (Đã Mở Lịch Ăn Xế)"
                          : "⏱ Chờ Thanh Toán (Gói Đang Công Bố)")}
                      </span>

                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        {inv.invoiceCode}
                      </span>

                      {inv.status !== "PAID" && (inv.lastRemindedAt || (inv.reminderCount && inv.reminderCount > 0)) && (
                        <span className="text-xs font-bold bg-amber-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                          <BellRing className="w-3 h-3" />
                          {translateText("Nhà trường đã nhắc phí")}
                        </span>
                      )}

                      <span className="text-xs text-slate-400">|</span>

                      <span className="text-xs text-slate-500">{translateText("Hạn đăng ký & đóng phí:")}{" "}
                        <strong className="text-slate-800">
                          {translateText(inv.dueDate)}
                        </strong>
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {translateText(toSnackText(inv.periodName))}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">{translateText("Học sinh:")}{" "}
                        <strong className="text-slate-900">
                          {inv.childName}
                        </strong>{" "}{translateText("• Lớp:")}{" "}
                        <strong className="text-teal-700">
                          {inv.className}
                        </strong>{" "}{translateText("• Phụ huynh:")}{" "}
                        <strong className="text-slate-800">
                          {inv.parentName}
                        </strong>
                      </p>
                    </div>

                    {/* Formula breakdown */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 flex flex-wrap items-center gap-4">
                      {(() => {
                        const weekly = getWeeklyBilling(inv);
                        return <>
                      <div>
                        <span className="text-slate-400 block text-[11px]">{translateText("Số tuần ăn xế:")}</span>
                        <strong className="text-slate-900 text-sm">
                          {translateText(formatNumber(weekly.weeks, "tuần"))}
                        </strong>
                      </div>
                      <span className="text-slate-300 font-bold">{translateText("&times;")}</span>
                      <div>
                        <span className="text-slate-400 block text-[11px]">{translateText("Đơn giá / tuần:")}</span>
                        <strong className="text-slate-900 text-sm">
                          {translateText(formatNumber(weekly.pricePerWeek, "đ"))}
                        </strong>
                      </div>
                      <span className="text-slate-300 font-bold">=</span>
                      <div>
                        <span className="text-slate-400 block text-[11px]">{translateText("Tổng số tiền:")}</span>
                        <strong className="text-emerald-700 text-base font-black">
                          {translateText(formatNumber(inv.amount, "VNĐ"))}
                        </strong>
                      </div>
                        </>;
                      })()}
                    </div>

                    {inv.status === "PAID" ? (
                      <div className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{translateText("Bé đã được ghi danh vào")}{" "}
                          <strong>{translateText("Danh sách điểm danh ăn xế của Giáo viên & Khẩu phần Bếp")}</strong>
                          .
                        </span>
                      </div>
                    ) : inv.isPaymentLocked || inv.periodStatus === "LOCKED" ? (
                      <div className="text-xs text-rose-700 flex items-center gap-1.5 font-semibold bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                        <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{translateText("Dịch vụ này đã bị nhà trường khóa, không thể đóng tiền nữa.")}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-700 flex items-center gap-1.5 font-medium">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{translateText("Hoàn tất thanh toán VNPAY để mở khóa Lịch ăn xế của gói này và ghi danh bé vào danh sách ăn xế của lớp.")}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-2.5">
                    {inv.status === "PAID" ? (
                      <button
                        onClick={() => handleViewReceipt(inv.registrationId)}
                        disabled={loadingReceipt}
                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />{translateText("Xem & Tải Biên Lai Điện Tử")}</button>
                    ) : inv.isPaymentLocked || inv.periodStatus === "LOCKED" ? (
                      <button
                        disabled
                        className="px-6 py-3.5 bg-slate-200 text-slate-500 text-sm font-bold rounded-2xl shadow-none cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Lock className="w-4 h-4 text-slate-400" />
                        {translateText("Đã khóa dịch vụ - Không thể đóng tiền")}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCheckout(inv)}
                        disabled={processingId === inv.registrationId || inv.amount == null}
                        className="px-6 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-sm font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        {processingId === inv.registrationId ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}{translateText("Thanh toán qua VNPAY QR (")}{translateText(formatNumber(inv.amount, "đ"))})
                      </button>
                    )}

                    <div className="text-[11px] text-slate-400 text-center lg:text-right">
                      {translateText(inv.status === "PAID"
                        ? "Đã lưu vào Lịch sử thanh toán & Doanh thu VNPAY"
                        : "Hỗ trợ VNPAY-QR, Mobile Banking & ATM")}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}


        </div>
      </main>

      {/* Electronic Receipt Modal */}
      <ElectronicReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
};
