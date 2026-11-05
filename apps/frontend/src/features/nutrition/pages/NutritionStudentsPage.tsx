import React, { useState, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { apiClient } from "../../../core/api/axios";
import { childrenApi } from "../../children/api/children.api";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import {
  Baby,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Calendar,
  X,
  Sparkles,
  Flame,
  Clock,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Users,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import {
  Field,
  Feedback,
  Modal,
  State,
  useSchoolAction,
  useSchoolResource,
} from "../../school/components/SchoolUI";
import { TeacherStatsOverview } from "../../teacher/components/TeacherStatsOverview";

function ChildNutritionDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const resource = useSchoolResource(async () => {
    const [child, response] = await Promise.all([
      childrenApi.getChild(id),
      apiClient.get(`/children/${id}/nutrition-profile`),
    ]);
    return { child, profile: response.data?.profile };
  }, [id]);

  const action = useSchoolAction();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const profile = resource.data?.profile;
  const form = draft || {
    dietaryRegime: profile?.dietaryRegime || "",
    dietaryNotes: profile?.dietaryNotes || "",
    eatingHabits: profile?.eatingHabits || "",
    nutritionGoals: profile?.nutritionGoals || "",
    targetEnergyKcal:
      profile?.targetEnergyKcal == null ? "" : String(profile.targetEnergyKcal),
  };
  const child = resource.data?.child;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void action.run(async () => {
      const energy = form.targetEnergyKcal.trim()
        ? Number(form.targetEnergyKcal)
        : null;
      if (energy !== null && (!Number.isFinite(energy) || energy < 0))
        throw new Error("Năng lượng mục tiêu phải là số không âm.");
      await apiClient.patch(`/children/${id}/nutrition-profile`, {
        ...form,
        targetEnergyKcal: energy,
      });
      setDraft(null);
      await resource.reload();
    }, "Đã lưu thành công hồ sơ dinh dưỡng cho học sinh.");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-teal-50 via-emerald-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Baby className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 uppercase tracking-wider">
                Hồ Sơ Dinh Dưỡng Học Sinh
              </span>
              <h3 className="font-black text-slate-900 text-lg mt-0.5">
                {child?.fullName || "Đang tải thông tin…"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <State resource={resource} />
          <Feedback error={action.error} message={action.message} />

          {child && !resource.error && !resource.loading && (
            <div className="space-y-6">
              {/* Quick Info Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Mã học sinh</span>
                  <strong className="text-slate-900 font-mono text-sm">{child.studentCode}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Lớp học</span>
                  <strong className="text-teal-800 text-sm">{child.className || child.class?.name || "Chưa phân lớp"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Ngày sinh</span>
                  <strong className="text-slate-800 text-sm">{child.dateOfBirth?.slice(0, 10) || "—"}</strong>
                </div>
              </div>

              {/* Dị ứng */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Dị Ứng Đã Khai Báo
                </h4>
                {child.allergies?.filter((a) => a.isActive !== false).length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {child.allergies
                      .filter((a) => a.isActive !== false)
                      .map((a) => (
                        <span
                          key={a.id}
                          className="px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          {a.customAllergenName || a.allergen?.nameVi || (a as any).allergenName} ({a.severity})
                          {a.note && <span className="font-normal text-slate-500">• {a.note}</span>}
                        </span>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Học sinh chưa ghi nhận dị ứng thực phẩm nào.</span>
                  </div>
                )}
              </div>

              {/* Form chỉnh sửa dinh dưỡng */}
              <form onSubmit={save} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Chế độ ăn chỉ định
                    </label>
                    <input
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                      maxLength={100}
                      value={form.dietaryRegime}
                      onChange={(e) => setDraft({ ...form, dietaryRegime: e.target.value })}
                      placeholder="VD: Cơm nát, ăn ít muối, kiêng hải sản…"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Năng lượng mục tiêu (kcal/ngày)
                    </label>
                    <input
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                      type="number"
                      min={0}
                      step="any"
                      value={form.targetEnergyKcal}
                      onChange={(e) => setDraft({ ...form, targetEnergyKcal: e.target.value })}
                      placeholder="VD: 1250"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Thói quen ăn uống & Sức ăn
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                    maxLength={3000}
                    value={form.eatingHabits}
                    onChange={(e) => setDraft({ ...form, eatingHabits: e.target.value })}
                    placeholder="Ghi nhận thói quen ăn chậm, kén rau, ăn nhanh, uống nhiều sữa…"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mục tiêu chăm sóc dinh dưỡng
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                    maxLength={3000}
                    value={form.nutritionGoals}
                    onChange={(e) => setDraft({ ...form, nutritionGoals: e.target.value })}
                    placeholder="VD: Tăng cường canxi cải thiện chiều cao, bổ sung đạm bồi dưỡng thể lực…"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Lưu ý đặc biệt cho bếp & giáo viên
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                    maxLength={3000}
                    value={form.dietaryNotes}
                    onChange={(e) => setDraft({ ...form, dietaryNotes: e.target.value })}
                    placeholder="Lưu ý khi chia phần ăn tại lớp…"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    {profile?.updatedAt ? `Cập nhật lần cuối: ${new Date(profile.updatedAt).toLocaleDateString("vi-VN")}` : "Hồ sơ mới"}
                  </span>
                  <button
                    type="submit"
                    disabled={action.busy}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    {action.busy ? "Đang lưu…" : "Lưu Hồ Sơ Dinh Dưỡng"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NutritionStudentsPage() {
  const isTeacherPortal = useLocation().pathname.startsWith("/teacher/");
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [allergyFilter, setAllergyFilter] = useState<"ALL" | "ALLERGIC" | "SAFE">("ALL");
  const selected = params.get("childId") || "";
  const setSelected = (id: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (id) next.set("childId", id);
    else next.delete("childId");
    return next;
  });

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const resource = useSchoolResource(
    () =>
      fetchKitchenCollection("/children", {
        search,
        classId: classId || undefined,
      }),
    [search, classId],
  );

  const classes = useSchoolResource(
    () => fetchKitchenCollection("/classes"),
    [],
  );

  const rows: any[] = resource.error ? [] : resource.data || [];

  // Filter theo trạng thái dị ứng
  const filteredRows = useMemo(() => {
    return rows.filter((c) => {
      const hasAllergies = Boolean(c.allergies?.length);
      if (allergyFilter === "ALLERGIC") return hasAllergies;
      if (allergyFilter === "SAFE") return !hasAllergies;
      return true;
    });
  }, [rows, allergyFilter]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = rows.length;
    const allergic = rows.filter((c) => Boolean(c.allergies?.length)).length;
    const safe = total - allergic;
    const classCount = (classes.data || []).length;
    return { total, allergic, safe, classCount };
  }, [rows, classes.data]);

  // Phân trang
  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleClearFilters = () => {
    setSearch("");
    setClassId("");
    setAllergyFilter("ALL");
    setPage(1);
  };

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* ─── 1. Header Banner ─── */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 text-teal-100 uppercase tracking-wider backdrop-blur-sm">
              {isTeacherPortal ? "Giáo viên • Lớp phụ trách" : "Chuyên Gia Dinh Dưỡng • NutriKid"}
            </span>
            <span className="text-xs text-teal-200">Quản lý hồ sơ dinh dưỡng cá nhân</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <Baby className="w-8 h-8 text-amber-300" />
            {isTeacherPortal ? "Học sinh & Hồ sơ dinh dưỡng của lớp" : "Học Sinh & Hồ Sơ Dinh Dưỡng Cá Nhân"}
          </h1>
          <p className="text-sm text-teal-100 max-w-2xl leading-relaxed">
            Tra cứu thông tin học sinh, kiểm soát tình trạng dị ứng thực phẩm và cập nhật chế độ ăn, mục tiêu dinh dưỡng cá nhân hoá cho từng bé.
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

      <Feedback error={classes.error} />

      {/* ─── 2. Thẻ Thống Kê Nhanh (KPI Cards) ─── */}
      {isTeacherPortal ? (
        <TeacherStatsOverview classes={classes.data} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng học sinh */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Tổng số học sinh
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {stats.total} <span className="text-xs font-bold text-slate-400">trẻ</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đang học tập tại trường
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Có cảnh báo dị ứng */}
          <div className="bg-white rounded-2xl p-5 border border-rose-200/90 shadow-xs flex items-center justify-between bg-rose-50/20">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Có cảnh báo dị ứng
              </span>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {stats.allergic} <span className="text-xs font-bold text-rose-500">học sinh</span>
              </div>
              <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Cần rà soát khi lên thực đơn
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: An toàn / Tiêu chuẩn */}
          <div className="bg-white rounded-2xl p-5 border border-emerald-200/90 shadow-xs flex items-center justify-between bg-emerald-50/20">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Chế độ ăn tiêu chuẩn
              </span>
              <div className="text-2xl font-black text-emerald-800 mt-1">
                {stats.safe} <span className="text-xs font-bold text-emerald-600">học sinh</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Không ghi nhận dị ứng
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Số lớp học */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Lớp học quản lý
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {stats.classCount} <span className="text-xs font-bold text-slate-400">lớp</span>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                Nhà trẻ, Mầm, Chồi, Lá
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. Search & Filter Bar ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            aria-label="Tìm học sinh"
            type="text"
            placeholder="Tìm theo tên học sinh hoặc mã học sinh…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {/* Lọc theo lớp */}
          <select
            aria-label="Lọc theo lớp"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="">Tất cả các lớp ({stats.classCount} lớp)</option>
            {(classes.data || []).map((c: any) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Lọc theo tình trạng dị ứng */}
          <select
            aria-label="Lọc theo tình trạng dị ứng"
            value={allergyFilter}
            onChange={(e) => {
              setAllergyFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái dị ứng</option>
            <option value="ALLERGIC">Có khai báo dị ứng ({stats.allergic})</option>
            <option value="SAFE">Chế độ ăn an toàn ({stats.safe})</option>
          </select>

          {(search || classId || allergyFilter !== "ALL") && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      <State resource={resource} empty={!rows.length} />

      {/* ─── 4. BẢNG DỮ LIỆU HỌC SINH PHÂN TRANG (Paginated Data Table) ─── */}
      {!!rows.length && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Table Header Row */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2 font-black text-slate-800 text-xs sm:text-sm">
              <ListOrdered className="w-4 h-4 text-teal-600" />
              <span>{isTeacherPortal ? "Hồ sơ dinh dưỡng học sinh lớp phụ trách" : "Bảng Hồ Sơ Dinh Dưỡng Học Sinh Toàn Trường"}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Tìm thấy <strong className="text-slate-800 font-bold">{totalFiltered}</strong> học sinh phù hợp
            </div>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 w-12 text-center">STT</th>
                  <th className="py-3 px-3 w-28 text-center font-mono">Mã HS</th>
                  <th className="py-3 px-4 min-w-[200px]">Học sinh & Ngày sinh</th>
                  <th className="py-3 px-3 min-w-[140px] text-center">Lớp học</th>
                  <th className="py-3 px-4 min-w-[220px]">Tình trạng dị ứng thực phẩm</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      <Baby className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">
                        Không tìm thấy học sinh nào phù hợp với bộ lọc hiện tại.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-2 text-xs text-teal-600 hover:underline font-bold cursor-pointer"
                      >
                        Bấm vào đây để xóa bộ lọc
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((c, idx) => {
                    const stt = (currentPage - 1) * pageSize + idx + 1;
                    const activeAllergies = (c.allergies || []).filter(
                      (a: any) => a.isActive !== false,
                    );
                    const hasAllergies = activeAllergies.length > 0;
                    const allergenNames = activeAllergies
                      .map(
                        (a: any) =>
                          a.customAllergenName ||
                          a.allergen?.nameVi ||
                          a.allergenName,
                      )
                      .filter(Boolean);

                    const dob = c.dateOfBirth
                      ? new Date(c.dateOfBirth).toLocaleDateString("vi-VN")
                      : "—";

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/80 transition group"
                      >
                        {/* STT */}
                        <td className="py-3.5 px-3 text-center text-slate-400 font-bold">
                          {stt}
                        </td>

                        {/* Mã học sinh */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {c.studentCode || "—"}
                          </span>
                        </td>

                        {/* Học sinh & Ngày sinh */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                              {c.fullName ? c.fullName.charAt(0) : "H"}
                            </div>
                            <div>
                              <p className="font-black text-xs text-slate-900 group-hover:text-teal-800 transition">
                                {c.fullName}
                              </p>
                              <p className="text-[11px] text-slate-400 font-normal">
                                Ngày sinh: {dob}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Lớp học */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60 inline-block">
                            {c.className || c.class?.name || "Chưa phân lớp"}
                          </span>
                        </td>

                        {/* Tình trạng dị ứng */}
                        <td className="py-3.5 px-4">
                          {hasAllergies ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>
                                {allergenNames.length} dị nguyên:{" "}
                                {allergenNames.slice(0, 2).join(", ")}
                                {allergenNames.length > 2
                                  ? ` (+${allergenNames.length - 2})`
                                  : ""}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>An toàn • Chưa có dị ứng</span>
                            </div>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelected(String(c.id))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Chi tiết & Hồ sơ</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ─── 5. Thanh Điều Hướng Phân Trang (Pagination Controls) ─── */}
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white text-xs">
            <div className="text-slate-500 font-medium">
              Hiển thị{" "}
              <strong className="text-slate-800">
                {totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{" "}
              -{" "}
              <strong className="text-slate-800">
                {Math.min(currentPage * pageSize, totalFiltered)}
              </strong>{" "}
              trong tổng số <strong className="text-slate-900">{totalFiltered}</strong>{" "}
              học sinh
            </div>

            <div className="flex items-center gap-3">
              {/* Selector số dòng mỗi trang */}
              <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                <span>Số dòng/trang:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <option value={10}>10 dòng</option>
                  <option value={15}>15 dòng</option>
                  <option value={20}>20 dòng</option>
                  <option value={30}>30 dòng</option>
                </select>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show current page, edges, and adjacent pages
                    return (
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1
                    );
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const hasGap = prev && p - prev > 1;

                    return (
                      <React.Fragment key={p}>
                        {hasGap && (
                          <span className="px-1 text-slate-400">…</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                            p === currentPage
                              ? "bg-teal-600 text-white shadow-xs"
                              : "text-slate-700 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition cursor-pointer"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. Modal Chi Tiết Hồ Sơ Dinh Dưỡng ─── */}
      {selected && (
        <ChildNutritionDetail
          key={selected}
          id={selected}
          onClose={() => setSelected("")}
        />
      )}
    </div>
  );
}
