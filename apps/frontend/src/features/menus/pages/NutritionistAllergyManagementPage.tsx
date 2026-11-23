import { normalizeSearch } from '../../../core/utils/search';
import { downloadExcel } from '../../../core/utils/excel-export';
import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  HeartPulse,
  Search,
  Plus,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  AlertOctagon,
  GraduationCap,
  Info,
  Edit3,
  Trash2,
  Check,
  X,
  Sparkles,
  Layers,
  RotateCcw,
  Archive,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { useAuthStore } from '../../../core/stores/auth.store';
import {
  nutritionEngineApi,
  AllergenCatalog,
  CreateAllergenPayload,
  UpdateAllergenPayload,
} from "../api/nutrition-rule-engine.api";
import { AllergenDrawer } from "../components/AllergenDrawer";

export interface ChildAllergyRecord {
  id: string;
  allergenId: string;
  allergenName: string;
  allergenCode: string;
  severity: string;
  note?: string;
  declaredAt?: string;
  isActive?: boolean;
}

export interface ChildWithAllergy {
  id: string;
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE";
  avatarUrl?: string | null;
  classId?: string | null;
  className?: string;
  ageGroup?: string;
  status: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies: ChildAllergyRecord[];
  hasAllergy: boolean;
}

export interface AllergenStandard {
  id: string;
  code: string;
  name: string;
  nameVi: string;
  nameEn?: string | null;
  commonFoods?: string | null;
  description?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  isSystemStandard?: boolean;
}

export interface ClassOption {
  id: string;
  name: string;
  ageGroup?: string;
  studentCount?: number;
}

const BADGE_STYLES: Record<string, string> = {
  SEAFOOD: "bg-rose-50 text-rose-700 border-rose-200",
  PEANUT: "bg-amber-50 text-amber-800 border-amber-200",
  TREE_NUT: "bg-amber-50 text-amber-800 border-amber-200",
  MILK: "bg-blue-50 text-blue-700 border-blue-200",
  EGG: "bg-yellow-50 text-yellow-800 border-yellow-200",
  WHEAT: "bg-orange-50 text-orange-800 border-orange-200",
  SOY: "bg-emerald-50 text-emerald-800 border-emerald-200",
  SESAME: "bg-stone-50 text-stone-800 border-stone-200",
};

export interface NutritionistAllergyManagementPageProps {
  embedded?: boolean;
  onCatalogChange?: () => void;
}

export const NutritionistAllergyManagementPage: React.FC<
  NutritionistAllergyManagementPageProps
> = ({ embedded = false, onCatalogChange }) => {
  useLanguage();
  const user = useAuthStore(state => state.user);
  const canManage = (user?.roles || []).some((role: any) =>
    ['SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN'].includes(
      String(typeof role === 'string' ? role : role.code).toUpperCase(),
    ),
  );

  const [isLoading, setIsLoading] = useState(true);
  const [allChildren, setAllChildren] = useState<ChildWithAllergy[]>([]);
  const [allergensList, setAllergensList] = useState<AllergenStandard[]>([]);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [selectedAllergenCode, setSelectedAllergenCode] = useState("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [includeDeletedCatalog, setIncludeDeletedCatalog] = useState(false);

  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isAllergenDrawerOpen, setIsAllergenDrawerOpen] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] =
    useState<AllergenCatalog | null>(null);

  const [selectedChildForCard, setSelectedChildForCard] =
    useState<ChildWithAllergy | null>(null);
  const [editingAllergy, setEditingAllergy] = useState<{
    childId: string;
    allergyId: string;
    childName: string;
    allergenName: string;
    severity: string;
    note: string;
  } | null>(null);

  const [declareForm, setDeclareForm] = useState({
    childId: "",
    allergenId: "",
    severity: "HIGH",
    note: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [childrenRes, allergensData, classesRes] = await Promise.all([
        apiClient.get("/children?limit=200"),
        nutritionEngineApi.getAllergens({
          search: catalogSearch || undefined,
          includeDeleted: includeDeletedCatalog,
        }),
        apiClient.get("/classes"),
      ]);

      const rawChildren =
        childrenRes.data?.data?.items ||
        childrenRes.data?.items ||
        childrenRes.data ||
        [];
      const rawClasses = classesRes.data?.data || classesRes.data || [];

      setAllChildren(Array.isArray(rawChildren) ? rawChildren : []);
      setAllergensList(
        Array.isArray(allergensData) ? (allergensData as any) : [],
      );
      setClassesList(Array.isArray(rawClasses) ? rawClasses : []);
    } catch {
      showToast("Không tải được hồ sơ dị ứng. Vui lòng thử lại.", "error");
      setAllChildren([]);
      setAllergensList([]);
      setClassesList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [catalogSearch, includeDeletedCatalog]);

  const allergicChildren = useMemo(
    () =>
      allChildren
        .map((c) => ({
          ...c,
          allergies: (c.allergies || []).filter((a) => a.isActive !== false),
        }))
        .filter((c) => c.allergies.length > 0),
    [allChildren],
  );

  const filteredAllergicChildren = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    return allergicChildren.filter((c) => {
      const matchQ =
        !q ||
        normalizeSearch(c.fullName).includes(q) ||
        normalizeSearch(c.studentCode).includes(q) ||
        c.allergies.some(
          (a) =>
            normalizeSearch(a.allergenName).includes(q) ||
            normalizeSearch((a.note || "")).includes(q),
        );
      const matchCls =
        selectedClassId === "ALL" ||
        c.classId === selectedClassId ||
        c.className === selectedClassId;
      const matchAlg =
        selectedAllergenCode === "ALL" ||
        c.allergies.some(
          (a) =>
            a.allergenCode === selectedAllergenCode ||
            a.allergenId === selectedAllergenCode,
        );
      const matchSev =
        selectedSeverity === "ALL" ||
        c.allergies.some((a) => a.severity === selectedSeverity);
      return matchQ && matchCls && matchAlg && matchSev;
    });
  }, [
    allergicChildren,
    searchQuery,
    selectedClassId,
    selectedAllergenCode,
    selectedSeverity,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClassId, selectedAllergenCode, selectedSeverity]);

  const totalItems = filteredAllergicChildren.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedChildren = useMemo(() => {
    return filteredAllergicChildren.slice(startIndex, endIndex);
  }, [filteredAllergicChildren, startIndex, endIndex]);

  const stats = useMemo(() => {
    const totalAllergic = allergicChildren.length;
    const totalStudents = allChildren.length || 1;
    const highRiskCount = allergicChildren.filter((c) =>
      c.allergies.some((a) =>
        ["HIGH", "SEVERE", "ANAPHYLACTIC"].includes(a.severity),
      ),
    ).length;

    const algCounts: Record<string, number> = {};
    const clsCounts: Record<string, number> = {};
    allergicChildren.forEach((c) => {
      const cls = c.className || "Chưa phân lớp";
      clsCounts[cls] = (clsCounts[cls] || 0) + 1;
      c.allergies.forEach((a) => {
        const name = a.allergenName || "Khác";
        algCounts[name] = (algCounts[name] || 0) + 1;
      });
    });

    const topAlg = Object.entries(algCounts).sort((a, b) => b[1] - a[1])[0];
    const topCls = Object.entries(clsCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      totalAllergic,
      totalStudents,
      allergyRate: Math.round((totalAllergic / totalStudents) * 100),
      highRiskCount,
      topAllergenText: topAlg ? `${topAlg[0]} (${topAlg[1]} bé)` : "Chưa có",
      topClassText: topCls ? `${topCls[0]} (${topCls[1]} bé)` : "Đồng đều",
    };
  }, [allergicChildren, allChildren]);

  const renderSeverityBadge = (severity: string) => {
    const s = severity?.toUpperCase();
    if (s === "HIGH" || s === "SEVERE" || s === "ANAPHYLACTIC") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-300">
          <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>{translateText("Nguy cơ cao (Phản vệ)")}</span>
        </span>
      );
    }
    if (s === "MEDIUM" || s === "MODERATE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{translateText("Trung bình")}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span>{translateText("Nhẹ / Bất dung nạp")}</span>
      </span>
    );
  };

  const handleDeclareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declareForm.childId || !declareForm.allergenId)
      return showToast("Vui lòng chọn học sinh và nhóm dị ứng", "error");
    setIsSubmitting(true);
    try {
      await apiClient.post(`/children/${declareForm.childId}/allergies`, {
        allergenId: Number(declareForm.allergenId),
        severity: declareForm.severity,
        note: declareForm.note,
      });
      showToast("Đã lưu hồ sơ dị ứng cho học sinh thành công");
      setIsDeclareModalOpen(false);
      setDeclareForm({
        childId: "",
        allergenId: "",
        severity: "HIGH",
        note: "",
      });
      fetchData();
      onCatalogChange?.();
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Có lỗi khi lưu hồ sơ dị ứng",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAllergy) return;
    setIsSubmitting(true);
    try {
      await apiClient.put(`/children/allergies/${editingAllergy.allergyId}`, {
        severity: editingAllergy.severity,
        note: editingAllergy.note,
      });
      showToast("Đã cập nhật thông tin dị ứng thành công");
      setIsEditModalOpen(false);
      setEditingAllergy(null);
      fetchData();
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Có lỗi khi cập nhật dị ứng",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllergy = async (
    allergyId: string,
    childName: string,
    allergenName: string,
  ) => {
    if (
      !window.confirm(
        translateText(`Xác nhận xóa cảnh báo dị ứng "${allergenName}" của học sinh "${childName}"?`),
      )
    )
      return;
    try {
      await apiClient.delete(`/children/allergies/${allergyId}`);
      showToast(`Đã xóa bản ghi dị ứng của bé ${childName}`);
      fetchData();
      onCatalogChange?.();
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Có lỗi khi xóa bản ghi dị ứng",
        "error",
      );
    }
  };

  const handleCatalogSubmit = async (
    payload: CreateAllergenPayload | UpdateAllergenPayload,
    id?: string,
  ) => {
    setIsSubmitting(true);
    try {
      if (id) {
        await nutritionEngineApi.updateAllergen(id, payload);
        showToast("Đã cập nhật quy tắc & thông tin nhóm dị ứng thành công.");
      } else {
        await nutritionEngineApi.createAllergen(
          payload as CreateAllergenPayload,
        );
        showToast("Đã thêm nhóm chất dị ứng mới vào danh mục kiểm soát.");
      }
      setIsAllergenDrawerOpen(false);
      await fetchData();
      onCatalogChange?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDeleteCatalog = async (item: AllergenStandard) => {
    if (item.isSystemStandard)
      return showToast(
        "Không thể xóa 8 nhóm dị ứng gốc chuẩn quốc tế Codex / BYT.",
        "error",
      );
    if (
      !window.confirm(
        translateText(`Xác nhận chuyển nhóm dị ứng "${item.nameVi || item.name}" vào lưu trữ?`),
      )
    )
      return;
    try {
      const res = await nutritionEngineApi.softDeleteAllergen(item.id);
      showToast(res.message);
      fetchData();
      onCatalogChange?.();
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Lỗi khi xóa chất dị ứng.",
        "error",
      );
    }
  };

  const handleRestoreCatalog = async (item: AllergenStandard) => {
    try {
      const res = await nutritionEngineApi.restoreAllergen(item.id);
      showToast(res.message);
      fetchData();
      onCatalogChange?.();
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Lỗi khi khôi phục chất dị ứng.",
        "error",
      );
    }
  };

  const handleExportExcel = async () => {
    if (!allergicChildren.length) return showToast('Chưa có dữ liệu học sinh dị ứng để xuất file', 'error');
    const ok = await downloadExcel(`Danh_Sach_Tre_Di_Ung_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      ['Mã học sinh', 'Họ và tên', 'Lớp học', 'Chất dị ứng', 'Mức độ nguy cơ', 'Triệu chứng và ghi chú', 'Ngày khai báo'],
      ...allergicChildren.flatMap(c => c.allergies.map(a => [c.studentCode, c.fullName, c.className || 'Chưa phân lớp', a.allergenName, a.severity === 'HIGH' ? 'Nguy cơ cao' : a.severity === 'MEDIUM' ? 'Trung bình' : 'Nhẹ', a.note, a.declaredAt?.slice(0, 10)])),
    ], 'Danh sách học sinh dị ứng');
    if (ok) showToast('Đã xuất file Excel báo cáo dị ứng thành công');
  };

  return (
    <div
      className={
        embedded
          ? "space-y-5 pt-1"
          : "w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      }
    >
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-red-50 text-red-800 border-red-300"
          }`}
        >
          {toastMessage.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <X className="w-4 h-4 text-red-600" />
          )}
          <span>{translateText(toastMessage.text)}</span>
        </div>
      )}

      {/* KPI Cards (chỉ hiện khi chạy độc lập để tránh trùng lặp với NutritionRulesPage) */}
      {!embedded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: translateText("Trẻ Có Hồ Sơ Dị Ứng"),
              val: stats.totalAllergic,
              unit: `/ ${stats.totalStudents} bé`,
              sub: `Chiếm tỷ lệ ${stats.allergyRate}% sĩ số`,
              icon: HeartPulse,
              color: "bg-rose-50 text-rose-600",
              text: "text-slate-900",
            },
            {
              title: translateText("Nguy Cơ Cao (Phản Vệ)"),
              val: stats.highRiskCount,
              unit: translateText("bé"),
              sub: translateText("Thẻ đỏ & khay ăn cách ly tuyệt đối"),
              icon: AlertOctagon,
              color: "bg-red-50 text-red-600",
              text: "text-red-600",
            },
            {
              title: translateText("Chất Phổ Biến Nhất"),
              val: stats.topAllergenText,
              unit: "",
              sub: translateText("Kiểm soát chặt nguyên liệu đầu vào"),
              icon: AlertTriangle,
              color: "bg-amber-50 text-amber-600",
              text: "text-amber-800 text-base truncate block",
            },
            {
              title: translateText("Lớp Tỷ Lệ Cao Nhất"),
              val: stats.topClassText,
              unit: "",
              sub: translateText("GVCN & Bếp giám sát kỹ giờ ăn"),
              icon: GraduationCap,
              color: "bg-teal-50 text-teal-600",
              text: "text-teal-800 text-base truncate block",
            },
          ].map((k) => (
            <div
              key={k.title}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translateText(k.title)}
                </span>
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center ${k.color}`}
                >
                  <k.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-black tracking-tight ${k.text}`}
                >
                  {translateText(k.val)}
                </span>
                {k.unit && (
                  <span className="text-xs font-bold text-slate-400">
                    {translateText(k.unit)}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                {translateText(k.sub)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIRECTORY: Danh Sách Học Sinh Dị Ứng */}
      <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={translateText("Tìm theo tên học sinh, mã số hoặc chất dị ứng...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">{translateText("Tất cả các lớp")}</option>
                {classesList.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedAllergenCode}
                onChange={(e) => setSelectedAllergenCode(e.target.value)}
                className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">{translateText("Tất cả nhóm dị ứng")}</option>
                {allergensList.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.nameVi || a.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">{translateText("Mọi mức độ nguy cơ")}</option>
                <option value="HIGH">{translateText("Nguy cơ cao (Phản vệ)")}</option>
                <option value="MEDIUM">{translateText("Trung bình")}</option>
                <option value="LOW">{translateText("Nhẹ")}</option>
              </select>

              <button
                onClick={fetchData}
                className="p-2 rounded-2xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                title={translateText("Làm mới dữ liệu")}
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title={translateText("Xuất danh sách học sinh dị ứng ra Excel")}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{translateText("Xuất Excel")}</span>
              </button>

              {canManage && (
                <button
                  onClick={() => {
                    setEditingCatalogItem(null);
                    setIsAllergenDrawerOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{translateText("Thêm Nhóm Dị Ứng")}</span>
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => setIsDeclareModalOpen(true)}
                  className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{translateText("Khai Báo Trẻ")}</span>
                </button>
              )}


            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">{translateText("Học Sinh")}</th>
                    <th className="py-3.5 px-4">{translateText("Lớp Học")}</th>
                    <th className="py-3.5 px-4">{translateText("Nhóm Dị Ứng")}</th>
                    <th className="py-3.5 px-4">{translateText("Mức Độ Cảnh Báo")}</th>
                    <th className="py-3.5 px-4">{translateText("Triệu Chứng & Quy Tắc Cách Ly Bếp")}</th>
                    <th className="py-3.5 px-5 text-right">{translateText("Thao Tác")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-slate-400"
                      >
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-300 mb-2" />
                        <p className="font-bold">{translateText("Đang tải hồ sơ dị ứng...")}</p>
                      </td>
                    </tr>
                  ) : filteredAllergicChildren.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-slate-400"
                      >
                        <ShieldAlert className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700">{translateText("Không tìm thấy học sinh dị ứng phù hợp với bộ lọc")}</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedChildren.map((child) => (
                      <tr
                        key={child.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {child.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">
                                {child.fullName}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {child.studentCode} •{" "}
                                {translateText(child.gender === "MALE" ? "Nam" : "Nữ")}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 inline-block">
                            {child.className || translateText("Chưa phân lớp")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {child.allergies.map((a) => (
                              <span
                                key={a.id}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${BADGE_STYLES[a.allergenCode] || "bg-purple-50 text-purple-700 border-purple-200"}`}
                              >
                                {a.allergenName}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {child.allergies.map((a) => (
                            <div key={a.id} className="mb-1 last:mb-0">
                              {renderSeverityBadge(a.severity)}
                            </div>
                          ))}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs text-slate-600">
                          {child.allergies.map((a) => (
                            <div
                              key={a.id}
                              className="text-[11px] leading-relaxed mb-1 last:mb-0"
                            >
                              <span className="font-semibold text-slate-800">
                                {a.allergenName}:{" "}
                              </span>
                              <span>{a.note || translateText("Theo dõi sát sau giờ ăn")}</span>
                            </div>
                          ))}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedChildForCard(child);
                                setIsCardModalOpen(true);
                              }}
                              className="p-1.5 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                              title={translateText("In thẻ nhận diện bàn ăn riêng")}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {canManage && child.allergies[0] && (
                              <>
                                <button
                                  onClick={() => {
                                    const a = child.allergies[0];
                                    setEditingAllergy({
                                      childId: child.id,
                                      allergyId: a.id,
                                      childName: child.fullName,
                                      allergenName: a.allergenName,
                                      severity: a.severity,
                                      note: a.note || "",
                                    });
                                    setIsEditModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition"
                                  title={translateText("Chỉnh sửa ghi chú dị ứng")}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteAllergy(
                                      child.allergies[0].id,
                                      child.fullName,
                                      child.allergies[0].allergenName,
                                    )
                                  }
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title={translateText("Xóa cảnh báo dị ứng")}
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

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span>
                  {totalItems > 0
                    ? `Hiển thị ${startIndex + 1} - ${endIndex} trên tổng số ${totalItems} học sinh dị ứng`
                    : translateText("Không có học sinh dị ứng phù hợp")}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">{translateText("Số lượng/trang:")}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition"
                    title={translateText("Trang trước")}
                  >
                    ‹
                  </button>
                  <span className="px-2 font-bold text-slate-700">
                    {`Trang ${currentPage} / ${totalPages}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition"
                    title={translateText("Trang sau")}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* TAB 2: CATALOG & ALLERGY RULES */}


      {/* Drawer Thêm/Sửa Nhóm Dị Ứng */}
      {canManage && (<AllergenDrawer
        isOpen={isAllergenDrawerOpen}
        allergen={editingCatalogItem}
        isLoading={isSubmitting}
        onClose={() => setIsAllergenDrawerOpen(false)}
        onSubmit={handleCatalogSubmit}
      />)}

      {/* MODAL 1: KHAI BÁO DỊ ỨNG HỌC SINH */}
      {canManage && isDeclareModalOpen && (
        <div className="fixed !m-0 inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{translateText("Khai Báo Dị Ứng Học Sinh Mới")}</h3>
                  <p className="text-xs text-slate-400">{translateText("Tạo hồ sơ theo dõi dị ứng thực phẩm cho học sinh")}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDeclareModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeclareSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">{translateText("Chọn Học Sinh *")}</label>
                <select
                  value={declareForm.childId}
                  onChange={(e) =>
                    setDeclareForm({ ...declareForm, childId: e.target.value })
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 font-semibold bg-white"
                >
                  <option value="">{translateText("-- Chọn học sinh toàn trường --")}</option>
                  {allChildren.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.studentCode}{translateText(") • Lớp:")}{" "}
                      {c.className || translateText("Chưa phân lớp")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">{translateText("Nhóm Chất Dị Ứng *")}</label>
                <select
                  value={declareForm.allergenId}
                  onChange={(e) =>
                    setDeclareForm({
                      ...declareForm,
                      allergenId: e.target.value,
                    })
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 font-semibold bg-white"
                >
                  <option value="">{translateText("-- Chọn nhóm chất dị ứng chuẩn --")}</option>
                  {allergensList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nameVi || a.name} ({translateText(a.code)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">{translateText("Mức Độ Cảnh Báo *")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      val: "HIGH",
                      label: translateText("Nguy cơ cao (Phản vệ)"),
                      active: "bg-red-500 text-white border-red-500",
                    },
                    {
                      val: "MEDIUM",
                      label: translateText("Trung bình"),
                      active: "bg-amber-500 text-white border-amber-500",
                    },
                    {
                      val: "LOW",
                      label: translateText("Nhẹ"),
                      active: "bg-blue-500 text-white border-blue-500",
                    },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() =>
                        setDeclareForm({ ...declareForm, severity: s.val })
                      }
                      className={`py-2 px-3 rounded-2xl font-bold border transition ${declareForm.severity === s.val ? s.active : "bg-slate-50 text-slate-700 border-slate-200"}`}
                    >
                      {translateText(s.label)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">{translateText("Triệu Chứng & Hướng Dẫn Cách Ly / Thay Thế Cho Bếp")}</label>
                <textarea
                  rows={3}
                  value={declareForm.note}
                  onChange={(e) =>
                    setDeclareForm({ ...declareForm, note: e.target.value })
                  }
                  placeholder={translateText("Ví dụ: Dị ứng tôm cua — sưng môi, khó thở. Yêu cầu Bếp nấu nồi riêng và thay bằng thịt lợn nạc...")}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeclareModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold"
                >{translateText("Hủy Bỏ")}</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {translateText(isSubmitting ? "Đang Lưu..." : "Lưu Hồ Sơ Dị Ứng")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CẬP NHẬT GHI CHÚ DỊ ỨNG */}
      {canManage && isEditModalOpen && editingAllergy && (
        <div className="fixed !m-0 inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{translateText("Cập Nhật Hồ Sơ Dị Ứng")}</h3>
                <p className="text-xs text-slate-500 font-semibold">{translateText("Học sinh: ")}{editingAllergy.childName} •{" "}
                  {editingAllergy.allergenName}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">{translateText("Mức Độ Cảnh Báo *")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      val: "HIGH",
                      label: translateText("Nguy cơ cao"),
                      active: "bg-red-500 text-white border-red-500",
                    },
                    {
                      val: "MEDIUM",
                      label: translateText("Trung bình"),
                      active: "bg-amber-500 text-white border-amber-500",
                    },
                    {
                      val: "LOW",
                      label: translateText("Nhẹ"),
                      active: "bg-blue-500 text-white border-blue-500",
                    },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() =>
                        setEditingAllergy({
                          ...editingAllergy,
                          severity: s.val,
                        })
                      }
                      className={`py-2 px-3 rounded-2xl font-bold border transition ${editingAllergy.severity === s.val ? s.active : "bg-slate-50 text-slate-700"}`}
                    >
                      {translateText(s.label)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">{translateText("Triệu Chứng & Hướng Dẫn Bếp")}</label>
                <textarea
                  rows={3}
                  value={editingAllergy.note}
                  onChange={(e) =>
                    setEditingAllergy({
                      ...editingAllergy,
                      note: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-600 font-bold"
                >{translateText("Hủy")}</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md"
                >
                  {translateText(isSubmitting ? "Đang Lưu..." : "Cập Nhật")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: IN THẺ NHẬN DIỆN BÀN ĂN DỊ ỨNG */}
      {isCardModalOpen && selectedChildForCard && (
        <div className="fixed !m-0 inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />{translateText(" Thẻ Nhận Diện Khay Ăn Dị Ứng")}</h3>
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              id="allergen-print-card"
              className="p-5 border-4 border-dashed border-red-500 rounded-3xl bg-red-50/40 space-y-4 text-center"
            >
              <div className="flex items-center justify-between pb-2 border-b border-red-200">
                <span className="font-black text-red-600 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <AlertOctagon className="w-4 h-4" />{translateText(" KIDMEAL CẢNH BÁO BÀN ĂN")}</span>
                <span className="text-[10px] font-bold text-slate-500">{translateText("LỚP: ")}{selectedChildForCard.className}
                </span>
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900">
                  {selectedChildForCard.fullName}
                </h2>
                <p className="text-xs text-slate-500 font-mono">{translateText("Mã số: ")}{selectedChildForCard.studentCode}
                </p>
              </div>
              <div className="p-3 bg-red-100 border border-red-300 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-red-700 uppercase tracking-wider block">{translateText("CHẤT DỊ ỨNG CẤM KỴ TUYỆT ĐỐI:")}</span>
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {selectedChildForCard.allergies.map((a) => (
                    <span
                      key={a.id}
                      className="px-3 py-1 bg-red-600 text-white font-black text-xs rounded-full shadow-sm"
                    >
                      ✕ {a.allergenName}
                    </span>
                  ))}
                </div>
              </div>
              {selectedChildForCard.allergies[0]?.note && (
                <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900">{translateText("Ghi chú cho Bếp & Cô giáo:")}{" "}
                  </span>
                  {selectedChildForCard.allergies[0].note}
                </div>
              )}
              <p className="text-[10px] text-slate-400 italic">{translateText("* Thẻ này dán cố định tại khay ăn và vị trí ngồi của học sinh trong giờ ăn bán trú.")}</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs"
              >{translateText("Đóng")}</button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> <span>{translateText("In Thẻ Ngay")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
