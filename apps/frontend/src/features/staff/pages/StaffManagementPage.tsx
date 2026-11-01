import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  GraduationCap,
  ChefHat,
  Search,
  RefreshCw,
  Archive,
  RotateCcw,
  Edit3,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  staffApi,
  StaffUser,
  StaffStats,
  StaffRole,
  CreateStaffPayload,
  UpdateStaffPayload,
} from '../api/staff.api';
import { StaffDrawer, ROLE_META } from '../components/StaffDrawer';
import { SoftDeleteConfirmModal } from '../components/SoftDeleteConfirmModal';
import { useAuthStore } from '../../../core/stores/auth.store';

export const StaffManagementPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [schoolName, setSchoolName] = useState(
    () => localStorage.getItem('school_name') || 'Cơ sở Mầm non',
  );

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [availableRoles, setAvailableRoles] = useState<StaffRole[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isListLoading, setIsListLoading] = useState(false);
  const [isDrawerSubmitting, setIsDrawerSubmitting] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffUser | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const onTenantUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.name) setSchoolName(detail.name);
    };
    window.addEventListener('tenant-profile-updated', onTenantUpdate);
    return () => window.removeEventListener('tenant-profile-updated', onTenantUpdate);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
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
      staffApi.getStaffRoles().then(setAvailableRoles).catch(() => {}),
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
        status: selectedStatus || undefined,
        includeDeleted: includeDeleted || selectedStatus === 'DELETED',
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });
      setStaffList(res.data);
      setTotalCount(res.meta.total);
      setTotalPages(res.meta.totalPages || 1);
    } catch {
      showToast('error', 'Không thể kết nối đến máy chủ để tải danh sách nhân sự.');
    } finally {
      setIsListLoading(false);
    }
  }, [currentPage, debouncedSearch, selectedRole, selectedStatus, includeDeleted, showToast]);

  useEffect(() => {
    loadStaffList();
  }, [loadStaffList]);

  const handleOpenDrawer = async (mode: 'create' | 'edit' | 'view', staff: StaffUser | null = null) => {
    setDrawerMode(mode);
    setEditingStaff(staff);
    setIsDrawerOpen(true);
    if (staff && mode === 'view') {
      try {
        const fresh = await staffApi.getStaffById(staff.id);
        setEditingStaff(fresh);
      } catch {}
    }
  };

  const handleDrawerSubmit = async (
    payload: CreateStaffPayload | UpdateStaffPayload,
    staffId?: string,
  ) => {
    setIsDrawerSubmitting(true);
    try {
      if (staffId) {
        const updated = await staffApi.updateStaff(staffId, payload as UpdateStaffPayload);
        showToast('success', `Đã cập nhật thông tin nhân sự "${updated.fullName}" thành công.`);
      } else {
        const created = await staffApi.createStaff(payload as CreateStaffPayload);
        showToast(
          'success',
          `Đã tạo tài khoản "${created.fullName}". Mật khẩu khởi tạo: ${created.initialPassword || 'Password123@'}`,
        );
      }
      setIsDrawerOpen(false);
      await Promise.all([loadStaffList(), loadStats()]);
    } finally {
      setIsDrawerSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: StaffUser) => {
    if (staff.id === currentUser?.id) {
      return showToast('error', 'Bạn không thể tự khóa tài khoản của chính mình.');
    }
    setIsActionSubmitting(true);
    try {
      const res = await staffApi.toggleStaffStatus(staff.id);
      showToast('success', res.message);
      await Promise.all([loadStaffList(), loadStats()]);
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể đổi trạng thái tài khoản.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleConfirmSoftDelete = async () => {
    if (!deletingStaff) return;
    setIsActionSubmitting(true);
    try {
      const res = await staffApi.softDeleteStaff(deletingStaff.id);
      showToast('success', res.message);
      setDeletingStaff(null);
      await Promise.all([loadStaffList(), loadStats()]);
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể xóa mềm tài khoản này.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleRestoreStaff = async (staff: StaffUser) => {
    setIsActionSubmitting(true);
    try {
      const res = await staffApi.restoreStaff(staff.id);
      showToast('success', res.message);
      await Promise.all([loadStaffList(), loadStats()]);
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể khôi phục tài khoản này.');
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
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
          meta?.pill || 'bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        {Icon && <Icon className="w-3 h-3" />}
        {roleName}
      </span>
    );
  };

  const kpiCards = [
    {
      label: 'Tổng Nhân Sự',
      value: stats?.totalStaff ?? 0,
      unit: 'người',
      sub: 'Toàn bộ cán bộ & nhân viên',
      icon: Users,
      iconCls: 'bg-teal-50 text-teal-600',
      valCls: 'text-slate-900',
      subCls: 'text-teal-700',
      onClick: () => {
        setSelectedRole('');
        setSelectedStatus('');
        setIncludeDeleted(false);
        setCurrentPage(1);
      },
    },
    {
      label: 'Đang Hoạt Động',
      value: stats?.activeStaff ?? 0,
      unit: 'tài khoản',
      sub: 'Sẵn sàng vận hành',
      icon: UserCheck,
      iconCls: 'bg-emerald-50 text-emerald-600',
      valCls: 'text-emerald-600',
      subCls: 'text-emerald-700',
      onClick: () => {
        setSelectedRole('');
        setSelectedStatus('ACTIVE');
        setIncludeDeleted(false);
        setCurrentPage(1);
      },
    },
    {
      label: 'Giáo Viên Chủ Nhiệm',
      value: stats?.teachers ?? 0,
      unit: 'cô',
      sub: 'Điểm danh & đánh giá bữa ăn',
      icon: GraduationCap,
      iconCls: 'bg-blue-50 text-blue-600',
      valCls: 'text-blue-600',
      subCls: 'text-blue-700',
      onClick: () => {
        setSelectedRole('TEACHER');
        setSelectedStatus('ACTIVE');
        setIncludeDeleted(false);
        setCurrentPage(1);
      },
    },
    {
      label: 'Bếp & Dinh Dưỡng',
      value: stats?.kitchenAndNutrition ?? 0,
      unit: 'nhân sự',
      sub: 'Kiểm thực 3 bước & Lưu mẫu 24h',
      icon: ChefHat,
      iconCls: 'bg-orange-50 text-orange-600',
      valCls: 'text-orange-600',
      subCls: 'text-orange-700',
      onClick: () => {
        setSelectedRole('NUTRITIONIST');
        setSelectedStatus('');
        setIncludeDeleted(false);
        setCurrentPage(1);
      },
    },
    {
      label: 'Tạm Khóa / Lưu Trữ',
      value: stats?.inactiveOrDeleted ?? 0,
      unit: 'hồ sơ',
      sub: 'Bảo toàn lịch sử dữ liệu',
      icon: Archive,
      iconCls: 'bg-amber-50 text-amber-600',
      valCls: 'text-slate-700',
      subCls: 'text-amber-700',
      onClick: () => {
        setSelectedRole('');
        setSelectedStatus('INACTIVE');
        setIncludeDeleted(true);
        setCurrentPage(1);
      },
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 max-w-md ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              CỔNG BAN GIÁM HIỆU
            </span>
            <span className="text-xs text-slate-400">• {schoolName}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Quản Lý Nhân Sự & Đội Ngũ Bếp
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản trị tài khoản, phân công vai trò, tra cứu và bảo vệ dữ liệu với quy chuẩn xóa mềm (UC08 – UC11).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => Promise.all([loadStaffList(), loadStats()])}
            disabled={isListLoading}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl shadow-xs transition"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isListLoading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenDrawer('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-teal-600/25 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm Nhân Sự Mới</span>
          </button>
        </div>
      </div>

      {/* 1. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              onClick={c.onClick}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-teal-300 cursor-pointer transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">{c.label}</span>
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${c.iconCls}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className={`text-2xl font-black tracking-tight ${c.valCls}`}>{c.value}</span>
                <span className="text-xs text-slate-400 font-medium ml-1">{c.unit}</span>
              </div>
              <div className={`mt-2 text-[11px] font-semibold ${c.subCls}`}>{c.sub}</div>
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
            placeholder="Tìm theo họ tên, email công việc, số điện thoại..."
            className="w-full pl-10 pr-8 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
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
            <option value="">Tất cả vai trò</option>
            {availableRoles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Tạm khóa</option>
            <option value="DELETED">Đã xóa mềm (Lưu trữ)</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700 transition">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => {
                setIncludeDeleted(e.target.checked);
                setCurrentPage(1);
              }}
              className="w-3.5 h-3.5 text-teal-600 rounded-sm focus:ring-teal-500"
            />
            <span>Xem cả tài khoản xóa mềm</span>
          </label>
        </div>
      </div>

      {/* 3. Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Nhân Sự & Email</th>
                <th className="py-3.5 px-4">Số Điện Thoại</th>
                <th className="py-3.5 px-4">Vai Trò Chuyên Môn</th>
                <th className="py-3.5 px-4">Trạng Thái</th>
                <th className="py-3.5 px-4">Tham Gia</th>
                <th className="py-3.5 px-5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isListLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="font-semibold">Đang tải danh sách nhân sự...</p>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <UserX className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">Không tìm thấy tài khoản nhân sự phù hợp</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc.
                    </p>
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => {
                  const isCurrent = staff.id === currentUser?.id;
                  const isSoftDeleted = staff.isDeleted;

                  return (
                    <tr
                      key={staff.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSoftDeleted ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3.5 px-5">
                        <div
                          onClick={() => handleOpenDrawer('view', staff)}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                              isSoftDeleted ? 'bg-slate-200 text-slate-600' : 'bg-teal-600 text-white'
                            }`}
                          >
                            {staff.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 group-hover:text-teal-700 truncate transition">
                                {staff.fullName}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-full">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate block">{staff.email}</span>
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
                          <span className="text-slate-300 italic">Chưa cập nhật</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {staff.roles?.length ? (
                            staff.roles.map((r) => renderRoleBadge(r.code, r.name))
                          ) : (
                            <span className="text-slate-400 italic">Chưa phân vai trò</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isSoftDeleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Archive className="w-3 h-3 text-slate-500" />
                            Đã xóa mềm (Lưu trữ)
                          </span>
                        ) : staff.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Tạm khóa
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(staff.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isSoftDeleted ? (
                            <button
                              onClick={() => handleRestoreStaff(staff)}
                              disabled={isActionSubmitting}
                              className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs flex items-center gap-1 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Khôi phục</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenDrawer('view', staff)}
                                className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition"
                                title="Xem chi tiết nhân sự (UC08)"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDrawer('edit', staff)}
                                className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition"
                                title="Chỉnh sửa nhân sự (UC10)"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {!isCurrent && (
                                <button
                                  onClick={() => handleToggleStatus(staff)}
                                  disabled={isActionSubmitting}
                                  className={`p-2 rounded-xl transition ${
                                    staff.status === 'ACTIVE'
                                      ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-amber-600 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={staff.status === 'ACTIVE' ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'}
                                >
                                  {staff.status === 'ACTIVE' ? (
                                    <Lock className="w-4 h-4" />
                                  ) : (
                                    <Unlock className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {!isCurrent && (
                                <button
                                  onClick={() => setDeletingStaff(staff)}
                                  disabled={isActionSubmitting}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                  title="Chuyển vào lưu trữ (Xóa mềm)"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              )}
                            </>
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
          <div>
            Hiển thị{' '}
            <span className="font-bold text-slate-800">
              {staffList.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>{' '}
            - <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, totalCount)}</span> trên
            tổng số <span className="font-bold text-slate-800">{totalCount}</span> nhân sự
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || isListLoading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-slate-700">
              Trang {currentPage} / {totalPages}
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
        onSwitchToEdit={() => setDrawerMode('edit')}
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
