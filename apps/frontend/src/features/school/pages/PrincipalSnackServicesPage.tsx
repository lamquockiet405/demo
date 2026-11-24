import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatDateDMY } from '../../../core/utils/date';
import React, { useState } from "react";
import { apiClient } from "../../../core/api/axios";
import { useAcademicYearFilter } from "../../academic-years/useAcademicYearFilter";
import {
  Coffee,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit2,
  X,
  FileText,
  Sparkles,
  Power,
  Trash2,
  Lock,
  Unlock,
  CalendarRange,
  ShieldAlert,
} from "lucide-react";

// Không dùng toISOString() cho input date: nó chuyển ngày local sang UTC và
// có thể làm Thứ Hai thành Chủ Nhật tại múi giờ Việt Nam.
const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getToday = () => formatLocalDate(new Date());
const getNextMonth = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return formatLocalDate(d);
};

// Helper: Tìm Thứ Hai đầu tiên tính từ một mốc ngày
const getFirstMonday = (d: Date) => {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = res.getDay();
  if (day === 0) res.setDate(res.getDate() + 1); // Chủ nhật -> Thứ Hai (+1)
  else if (day > 1) res.setDate(res.getDate() + (8 - day)); // Thứ Ba..Thứ Bảy -> Thứ Hai tiếp theo
  return res;
};

// Helper: Tính ngày hạn chót đóng tiền tự động (trước ngày bắt đầu 2 ngày)
const calcDeadlineBefore2Days = (startDateStr: string) => {
  if (!startDateStr) return "";
  const d = new Date(`${startDateStr}T12:00:00`);
  d.setDate(d.getDate() - 2);
  return formatLocalDate(d);
};

// Helper: Tính khoảng ngày Thứ Hai -> Thứ Sáu của một tuần dựa trên mốc Thứ Hai cơ sở
const getWeekRangeFromBase = (weekNum: number, baseMonday: Date) => {
  const mon = new Date(baseMonday.getFullYear(), baseMonday.getMonth(), baseMonday.getDate());
  mon.setDate(mon.getDate() + (weekNum - 1) * 7);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const dead = new Date(mon);
  dead.setDate(mon.getDate() - 2); // Trước ngày bắt đầu 2 ngày

  const monStr = `${mon.getDate().toString().padStart(2, "0")}/${(mon.getMonth() + 1).toString().padStart(2, "0")}`;
  const friStr = `${fri.getDate().toString().padStart(2, "0")}/${(fri.getMonth() + 1).toString().padStart(2, "0")}`;

  return {
    startDate: formatLocalDate(mon),
    endDate: formatLocalDate(fri),
    registrationDeadline: formatLocalDate(dead),
    label: `Tuần ${weekNum} (${monStr} → ${friStr})`,
  };
};

// Helper: Tính khoảng ngày tuần kế tiếp dựa trên các gói đã có và năm học áp dụng
const getNextWeekRange = (
  rows: any[],
  academicYear?: { startDate?: string; endDate?: string },
) => {
  const rowsInYear = academicYear?.startDate && academicYear?.endDate
    ? rows.filter(
      (r) =>
        r.startDate >= academicYear.startDate! &&
        r.startDate <= academicYear.endDate!,
    )
    : rows;

  const yearStart = academicYear?.startDate
    ? new Date(`${academicYear.startDate}T12:00:00`)
    : new Date();
  const baseMondayOfYear = getFirstMonday(yearStart);

  if (rowsInYear.length === 0) {
    const range = getWeekRangeFromBase(1, baseMondayOfYear);
    return { weekNumber: 1, ...range };
  }

  const endDates = rowsInYear
    .map((row) => row.endDate)
    .filter(Boolean)
    .sort();
  const latest = endDates[endDates.length - 1];
  const nextMon = new Date(`${latest}T12:00:00`);
  nextMon.setDate(nextMon.getDate() + 1);
  while (nextMon.getDay() !== 1) nextMon.setDate(nextMon.getDate() + 1);

  const maxWeekNum = rowsInYear.reduce(
    (max, row) => Math.max(max, getPackageWeek(row).weekNumber),
    0,
  );
  const nextWeekNumber = maxWeekNum + 1;

  const fri = new Date(nextMon);
  fri.setDate(nextMon.getDate() + 4);
  const dead = new Date(nextMon);
  dead.setDate(nextMon.getDate() - 2); // Trước ngày bắt đầu 2 ngày

  const monStr = `${nextMon.getDate().toString().padStart(2, "0")}/${(nextMon.getMonth() + 1).toString().padStart(2, "0")}`;
  const friStr = `${fri.getDate().toString().padStart(2, "0")}/${(fri.getMonth() + 1).toString().padStart(2, "0")}`;

  return {
    weekNumber: nextWeekNumber,
    startDate: formatLocalDate(nextMon),
    endDate: formatLocalDate(fri),
    registrationDeadline: formatLocalDate(dead),
    label: `Tuần ${nextWeekNumber} (${monStr} → ${friStr})`,
  };
};

// Helper: Xác định số tuần của một gói thực đơn
const getPackageWeek = (r: any): { weekNumber: number; label: string } => {
  if (r.weekNumber) return { weekNumber: Number(r.weekNumber), label: `Tuần ${r.weekNumber}` };
  const m = r.name?.match(/tuần\s*(\d+)/i);
  if (m) return { weekNumber: parseInt(m[1], 10), label: `Tuần ${m[1]}` };
  const d = r.startDate ? new Date(r.startDate).getDate() : 1;
  const w = Math.min(5, Math.ceil(d / 7));
  return { weekNumber: w, label: `Tuần ${w}` };
};

const getEmptyForm = (
  rows: any[] = [],
  academicYear?: { name?: string; startDate?: string; endDate?: string },
) => {
  const defWeek = getNextWeekRange(rows, academicYear);
  const startShort = `${defWeek.startDate.slice(8, 10)}/${defWeek.startDate.slice(5, 7)}`;
  const endShort = `${defWeek.endDate.slice(8, 10)}/${defWeek.endDate.slice(5, 7)}`;
  return {
    name: `Thực đơn ăn xế (${startShort} – ${endShort}) - KidMeal`,
    startDate: defWeek.startDate,
    endDate: defWeek.endDate,
    registrationDeadline: defWeek.registrationDeadline,
    feeAmount: "75000",
    description: "Khẩu phần ăn xế chiều gồm súp/bánh dinh dưỡng, sữa hạt và trái cây tươi theo chuẩn thực đơn tuần.",
    status: "OPEN",
    isPaymentLocked: false,
  };
};

export function PrincipalSnackServicesPage() {
  useLanguage();
  const yearFilter = useAcademicYearFilter();
  const selectedYear =
    yearFilter.years.find((y) => String(y.id) === String(yearFilter.yearId)) ||
    yearFilter.years.find((y) => y.status === "ACTIVE");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState(getEmptyForm([], selectedYear));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<{ items: any[]; total?: number }>({ items: [] });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/snack-services", {
        params: {
          search: search || undefined,
          status: status || undefined,
          academicYearId: yearFilter.yearId || undefined,
        },
      });
      const raw = res.data;
      const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
      setData({ items, total: items.length });
    } catch (err: any) {
      setError(err.response?.data?.message || "Không thể tải danh sách thực đơn ăn xế.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!yearFilter.loading) {
      fetchData();
    }
  }, [search, status, yearFilter.yearId, yearFilter.loading]);

  const rawRows = Array.isArray(data) ? data : data.items || [];

  const rows = rawRows;

  // Thống kê nhanh toàn trường
  const openCount = rawRows.filter((r) => r.status === "OPEN" && !r.isPaymentLocked).length;
  const lockedCount = rawRows.filter((r) => r.status === "LOCKED" || r.isPaymentLocked).length;
  const closedCount = rawRows.filter((r) => r.status === "CLOSED").length;
  const totalRegistered = rawRows.reduce((sum, r) => sum + (Number(r.registeredCount) || 0), 0);

  const openModal = async (row?: any) => {
    setError(null);
    if (row?.id) {
      try {
        const raw = (await apiClient.get(`/snack-services/${row.id}`)).data;
        const d = raw?.data || raw;
        const wk = getPackageWeek(d);
        setForm({
          name: d.name || "",
          startDate: d.startDate || getToday(),
          endDate: d.endDate || getNextMonth(),
          registrationDeadline: d.registrationDeadline || getToday(),
          feeAmount: String(d.feeAmount ?? ""),
          description: d.description || "",
          status: d.status || "OPEN",
          isPaymentLocked: d.status === "LOCKED" || Boolean(d.isPaymentLocked),
        });
      } catch {
        const wk = getPackageWeek(row);
        setForm({
          name: row.name || "",
          startDate: row.startDate || getToday(),
          endDate: row.endDate || getNextMonth(),
          registrationDeadline: row.registrationDeadline || getToday(),
          feeAmount: String(row.feeAmount ?? ""),
          description: row.description || "",
          status: row.status || "OPEN",
          isPaymentLocked: row.status === "LOCKED" || Boolean(row.isPaymentLocked),
        });
      }
    } else {
      setForm(getEmptyForm(rawRows, selectedYear));
    }
    setEditing(row || {});
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.startDate ||
      !form.endDate ||
      form.endDate < form.startDate ||
      !form.registrationDeadline ||
      !form.feeAmount.trim() ||
      !Number.isFinite(Number(form.feeAmount)) ||
      Number(form.feeAmount) < 0
    ) {
      setError("Vui lòng nhập đầy đủ tên gói thực đơn ăn xế, khoảng ngày phục vụ, hạn đóng tiền và mức phí hợp lệ.");
      return;
    }

    const startD = new Date(`${form.startDate}T00:00:00`);
    const deadD = new Date(`${form.registrationDeadline}T00:00:00`);
    const diffDays = Math.round((startD.getTime() - deadD.getTime()) / 86400000);
    if (diffDays < 2) {
      setError("Hạn chót đóng tiền phải trước ngày bắt đầu ít nhất 2 ngày.");
      return;
    }

    if (startD.getDay() !== 1 || new Date(`${form.endDate}T00:00:00`).getDay() !== 5) {
      setError("Ngày phục vụ phải bắt đầu vào Thứ Hai và kết thúc vào Thứ Sáu.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const cleanCode = form.name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 15);
      const periodCode = `PKG-XE-${form.startDate}-${Date.now().toString().slice(-4)}`;

      const finalStatus = form.status === "LOCKED" ? "OPEN" : form.status;

      const body = {
        name: form.name.trim(),
        periodCode,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationDeadline: form.registrationDeadline,
        feeAmount: Number(form.feeAmount),
        nutritionNotes: form.description?.trim() || "",
        description: form.description?.trim() || "",
        status: finalStatus,
        isPaymentLocked: false,
        capacityMode: "UNLIMITED",
      };

      if (editing?.id) {
        await apiClient.put(`/snack-services/${editing.id}`, body);
        setToast("Đã cập nhật thông tin thực đơn ăn xế thành công!");
      } else {
        await apiClient.post("/snack-services/periods", body);
        setToast(finalStatus === "OPEN"
          ? "Đã tạo mới và mở cổng đóng tiền thực đơn ăn xế tuần thành công!"
          : "Đã lưu thực đơn ăn xế. Phụ huynh hiện chưa thể đóng tiền cho gói này.");
      }

      setEditing(null);
      await fetchData();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(". ") : msg || err.message || "Không thể lưu thực đơn ăn xế.");
    } finally {
      setSubmitting(false);
    }
  };

  // Khóa / Mở cổng đóng tiền
  const togglePeriodLock = async (row: any) => {
    try {
      await apiClient.put(`/snack-services/periods/${row.id}/toggle-lock`);
      const willLock = row.status === "OPEN" && !row.isPaymentLocked;
      setToast(willLock
        ? `Đã khóa dịch vụ "${row.name}". Phụ huynh không thể đóng tiền gói này nữa!`
        : `Đã mở lại cổng đóng tiền cho "${row.name}"!`);
      await fetchData();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      alert(translateText(err.response?.data?.message || "Không thể thay đổi trạng thái khóa đóng tiền."));
    }
  };

  const togglePeriodStatus = async (id: number) => {
    try {
      await apiClient.put(`/snack-services/periods/${id}/toggle`);
      setToast("Đã thay đổi trạng thái đóng/mở đợt thực đơn ăn xế thành công!");
      await fetchData();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      alert(translateText(err.response?.data?.message || "Không thể thay đổi trạng thái đợt thực đơn."));
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(translateText(`Bạn có chắc muốn xóa thực đơn ăn xế "${row.name}" không?`))) return;
    try {
      await apiClient.delete(`/snack-services/${row.id}`);
      setToast("Đã xóa thực đơn ăn xế thành công!");
      await fetchData();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      alert(translateText(err.response?.data?.message || "Không thể xóa thực đơn ăn xế."));
    }
  };

  const openDetail = async (id: number | string) => {
    try {
      const res = await apiClient.get(`/snack-services/${id}`);
      setDetail(res.data?.data || res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Không thể tải chi tiết thực đơn ăn xế.");
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Thông báo Toast */}
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{translateText(toast)}</span>
        </div>
      )}

      {/* Lỗi cảnh báo */}
      {error && !editing && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-sm font-semibold">{translateText(error)}</span>
        </div>
      )}

      {/* ─── 2. KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{translateText("Tổng số gói ăn xế")}</p>
            <p className="text-2xl font-black text-slate-900">{rawRows.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800">{translateText("Đang mở đóng tiền")}</p>
            <p className="text-2xl font-black text-emerald-700">{openCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-300 bg-amber-50/30 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800">{translateText("Đã khóa đóng tiền")}</p>
            <p className="text-2xl font-black text-amber-700">{lockedCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-blue-200 bg-blue-50/20 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-800">{translateText("Tổng học sinh đăng ký")}</p>
            <p className="text-2xl font-black text-blue-700">{translateText(totalRegistered)}</p>
          </div>
        </div>
      </div>

      {/* ─── 3. Search & Filter Bar ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={translateText("Tìm theo tên thực đơn ăn xế, tuần...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Lọc Năm học thống nhất */}
          <div className="flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-teal-600 shrink-0" />
            <select
              aria-label={translateText("Năm học")}
              value={yearFilter.yearId}
              onChange={(e) => {
                yearFilter.setYearId(e.target.value);
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-xs"
            >
              {yearFilter.years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                  {year.status === "ACTIVE" ? " (đang áp dụng)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Trạng thái */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{translateText("Tất cả trạng thái")}</option>
              <option value="OPEN">{translateText("Đang mở đóng tiền (OPEN)")}</option>
              <option value="LOCKED">{translateText("Đã khóa đóng tiền (LOCKED)")}</option>
              <option value="CLOSED">{translateText("Đã kết thúc (CLOSED)")}</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title={translateText("Làm mới danh sách")}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>{translateText("Làm mới")}</span>
          </button>

          <button
            onClick={() => void openModal()}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{translateText("Tạo Thực Đơn Ăn Xế")}</span>
          </button>
        </div>
      </div>

      {/* ─── 4. Table Danh Sách Thực Đơn Ăn Xế Theo Tuần ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
            <p className="text-sm font-medium">{translateText("Đang tải danh sách thực đơn ăn xế...")}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
              <Coffee className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">{translateText("Không tìm thấy thực đơn ăn xế nào")}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {translateText(search || status
                ? "Thử thay đổi từ khóa tìm kiếm để xem các thực đơn khác."
                : "Chưa có thực đơn ăn xế nào được tạo. Hãy bấm 'Tạo Thực Đơn Ăn Xế' để công bố cho phụ huynh.")}
            </p>
            {!search && !status && (
              <button
                onClick={() => void openModal()}
                className="mt-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition"
              >
                <PlusCircle className="w-4 h-4" />
                {translateText("Tạo thực đơn đầu tiên")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                <tr>
                  <th className="p-4">{translateText("Tên Thực Đơn Ăn Xế")}</th>
                  <th className="p-4">{translateText("Tuần Áp Dụng & Thời Gian")}</th>
                  <th className="p-4">{translateText("Hạn Đóng Tiền")}</th>
                  <th className="p-4">{translateText("Mức Phí / Tuần")}</th>
                  <th className="p-4 text-center">{translateText("Đã Đăng Ký")}</th>
                  <th className="p-4 text-center">{translateText("Trạng Thái")}</th>
                  <th className="p-4 text-right">{translateText("Thao Tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r: any) => {
                  const wk = getPackageWeek(r);
                  const isLocked = r.status === "LOCKED" || r.isPaymentLocked;
                  const isOpen = r.status === "OPEN" && !isLocked;

                  return (
                    <tr key={r.id} className="hover:bg-teal-50/20 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{r.name}</span>
                          <span className="bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-teal-200 shrink-0">
                            {translateText(wk.label)}
                          </span>
                        </div>
                        {r.description && (
                          <div className="text-slate-500 text-[11px] truncate max-w-sm mt-0.5">{r.description}</div>
                        )}
                      </td>
                      <td className="p-4 text-slate-700 font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 font-bold text-slate-900">
                            <Calendar className="w-3.5 h-3.5 text-teal-600" />
                            {formatDateDMY(r.startDate)} → {formatDateDMY(r.endDate)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {translateText("Phục vụ 5 ngày (Thứ 2 - Thứ 6)")}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          {translateText(r.registrationDeadline || "Không giới hạn")}
                        </span>
                      </td>
                      <td className="p-4 font-black text-emerald-700 text-sm">
                        {translateText(r.feeAmount == null ? "0 đ" : `${Number(r.feeAmount).toLocaleString(getLocale())} đ`)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          <Users className="w-3 h-3 text-slate-500" />
                          {translateText(r.registeredCount || 0)}{translateText(" bé")}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            {translateText("Đang mở đóng tiền")}
                          </span>
                        ) : isLocked ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                            <Lock className="w-3 h-3 text-amber-700" />
                            {translateText("Đã khóa đóng tiền")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {translateText("Đã kết thúc")}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => void openDetail(r.id)}
                            title={translateText("Xem chi tiết & danh sách đăng ký")}
                            className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition inline-flex items-center"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                          </button>

                          <button
                            onClick={() => void openModal(r)}
                            title={translateText("Chỉnh sửa thực đơn ăn xế")}
                            className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition inline-flex items-center shadow-xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Chức năng: Khóa dịch vụ không thể đóng tiền nữa / Mở lại đóng tiền */}
                          <button
                            onClick={() => void togglePeriodLock(r)}
                            title={translateText(isLocked ? "Mở lại cổng đóng tiền" : "Khóa dịch vụ (Không thể đóng tiền nữa)")}
                            className={`p-2 rounded-xl font-bold transition inline-flex items-center border ${isLocked
                              ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              : "border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                              }`}
                          >
                            {isLocked ? (
                              <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-amber-700" />
                            )}
                          </button>

                          {/* Đóng / mở đợt */}
                          <button
                            onClick={() => void togglePeriodStatus(r.id)}
                            title={translateText(r.status === "CLOSED" ? "Kích hoạt lại gói" : "Kết thúc đợt phục vụ")}
                            className={`p-2 rounded-xl font-bold transition inline-flex items-center border ${r.status === "CLOSED"
                              ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                              : "border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                              }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => void handleDelete(r)}
                            title={translateText("Xóa thực đơn ăn xế")}
                            className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold transition inline-flex items-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ─── 5. Modal Tạo / Cập nhật Thực Đơn Ăn Xế (Phân theo tuần & Khóa đóng tiền) ─── */}
      {editing && (
        <div className="fixed !m-0 inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-teal-50 to-emerald-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    {translateText(editing.id ? "Cập Nhật Thực Đơn Ăn Xế" : "Tạo Gói Thực Đơn Ăn Xế Mới")}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-bold text-teal-800 bg-white/80 px-2 py-0.5 rounded-md border border-teal-200 shadow-2xs">
                      {translateText(`Năm học: ${selectedYear?.name || "2029-2030"}`)}
                      {selectedYear?.status === "ACTIVE" ? ` (${translateText("đang áp dụng")})` : ""}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveService} className="p-6 space-y-4 overflow-y-auto">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{translateText(error)}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {translateText("Tên thực đơn ăn xế ")}<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={translateText("Ví dụ: Thực đơn ăn xế Tuần 1 - KidMeal")}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {translateText("Ngày bắt đầu (Thứ Hai) ")}<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      let newEnd = form.endDate;
                      if (newStart) {
                        const s = new Date(`${newStart}T12:00:00`);
                        if (s.getDay() === 1) {
                          const eDate = new Date(s);
                          eDate.setDate(s.getDate() + 4);
                          newEnd = formatLocalDate(eDate);
                        }
                      }
                      setForm({
                        ...form,
                        startDate: newStart,
                        endDate: newEnd,
                        registrationDeadline: calcDeadlineBefore2Days(newStart),
                      });
                    }}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {translateText("Ngày kết thúc (Thứ Sáu) ")}<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {translateText("Hạn chót đóng tiền ")}<span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-semibold text-teal-700">
                      {translateText("(Trước ngày bắt đầu 2 ngày)")}
                    </span>
                  </div>
                  <input
                    type="date"
                    required
                    max={calcDeadlineBefore2Days(form.startDate)}
                    value={form.registrationDeadline}
                    onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {translateText("Mức phí / tuần (VNĐ) ")}<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    placeholder={translateText("Ví dụ: 75000")}
                    value={form.feeAmount}
                    onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {translateText("Trạng thái công bố & nộp tiền")}
                </label>
                <select
                  value={form.status === "LOCKED" ? "OPEN" : form.status}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({
                      ...form,
                      status: val,
                      isPaymentLocked: false,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="OPEN">{translateText("Đang mở đóng tiền trực tuyến (OPEN)")}</option>
                  <option value="CLOSED">{translateText("Đã kết thúc / Đóng gói (CLOSED)")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {translateText("Mô tả món ăn xế & ghi chú dinh dưỡng")}
                </label>
                <textarea
                  rows={2}
                  placeholder={translateText("Khẩu phần ăn xế lúc 14h30 - 15h00 gồm cháo cá hồi, sữa bắp và chuối tiêu...")}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  {translateText("Hủy")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {translateText(submitting ? "Đang lưu..." : "Lưu Thực Đơn Ăn Xế")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Modal Xem Chi Tiết Thực Đơn Ăn Xế ─── */}
      {detail && (
        <div className="fixed !m-0 inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-teal-50 to-emerald-50 shrink-0">
              <div>
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">
                  {translateText("Chi Tiết Thực Đơn Ăn Xế")}
                </span>
                <h3 className="font-black text-slate-900 text-lg">{detail.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">{translateText("Thời gian phục vụ")}</span>
                  <strong className="text-slate-800">{formatDateDMY(detail.startDate)} ~ {formatDateDMY(detail.endDate)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{translateText("Hạn đóng tiền")}</span>
                  <strong className="text-slate-800">{detail.registrationDeadline ? formatDateDMY(detail.registrationDeadline) : translateText("Không giới hạn")}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{translateText("Mức phí / tuần")}</span>
                  <strong className="text-emerald-700 text-sm font-black">
                    {translateText(Number(detail.feeAmount).toLocaleString(getLocale()))}{translateText(" đ")}
                  </strong>
                </div>
              </div>

              {detail.description && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-1">{translateText("Mô tả thực đơn")}</h4>
                  <p className="text-xs text-slate-600 bg-white p-3 border border-slate-200 rounded-xl leading-relaxed">
                    {detail.description}
                  </p>
                </div>
              )}

              {/* Thực đơn dịch vụ */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-teal-600" />
                  {translateText("Lịch Thực Đơn Ăn Xế Trong Tuần")}
                </h4>
                {!detail.menuSchedule?.length ? (
                  <p className="text-xs text-slate-400 italic">{translateText("Chưa có lịch thực đơn cụ thể.")}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {detail.menuSchedule.map((m: any, i: number) => (
                      <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-xs space-y-1">
                        <span className="font-bold text-teal-800">{translateText(m.dayLabel)}</span>
                        <p className="text-slate-600">
                          {translateText(m.mainDish || "")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danh sách học sinh đăng ký */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-600" />
                    {translateText("Danh Sách Học Sinh Đã Đăng Ký")}
                  </span>
                  <span className="text-teal-700 font-black">({translateText(detail.registrations?.length || 0)}{translateText(" bé")})</span>
                </h4>
                {!detail.registrations?.length ? (
                  <p className="text-xs text-slate-400 italic">{translateText("Chưa có học sinh nào đăng ký gói này.")}</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold">
                        <tr>
                          <th className="p-2.5">{translateText("Học Sinh")}</th>
                          <th className="p-2.5">{translateText("Lớp")}</th>
                          <th className="p-2.5 text-right">{translateText("Trạng Thái")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.registrations.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{r.studentName}</td>
                            <td className="p-2.5 text-slate-600">{r.className}</td>
                            <td className="p-2.5 text-right font-semibold text-emerald-700">{translateText(r.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 text-right">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition"
              >
                {translateText("Đóng")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
