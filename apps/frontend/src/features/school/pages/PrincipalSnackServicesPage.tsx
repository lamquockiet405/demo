import React, { useState } from "react";
import { apiClient } from "../../../core/api/axios";
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
} from "lucide-react";

const getToday = () => new Date().toISOString().slice(0, 10);
const getNextMonth = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

const getEmptyForm = () => ({
  name: "",
  startDate: getToday(),
  endDate: getNextMonth(),
  registrationDeadline: getToday(),
  feeAmount: "",
  description: "",
  status: "OPEN",
});

export function PrincipalSnackServicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState(getEmptyForm());
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
        params: { search: search || undefined, status: status || undefined },
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
      setError(err.response?.data?.message || "Không thể tải danh sách dịch vụ ăn phụ.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [search, status]);

  const rows = Array.isArray(data) ? data : data.items || [];

  // Thống kê nhanh
  const openCount = rows.filter((r) => r.status === "OPEN").length;
  const closedCount = rows.filter((r) => r.status === "CLOSED").length;
  const totalRegistered = rows.reduce((sum, r) => sum + (Number(r.registeredCount) || 0), 0);

  const openModal = async (row?: any) => {
    setError(null);
    if (row?.id) {
      try {
        const raw = (await apiClient.get(`/snack-services/${row.id}`)).data;
        const d = raw?.data || raw;
        setForm({
          name: d.name || "",
          startDate: d.startDate || getToday(),
          endDate: d.endDate || getNextMonth(),
          registrationDeadline: d.registrationDeadline || getToday(),
          feeAmount: String(d.feeAmount ?? ""),
          description: d.description || "",
          status: d.status || "OPEN",
        });
      } catch {
        setForm({
          name: row.name || "",
          startDate: row.startDate || getToday(),
          endDate: row.endDate || getNextMonth(),
          registrationDeadline: row.registrationDeadline || getToday(),
          feeAmount: String(row.feeAmount ?? ""),
          description: row.description || "",
          status: row.status || "OPEN",
        });
      }
    } else {
      setForm(getEmptyForm());
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
      setError("Vui lòng nhập đầy đủ tên gói, khoảng ngày phục vụ, hạn đăng ký và mức phí hợp lệ.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const monthStr = form.startDate.slice(0, 7);
      const cleanCode = form.name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 15);
      const periodCode = `PKG-${monthStr}-${cleanCode}-${Date.now().toString().slice(-4)}`;

      const body = {
        name: form.name.trim(),
        periodCode,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationDeadline: form.registrationDeadline,
        feeAmount: Number(form.feeAmount),
        nutritionNotes: form.description?.trim() || "",
        description: form.description?.trim() || "",
        status: form.status || "OPEN",
        capacityMode: "UNLIMITED",
      };

      if (editing?.id) {
        await apiClient.put(`/snack-services/${editing.id}`, body);
        setToast("Đã cập nhật thông tin gói dịch vụ ăn phụ thành công!");
      } else {
        await apiClient.post("/snack-services/periods", body);
        setToast(form.status === "OPEN"
          ? "Đã tạo mới và công bố gói dịch vụ ăn phụ thành công!"
          : "Đã lưu gói dịch vụ nội bộ. Mở đăng ký để công bố cho phụ huynh.");
      }

      setEditing(null);
      await fetchData();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(". ") : msg || err.message || "Không thể lưu dịch vụ ăn phụ.");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePeriodStatus = async (id: number) => {
    try {
      await apiClient.put(`/snack-services/periods/${id}/toggle`);
      setToast("Đã thay đổi trạng thái gói dịch vụ thành công!");
      await fetchData();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể thay đổi trạng thái gói dịch vụ.");
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Bạn có chắc muốn xóa gói "${row.name}" không?`)) return;
    try {
      await apiClient.delete(`/snack-services/${row.id}`);
      setToast("Đã xóa gói dịch vụ thành công!");
      await fetchData();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể xóa gói dịch vụ.");
    }
  };

  const openDetail = async (id: number | string) => {
    try {
      const res = await apiClient.get(`/snack-services/${id}`);
      setDetail(res.data?.data || res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Không thể tải chi tiết gói dịch vụ.");
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* ─── 1. Header Banner ─── */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
              Ban Giám Hiệu • Dịch Vụ Bán Trú
            </span>
            <span className="text-xs text-teal-200">Suất ăn sáng & xế chiều</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <Coffee className="w-8 h-8 text-amber-300" />
            Quản Lý Gói Dịch Vụ Ăn Phụ
          </h1>
          <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
            Thiết lập các kỳ dịch vụ ăn sáng, ăn xế nhẹ dinh dưỡng, cấu hình mức phí trọn kỳ và mở cổng đăng ký trực tuyến cho Phụ huynh toàn trường.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <button
            onClick={() => void openModal()}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-2xl text-xs font-black shadow-md transition flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Tạo Dịch Vụ Mới
          </button>
        </div>
      </div>

      {/* Thông báo Toast */}
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* Lỗi cảnh báo */}
      {error && !editing && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      {/* ─── 2. KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Tổng số gói</p>
            <p className="text-2xl font-black text-slate-900">{rows.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800">Đang mở đăng ký</p>
            <p className="text-2xl font-black text-emerald-700">{openCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Đã đóng / kết thúc</p>
            <p className="text-2xl font-black text-slate-700">{closedCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/20 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800">Tổng học sinh đăng ký</p>
            <p className="text-2xl font-black text-amber-700">{totalRegistered}</p>
          </div>
        </div>
      </div>

      {/* ─── 3. Search & Filter Bar ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên gói dịch vụ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-auto"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Đang mở đăng ký (OPEN)</option>
            <option value="CLOSED">Đã đóng (CLOSED)</option>
            <option value="DRAFT">Bản nháp (DRAFT)</option>
          </select>
        </div>
      </div>

      {/* ─── 4. Table / Cards Danh Sách Gói Dịch Vụ ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
            <p className="text-sm font-medium">Đang tải danh sách dịch vụ ăn phụ...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
              <Coffee className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy gói dịch vụ ăn phụ nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || status
                ? "Thử thay đổi từ khóa tìm kiếm hoặc bỏ lọc trạng thái để xem các gói khác."
                : "Chưa có gói dịch vụ nào được tạo. Hãy bấm 'Tạo Dịch Vụ Mới' để công bố cho phụ huynh."}
            </p>
            {!search && !status && (
              <button
                onClick={() => void openModal()}
                className="mt-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition"
              >
                <PlusCircle className="w-4 h-4" />
                Tạo gói đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/70">
                <tr>
                  <th className="p-4">Tên Gói Dịch Vụ</th>
                  <th className="p-4">Thời Gian Phục Vụ</th>
                  <th className="p-4">Hạn Đăng Ký</th>
                  <th className="p-4">Mức Phí Trọn Kỳ</th>
                  <th className="p-4 text-center">Đã Đăng Ký</th>
                  <th className="p-4 text-center">Trạng Thái</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-teal-50/20 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-sm">{r.name}</div>
                      {r.description && (
                        <div className="text-slate-500 text-[11px] truncate max-w-xs">{r.description}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-700 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {r.startDate} ~ {r.endDate}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {r.registrationDeadline || "Không giới hạn"}
                      </span>
                    </td>
                    <td className="p-4 font-black text-emerald-700 text-sm">
                      {r.feeAmount == null ? "0 đ" : `${Number(r.feeAmount).toLocaleString("vi-VN")} đ`}
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                        <Users className="w-3 h-3 text-slate-500" />
                        {r.registeredCount || 0} bé
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${
                          r.status === "OPEN"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : r.status === "DRAFT"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {r.status === "OPEN" ? "● Đang mở" : r.status === "DRAFT" ? "Bản nháp" : "Đã đóng"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => void openDetail(r.id)}
                          title="Xem chi tiết & danh sách đăng ký"
                          className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition inline-flex items-center"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button
                          onClick={() => void openModal(r)}
                          title="Chỉnh sửa gói"
                          className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition inline-flex items-center shadow-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void togglePeriodStatus(r.id)}
                          title={r.status === "OPEN" ? "Đóng gói đăng ký" : "Mở lại gói đăng ký"}
                          className={`p-2 rounded-xl font-bold transition inline-flex items-center border ${
                            r.status === "OPEN"
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void handleDelete(r)}
                          title="Xóa gói dịch vụ"
                          className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold transition inline-flex items-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. Modal Tạo / Cập nhật gói dịch vụ ─── */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-teal-50 to-emerald-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
                  <Coffee className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-900 text-lg">
                  {editing.id ? "Cập Nhật Gói Dịch Vụ Ăn Phụ" : "Tạo Gói Dịch Vụ Ăn Phụ Mới"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveService} className="p-6 space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên gói dịch vụ ăn phụ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Suất ăn sáng dinh dưỡng Tháng 11/2026"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ngày bắt đầu phục vụ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ngày kết thúc phục vụ <span className="text-rose-500">*</span>
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Hạn chót đăng ký <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.registrationDeadline}
                    onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mức phí trọn kỳ (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    placeholder="Ví dụ: 300000"
                    value={form.feeAmount}
                    onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Trạng thái công bố</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="OPEN">Mở cho Phụ huynh đăng ký & thanh toán (OPEN)</option>
                  <option value="CLOSED">Đóng đăng ký (CLOSED)</option>
                  {!editing.id && <option value="DRAFT">Lưu nháp nội bộ (DRAFT)</option>}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mô tả & ghi chú dinh dưỡng</label>
                <textarea
                  rows={3}
                  placeholder="Thông tin chi tiết về thực đơn, thời gian phục vụ 07h00 hoặc 17h00..."
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
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? "Đang lưu..." : "Lưu & Công Bố Gói"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Modal Xem Chi Tiết Gói Dịch Vụ ─── */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-teal-50 to-emerald-50 shrink-0">
              <div>
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Chi Tiết Gói Dịch Vụ</span>
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
                  <span className="text-slate-400 block text-[11px]">Thời gian phục vụ</span>
                  <strong className="text-slate-800">{detail.startDate} ~ {detail.endDate}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hạn đăng ký</span>
                  <strong className="text-slate-800">{detail.registrationDeadline || "Không giới hạn"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mức phí trọn kỳ</span>
                  <strong className="text-emerald-700 text-sm font-black">
                    {Number(detail.feeAmount).toLocaleString("vi-VN")} đ
                  </strong>
                </div>
              </div>

              {detail.description && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-1">Mô tả dịch vụ</h4>
                  <p className="text-xs text-slate-600 bg-white p-3 border border-slate-200 rounded-xl leading-relaxed">
                    {detail.description}
                  </p>
                </div>
              )}

              {/* Thực đơn dịch vụ */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-teal-600" />
                  Lịch Thực Đơn Ăn Phụ Trong Tuần
                </h4>
                {!detail.menuSchedule?.length ? (
                  <p className="text-xs text-slate-400 italic">Chưa có lịch thực đơn cụ thể.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {detail.menuSchedule.map((m: any, i: number) => (
                      <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-xs space-y-1">
                        <span className="font-bold text-teal-800">{m.dayLabel}</span>
                        <p className="text-slate-600">
                          {[m.mainDish, m.drinkItem, m.fruitOrSide].filter(Boolean).join(" · ")}
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
                    Danh Sách Học Sinh Đã Đăng Ký
                  </span>
                  <span className="text-teal-700 font-black">({detail.registrations?.length || 0} bé)</span>
                </h4>
                {!detail.registrations?.length ? (
                  <p className="text-xs text-slate-400 italic">Chưa có học sinh nào đăng ký gói này.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold">
                        <tr>
                          <th className="p-2.5">Học Sinh</th>
                          <th className="p-2.5">Lớp</th>
                          <th className="p-2.5 text-right">Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.registrations.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{r.studentName}</td>
                            <td className="p-2.5 text-slate-600">{r.className}</td>
                            <td className="p-2.5 text-right font-semibold text-emerald-700">{r.status}</td>
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
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
