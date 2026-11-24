import { normalizeSearch } from '../../../core/utils/search';
import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from "react";
import {
  Users,
  UserCheck,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  GraduationCap,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  FileSpreadsheet,
} from "lucide-react";
import { downloadExcel } from "../../../core/utils/excel-export";
import { formatDateDMY, formatDateTimeDMY } from "../../../core/utils/date";
import {
  parentsApi,
  ParentUser,
  ParentStats,
  CreateParentPayload,
  UpdateParentPayload,
} from "../api/parents.api";
import { apiClient } from "../../../core/api/axios";
import { useAcademicYearFilter } from '../../academic-years/useAcademicYearFilter';

export const ParentManagementPage: React.FC = () => {
  useLanguage();
  const yearFilter = useAcademicYearFilter();
  const [parents, setParents] = useState<ParentUser[]>([]);
  const [stats, setStats] = useState<ParentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Children list for linking
  const [availableChildren, setAvailableChildren] = useState<
    Array<{
      id: string;
      fullName: string;
      studentCode: string;
      className?: string;
      parentId?: string | null;
      parentName?: string | null;
      parentEmail?: string | null;
    }>
  >([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingParent, setViewingParent] = useState<ParentUser | null>(null);
  const [editingParent, setEditingParent] = useState<ParentUser | null>(null);
  const [deletingParent, setDeletingParent] = useState<ParentUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form states
  const [formEmail, setFormEmail] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formAddress, setFormAddress] = useState("");
  const [formOccupation, setFormOccupation] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formSelectedChildIds, setFormSelectedChildIds] = useState<string[]>(
    [],
  );
  const [childSearchKeyword, setChildSearchKeyword] = useState("");

  // Email validation & duplicate checking states
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = useState<string | null>(
    null,
  );
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [formPasswordError, setFormPasswordError] = useState<string | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchParents = async () => {
    setLoading(true);
    try {
      const [parentData, statData] = await Promise.all([
        parentsApi.getParents({
          academicYearId: yearFilter.yearId || undefined,
          allAcademicYears: !yearFilter.loading && !yearFilter.error && !yearFilter.yearId || undefined,
          search: appliedSearch || undefined,
          status: selectedStatus !== "ALL" ? selectedStatus : undefined,
          includeDeleted,
          page: currentPage,
          limit: pageSize,
        }),
        parentsApi.getStats({
          academicYearId: yearFilter.yearId || undefined,
          allAcademicYears: !yearFilter.loading && !yearFilter.error && !yearFilter.yearId || undefined,
        }),
      ]);

      const parentList = Array.isArray(parentData)
        ? parentData
        : (parentData as any)?.data || (parentData as any)?.items || [];
      setParents(parentList);
      setTotalCount((parentData as any)?.meta?.total ?? parentList.length);
      setTotalPages((parentData as any)?.meta?.totalPages ?? 1);
      setStats(statData);
    } catch (err) {
      console.error("Lỗi khi tải danh sách phụ huynh:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    try {
      const res = await apiClient.get("/children?limit=500");
      const items = res.data?.items || [];
      setAvailableChildren(
        items.map((c: any) => ({
          id: String(c.id),
          fullName: c.fullName,
          studentCode: c.studentCode,
          className: c.className || c.class?.name || "Chưa xếp lớp",
          parentId: c.parentId ? String(c.parentId) : null,
          parentName: c.parentName || null,
          parentEmail: c.parentEmail || null,
        })),
      );
    } catch (err) {
      console.error("Lỗi khi tải danh sách học sinh:", err);
    }
  };

  useEffect(() => {
    fetchParents();
  }, [currentPage, selectedStatus, includeDeleted, appliedSearch, pageSize, yearFilter.yearId, yearFilter.loading, yearFilter.error]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchChildren();
  }, []);

  // Debounced check for duplicate email during account creation
  useEffect(() => {
    if (!isCreateModalOpen || editingParent) {
      setIsDuplicateEmail(false);
      setEmailErrorMessage(null);
      setIsCheckingEmail(false);
      return;
    }

    const trimmed = formEmail.trim().toLowerCase();
    if (!trimmed) {
      setIsDuplicateEmail(false);
      setEmailErrorMessage(null);
      setIsCheckingEmail(false);
      return;
    }

    // 1. Kiểm tra nhanh tức thì trên danh sách parents hiện có trong RAM
    const localMatch = parents.some(
      (p) => p.email?.trim().toLowerCase() === trimmed,
    );
    if (localMatch) {
      setIsDuplicateEmail(true);
      setEmailErrorMessage("Email này đã tồn tại trong danh sách phụ huynh.");
      setIsCheckingEmail(false);
      return;
    }

    // Kiểm tra cơ bản định dạng email trước khi gọi backend API
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setIsDuplicateEmail(false);
      setEmailErrorMessage(null);
      setIsCheckingEmail(false);
      return;
    }

    setIsCheckingEmail(true);
    const timer = setTimeout(async () => {
      try {
        const res = await parentsApi.checkEmail(trimmed);
        if (res.exists) {
          setIsDuplicateEmail(true);
          setEmailErrorMessage(
            res.message ||
              "Email này đã được sử dụng trong hệ thống. Vui lòng chọn email khác.",
          );
        } else {
          setIsDuplicateEmail(false);
          setEmailErrorMessage(null);
        }
      } catch (err) {
        console.error("Lỗi khi kiểm tra email:", err);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formEmail, isCreateModalOpen, editingParent, parents]);

  const handleExportExcel = async () => {
    if (!parents.length) return;
    const headers = [
      'STT',
      'Họ và tên phụ huynh',
      'Email',
      'Số điện thoại',
      'Học sinh liên kết',
      'Nghề nghiệp',
      'Địa chỉ',
      'Trạng thái',
      'Ngày đăng ký',
    ];
    const dataRows = parents.map((p, idx) => [
      idx + 1,
      p.fullName,
      p.email,
      p.phone || 'Chưa cập nhật',
      (p.children || []).map((c: any) => `${c.fullName || c.name || ''} (${c.className || ''})`).join('; ') || 'Chưa liên kết',
      p.occupation || '',
      p.address || '',
      p.status === 'ACTIVE' ? 'Hoạt động' : 'Bị khóa',
      p.createdAt ? formatDateDMY(p.createdAt) : '',
    ]);
    await downloadExcel(
      `Danh_sach_phu_huynh_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [headers, ...dataRows],
      'Danh sách phụ huynh'
    );
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
    setCurrentPage(1);
    if (currentPage === 1 && appliedSearch === search.trim()) void fetchParents();
  };

  const openCreateModal = () => {
    fetchChildren();
    setFormEmail("");
    setFormFullName("");
    setFormPhone("");
    setFormPassword("");
    setFormStatus("ACTIVE");
    setFormAddress("");
    setFormOccupation("");
    setFormNote("");
    setFormSelectedChildIds([]);
    setChildSearchKeyword("");
    setIsDuplicateEmail(false);
    setEmailErrorMessage(null);
    setIsCheckingEmail(false);
    setFormPasswordError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (parent: ParentUser) => {
    fetchChildren();
    setEditingParent(parent);
    setFormEmail(parent.email);
    setFormFullName(parent.fullName);
    setFormPhone(parent.phone || "");
    setFormPassword("");
    setFormStatus(parent.status);
    setFormAddress(parent.address || "");
    setFormOccupation(parent.occupation || "");
    setFormNote(parent.note || "");
    setFormSelectedChildIds(
      Array.isArray(parent.children) ? parent.children.map((c) => String(c.id)).slice(0, 1) : [],
    );
    setChildSearchKeyword("");
    setIsDuplicateEmail(false);
    setEmailErrorMessage(null);
    setIsCheckingEmail(false);
    setFormPasswordError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPassword.trim().length < 8) {
      setFormPasswordError("Nhập mật khẩu ban đầu có ít nhất 8 ký tự.");
      showToast("error", "Nhập mật khẩu ban đầu có ít nhất 8 ký tự.");
      return;
    }
    setFormPasswordError(null);
    if (!formEmail.trim() || !formFullName.trim()) {
      showToast("error", "Vui lòng nhập đầy đủ email và họ tên phụ huynh.");
      return;
    }
    if (formPhone && !/^0\d{9,10}$/.test(formPhone)) {
      showToast("error", "Số điện thoại phải gồm 10 hoặc 11 chữ số và bắt đầu bằng số 0.");
      return;
    }

    if (isDuplicateEmail) {
      showToast(
        "error",
        emailErrorMessage ||
          "Email này đã tồn tại trong hệ thống. Vui lòng chọn email khác.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateParentPayload = {
        email: formEmail.trim(),
        fullName: formFullName.trim(),
        phone: formPhone.trim() || undefined,
        password: formPassword.trim() || undefined,
        status: formStatus,
        address: formAddress.trim() || undefined,
        occupation: formOccupation.trim() || undefined,
        note: formNote.trim() || undefined,
        childIds: formSelectedChildIds,
      };
      await parentsApi.createParent(payload);
      showToast("success", "Tạo tài khoản phụ huynh thành công!");
      setIsCreateModalOpen(false);
      fetchParents();
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Có lỗi xảy ra khi tạo tài khoản.";
      if (err.response?.status === 409 || msg.toLowerCase().includes("email")) {
        setIsDuplicateEmail(true);
        setEmailErrorMessage(msg);
      }
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParent) return;
    if (formPhone && !/^0\d{9,10}$/.test(formPhone)) {
      showToast("error", "Số điện thoại phải gồm 10 hoặc 11 chữ số và bắt đầu bằng số 0.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: UpdateParentPayload = {
        fullName: formFullName.trim(),
        phone: formPhone.trim() || undefined,
        status: formStatus,
        newPassword: formPassword.trim() || undefined,
        address: formAddress.trim() || undefined,
        occupation: formOccupation.trim() || undefined,
        note: formNote.trim() || undefined,
        childIds: formSelectedChildIds,
      };
      await parentsApi.updateParent(editingParent.id, payload);
      showToast("success", "Cập nhật tài khoản phụ huynh thành công!");
      setEditingParent(null);
      fetchParents();
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Có lỗi xảy ra khi cập nhật.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingParent) return;
    setSubmitting(true);
    try {
      await parentsApi.deleteParent(deletingParent.id);
      showToast("success", "Đã xóa tài khoản phụ huynh và hủy liên kết.");
      setDeletingParent(null);
      fetchParents();
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Có lỗi xảy ra khi xóa.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await parentsApi.restoreParent(id);
      showToast("success", "Khôi phục tài khoản phụ huynh thành công!");
      fetchParents();
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Không thể khôi phục tài khoản.",
      );
    }
  };

  const selectSingleChild = (childId: string | number) => {
    const sId = String(childId);
    const target = availableChildren.find((c) => String(c.id) === sId);
    const currentParentId = editingParent ? String(editingParent.id) : null;
    if (target?.parentId && target.parentId !== currentParentId) {
      showToast(
        "error",
        `Học sinh này đã được liên kết với phụ huynh khác (${target.parentName || target.parentEmail}). Không thể liên kết thêm.`,
      );
      return;
    }
    setFormSelectedChildIds((prev) =>
      prev.map(String).includes(sId) ? [] : [sId],
    );
  };

  const filteredAvailableChildren = availableChildren
    .filter((c) => {
      const currentParentId = editingParent ? String(editingParent.id) : null;
      return !c.parentId || c.parentId === currentParentId;
    })
    .filter((c) => {
      if (!childSearchKeyword.trim()) return true;
      const kw = normalizeSearch(childSearchKeyword);
      return (
        normalizeSearch((c.fullName || "")).includes(kw) ||
        normalizeSearch((c.studentCode || "")).includes(kw) ||
        normalizeSearch((c.className || "")).includes(kw)
      );
    })
    .sort((a, b) => {
      const currentParentId = editingParent ? String(editingParent.id) : null;
      const aLinkedOther = Boolean(a.parentId && a.parentId !== currentParentId);
      const bLinkedOther = Boolean(b.parentId && b.parentId !== currentParentId);
      if (aLinkedOther === bLinkedOther) {
        return (a.fullName || "").localeCompare(b.fullName || "", "vi");
      }
      return aLinkedOther ? 1 : -1;
    });

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4.5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-top-4 max-w-md ${
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
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Tổng phụ huynh")}</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {stats?.totalParents || totalCount}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Đang hoạt động")}</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">
              {stats?.activeParents || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Đã liên kết học sinh")}</p>
            <p className="text-2xl font-black text-blue-700 mt-0.5">
              {stats?.parentsWithChildren || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Bị khóa / Vô hiệu hóa")}</p>
            <p className="text-2xl font-black text-slate-700 mt-0.5">
              {translateText(stats?.inactiveOrDeleted ?? (stats as any)?.inactiveParents ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      {yearFilter.error && <p role="alert" className="text-red-600">{yearFilter.error}</p>}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col md:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={translateText("Tìm theo họ tên phụ huynh, email, số điện thoại hoặc tên học sinh...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">{translateText("Năm học")}<select aria-label={translateText("Năm học")} value={yearFilter.yearId} onChange={e => {
                yearFilter.setYearId(e.target.value); setCurrentPage(1);
              }} className="px-3.5 py-2.5 bg-slate-50 text-xs text-slate-800 rounded-xl border border-slate-200">
                <option value="">{translateText("Tất cả năm học")}</option>
                {yearFilter.years.map(year => <option key={year.id} value={year.id}>{year.name}{year.status === 'ACTIVE' ? ' (đang áp dụng)' : ''}</option>)}
              </select>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2.5 bg-slate-50 text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 focus:outline-none"
            >
              <option value="ALL">{translateText("Tất cả trạng thái")}</option>
              <option value="ACTIVE">{translateText("Đang hoạt động")}</option>
              <option value="BLOCKED">{translateText("Bị khóa")}</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >{translateText("Tìm kiếm")}</button>

            <button
              type="button"
              onClick={fetchParents}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
              title={translateText("Làm mới")}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : "text-slate-500"}`}
              />
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
              title={translateText("Xuất danh sách phụ huynh ra file Excel")}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{translateText("Xuất Excel")}</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{translateText("Tạo tài khoản")}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-teal-600 text-white border-b border-teal-700/60 font-bold">
              <tr className="text-white text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3.5 text-white">{translateText("Phụ huynh")}</th>
                <th className="px-4 py-3.5 text-white">{translateText("Email & Điện thoại")}</th>
                <th className="px-4 py-3.5 text-white">{translateText("Học sinh liên kết")}</th>
                <th className="px-4 py-3.5 text-white">{translateText("Trạng thái")}</th>
                <th className="px-4 py-3.5 text-white">{translateText("Ngày đăng ký")}</th>
                <th className="px-4 py-3.5 text-center w-28 text-white">{translateText("Thao tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    <div className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p>{translateText("Đang tải danh sách phụ huynh...")}</p>
                  </td>
                </tr>
              ) : parents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">{translateText("Không tìm thấy tài khoản phụ huynh nào")}</p>
                    <p className="text-[11px] mt-0.5">{translateText("Nhấn \"Tạo tài khoản phụ huynh\" để bắt đầu thiết lập.")}</p>
                  </td>
                </tr>
              ) : (
                (Array.isArray(parents) ? parents : []).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 font-black flex items-center justify-center text-sm shadow-inner shrink-0">
                          {(p.fullName || "P").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {p.fullName}
                          </div>
                          {p.twoFactorEnabled && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                              <ShieldCheck className="w-3 h-3" />{translateText(" Đã bật 2FA")}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {p.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {p.phone || translateText("Chưa cập nhật")}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {Array.isArray(p.children) && p.children.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.children.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold"
                            >
                              <GraduationCap className="w-3 h-3 text-teal-600" />
                              {c.fullName} ({c.className})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">{translateText("Chưa liên kết học sinh")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {p.isDeleted ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">{translateText("ĐÃ XÓA")}</span>
                      ) : p.status === "ACTIVE" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">{translateText("HOẠT ĐỘNG")}</span>
                      ) : p.status === "INACTIVE" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{translateText("KHÓA")}</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          {translateText(p.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                      {translateText(formatDateDMY(p.createdAt))}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingParent(p)}
                          title={translateText("Xem chi tiết tài khoản")}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {p.status === "INACTIVE" || p.isDeleted ? (
                          <>
                            <button
                              onClick={() => handleRestore(p.id)}
                              title={translateText("Khôi phục / Kích hoạt lại tài khoản")}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(p)}
                              title={translateText("Chỉnh sửa tài khoản")}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEditModal(p)}
                              title={translateText("Chỉnh sửa tài khoản")}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingParent(p)}
                              title={translateText("Tạm ngưng / Vô hiệu hóa tài khoản")}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>{translateText("Hiển thị ")}<span className="font-bold">{parents.length}</span> /{" "}
            {totalCount}{translateText(" phụ huynh (Trang ")}{currentPage}/{totalPages})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold px-2">{currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. View Details Modal */}
      {viewingParent && (
        <div className="fixed !m-0 inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{translateText("Hồ sơ chi tiết Phụ huynh")}</h3>
                  <p className="text-[11px] text-slate-500">{translateText("Mã định danh: #")}{translateText(viewingParent.id)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingParent(null)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Header Profile Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-teal-50/60 to-blue-50/60 border border-teal-100">
                <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
                  {(viewingParent.fullName || "P").charAt(0).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-slate-900">
                      {viewingParent.fullName}
                    </h4>
                    {viewingParent.status === "ACTIVE" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">{translateText("HOẠT ĐỘNG")}</span>
                    ) : viewingParent.status === "INACTIVE" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{translateText("KHÓA")}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        {translateText(viewingParent.status)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-slate-600">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Mail className="w-3.5 h-3.5 text-teal-600" />{" "}
                      {viewingParent.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-teal-600" />{" "}
                      {viewingParent.phone || translateText("Chưa cập nhật SĐT")}
                    </span>
                    {viewingParent.twoFactorEnabled && (
                      <span className="flex items-center gap-1 text-emerald-700 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />{translateText(" 2FA Bảo mật")}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">{translateText("Nghề nghiệp:")}</span>
                  <span className="text-slate-800 font-semibold">
                    {translateText(viewingParent.occupation || "Chưa thiết lập")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">{translateText("Địa chỉ liên hệ:")}</span>
                  <span className="text-slate-800 font-semibold">
                    {viewingParent.address || translateText("Chưa thiết lập")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">{translateText("Ngày khởi tạo tài khoản:")}</span>
                  <span className="text-slate-800 font-mono font-medium">
                    {translateText(formatDateTimeDMY(viewingParent.createdAt))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">{translateText("Đăng nhập lần cuối:")}</span>
                  <span className="text-slate-800 font-mono font-medium">
                    {translateText(viewingParent.lastLoginAt
                      ? formatDateTimeDMY(viewingParent.lastLoginAt)
                      : "Chưa từng đăng nhập")}
                  </span>
                </div>
                {viewingParent.note && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 font-medium block text-[11px]">{translateText("Ghi chú nội bộ:")}</span>
                    <p className="text-slate-700 italic mt-0.5">
                      {viewingParent.note}
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Children List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-teal-600" />{translateText("Học sinh thuộc quyền giám hộ (")}{viewingParent.children?.length || 0})
                  </h5>
                </div>
                {viewingParent.children && viewingParent.children.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {viewingParent.children.map((child) => (
                      <div
                        key={child.id}
                        className="p-3 bg-white border border-teal-200/80 rounded-2xl shadow-xs flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 font-black text-xs flex items-center justify-center shrink-0">
                          {translateText(child.gender === "FEMALE" ? "👧" : "👦")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">
                            {child.fullName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono text-teal-700 font-semibold">
                              {child.studentCode}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-slate-700">
                              {child.className}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">{translateText("Phụ huynh này chưa được liên kết với học sinh nào trong hệ thống.")}</div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewingParent(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >{translateText("Đóng")}</button>
              <button
                type="button"
                onClick={() => {
                  const p = viewingParent;
                  setViewingParent(null);
                  openEditModal(p);
                }}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 transition flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />{translateText(" Chỉnh sửa tài khoản này")}</button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Create / Edit Modal */}
      {(isCreateModalOpen || editingParent) && (
        <div className="fixed !m-0 inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  {editingParent ? (
                    <Edit3 className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {translateText(editingParent
                    ? "Cập nhật tài khoản Phụ huynh"
                    : "Tạo mới tài khoản Phụ huynh")}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingParent(null);
                  setIsDuplicateEmail(false);
                  setEmailErrorMessage(null);
                }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={editingParent ? handleEditSubmit : handleCreateSubmit}
              className="p-6 overflow-y-auto space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-bold mb-1">{translateText("Họ và tên phụ huynh ")}<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={translateText("Ví dụ: Nguyễn Văn An")}
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">{translateText("Email đăng nhập ")}<span className="text-rose-500">*</span>
                    {isCheckingEmail && (
                      <span className="text-[10px] text-teal-600 font-normal ml-2">{translateText("Đang kiểm tra...")}</span>
                    )}
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingParent}
                    placeholder={translateText("phuhuynh@example.com")}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition disabled:bg-slate-100 disabled:text-slate-500 ${
                      !editingParent && isDuplicateEmail
                        ? "border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        : "border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    }`}
                  />
                  {!editingParent && isDuplicateEmail && (
                    <p className="flex items-center gap-1 text-rose-500 text-[11px] font-semibold mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {translateText(emailErrorMessage ||
                        "Email này đã tồn tại trong hệ thống. Vui lòng chọn email khác.")}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">{translateText("Số điện thoại")}</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    placeholder={"0912345678"}
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
                  />
                </div>
              </div>

              {!editingParent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {translateText("Mật khẩu ban đầu (ít nhất 8 ký tự)")} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder={translateText("Mật khẩu ban đầu (ít nhất 8 ký tự)")}
                      value={formPassword}
                      onChange={(e) => {
                        setFormPassword(e.target.value);
                        if (formPasswordError && e.target.value.trim().length >= 8) {
                          setFormPasswordError(null);
                        }
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs text-slate-800 rounded-xl border transition ${
                        formPasswordError
                          ? "border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                          : "border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      }`}
                    />
                    {formPasswordError && (
                      <p className="flex items-center gap-1 text-rose-500 text-[11px] font-semibold mt-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {translateText(formPasswordError)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">{translateText("Trạng thái tài khoản")}</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="ACTIVE">{translateText("Hoạt động (ACTIVE)")}</option>
                    <option value="BLOCKED">{translateText("Khóa (BLOCKED)")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">{translateText("Nghề nghiệp")}</label>
                  <input
                    type="text"
                    placeholder={translateText("Ví dụ: Kỹ sư, Bác sĩ, Kinh doanh...")}
                    value={formOccupation}
                    onChange={(e) => setFormOccupation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
                  />
                </div>
              </div>

              {/* Children Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">{translateText("Liên kết học sinh (Con em)")}</label>
                  {formSelectedChildIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormSelectedChildIds([])}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      {translateText("Hủy chọn")}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  {translateText("Mỗi phụ huynh liên kết với 1 học sinh để đồng bộ thực đơn và thông tin sức khỏe:")}
                </p>

                {/* Thanh tìm kiếm học sinh */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={childSearchKeyword}
                    onChange={(e) => setChildSearchKeyword(e.target.value)}
                    placeholder={translateText("Tìm tên bé, mã học sinh hoặc tên lớp...")}
                    className="w-full pl-8 pr-8 py-2 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
                  />
                  {childSearchKeyword && (
                    <button
                      type="button"
                      onClick={() => setChildSearchKeyword("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl p-2.5 bg-slate-50 space-y-1.5">
                  {filteredAvailableChildren.length === 0 ? (
                    <p className="text-slate-400 text-center py-4 text-xs">
                      {childSearchKeyword
                        ? translateText("Không tìm thấy học sinh phù hợp")
                        : availableChildren.length > 0
                          ? translateText("Tất cả học sinh đã được liên kết")
                          : translateText("Chưa có danh sách học sinh")}
                    </p>
                  ) : (
                    filteredAvailableChildren.map((c) => {
                      const isSelected = formSelectedChildIds.map(String).includes(String(c.id));
                      const currentParentId = editingParent ? String(editingParent.id) : null;
                      const isLinkedToOther = Boolean(c.parentId && c.parentId !== currentParentId);
                      const isLinkedToSelf = Boolean(c.parentId && c.parentId === currentParentId);

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (isLinkedToOther) return;
                            selectSingleChild(c.id);
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs transition select-none ${
                            isLinkedToOther
                              ? "bg-slate-100/70 border border-slate-200/60 opacity-60 cursor-not-allowed text-slate-400"
                              : isSelected
                                ? "bg-teal-100/80 border border-teal-400 font-bold text-teal-900 shadow-xs cursor-pointer"
                                : "bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="parent_child_select"
                              checked={isSelected}
                              disabled={isLinkedToOther}
                              onChange={() => {}}
                              className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500 pointer-events-none disabled:opacity-40"
                            />
                            <div>
                              <span className={isLinkedToOther ? "line-through text-slate-400" : ""}>
                                {c.fullName} ({c.studentCode})
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/80 border border-slate-200 text-slate-600 font-normal">
                              {c.className}
                            </span>
                            {isLinkedToOther ? (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-semibold"
                                title={`Đã liên kết với phụ huynh ${c.parentName || c.parentEmail || ''}`}
                              >
                                {translateText("Đã có PH")} ({c.parentName || translateText("khác")})
                              </span>
                            ) : isLinkedToSelf ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 font-semibold">
                                {translateText("Đang liên kết")}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                                {translateText("Chưa liên kết")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {formSelectedChildIds.length > 0 ? (
                  <p className="text-[11px] text-teal-700 font-semibold mt-1.5">
                    ✓ {translateText("Đã chọn học sinh:")}{" "}
                    <b>{availableChildren.find(c => formSelectedChildIds.map(String).includes(String(c.id)))?.fullName}</b>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-600 italic mt-1.5">
                    ⚠️ {translateText("Chưa chọn học sinh liên kết. Phụ huynh sẽ không thể đăng nhập nếu chưa liên kết với học sinh.")}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingParent(null);
                    setIsDuplicateEmail(false);
                    setEmailErrorMessage(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >{translateText("Hủy bỏ")}</button>
                <button
                  type="submit"
                  disabled={submitting || (!editingParent && isDuplicateEmail)}
                  title={
                    translateText(!editingParent && isDuplicateEmail
                      ? "Email này đã tồn tại trong hệ thống"
                      : undefined)
                  }
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {translateText(submitting
                    ? "Đang lưu..."
                    : editingParent
                      ? "Lưu thay đổi"
                      : "Tạo tài khoản")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Soft Delete Modal */}
      {deletingParent && (
        <div className="fixed !m-0 inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">{translateText("Xác nhận xóa tài khoản phụ huynh")}</h3>
              <p className="text-slate-500 text-xs">{translateText("Bạn có chắc chắn muốn xóa tài khoản của phụ huynh")}{" "}
                <span className="font-bold text-slate-900">
                  {deletingParent.fullName}
                </span>{" "}
                ({deletingParent.email})?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeletingParent(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
              >{translateText("Hủy bỏ")}</button>
              <button
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-600/20 transition disabled:opacity-50"
              >
                {translateText(submitting ? "Đang xóa..." : "Đồng ý xóa")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
