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
  Salad,
  Layers,
  RotateCcw,
  Archive,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";
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
  const [activeTab, setActiveTab] = useState<"DIRECTORY" | "CATALOG">(
    "DIRECTORY",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [allChildren, setAllChildren] = useState<ChildWithAllergy[]>([]);
  const [allergensList, setAllergensList] = useState<AllergenStandard[]>([]);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [selectedAllergenCode, setSelectedAllergenCode] = useState("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
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
      allChildren.filter(
        (c) => Array.isArray(c.allergies) && c.allergies.length > 0,
      ),
    [allChildren],
  );

  const filteredAllergicChildren = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allergicChildren.filter((c) => {
      const matchQ =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.studentCode.toLowerCase().includes(q) ||
        c.allergies.some(
          (a) =>
            a.allergenName.toLowerCase().includes(q) ||
            (a.note || "").toLowerCase().includes(q),
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
          <span>Nguy cơ cao (Phản vệ)</span>
        </span>
      );
    }
    if (s === "MEDIUM" || s === "MODERATE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Trung bình</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span>Nhẹ / Bất dung nạp</span>
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
        `Xác nhận xóa cảnh báo dị ứng "${allergenName}" của học sinh "${childName}"?`,
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
        `Xác nhận chuyển nhóm dị ứng "${item.nameVi || item.name}" vào lưu trữ?`,
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

  const handleExportCSV = () => {
    if (allergicChildren.length === 0)
      return showToast("Chưa có dữ liệu học sinh dị ứng để xuất file", "error");
    const headers = [
      "Mã Học Sinh",
      "Họ Và Tên",
      "Lớp Học",
      "Chất Dị Ứng",
      "Mức Độ Nguy Cơ",
      "Triệu Chứng & Ghi Chú Cách Ly",
      "Ngày Khai Báo",
    ];
    const rows = allergicChildren.flatMap((c) =>
      c.allergies.map((a) => [
        `"${c.studentCode}"`,
        `"${c.fullName}"`,
        `"${c.className || "Chưa phân lớp"}"`,
        `"${a.allergenName}"`,
        `"${a.severity === "HIGH" ? "Nguy cơ cao" : a.severity === "MEDIUM" ? "Trung bình" : "Nhẹ"}"`,
        `"${(a.note || "").replace(/"/g, '""')}"`,
        `"${a.declaredAt ? new Date(a.declaredAt).toLocaleDateString("vi-VN") : ""}"`,
      ]),
    );
    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `KidMeal_Danh_Sach_Tre_Di_Ung_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast("Đã xuất file báo cáo dị ứng thành công");
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
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#0d3429] via-[#114b3b] to-[#1c382f] rounded-3xl p-6 text-white shadow-xl border border-emerald-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Quy Tắc An Toàn Thực Phẩm Codex CXC 80-2020 & Bộ Y Tế
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Cấu Hình Quy Tắc Dị Ứng & Hồ Sơ Cách Ly Khẩu Phần Mầm Non
          </h2>
          <p className="text-emerald-100 text-xs leading-relaxed">
            Quản trị danh mục dị nguyên chuẩn Codex, phân tầng 3 mức độ phản vệ
            (Nhẹ • Trung bình • Phản vệ cấp tính), chống nhiễm chéo dụng cụ nấu
            và in thẻ cảnh báo bàn ăn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Xuất Excel/CSV</span>
          </button>
          <button
            onClick={() => {
              setEditingCatalogItem(null);
              setIsAllergenDrawerOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-lg transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Nhóm Dị Ứng</span>
          </button>
          <button
            onClick={() => setIsDeclareModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-xs shadow-lg transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Khai Báo Hồ Sơ Trẻ</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (chỉ hiện đầy đủ khi chạy độc lập để tránh trùng lặp với NutritionRulesPage) */}
      {!embedded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              title: "Trẻ Có Hồ Sơ Dị Ứng",
              val: stats.totalAllergic,
              unit: `/ ${stats.totalStudents} bé`,
              sub: `Chiếm tỷ lệ ${stats.allergyRate}% sĩ số`,
              icon: HeartPulse,
              color: "bg-rose-50 text-rose-600",
              text: "text-slate-900",
            },
            {
              title: "Nguy Cơ Cao (Phản Vệ)",
              val: stats.highRiskCount,
              unit: "bé",
              sub: "Thẻ đỏ & khay ăn cách ly tuyệt đối",
              icon: AlertOctagon,
              color: "bg-red-50 text-red-600",
              text: "text-red-600",
            },
            {
              title: "Chất Phổ Biến Nhất",
              val: stats.topAllergenText,
              unit: "",
              sub: "Kiểm soát chặt nguyên liệu đầu vào",
              icon: AlertTriangle,
              color: "bg-amber-50 text-amber-600",
              text: "text-amber-800 text-base truncate block",
            },
            {
              title: "Lớp Tỷ Lệ Cao Nhất",
              val: stats.topClassText,
              unit: "",
              sub: "GVCN & Bếp giám sát kỹ giờ ăn",
              icon: GraduationCap,
              color: "bg-teal-50 text-teal-600",
              text: "text-teal-800 text-base truncate block",
            },
            {
              title: "Món Ăn Thay Thế",
              val: "100%",
              unit: "",
              sub: "Đảm bảo tương đương dinh dưỡng",
              icon: Salad,
              color: "bg-emerald-50 text-emerald-600",
              text: "text-emerald-600",
            },
          ].map((k) => (
            <div
              key={k.title}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {k.title}
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
                  {k.val}
                </span>
                {k.unit && (
                  <span className="text-xs font-bold text-slate-400">
                    {k.unit}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                {k.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("DIRECTORY")}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            activeTab === "DIRECTORY"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/25"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Danh Sách Học Sinh Dị Ứng</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === "DIRECTORY" ? "bg-rose-700 text-rose-100" : "bg-slate-200 text-slate-700"}`}
          >
            {allergicChildren.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("CATALOG")}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            activeTab === "CATALOG"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Danh Mục Dị Ứng Codex & Quy Tắc Xử Trí (UC43)</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === "CATALOG" ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-700"}`}
          >
            {allergensList.length}
          </span>
        </button>
      </div>

      {/* TAB 1: DIRECTORY */}
      {activeTab === "DIRECTORY" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên học sinh, mã số hoặc chất dị ứng..."
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
                <option value="ALL">Tất cả các lớp</option>
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
                <option value="ALL">Tất cả nhóm dị ứng</option>
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
                <option value="ALL">Mọi mức độ nguy cơ</option>
                <option value="HIGH">Nguy cơ cao (Phản vệ)</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="LOW">Nhẹ</option>
              </select>

              <button
                onClick={fetchData}
                className="p-2 rounded-2xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Học Sinh</th>
                    <th className="py-3.5 px-4">Lớp Học</th>
                    <th className="py-3.5 px-4">Nhóm Dị Ứng</th>
                    <th className="py-3.5 px-4">Mức Độ Cảnh Báo</th>
                    <th className="py-3.5 px-4">
                      Triệu Chứng & Quy Tắc Cách Ly Bếp
                    </th>
                    <th className="py-3.5 px-5 text-right">Thao Tác</th>
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
                        <p className="font-bold">Đang tải hồ sơ dị ứng...</p>
                      </td>
                    </tr>
                  ) : filteredAllergicChildren.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-slate-400"
                      >
                        <ShieldAlert className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700">
                          Không tìm thấy học sinh dị ứng phù hợp với bộ lọc
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAllergicChildren.map((child) => (
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
                                {child.gender === "MALE" ? "Nam" : "Nữ"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 inline-block">
                            {child.className || "Chưa phân lớp"}
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
                              <span>{a.note || "Theo dõi sát sau giờ ăn"}</span>
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
                              title="In thẻ nhận diện bàn ăn riêng"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {child.allergies[0] && (
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
                                  title="Chỉnh sửa ghi chú dị ứng"
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
                                  title="Xóa cảnh báo dị ứng"
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
          </div>
        </div>
      )}

      {/* TAB 2: CATALOG & ALLERGY RULES (UC43) */}
      {activeTab === "CATALOG" && (
        <div className="space-y-5">
          {/* Toolbar Tìm kiếm & Thêm mới Danh mục Dị ứng */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Tìm mã dị nguyên (MILK, PEANUT...) hoặc thực phẩm cảnh báo..."
                className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={includeDeletedCatalog}
                  onChange={(e) => setIncludeDeletedCatalog(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded-sm"
                />
                <span>Hiện nhóm đã lưu trữ</span>
              </label>
              <button
                onClick={() => {
                  setEditingCatalogItem(null);
                  setIsAllergenDrawerOpen(true);
                }}
                className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Dị Nguyên Mới</span>
              </button>
            </div>
          </div>

          {/* 3-Tier Allergy Rule Protocol Banner (Codex CXC 80-2020) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                level: "MỨC 1: NHẸ / BẤT DUNG NẠP (LOW)",
                color: "border-blue-200 bg-blue-50/60 text-blue-900",
                rule: "Ghi chú chia phần hạn chế dị nguyên; thay thế tinh bột/sữa không chứa lactose hoặc gluten tương đương.",
              },
              {
                level: "MỨC 2: TRUNG BÌNH (MEDIUM)",
                color: "border-amber-200 bg-amber-50/60 text-amber-900",
                rule: "Rule Engine cảnh báo vàng; bắt buộc tách khẩu phần hoặc đổi sang nguyên liệu đạm an toàn tương đương Calo.",
              },
              {
                level: "MỨC 3: NGUY CƠ PHẢN VỆ (HIGH / CRITICAL)",
                color: "border-red-200 bg-red-50/60 text-red-900",
                rule: "Rule Engine chặn cảnh báo đỏ; nấu nồi/dụng cụ riêng chống nhiễm chéo (CXC 80-2020), dán thẻ đỏ khay ăn & sẵn sàng phác đồ cấp cứu.",
              },
            ].map((p) => (
              <div
                key={p.level}
                className={`p-4 rounded-2xl border space-y-1.5 ${p.color}`}
              >
                <span className="text-[11px] font-black uppercase tracking-wider block">
                  {p.level}
                </span>
                <p className="text-xs leading-relaxed opacity-90">{p.rule}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allergensList.map((item) => (
              <div
                key={item.id}
                className={`bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between ${
                  item.isDeleted ? "opacity-60 bg-slate-50" : ""
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-sm">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {item.code}
                      </span>
                      {item.isDeleted ? (
                        <button
                          onClick={() => handleRestoreCatalog(item)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg"
                          title="Khôi phục"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingCatalogItem(item as any);
                              setIsAllergenDrawerOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Chỉnh sửa quy tắc dị nguyên"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {!item.isSystemStandard && (
                            <button
                              onClick={() => handleSoftDeleteCatalog(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Lưu trữ (Xóa mềm)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-3">
                    {item.nameVi || item.name}
                  </h3>
                  {item.nameEn && (
                    <p className="text-[11px] text-slate-400 italic">
                      {item.nameEn}
                    </p>
                  )}

                  <div className="mt-3 p-2.5 bg-slate-50 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Thực phẩm & Quy tắc cảnh báo:
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {item.commonFoods || item.description || "Chưa cập nhật"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full ${item.isSystemStandard ? "text-amber-700 bg-amber-50" : "text-indigo-700 bg-indigo-50"}`}
                  >
                    {item.isSystemStandard
                      ? "Chuẩn Codex / BYT"
                      : "Quy tắc Trường"}
                  </span>
                  <span
                    className={
                      item.isDeleted
                        ? "text-slate-400 font-bold"
                        : "text-emerald-700 font-bold"
                    }
                  >
                    {item.isDeleted ? "Đã lưu trữ" : "✓ Đang kích hoạt"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawer Thêm/Sửa Nhóm Dị Ứng */}
      <AllergenDrawer
        isOpen={isAllergenDrawerOpen}
        allergen={editingCatalogItem}
        isLoading={isSubmitting}
        onClose={() => setIsAllergenDrawerOpen(false)}
        onSubmit={handleCatalogSubmit}
      />

      {/* MODAL 1: KHAI BÁO DỊ ỨNG HỌC SINH */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Khai Báo Dị Ứng Học Sinh Mới
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tạo hồ sơ theo dõi dị ứng thực phẩm cho học sinh
                  </p>
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
                <label className="font-bold text-slate-700">
                  Chọn Học Sinh *
                </label>
                <select
                  value={declareForm.childId}
                  onChange={(e) =>
                    setDeclareForm({ ...declareForm, childId: e.target.value })
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 font-semibold bg-white"
                >
                  <option value="">-- Chọn học sinh toàn trường --</option>
                  {allChildren.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.studentCode}) • Lớp:{" "}
                      {c.className || "Chưa phân lớp"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">
                  Nhóm Chất Dị Ứng *
                </label>
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
                  <option value="">
                    -- Chọn nhóm chất dị ứng (Codex/BYT) --
                  </option>
                  {allergensList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nameVi || a.name} ({a.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">
                  Mức Độ Cảnh Báo *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      val: "HIGH",
                      label: "Nguy cơ cao (Phản vệ)",
                      active: "bg-red-500 text-white border-red-500",
                    },
                    {
                      val: "MEDIUM",
                      label: "Trung bình",
                      active: "bg-amber-500 text-white border-amber-500",
                    },
                    {
                      val: "LOW",
                      label: "Nhẹ",
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
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">
                  Triệu Chứng & Hướng Dẫn Cách Ly / Thay Thế Cho Bếp
                </label>
                <textarea
                  rows={3}
                  value={declareForm.note}
                  onChange={(e) =>
                    setDeclareForm({ ...declareForm, note: e.target.value })
                  }
                  placeholder="Ví dụ: Dị ứng tôm cua — sưng môi, khó thở. Yêu cầu Bếp nấu nồi riêng và thay bằng thịt lợn nạc..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeclareModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "Đang Lưu..." : "Lưu Hồ Sơ Dị Ứng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CẬP NHẬT GHI CHÚ DỊ ỨNG */}
      {isEditModalOpen && editingAllergy && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Cập Nhật Hồ Sơ Dị Ứng
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Học sinh: {editingAllergy.childName} •{" "}
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
                <label className="font-bold text-slate-700">
                  Mức Độ Cảnh Báo *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      val: "HIGH",
                      label: "Nguy cơ cao",
                      active: "bg-red-500 text-white border-red-500",
                    },
                    {
                      val: "MEDIUM",
                      label: "Trung bình",
                      active: "bg-amber-500 text-white border-amber-500",
                    },
                    {
                      val: "LOW",
                      label: "Nhẹ",
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
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">
                  Triệu Chứng & Hướng Dẫn Bếp
                </label>
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
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md"
                >
                  {isSubmitting ? "Đang Lưu..." : "Cập Nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: IN THẺ NHẬN DIỆN BÀN ĂN DỊ ỨNG */}
      {isCardModalOpen && selectedChildForCard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" /> Thẻ Nhận Diện
                Khay Ăn Dị Ứng
              </h3>
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
                  <AlertOctagon className="w-4 h-4" /> KIDMEAL CẢNH BÁO BÀN ĂN
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  LỚP: {selectedChildForCard.className}
                </span>
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900">
                  {selectedChildForCard.fullName}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Mã số: {selectedChildForCard.studentCode}
                </p>
              </div>
              <div className="p-3 bg-red-100 border border-red-300 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-red-700 uppercase tracking-wider block">
                  CHẤT DỊ ỨNG CẤM KỴ TUYỆT ĐỐI:
                </span>
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
                  <span className="font-bold text-slate-900">
                    Ghi chú cho Bếp & Cô giáo:{" "}
                  </span>
                  {selectedChildForCard.allergies[0].note}
                </div>
              )}
              <p className="text-[10px] text-slate-400 italic">
                * Thẻ này dán cố định tại khay ăn và vị trí ngồi của học sinh
                trong giờ ăn bán trú.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> <span>In Thẻ Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
