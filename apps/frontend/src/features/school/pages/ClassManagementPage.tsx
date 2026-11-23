import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  School,
  GraduationCap,
  Users,
  Baby,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  Eye,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  FileSpreadsheet,
} from "lucide-react";
import { downloadExcel } from "../../../core/utils/excel-export";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import { rowsOf } from "../../kitchen/utils/kitchen-operations";
import { useSchoolAction, useSchoolResource } from "../components/SchoolUI";
import { academicYearsApi } from "../../academic-years/academic-years.api";

interface ClassRow {
  id: number;
  name: string;
  ageGroup: string;
  schoolYear: string;
  homeroomTeacherId?: number | string | null;
  homeroomTeacher?: {
    id: number;
    fullName: string;
    phone?: string;
    avatar?: string;
  } | null;
  studentCount?: number;
  status: "ACTIVE" | "INACTIVE";
}

interface TeacherOption {
  id: number | string;
  fullName: string;
  phone?: string;
}

export function ClassManagementPage() {
  useLanguage();
  const [schoolName, setSchoolName] = useState(
    () => localStorage.getItem("school_name") || "KidMeal"
  );

  const [search, setSearch] = useState("");
  const [age, setAge] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const onTenantUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.name) setSchoolName(detail.name);
    };
    window.addEventListener("tenant-profile-updated", onTenantUpdate);
    return () =>
      window.removeEventListener("tenant-profile-updated", onTenantUpdate);
  }, []);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const resource = useSchoolResource(
    () =>
      fetchKitchenCollection("/classes", {
        search: search.trim() || undefined,
        ageGroup: age || undefined,
        status: status || undefined,
      }),
    [search, age, status],
  );

  const teachers = useSchoolResource<TeacherOption[]>(
    async () => {
      try {
        const staff = await fetchKitchenCollection("/users/staff", {
          roleCode: "TEACHER",
          status: "ACTIVE",
          limit: 100,
        });
        if (Array.isArray(staff) && staff.length > 0) return staff;
      } catch (e) {
        console.warn("fetchKitchenCollection /users/staff failed:", e);
      }
      try {
        const res = (
          await apiClient.get("/users/staff", {
            params: { roleCode: "TEACHER", status: "ACTIVE", limit: 100 },
          })
        ).data;
        return rowsOf(res);
      } catch (err) {
        return [];
      }
    },
    [],
  );
  const academicYears = useSchoolResource<Array<{ id: string; name: string; status: string }>>(
    () => academicYearsApi.list(),
    [],
  );

  const action = useSchoolAction();
  const rows: ClassRow[] = resource.error ? [] : resource.data || [];

  // Metrics calculation
  const totalClasses = rows.length;
  const totalStudents = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.studentCount) || 0), 0),
    [rows],
  );
  const isMam = (r: ClassRow) => r.ageGroup === "3-4" || r.name.toLowerCase().includes("mầm") || r.name.includes("3-4");
  const isChoi = (r: ClassRow) => r.ageGroup === "4-5" || r.name.toLowerCase().includes("chồi") || r.name.includes("4-5");
  const isLa = (r: ClassRow) => r.ageGroup === "5-6" || r.name.toLowerCase().includes("lá") || r.name.includes("5-6");

  const mamClasses = useMemo(() => rows.filter(isMam), [rows]);
  const choiClasses = useMemo(() => rows.filter(isChoi), [rows]);
  const laClasses = useMemo(() => rows.filter(isLa), [rows]);

  const kpiCards = [
    {
      label: "Tổng Số Lớp Học",
      value: totalClasses,
      unit: "lớp",
      sub: "Toàn bộ nhóm lớp hiện có",
      icon: School,
      iconCls: "bg-teal-50 text-teal-600",
      valCls: "text-slate-900",
      subCls: "text-teal-700",
      onClick: () => {
        setAge("");
        setStatus("");
        setSearch("");
      },
    },
    {
      label: "Lớp Mầm (3 - 4 tuổi)",
      value: mamClasses.length,
      unit: "lớp",
      sub: `${mamClasses.reduce((acc, r) => acc + (Number(r.studentCount) || 0), 0)} học sinh`,
      icon: GraduationCap,
      iconCls: "bg-emerald-50 text-emerald-600",
      valCls: "text-emerald-600",
      subCls: "text-emerald-700",
      onClick: () => setAge("3-4"),
    },
    {
      label: "Lớp Chồi (4 - 5 tuổi)",
      value: choiClasses.length,
      unit: "lớp",
      sub: `${choiClasses.reduce((acc, r) => acc + (Number(r.studentCount) || 0), 0)} học sinh`,
      icon: GraduationCap,
      iconCls: "bg-blue-50 text-blue-600",
      valCls: "text-blue-600",
      subCls: "text-blue-700",
      onClick: () => setAge("4-5"),
    },
    {
      label: "Lớp Lá (5 - 6 tuổi)",
      value: laClasses.length,
      unit: "lớp",
      sub: `${laClasses.reduce((acc, r) => acc + (Number(r.studentCount) || 0), 0)} học sinh`,
      icon: GraduationCap,
      iconCls: "bg-purple-50 text-purple-600",
      valCls: "text-purple-600",
      subCls: "text-purple-700",
      onClick: () => setAge("5-6"),
    },
  ];

  const openForm = (row?: ClassRow) =>
    setEditing({
      id: row?.id,
      name: row?.name || "",
      ageGroup: row?.ageGroup || "3-4",
      schoolYear: row?.schoolYear || academicYears.data?.find((year) => year.status === "ACTIVE")?.name || academicYears.data?.[0]?.name || "",
      homeroomTeacherId: row?.homeroomTeacherId
        ? String(row.homeroomTeacherId)
        : "",
      status: row?.status || "ACTIVE",
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      if (
        !editing.name.trim() ||
        !editing.ageGroup ||
        !editing.schoolYear || !academicYears.data?.some((year) => year.name === editing.schoolYear)
      ) {
        throw new Error(
          "Vui lòng chọn tên lớp, nhóm tuổi và năm học trong Quản lý năm học.",
        );
      }
      const { id, ...form } = editing;
      const payload = {
        ...form,
        name: form.name.trim(),
        homeroomTeacherId: form.homeroomTeacherId
          ? Number(form.homeroomTeacherId)
          : null,
      };
      if (id) {
        await apiClient.patch(`/classes/${id}`, payload);
        showToast("success", "Cập nhật thông tin lớp học thành công.");
      } else {
        await apiClient.post("/classes", payload);
        showToast("success", "Đã tạo lớp học mới thành công.");
      }
      setEditing(null);
      await resource.reload();
    }, "Đã lưu lớp học.");
  };

  const handleExportExcel = async () => {
    if (!rows.length) return;
    const headers = [
      'STT',
      'Tên lớp',
      'Độ tuổi',
      'Năm học',
      'Giáo viên chủ nhiệm',
      'Số điện thoại GVCN',
      'Sĩ số học sinh',
      'Trạng thái',
    ];
    const dataRows = rows.map((r, idx) => [
      idx + 1,
      r.name,
      r.ageGroup ? `${r.ageGroup} tuổi` : '',
      r.schoolYear || '',
      r.homeroomTeacher?.fullName || 'Chưa phân công',
      r.homeroomTeacher?.phone || '',
      r.studentCount ?? 0,
      r.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động',
    ]);
    await downloadExcel(
      `Danh_sach_lop_hoc_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [headers, ...dataRows],
      'Danh sách lớp học'
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4.5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 max-w-md ${
            toastMessage.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30"
              : "bg-rose-600 text-white border-rose-500 shadow-rose-900/40"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-white shrink-0" />
          )}
          <span className="text-xs font-semibold leading-relaxed">{translateText(toastMessage.text)}</span>
        </div>
      )}

      {!academicYears.loading && !academicYears.data?.length && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Chưa có năm học. Hãy tạo hoặc chọn năm học trong <Link className="font-bold underline" to="/academic-years">Quản lý năm học</Link> trước khi thêm lớp.
        </p>
      )}

      {/* 1. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              onClick={c.onClick}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-teal-300 cursor-pointer transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {translateText(c.label)}
                </span>
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center ${c.iconCls}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className={`text-2xl font-black tracking-tight ${c.valCls}`}>
                  {c.value}
                </span>
                <span className="text-xs text-slate-400 font-medium ml-1">
                  {translateText(c.unit)}
                </span>
              </div>
              <div className={`mt-2 text-[11px] font-semibold ${c.subCls}`}>
                {translateText(c.sub)}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={translateText("Tìm theo tên lớp, năm học...")}
            className="w-full pl-10 pr-8 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{translateText("Tất cả nhóm tuổi")}</option>
            <option value="3-4">{translateText("3 - 4 tuổi (Lớp Mầm)")}</option>
            <option value="4-5">{translateText("4 - 5 tuổi (Lớp Chồi)")}</option>
            <option value="5-6">{translateText("5 - 6 tuổi (Lớp Lá)")}</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{translateText("Tất cả trạng thái")}</option>
            <option value="ACTIVE">{translateText("Hoạt động")}</option>
            <option value="INACTIVE">{translateText("Ngừng hoạt động")}</option>
          </select>

          <button
            onClick={() => resource.reload()}
            disabled={resource.loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl shadow-xs transition cursor-pointer"
            title={translateText("Làm mới dữ liệu")}
          >
            <RefreshCw
              className={`w-4 h-4 ${resource.loading ? "animate-spin text-teal-600" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-2xl shadow-2xs transition cursor-pointer"
            title={translateText("Xuất danh sách lớp học ra file Excel")}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>
          <button
            onClick={() => openForm()}
            disabled={academicYears.loading || !academicYears.data?.length}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-2xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{translateText("Tạo Lớp Mới")}</span>
          </button>
        </div>
      </div>

      {/* 3. Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-teal-600 text-white">
              <tr className="border-b border-teal-700/60 text-[11px] font-bold text-white uppercase tracking-wider">
                <th className="py-3.5 px-5 text-white">{translateText("Lớp Học")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Nhóm Tuổi")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Năm Học")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Giáo Viên Chủ Nhiệm")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Sĩ Số")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Trạng Thái")}</th>
                <th className="py-3.5 px-5 text-right text-white">{translateText("Thao Tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {resource.loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="font-semibold">{translateText("Đang tải danh sách lớp học...")}</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <School className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">
                      {translateText("Không tìm thấy lớp học phù hợp")}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {translateText("Thử điều chỉnh từ khóa tìm kiếm hoặc lọc nhóm tuổi.")}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Lớp học */}
                    <td className="py-3.5 px-5">
                      <Link
                        to={`/students?classId=${row.id}`}
                        className="flex items-center gap-3 group"
                        title={translateText("Xem danh sách học sinh của lớp")}
                      >
                        <div className="w-9 h-9 rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs group-hover:bg-teal-600 group-hover:text-white transition">
                          <School className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 group-hover:text-teal-700 truncate transition block">
                            {row.name}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            Mã: #{row.id}
                          </span>
                        </div>
                      </Link>
                    </td>

                    {/* Nhóm tuổi */}
                    <td className="py-3.5 px-4">
                      {(() => {
                        const str = `${row.ageGroup} ${row.name}`.toLowerCase();
                        if (str.includes("3-4") || str.includes("mầm") || row.ageGroup === "3-4") {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <GraduationCap className="w-3 h-3 text-emerald-600" />
                              {translateText("3 - 4 tuổi (Mầm)")}
                            </span>
                          );
                        }
                        if (str.includes("4-5") || str.includes("chồi") || row.ageGroup === "4-5") {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <GraduationCap className="w-3 h-3 text-blue-600" />
                              {translateText("4 - 5 tuổi (Chồi)")}
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <GraduationCap className="w-3 h-3 text-purple-600" />
                            {translateText("5 - 6 tuổi (Lá)")}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Năm học */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{row.schoolYear || "—"}</span>
                      </div>
                    </td>

                    {/* Giáo viên chủ nhiệm */}
                    <td className="py-3.5 px-4">
                      {row.homeroomTeacher?.fullName ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                            {row.homeroomTeacher.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">
                              {row.homeroomTeacher.fullName}
                            </span>
                            {row.homeroomTeacher.phone && (
                              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-slate-400" />
                                {row.homeroomTeacher.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">
                          {translateText("Chưa phân công")}
                        </span>
                      )}
                    </td>

                    {/* Sĩ số */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <Users className="w-3 h-3 text-slate-500" />
                        <span>{row.studentCount ?? 0} {translateText("học sinh")}</span>
                      </span>
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3.5 px-4">
                      {row.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {translateText("Hoạt động")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {translateText("Ngừng hoạt động")}
                        </span>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/students?classId=${row.id}`}
                          className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition inline-flex items-center"
                          title={translateText("Xem danh sách học sinh của lớp")}
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openForm(row)}
                          className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition"
                          title={translateText("Chỉnh sửa lớp học")}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tạo / Sửa lớp học */}
      {editing && (
        <div className="fixed !m-0 inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed !m-0 inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !action.busy && setEditing(null)}
          />

          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setEditing(null)}
              disabled={action.busy}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 flex items-center justify-center shrink-0">
                <School className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {translateText(editing.id ? "Cập Nhật Thông Tin Lớp Học" : "Tạo Lớp Học Mới")}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {translateText("Nhập thông tin phân công giáo viên, độ tuổi và năm học áp dụng.")}
                </p>
              </div>
            </div>

            {action.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{translateText(action.error)}</span>
              </div>
            )}

            <form onSubmit={save} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {translateText("Tên lớp học *")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={translateText("Ví dụ: Lớp Mầm 1 (3-4 tuổi)")}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {translateText("Nhóm tuổi học sinh *")}
                  </label>
                  <select
                    required
                    value={editing.ageGroup}
                    onChange={(e) =>
                      setEditing({ ...editing, ageGroup: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition text-xs"
                  >
                    <option value="3-4">{translateText("3 - 4 tuổi (Lớp Mầm)")}</option>
                    <option value="4-5">{translateText("4 - 5 tuổi (Lớp Chồi)")}</option>
                    <option value="5-6">{translateText("5 - 6 tuổi (Lớp Lá)")}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {translateText("Năm học (YYYY-YYYY) *")}
                  </label>
                  <select
                    required
                    value={editing.schoolYear}
                    onChange={(e) =>
                      setEditing({ ...editing, schoolYear: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition text-xs"
                  >
                    <option value="">{translateText("Chọn năm học trong Quản lý năm học")}</option>
                    {academicYears.data?.map((year) => (
                      <option key={year.id} value={year.name}>
                        {year.name} · {year.status === "ACTIVE" ? "Đang áp dụng" : year.status === "DRAFT" ? "Đang chuẩn bị" : "Đã kết thúc"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {translateText("Giáo viên chủ nhiệm")}
                </label>
                <select
                  value={editing.homeroomTeacherId}
                  onChange={(e) =>
                    setEditing({ ...editing, homeroomTeacherId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition text-xs"
                >
                  <option value="">{translateText("Chưa phân công giáo viên")}</option>
                  {(teachers.data || []).map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} {t.phone ? `(${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {translateText("Trạng thái hoạt động")}
                </label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition text-xs"
                >
                  <option value="ACTIVE">{translateText("Đang hoạt động")}</option>
                  <option value="INACTIVE">{translateText("Ngừng hoạt động")}</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={action.busy}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  {translateText("Hủy bỏ")}
                </button>
                <button
                  type="submit"
                  disabled={action.busy}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition flex items-center gap-2"
                >
                  {action.busy ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <School className="w-4 h-4" />
                  )}
                  <span>{translateText(editing.id ? "Lưu thay đổi" : "Tạo lớp học")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
