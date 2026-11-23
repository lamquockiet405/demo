import { normalizeSearch } from '../../../core/utils/search';
import { formatDateDMY, formatDateTimeDMY } from '../../../core/utils/date';
import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "../../../core/api/axios";
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  Send,
  BellRing,
  Download,
  AlertCircle,
  Receipt,
  User,
  GraduationCap,
  Calendar,
  X,
  ExternalLink,
} from "lucide-react";
import { downloadExcelSheets } from "../../../core/utils/excel-export";
import { ElectronicReceiptModal } from "../../payments/components/ElectronicReceiptModal";
import { vnpayApi, ElectronicReceiptData } from "../../payments/api/vnpay.api";

interface InvoiceRow {
  id: number;
  registrationId: number;
  invoiceCode: string;
  orderCode: string;
  childId: number;
  childName: string;
  className: string;
  parentName: string;
  parentPhone: string;
  periodId: number;
  periodName: string;
  packageName: string;
  periodText: string;
  amount: number | null;
  status: "PENDING" | "PAID" | "SUCCESS" | "FAILED" | "CANCELLED";
  statusLabel: string;
  registeredAt: string | null;
  paidAt: string | null;
  vnpTransactionNo: string | null;
  dueDate: string | null;
  lastRemindedAt?: string | null;
  reminderCount?: number;
}

export function PrincipalPaymentsPage() {
  useLanguage();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [batchReminding, setBatchReminding] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ElectronicReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<number | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<InvoiceRow[]>("/payments/invoices");
      const list = Array.isArray(res.data)
        ? res.data
        : ((res.data as any)?.items || (res.data as any)?.data || []);
      setInvoices(list);
    } catch (err: any) {
      setError(err.response?.data?.message || "Không thể tải danh sách hóa đơn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInvoices();
  }, []);

  // Danh sách các lớp học độc nhất để lọc
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.className) set.add(inv.className);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Bộ lọc danh sách
  const filteredRows = useMemo(() => {
    return invoices.filter((r) => {
      // 1. Lọc theo trạng thái
      if (statusFilter === "PENDING" && r.status !== "PENDING") return false;
      if (statusFilter === "PAID" && r.status !== "PAID" && r.status !== "SUCCESS") return false;
      if (statusFilter === "FAILED" && r.status !== "FAILED" && r.status !== "CANCELLED") return false;

      // 2. Lọc theo lớp
      if (classFilter !== "ALL" && r.className !== classFilter) return false;

      // 3. Lọc theo ngày
      if (dateFilter) {
        const paidDate = r.paidAt ? r.paidAt.slice(0, 10) : "";
        const regDate = r.registeredAt ? r.registeredAt.slice(0, 10) : "";
        if (paidDate !== dateFilter && regDate !== dateFilter) return false;
      }

      // 4. Lọc theo từ khóa tìm kiếm
      if (search.trim()) {
        const q = normalizeSearch(search.trim());
        const str = `${r.invoiceCode || ""} ${r.orderCode || ""} ${r.childName || ""} ${r.parentName || ""} ${r.parentPhone || ""} ${r.className || ""} ${r.periodName || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, classFilter, dateFilter, search]);

  // Thống kê KPI
  const stats = useMemo(() => {
    const total = invoices.length;
    const paidList = invoices.filter((i) => i.status === "PAID" || i.status === "SUCCESS");
    const pendingList = invoices.filter((i) => i.status === "PENDING");
    const paidCount = paidList.length;
    const pendingCount = pendingList.length;
    const totalPaidAmount = paidList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return { total, paidCount, pendingCount, totalPaidAmount };
  }, [invoices]);

  // Gửi nhắc phí cho 1 hóa đơn
  const handleRemindSingle = async (row: InvoiceRow) => {
    setRemindingId(row.id);
    try {
      const res = await apiClient.post(`/payments/invoices/${row.id}/remind`);
      const msg = res.data?.message || `Đã gửi thông báo nhắc phí đến phụ huynh ${row.parentName || ""} (Bé ${row.childName}) thành công!`;
      setToast(msg);
      // Cập nhật trạng thái trực tiếp trên state
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                lastRemindedAt: new Date().toISOString(),
                reminderCount: (item.reminderCount || 0) + 1,
              }
            : item,
        ),
      );
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      alert(translateText(err.response?.data?.message || "Không thể gửi thông báo nhắc phí."));
    } finally {
      setRemindingId(null);
    }
  };

  // Gửi nhắc phí hàng loạt cho tất cả các đơn chờ
  const handleBatchRemind = async () => {
    const pendingCount = invoices.filter((i) => i.status === "PENDING").length;
    if (pendingCount === 0) {
      alert(translateText("Hiện tại không có hóa đơn nào đang chờ thanh toán cần nhắc phí."));
      return;
    }

    if (!window.confirm(translateText(`Bạn có chắc chắn muốn gửi thông báo nhắc phí đến toàn bộ ${pendingCount} phụ huynh có hóa đơn chưa thanh toán?`))) {
      return;
    }

    setBatchReminding(true);
    try {
      const res = await apiClient.post("/payments/invoices/batch-remind");
      const msg = res.data?.message || `Đã gửi thông báo nhắc phí tới ${res.data?.sentCount || pendingCount} phụ huynh thành công!`;
      setToast(msg);
      await fetchInvoices();
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      alert(translateText(err.response?.data?.message || "Không thể gửi nhắc phí hàng loạt."));
    } finally {
      setBatchReminding(false);
    }
  };

  // Mở biên lai điện tử cho hóa đơn đã thanh toán
  const handleViewReceipt = async (row: InvoiceRow) => {
    setLoadingReceiptId(row.id);
    try {
      const receiptData = await vnpayApi.getReceipt(row.registrationId || row.id);
      setSelectedReceipt(receiptData);
    } catch (err: any) {
      alert(translateText(err.response?.data?.message || "Không thể lấy chi tiết biên lai thu tiền."));
    } finally {
      setLoadingReceiptId(null);
    }
  };

  // Xuất file Excel
  const handleExportExcel = () => {
    const headers = [
      "Mã Hóa Đơn",
      "Học Sinh",
      "Lớp",
      "Phụ Huynh",
      "Số Điện Thoại",
      "Gói Thực Đơn",
      "Số Tiền (VNĐ)",
      "Trạng Thái",
      "Thời Điểm Thanh Toán",
      "Đã Nhắc Phí Lúc",
    ];

    const dataRows = filteredRows.map((r) => [
      r.invoiceCode || `INV-${r.id}`,
      r.childName || "—",
      r.className || "—",
      r.parentName || "—",
      r.parentPhone || "—",
      r.packageName || r.periodName || "Thực đơn ăn xế",
      Number(r.amount || 0),
      r.status === "PAID" || r.status === "SUCCESS"
        ? "Đã thanh toán"
        : r.status === "PENDING"
          ? "Chờ thanh toán"
          : "Thất bại",
      r.paidAt ? formatDateTimeDMY(r.paidAt) : "Chưa thanh toán",
      r.lastRemindedAt ? formatDateTimeDMY(r.lastRemindedAt) : "Chưa nhắc",
    ]);

    downloadExcelSheets("Lich_Su_Thanh_Toan_KidMeal.xlsx", "Lịch sử thanh toán", [
      { name: "Danh sách hóa đơn", rows: [headers, ...dataRows] },
    ]);
  };

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Thông báo Toast */}
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{translateText(toast)}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cảnh báo lỗi */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-sm font-semibold">{translateText(error)}</span>
        </div>
      )}

      {/* ─── 2. KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{translateText("Tổng số hóa đơn")}</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800">{translateText("Đã thanh toán (VNPAY)")}</p>
            <p className="text-2xl font-black text-emerald-700">{stats.paidCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-300 bg-amber-50/30 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800">{translateText("Chờ thanh toán (Chờ xử lý)")}</p>
            <p className="text-2xl font-black text-amber-700">{stats.pendingCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-teal-200 bg-teal-50/20 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-teal-800">{translateText("Tổng doanh thu đã thu")}</p>
            <p className="text-2xl font-black text-teal-700">
              {stats.totalPaidAmount.toLocaleString(getLocale())} ₫
            </p>
          </div>
        </div>
      </div>

      {/* ─── 3. Bộ lọc và Tìm kiếm Hiện Đại ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={translateText("Tìm theo học sinh, phụ huynh, lớp, mã hóa đơn...")}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>

          {/* Lọc trạng thái */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">{translateText("Tất cả trạng thái")}</option>
              <option value="PENDING">{translateText("Chờ thanh toán (PENDING)")}</option>
              <option value="PAID">{translateText("Đã thanh toán (PAID)")}</option>
              <option value="FAILED">{translateText("Thất bại / Đã hủy")}</option>
            </select>
          </div>

          {/* Lọc lớp */}
          {classOptions.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">{translateText("Tất cả các lớp")}</option>
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lọc ngày */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              title={translateText("Lọc theo ngày thanh toán")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút reset */}
          {(search || statusFilter !== "ALL" || classFilter !== "ALL" || dateFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setClassFilter("ALL");
                setDateFilter("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold px-3 py-1.5 rounded-xl hover:bg-rose-50 transition cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              {translateText("Đặt lại")}
            </button>
          )}

          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center cursor-pointer"
            title={translateText("Làm mới dữ liệu")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : "text-slate-500"}`} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{translateText("Xuất Excel")}</span>
          </button>

          <button
            onClick={handleBatchRemind}
            disabled={batchReminding || stats.pendingCount === 0}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              stats.pendingCount > 0
                ? "bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <BellRing className={`w-3.5 h-3.5 ${batchReminding ? "animate-spin" : ""}`} />
            <span>{batchReminding
              ? translateText("Đang gửi...")
              : translateText(`Nhắc phí (${stats.pendingCount})`)}</span>
          </button>
        </div>
      </div>

      {/* ─── 4. Bảng Dữ Liệu Hóa Đơn ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-600">
              {translateText("Đang tải dữ liệu lịch sử thanh toán & hóa đơn...")}
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {translateText("Không tìm thấy hóa đơn nào")}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {translateText(
                search || statusFilter !== "ALL" || classFilter !== "ALL" || dateFilter
                  ? "Thử thay đổi điều kiện tìm kiếm hoặc đặt lại bộ lọc để tra cứu hóa đơn khác."
                  : "Chưa có hồ sơ hóa đơn tiền ăn xế nào được tạo trong hệ thống.",
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-teal-600 text-white">
                <tr className="bg-teal-600 border-b border-teal-700/60 text-white uppercase font-bold tracking-wider">
                  <th className="py-4 px-4 font-black text-white">{translateText("Hóa đơn")}</th>
                  <th className="py-4 px-4 font-black text-white">{translateText("Học sinh / Lớp")}</th>
                  <th className="py-4 px-4 font-black text-white">{translateText("Phụ huynh")}</th>
                  <th className="py-4 px-4 font-black text-white">{translateText("Gói dịch vụ")}</th>
                  <th className="py-4 px-4 font-black text-white">{translateText("Số tiền")}</th>
                  <th className="py-4 px-4 font-black text-white">{translateText("Trạng thái")}</th>
                  <th className="py-4 px-4 font-black text-white">{translateText("Thanh toán lúc")}</th>
                  <th className="py-4 px-4 font-black text-right text-white">{translateText("Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r) => {
                  const isPaid = r.status === "PAID" || r.status === "SUCCESS";
                  const isPending = r.status === "PENDING";
                  const displayCode = r.invoiceCode || r.orderCode || `INV-${r.id}`;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      {/* Mã Hóa Đơn */}
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md text-[11px] border border-slate-200/80">
                          {displayCode}
                        </span>
                      </td>

                      {/* Học sinh / Lớp */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {r.childName || "—"}
                        </div>
                        <div className="text-[11px] font-semibold text-teal-700 mt-0.5 inline-flex items-center gap-1 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                          <GraduationCap className="w-3 h-3" />
                          {r.className || "Chưa xếp lớp"}
                        </div>
                      </td>

                      {/* Phụ huynh */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">
                          {r.parentName || "—"}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {r.parentPhone || "—"}
                        </div>
                      </td>

                      {/* Gói dịch vụ */}
                      <td className="py-4 px-4 max-w-[240px]">
                        <div className="font-bold text-slate-800 truncate" title={r.packageName || r.periodName}>
                          {translateText(r.packageName || r.periodName || "Thực đơn ăn xế")}
                        </div>
                        {r.periodText && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {r.periodText}
                          </div>
                        )}
                      </td>

                      {/* Số tiền */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-black text-slate-900 text-sm">
                          {r.amount != null
                            ? `${Number(r.amount).toLocaleString(getLocale())} ₫`
                            : "—"}
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {translateText("Đã thanh toán")}
                          </span>
                        ) : isPending ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {translateText("Chờ xử lý")}
                            </span>
                            {r.lastRemindedAt && (
                              <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                                <BellRing className="w-3 h-3" />
                                {translateText(`Đã nhắc (${formatDateDMY(r.lastRemindedAt)})`)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                            {translateText(r.status)}
                          </span>
                        )}
                      </td>

                      {/* Thời điểm thanh toán */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-600">
                        {r.paidAt ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800">
                              {new Date(r.paidAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {formatDateDMY(r.paidAt)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">
                            {translateText("Chưa thanh toán")}
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              onClick={() => void handleRemindSingle(r)}
                              disabled={remindingId === r.id}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title={translateText("Gửi thông báo nhắc phụ huynh đóng tiền ăn xế")}
                            >
                              <BellRing className={`w-3.5 h-3.5 ${remindingId === r.id ? "animate-spin" : ""}`} />
                              {remindingId === r.id
                                ? translateText("Đang gửi...")
                                : translateText("Nhắc phí")}
                            </button>
                          )}

                          {isPaid && (
                            <button
                              onClick={() => void handleViewReceipt(r)}
                              disabled={loadingReceiptId === r.id}
                              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title={translateText("Xem chi tiết biên lai thu tiền điện tử")}
                            >
                              <Receipt className={`w-3.5 h-3.5 ${loadingReceiptId === r.id ? "animate-spin" : ""}`} />
                              {loadingReceiptId === r.id
                                ? translateText("Đang mở...")
                                : translateText("Biên lai")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modal Biên Lai Thu Tiền Điện Tử ─── */}
      <ElectronicReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
