import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatDateDMY } from '../../../core/utils/date';
import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserX,
  UserPlus,
  GraduationCap,
  ChefHat,
  Search,
  RefreshCw,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { downloadExcel } from "../../../core/utils/excel-export";
import {
  staffApi,
  StaffUser,
  StaffStats,
  StaffRole,
  CreateStaffPayload,
  UpdateStaffPayload,
} from "../api/staff.api";
import { StaffDrawer, ROLE_META } from "../components/StaffDrawer";
import { SoftDeleteConfirmModal } from "../components/SoftDeleteConfirmModal";
import { useAuthStore } from "../../../core/stores/auth.store";

export const StaffManagementPage: React.FC = () => {
  useLanguage();
  const { user: currentUser } = useAuthStore();
  const [schoolName, setSchoolName] = useState(
    () => localStorage.getItem("school_name") || "Cơ sở Mầm non",
  );

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [availableRoles, setAvailableRoles] = useState<StaffRole[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isListLoading, setIsListLoading] = useState(false);
  const [isDrawerSubmitting, setIsDrawerSubmitting] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "view">(
    "create",
  );
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffUser | null>(null);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await staffApi.getStaffStats();
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      staffApi
        .getStaffRoles()
        .then(setAvailableRoles)
        .catch(() => {}),
      loadStats(),
    ]);
  }, [loadStats]);

  const loadStaffList = useCallback(async () => {
    setIsListLoading(true);
    try {
      const res = await staffApi.getStaffList({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        roleCode: selectedRole || undefined,
        status: "ACTIVE",
        includeDeleted: false,
        sortBy: "createdAt",
        sortOrder: "DESC",
      });
      // Filter out any inactive or soft-deleted staff
      const activeList = (res.data || []).filter(
        (s) => !s.isDeleted && s.status === "ACTIVE",
      );
      setStaffList(activeList);
      setTotalCount(res.meta?.total ?? activeList.length);
      setTotalPages(res.meta?.totalPages || 1);
    } catch {
      showToast(
        "error",
        "Không thể kết nối đến máy chủ để tải danh sách nhân sự.",
      );
    } finally {
      setIsListLoading(false);
    }
  }, [
    currentPage,
    debouncedSearch,
    selectedRole,
    showToast,
  ]);

  useEffect(() => {
    loadStaffList();
  }, [loadStaffList]);

  const handleOpenDrawer = (
    mode: "create" | "edit" | "view",
    staff?: StaffUser,
  ) => {
    setDrawerMode(mode);
    setEditingStaff(staff || null);
    setIsDrawerOpen(true);
  };

  const handleDrawerSubmit = async (
    payload: CreateStaffPayload | UpdateStaffPayload,
  ) => {
    setIsDrawerSubmitting(true);
    try {
      if (drawerMode === "create") {
        const res = await staffApi.createStaff(payload as CreateStaffPayload);
        showToast("success", `Đã tạo tài khoản cho ${res.fullName}`);
        if (res.initialPassword) {
          navigator.clipboard?.writeText(
            `Email: ${res.email} - Mật khẩu: ${res.initialPassword}`,
          );
        }
      } else if (drawerMode === "edit" && editingStaff) {
        await staffApi.updateStaff(
          editingStaff.id,
          payload as UpdateStaffPayload,
        );
        showToast("success", "Cập nhật hồ sơ nhân sự thành công.");
      }
      setIsDrawerOpen(false);
      await Promise.all([loadStaffList(), loadStats()]);
    } finally {
      setIsDrawerSubmitting(false);
    }
  };

  const handleConfirmSoftDelete = async () => {
    if (!deletingStaff) return;
    setIsActionSubmitting(true);
    try {
      const res = await staffApi.softDeleteStaff(deletingStaff.id);
      showToast("success", res.message || "Đã xóa tài khoản nhân sự thành công.");
      setDeletingStaff(null);
      await Promise.all([loadStaffList(), loadStats()]);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Không thể xóa tài khoản này.",
      );
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const renderRoleBadge = (roleCode: string, roleName: string) => {
    const meta = ROLE_META[roleCode];
    const Icon = meta?.icon;
    return (
      <span
        key={roleCode}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
          meta?.pill || "bg-slate-100 text-slate-700 border-slate-200"
        }`}
      >
        {Icon && <Icon className="w-3 h-3" />}
        {translateText(roleName)}
      </span>
    );
  };

  const handleExportExcel = async () => {
    if (!staffList.length) {
      showToast("error", "Chưa có dữ liệu nhân sự để xuất báo cáo.");
      return;
    }
    const headers = [
      "Họ và tên",
      "Email",
      "Số điện thoại",
      "Vai trò",
      "Trạng thái",
      "Ngày tham gia",
    ];
    const rows = staffList.map((s) => [
      s.fullName,
      s.email,
      s.phone || "Chưa cập nhật",
      s.roles?.map((r) => r.name || r.code).join(", ") || "Chưa phân vai trò",
      s.status === "ACTIVE" ? "Đang hoạt động" : "Tạm khóa",
      s.createdAt ? formatDateDMY(s.createdAt) : "",
    ]);
    const ok = await downloadExcel(
      `Danh_sach_nhan_su_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [headers, ...rows],
      "Danh sách nhân sự mầm non"
    );
    if (ok) showToast("success", "Đã xuất file Excel danh sách nhân sự thành công!");
  };

  const kpiCards = [
    {
      label: "Tổng Nhân Sự",
      value: stats?.totalStaff ?? 0,
      unit: "tài khoản",
      sub: "Đang hoạt động trong trường",
      icon: Users,
      iconCls: "bg-teal-50 text-teal-600",
      valCls: "text-slate-900",
      subCls: "text-teal-700",
      onClick: () => {
        setSelectedRole("");
        setCurrentPage(1);
      },
    },
    {
      label: "Giáo Viên Chủ Nhiệm",
      value: stats?.teachers ?? 0,
      unit: "cô",
      sub: "Điểm danh & chăm sóc học sinh",
      icon: GraduationCap,
      iconCls: "bg-blue-50 text-blue-600",
      valCls: "text-blue-600",
      subCls: "text-blue-700",
      onClick: () => {
        setSelectedRole("TEACHER");
        setCurrentPage(1);
      },
    },
    {
      label: "Bếp & Dinh Dưỡng",
      value: stats?.kitchenAndNutrition ?? 0,
      unit: "nhân sự",
      sub: "Kiểm thực 3 bước & Lưu mẫu 24h",
      icon: ChefHat,
      iconCls: "bg-orange-50 text-orange-600",
      valCls: "text-orange-600",
      subCls: "text-orange-700",
      onClick: () => {
        setSelectedRole("NUTRITIONIST");
        setCurrentPage(1);
      },
    },
    {
      label: "Cán Bộ Quản Lý & Khác",
      value: (stats?.managementStaff ?? 0) + (stats?.medicalStaff ?? 0),
      unit: "nhân sự",
      sub: "Ban giám hiệu & chuyên trách",
      icon: ShieldCheck,
      iconCls: "bg-purple-50 text-purple-600",
      valCls: "text-purple-600",
      subCls: "text-purple-700",
      onClick: () => {
        setSelectedRole("PRINCIPAL");
        setCurrentPage(1);
      },
    },
  ];

  return (
    <div className="w-full space-y-6">
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
                <span
                  className={`text-2xl font-black tracking-tight ${c.valCls}`}
                >
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
            placeholder={translateText("Tìm theo họ tên, email công việc, số điện thoại...")}
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
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{translateText("Tất cả vai trò")}</option>
            {availableRoles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => Promise.all([loadStaffList(), loadStats()])}
            disabled={isListLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl shadow-xs transition cursor-pointer"
            title={translateText("Làm mới dữ liệu")}
          >
            <RefreshCw
              className={`w-4 h-4 ${isListLoading ? "animate-spin text-teal-600" : ""}`}
            />
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-2xl shadow-2xs transition cursor-pointer"
            title={translateText("Xuất danh sách nhân sự ra file Excel")}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>
          <button
            onClick={() => handleOpenDrawer("create")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-2xl shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{translateText("Thêm Nhân Sự")}</span>
          </button>
        </div>
      </div>

      {/* 3. Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-teal-600 text-white">
              <tr className="border-b border-teal-700/60 text-[11px] font-bold text-white uppercase tracking-wider">
                <th className="py-3.5 px-5 text-white">{translateText("Nhân Sự & Email")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Số Điện Thoại")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Vai Trò Chuyên Môn")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Trạng Thái")}</th>
                <th className="py-3.5 px-4 text-white">{translateText("Tham Gia")}</th>
                <th className="py-3.5 px-5 text-right text-white">{translateText("Thao Tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isListLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="font-semibold">{translateText("Đang tải danh sách nhân sự...")}</p>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <UserX className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">{translateText("Không tìm thấy tài khoản nhân sự phù hợp")}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{translateText("Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc.")}</p>
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => {
                  const isCurrent = staff.id === currentUser?.id;

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div
                          onClick={() => handleOpenDrawer("view", staff)}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div
                            className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs bg-teal-600 text-white"
                          >
                            {staff.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 group-hover:text-teal-700 truncate transition">
                                {staff.fullName}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-full">{translateText("Bạn")}</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {staff.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {staff.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{staff.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">{translateText("Chưa cập nhật")}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {staff.roles?.length ? (
                            staff.roles.map((r) =>
                              renderRoleBadge(r.code, r.name),
                            )
                          ) : (
                            <span className="text-slate-400 italic">{translateText("Chưa phân vai trò")}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {translateText("Hoạt động")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            {translateText(formatDateDMY(staff.createdAt))}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDrawer("view", staff)}
                            className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition"
                            title={translateText("Xem chi tiết nhân sự")}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDrawer("edit", staff)}
                            className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition"
                            title={translateText("Chỉnh sửa nhân sự")}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => setDeletingStaff(staff)}
                              disabled={isActionSubmitting}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                              title={translateText("Xóa tài khoản nhân sự")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>{translateText("Hiển thị")}{" "}
            <span className="font-bold text-slate-800">
              {staffList.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>{" "}
            -{" "}
            <span className="font-bold text-slate-800">
              {Math.min(currentPage * pageSize, totalCount)}
            </span>{" "}{translateText("trên tổng số")}{" "}
            <span className="font-bold text-slate-800">{totalCount}</span>{translateText(" nhân sự")}</div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || isListLoading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-slate-700">{translateText("Trang ")}{currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages || isListLoading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <StaffDrawer
        isOpen={isDrawerOpen}
        mode={drawerMode}
        staff={editingStaff}
        availableRoles={availableRoles}
        isLoading={isDrawerSubmitting}
        onClose={() => setIsDrawerOpen(false)}
        onSwitchToEdit={() => setDrawerMode("edit")}
        onSubmit={handleDrawerSubmit}
      />

      <SoftDeleteConfirmModal
        isOpen={Boolean(deletingStaff)}
        staff={deletingStaff}
        isLoading={isActionSubmitting}
        onClose={() => setDeletingStaff(null)}
        onConfirm={handleConfirmSoftDelete}
      />
    </div>
  );
};
