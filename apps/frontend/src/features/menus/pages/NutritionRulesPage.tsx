import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Scale,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HeartPulse,
  Salad,
  RotateCcw,
  Edit3,
  Archive,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Play,
  CloudDownload,
  Database,
  PieChart,
  Droplets,
  X,
} from "lucide-react";
import {
  nutritionEngineApi,
  NutritionRule,
  AllergenCatalog,
  NutritionEngineStats,
  MenuScanResult,
  CreateNutritionRulePayload,
  UpdateNutritionRulePayload,
  CreateAllergenPayload,
  UpdateAllergenPayload,
} from "../api/nutrition-rule-engine.api";
import { NutritionRuleDrawer } from "../components/NutritionRuleDrawer";
import { AllergenDrawer } from "../components/AllergenDrawer";
import { NutritionistAllergyManagementPage } from "./NutritionistAllergyManagementPage";
import { MealDistributionPanel } from "../components/MealDistributionPanel";
import { useAuthStore } from "../../../core/stores/auth.store";

export const NutritionRulesPage: React.FC = () => {
  useLanguage();
  const navigate = useNavigate(),
    location = useLocation();
  const { user } = useAuthStore();
  const isPrincipalOrAdmin = (user?.roles || []).some((r: any) => {
    const role = typeof r === "string" ? r : r?.code || r?.name || "";
    return [
      "PRINCIPAL",
      "SCHOOL_MANAGEMENT",
      "SCHOOL_MANAGER",
      "SUPER_ADMIN",
      "ADMIN",
    ].includes(role.toUpperCase());
  });
  const [activeTab, setActiveTab] = useState<
    "STANDARDS" | "MEAL_DISTRIBUTION" | "ALLERGENS" | "SCANNER"
  >("STANDARDS");

  useEffect(() => {
    if (location.search.includes("tab=MEAL_DISTRIBUTION")) {
      setActiveTab("MEAL_DISTRIBUTION");
      return;
    }
    if (
      location.pathname.startsWith("/nutritionist") &&
      (location.pathname.includes("/allergens") ||
        location.search.includes("tab=ALLERGENS"))
    ) {
      setActiveTab("ALLERGENS");
    }
  }, [location.pathname, location.search]);

  const [stats, setStats] = useState<NutritionEngineStats | null>(null);
  const [rules, setRules] = useState<NutritionRule[]>([]);
  const [allergens, setAllergens] = useState<AllergenCatalog[]>([]);

  const [ruleSearch, setRuleSearch] = useState("");
  const [ruleAgeFilter, setRuleAgeFilter] = useState("");
  const [includeDeletedRules, setIncludeDeletedRules] = useState(false);

  const [scanResult, setScanResult] = useState<MenuScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [isRuleDrawerOpen, setIsRuleDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NutritionRule | null>(null);

  const [isAllergenDrawerOpen, setIsAllergenDrawerOpen] = useState(false);
  const [editingAllergen, setEditingAllergen] =
    useState<AllergenCatalog | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStats = async () => {
    try {
      setStats(await nutritionEngineApi.getNutritionStats());
    } catch {
      setStats(null);
      showToast("error", "Không tải được thống kê quy tắc.");
    }
  };

  const loadRules = async () => {
    try {
      setRules(
        await nutritionEngineApi.getNutritionRules({
          search: ruleSearch,
          targetAgeGroup: ruleAgeFilter || undefined,
          includeDeleted: includeDeletedRules,
        }),
      );
    } catch {
      setRules([]);
      showToast("error", "Không tải được tiêu chuẩn dinh dưỡng.");
    }
  };

  const loadAllergens = async () => {
    try {
      setAllergens(await nutritionEngineApi.getAllergens());
    } catch {}
  };

  const refreshAll = () =>
    Promise.all([loadStats(), loadRules(), loadAllergens()]);

  useEffect(() => {
    refreshAll();
  }, []);
  useEffect(() => {
    loadRules();
  }, [ruleSearch, ruleAgeFilter, includeDeletedRules]);

  const handleConfirmSyncRda = async () => {
    setIsSyncing(true);
    try {
      const res = await nutritionEngineApi.syncRdaStandards();
      showToast(
        "success",
        res.message ||
          "Đã đồng bộ thành công chuẩn dinh dưỡng Quốc gia vào Database!",
      );
      await Promise.all([loadRules(), loadStats()]);
      setIsSyncModalOpen(false);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Có lỗi khi đồng bộ quy chuẩn.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRuleSubmit = async (
    payload: CreateNutritionRulePayload | UpdateNutritionRulePayload,
    id?: string,
  ) => {
    setIsLoading(true);
    try {
      if (id) {
        await nutritionEngineApi.updateNutritionRule(id, payload);
        showToast("success", "Đã cập nhật quy chuẩn dinh dưỡng thành công.");
      } else {
        await nutritionEngineApi.createNutritionRule(
          payload as CreateNutritionRulePayload,
        );
        showToast(
          "success",
          "Đã tạo mới quy chuẩn dinh dưỡng Quy chuẩn Dinh dưỡng thành công.",
        );
      }
      setIsRuleDrawerOpen(false);
      await Promise.all([loadRules(), loadStats()]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSoftDeleteRule = async (rule: NutritionRule) => {
    if (rule.isSystemRule)
      return showToast(
        "error",
        "Không thể xóa quy chuẩn gốc quốc gia của Bộ GD&ĐT.",
      );
    if (
      !window.confirm(
        translateText(`Xác nhận chuyển quy chuẩn "${rule.name}" vào danh sách lưu trữ (xóa mềm)?`),
      )
    )
      return;
    try {
      const res = await nutritionEngineApi.softDeleteNutritionRule(rule.id);
      showToast("success", res.message);
      await Promise.all([loadRules(), loadStats()]);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Không thể xóa quy chuẩn này.",
      );
    }
  };

  const handleRestoreRule = async (rule: NutritionRule) => {
    try {
      const res = await nutritionEngineApi.restoreNutritionRule(rule.id);
      showToast("success", res.message);
      await Promise.all([loadRules(), loadStats()]);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Không thể khôi phục quy chuẩn.",
      );
    }
  };

  const handleAllergenSubmit = async (
    payload: CreateAllergenPayload | UpdateAllergenPayload,
    id?: string,
  ) => {
    setIsLoading(true);
    try {
      if (id) {
        await nutritionEngineApi.updateAllergen(id, payload);
        showToast("success", "Đã cập nhật thông tin chất dị ứng thành công.");
      } else {
        await nutritionEngineApi.createAllergen(
          payload as CreateAllergenPayload,
        );
        showToast("success", "Đã thêm chất dị ứng mới vào danh mục kiểm tra.");
      }
      setIsAllergenDrawerOpen(false);
      await Promise.all([loadAllergens(), loadStats()]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerScan = () =>
    navigate(
      location.pathname.startsWith("/nutritionist")
        ? "/nutritionist/menu-evaluation"
        : "/menu-evaluation",
    );

  const standardDayboarding = rules.find((r) => r.mealScope === "DAYBOARDING") || rules[0];
  const standardFullDay = rules.find((r) => r.mealScope === "FULL_DAY");

  const minCaloDisplay = standardDayboarding
    ? (standardDayboarding.minCaloriesKcal ?? (standardDayboarding as any).minEnergyKcal ?? 615)
    : 615;
  const maxCaloDisplay = standardFullDay
    ? (standardFullDay.maxCaloriesKcal ?? (standardFullDay as any).maxEnergyKcal ?? 926)
    : (standardDayboarding ? (standardDayboarding.maxCaloriesKcal ?? (standardDayboarding as any).maxEnergyKcal ?? 726) : 726);

  const kpiCards = [
    {
      label: "Quy Chuẩn Áp Dụng",
      val: stats?.activeRulesCount ?? (rules.length || 2),
      unit: "cấu hình",
      sub: "Cấu hình 1 (Tiêu chuẩn) & Cấu hình 2 (Ăn xế)",
      icon: Scale,
      iconCls: "bg-teal-50 text-teal-600",
      valCls: "text-slate-900",
      subCls: "text-teal-700",
    },
    {
      label: "Năng Lượng Bán Trú",
      val: `${minCaloDisplay} – ${maxCaloDisplay}`,
      unit: "Kcal",
      sub: "CH1: 615–726 Kcal · CH2 (Ăn xế): 765–926 Kcal",
      icon: ShieldCheck,
      iconCls: "bg-emerald-50 text-emerald-600",
      valCls: "text-emerald-700",
      subCls: "text-emerald-700",
      dot: true,
    },
    {
      label: "Định Mức Nước Tại Trường",
      val: standardFullDay?.waterMlMax
        ? `${standardDayboarding?.waterMlMin || 800} – ${standardFullDay.waterMlMax}`
        : "800 – 1350",
      unit: "ml",
      sub: "CH1: 800–1100 ml · CH2 (Ăn xế): 1000–1350 ml",
      icon: Droplets,
      iconCls: "bg-cyan-50 text-cyan-600",
      valCls: "text-cyan-700",
      subCls: "text-cyan-700",
    },
    {
      label: "Trẻ Có Hồ Sơ Dị Ứng",
      val: stats?.allergicChildrenCount ?? 0,
      unit: "bé",
      sub: "Tự động kiểm soát thực đơn riêng",
      icon: HeartPulse,
      iconCls: "bg-rose-50 text-rose-600",
      valCls: "text-rose-600",
      subCls: "text-rose-700",
    },
  ];

  if (!isPrincipalOrAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 my-16 bg-white border border-slate-200/80 rounded-3xl shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">{translateText("Giới hạn quyền truy cập")}</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          {translateText("Chức năng cấu hình và ban hành Tiêu chuẩn dinh dưỡng & Phân bổ bữa ăn thuộc thẩm quyền quản trị của Ban Giám Hiệu & Hiệu Trưởng. Tài khoản Chuyên viên dinh dưỡng không có quyền thực hiện thao tác này.")}
        </p>
        <div className="pt-2">
          <button
            onClick={() => navigate("/nutritionist/menus")}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-teal-600/25 transition"
          >
            {translateText("Quay lại Quản lý thực đơn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6 text-slate-800">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-top-4 max-w-md ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span className="text-xs font-semibold">{translateText(toast.text)}</span>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((c) => (
            <div
              key={c.label}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {translateText(c.label)}
                </span>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconCls}`}
                >
                  <c.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <span
                  className={`text-2xl font-black tracking-tight ${c.valCls}`}
                >
                  {translateText(c.val)}
                </span>
                {c.unit && (
                  <span className="text-xs text-slate-500 font-semibold ml-1">
                    {translateText(c.unit)}
                  </span>
                )}
              </div>
              <div
                className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1 ${c.subCls}`}
              >
                {c.dot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <span>{translateText(c.sub)}</span>
              </div>
            </div>
          ))}
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs">
        <div className="inline-flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
          {[
            {
              id: "STANDARDS" as const,
              label: translateText("Tiêu chuẩn dinh dưỡng"),
              count: rules.length,
              icon: Scale,
              activeCls: "bg-teal-600 text-white shadow-2xs",
              badgeCls: "bg-teal-700 text-teal-100",
            },
            {
              id: "MEAL_DISTRIBUTION" as const,
              label: translateText("Phân bổ năng lượng & nước theo bữa"),
              count: null,
              icon: PieChart,
              activeCls: "bg-teal-600 text-white shadow-2xs",
              badgeCls: "",
            },
            {
              id: "ALLERGENS" as const,
              label: translateText("Quy tắc & Danh mục dị ứng"),
              count: allergens.length,
              icon: ShieldAlert,
              activeCls: "bg-rose-600 text-white shadow-2xs",
              badgeCls: "bg-rose-700 text-rose-100",
            },
            {
              id: "SCANNER" as const,
              label: translateText("Kiểm tra thực đơn"),
              count: null,
              icon: Sparkles,
              activeCls: "bg-indigo-600 text-white shadow-2xs",
              badgeCls: "",
            },
          ]
            .filter(
              (t) =>
                location.pathname.startsWith("/nutritionist") ||
                t.id === "STANDARDS" ||
                t.id === "MEAL_DISTRIBUTION",
            )
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === t.id
                    ? t.activeCls
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span>{translateText(t.label)}</span>
                {t.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeTab === t.id ? t.badgeCls : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {translateText(t.count)}
                  </span>
                )}
              </button>
            ))}
        </div>

        {activeTab === "STANDARDS" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                placeholder={translateText("Tìm quy chuẩn...")}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="button"
              onClick={refreshAll}
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition cursor-pointer"
              title={translateText("Làm mới dữ liệu")}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingRule(null);
                setIsRuleDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{translateText("Thêm cấu hình quy chuẩn")}</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: STANDARDS */}
      {activeTab === "STANDARDS" && (
        <div className="space-y-4">
          {/* Banner Đề xuất & Vận hành 2 Cấu hình Thực đơn */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border-2 border-teal-200/90 rounded-2xl p-4 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-teal-100 text-teal-800">
                  {translateText("CẤU HÌNH 1 · BÁN TRÚ TIÊU CHUẨN")}
                </span>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                  {translateText("3 bữa cơ bản")}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-1">
                {translateText("Quy chuẩn Bán trú Tiêu chuẩn (Không ăn xế)")}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {translateText("Áp dụng cho học sinh bán trú thông thường (chưa đăng ký ăn xế). Gồm 3 bữa tại trường:")}{" "}
                <strong className="text-slate-800">{translateText("Buổi sáng (09:00), Bữa trưa chính (11:00), Buổi phụ (14:30)")}</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 pt-2 border-t border-slate-100">
                <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                  🔥 615 – 726 Kcal (50 – 55%)
                </span>
                <span className="text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">
                  💧 800 – 1.100 ml
                </span>
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                  P: 13-20% · L: 25-35% · G: 52-60%
                </span>
              </div>
            </div>

            <div className="bg-white border-2 border-amber-300/90 rounded-2xl p-4 shadow-2xs relative overflow-hidden bg-gradient-to-br from-white via-amber-50/20 to-orange-50/20">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900">
                  {translateText("CẤU HÌNH 2 · BÁN TRÚ TOÀN DIỆN")}
                </span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                  {translateText("Có ăn xế chiều · 4 bữa")}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-1">
                {translateText("Quy chuẩn Bán trú Toàn diện (Có ăn xế chiều 17:00)")}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {translateText("Khi trẻ đóng tiền ăn xế bên Cổng phụ huynh, món ăn Buổi xế chiều (17:00: súp, cháo, bún, nui)")}{" "}
                <strong className="text-amber-900">{translateText("sẽ tự động được tính vào Cấu hình thứ 2 này")}</strong>{" "}
                {translateText("để đánh giá sức ăn & tổng calo cả ngày.")}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 pt-2 border-t border-amber-100">
                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                  🔥 765 – 926 Kcal (60 – 70%)
                </span>
                <span className="text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">
                  💧 1.000 – 1.350 ml
                </span>
                <span className="text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-lg">{translateText("+150–200 Kcal món ăn xế")}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-teal-700 bg-teal-600 text-[11px] font-bold text-white uppercase tracking-wider">
                    <th className="py-3.5 px-5">{translateText("Tên quy chuẩn / Cấu hình")}</th>
                    <th className="py-3.5 px-4">{translateText("Nhóm tuổi")}</th>
                    <th className="py-3.5 px-4">{translateText("Năng lượng")}</th>
                    <th className="py-3.5 px-4">{translateText("Cơ cấu Đạm · Béo · Bột đường")}</th>
                    <th className="py-3.5 px-4">{translateText("Nhu cầu nước")}</th>
                    <th className="py-3.5 px-4">{translateText("Vi chất Canxi")}</th>
                    <th className="py-3.5 px-4">{translateText("Trạng thái")}</th>
                    <th className="py-3.5 px-5 text-right">{translateText("Thao tác")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-12 text-center text-slate-400"
                      >
                        <Scale className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700">{translateText("Chưa tìm thấy quy chuẩn dinh dưỡng phù hợp")}</p>
                      </td>
                    </tr>
                  ) : (
                    [...rules]
                      .sort((a, b) => {
                        if (a.mealScope === "DAYBOARDING" && b.mealScope !== "DAYBOARDING") return -1;
                        if (a.mealScope !== "DAYBOARDING" && b.mealScope === "DAYBOARDING") return 1;
                        return 0;
                      })
                      .map((item) => {
                      const isDeleted = item.isDeleted;
                      const isFullDayConfig = item.mealScope === "FULL_DAY";
                      const configPrefix = isFullDayConfig ? "Cấu hình 2: " : "Cấu hình 1: ";
                      const displayName = item.name.startsWith("Cấu hình")
                        ? item.name
                        : `${configPrefix}${item.name}`;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/70 transition-colors ${isDeleted ? "bg-slate-50/50 opacity-70" : ""}`}
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  isFullDayConfig
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : "bg-teal-100 text-teal-800 border border-teal-200"
                                }`}
                              >
                                {isFullDayConfig ? "CH 2" : "CH 1"}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {displayName}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {translateText(
                                    isFullDayConfig
                                      ? "Phạm vi: Bán trú toàn diện (4 bữa) · 60–70% năng lượng · Tự động tính món ăn xế (17:00) khi trẻ đóng tiền"
                                      : "Phạm vi: Bán trú tiêu chuẩn (3 bữa) · 50–55% năng lượng · Áp dụng khi chưa đăng ký ăn xế"
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                              {translateText(item.targetAgeGroup === "ALL_AGES"
                                ? "Mọi lứa tuổi"
                                : "Mẫu giáo")}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {translateText(item.minCaloriesKcal ??
                              (item as any).minEnergyKcal ??
                              "—")}{" "}
                            -{" "}
                            {translateText(item.maxCaloriesKcal ??
                              (item as any).maxEnergyKcal ??
                              "—")}{" "}{translateText("Kcal")}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{translateText("P: ")}{translateText(item.minProteinPercent ?? "—")}-
                                {translateText(item.maxProteinPercent ?? "—")}%
                              </span>
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{translateText("L: ")}{translateText(item.minFatPercent ?? "—")}-
                                {translateText(item.maxFatPercent ?? "—")}%
                              </span>
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{translateText("G: ")}{translateText(item.minCarbPercent ?? "—")}-
                                {translateText(item.maxCarbPercent ?? "—")}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {item.waterMlMin || item.waterMlMax ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-50 border border-cyan-200/80 text-cyan-800 text-xs font-bold">
                                <Droplets className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                <span>
                                  {Number(item.waterMlMin).toLocaleString('vi-VN')} – {Number(item.waterMlMax).toLocaleString('vi-VN')} ml
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            <div>{translateText("Ca: ≥ ")}{translateText(item.minCalciumMg ?? "—")}{translateText("mg")}</div>
                            <div className="text-slate-400">{translateText("Ca/P: ")}{item.caPRatioMin || 1.0} -{" "}
                              {item.caPRatioMax || 1.5}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {isDeleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Archive className="w-3 h-3" />{translateText(" Đã xóa mềm")}</span>
                            ) : isFullDayConfig ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">{translateText("Chuẩn Ăn Xế (Đã đóng tiền)")}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">{translateText("Chuẩn Tiêu Chuẩn (Không ăn xế)")}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingRule(item);
                                  setIsRuleDrawerOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs flex items-center gap-1.5 transition"
                                title={translateText("Chỉnh sửa quy chuẩn")}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{translateText("Chỉnh sửa")}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PHÂN BỔ NĂNG LƯỢNG & DINH DƯỠNG THEO BỮA */}
      {activeTab === "MEAL_DISTRIBUTION" && <MealDistributionPanel />}

      {/* TAB 2: ALLERGENS (UC43) */}
      {activeTab === "ALLERGENS" && (
        <div className="space-y-6">
          <NutritionistAllergyManagementPage
            embedded={true}
            onCatalogChange={refreshAll}
          />
        </div>
      )}

      {/* TAB 3: RULE ENGINE SCANNER */}
      {activeTab === "SCANNER" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-900">{translateText("Quét thực đơn và dị ứng")}</h2>
            <div>
              <button
                  onClick={handleTriggerScan}
                  disabled={isScanning}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {translateText(isScanning
                      ? "Đang Phân Tích Thực Đơn..."
                      : "Bắt Đầu Quét Thực Đơn Tuần Hiện Tại")}
                  </span>
              </button>
            </div>
          </div>

          {scanResult && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex items-center gap-5">
                  <div
                    className={`w-20 h-20 rounded-3xl flex flex-col items-center justify-center font-black text-2xl ${
                      scanResult.overallStatus === "PASS"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : scanResult.overallStatus === "WARNING"
                          ? "bg-amber-50 text-amber-600 border border-amber-200"
                          : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    <span>{scanResult.complianceScore}</span>
                    <span className="text-[10px] font-bold text-slate-400">{translateText("/ 100 ĐIỂM")}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{translateText("Trạng Thái Thẩm Định:")}</span>
                    <span
                      className={`text-lg font-black mt-0.5 inline-block ${
                        scanResult.overallStatus === "PASS"
                          ? "text-emerald-600"
                          : scanResult.overallStatus === "WARNING"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {translateText(scanResult.overallStatus === "PASS"
                        ? "✓ ĐẠT CHUẨN THÔNG TƯ 28"
                        : scanResult.overallStatus === "WARNING"
                          ? "⚠ CẦN ĐIỀU CHỈNH"
                          : "✕ PHÁT HIỆN VI PHẠM")}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      {translateText(scanResult.menuTitle)}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{translateText("Quy chuẩn áp dụng:")}</span>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {scanResult.appliedRuleName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{translateText("Chuẩn Calo: ")}{scanResult.standardReference.minEnergyKcal} -{" "}
                      {scanResult.standardReference.maxEnergyKcal}{translateText(" Kcal/trẻ")}</p>
                  </div>
                  <div className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100">{translateText("Thực tế: ")}{scanResult.summaryNutrition.totalEnergyKcal}{" "}{translateText("Kcal/suất")}</div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{translateText("Tổng số phát hiện:")}</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-black text-slate-900">
                        {scanResult.violations.length}
                      </span>
                      <span className="text-xs text-slate-400">{translateText("mục lưu ý")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      {
                        scanResult.violations.filter(
                          (v) => v.severity === "CRITICAL",
                        ).length
                      }{" "}{translateText("Nghiêm trọng")}</span>
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      {
                        scanResult.violations.filter(
                          (v) => v.severity === "WARNING",
                        ).length
                      }{" "}{translateText("Cảnh báo")}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-teal-600" />
                  <span>{translateText("Cơ Cấu Tỷ Lệ Năng Lượng Thực Tế vs Tiêu Chuẩn Dinh Dưỡng")}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      label: translateText("Đạm (Protein - P)"),
                      pct: scanResult.summaryNutrition.proteinRatioPercent,
                      g: scanResult.summaryNutrition.totalProteinG,
                      min: scanResult.standardReference.minProteinPercent,
                      max: scanResult.standardReference.maxProteinPercent,
                      box: "bg-blue-50/70 border-blue-200/80 text-blue-900",
                      barBg: "bg-blue-200",
                      bar: "bg-blue-600",
                      mult: 2.5,
                    },
                    {
                      label: translateText("Béo (Lipid - L)"),
                      pct: scanResult.summaryNutrition.lipidRatioPercent,
                      g: scanResult.summaryNutrition.totalLipidG,
                      min: scanResult.standardReference.minFatPercent,
                      max: scanResult.standardReference.maxFatPercent,
                      box: "bg-amber-50/70 border-amber-200/80 text-amber-900",
                      barBg: "bg-amber-200",
                      bar: "bg-amber-500",
                      mult: 2.5,
                    },
                    {
                      label: translateText("Bột Đường (Glucid - G)"),
                      pct: scanResult.summaryNutrition.glucidRatioPercent,
                      g: scanResult.summaryNutrition.totalGlucidG,
                      min: scanResult.standardReference.minCarbPercent,
                      max: scanResult.standardReference.maxCarbPercent,
                      box: "bg-emerald-50/70 border-emerald-200/80 text-emerald-900",
                      barBg: "bg-emerald-200",
                      bar: "bg-emerald-600",
                      mult: 1.5,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={`p-4 border rounded-2xl space-y-2 ${m.box}`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">{translateText(m.label)}</span>
                        <span className="font-black">{m.pct}%</span>
                      </div>
                      <div
                        className={`w-full rounded-full h-2.5 overflow-hidden ${m.barBg}`}
                      >
                        <div
                          className={`h-2.5 rounded-full ${m.bar}`}
                          style={{ width: `${Math.min(m.pct * m.mult, 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] opacity-85">{translateText("Chuẩn: ")}{m.min}% - {m.max}{translateText("% (Thực tế: ")}{m.g}{translateText("g)")}</p>
                    </div>
                  ))}
                </div>
              </div>

              {scanResult.violations.length > 0 && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />{translateText(" Chi Tiết Xung Đột Dị Ứng & Cảnh Báo Dinh Dưỡng")}</span>
                    <span className="text-xs text-slate-400 font-normal">
                      {scanResult.violations.length}{translateText(" mục cần can thiệp")}</span>
                  </h3>
                  <div className="space-y-3">
                    {scanResult.violations.map((v, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border flex items-start gap-4 ${v.severity === "CRITICAL" ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/60"}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${v.severity === "CRITICAL" ? "bg-red-500" : "bg-amber-500"}`}
                        >
                          {v.category === "ALLERGEN" ? (
                            <HeartPulse className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {translateText(v.title)}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.severity === "CRITICAL" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}
                            >
                              {translateText(v.severity === "CRITICAL"
                                ? "NGUY HIỂM"
                                : "CẢNH BÁO")}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1">{translateText(v.message)}</p>
                          <div className="mt-2 text-slate-800 font-semibold bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-teal-700">{translateText("Khuyến nghị giải quyết:")}{" "}
                            </span>
                            {translateText(v.recommendation)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-emerald-50/80 border border-emerald-200 rounded-3xl p-6 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{translateText("Kế Hoạch Khắc Phục Đề Xuất Cho Bếp & Ban Giám Hiệu")}</span>
                </h3>
                <ul className="space-y-2 text-xs text-emerald-900 font-medium">
                  {scanResult.actionableRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>{translateText(rec)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawers */}
      <NutritionRuleDrawer
        isOpen={isRuleDrawerOpen}
        rule={editingRule}
        isLoading={isLoading}
        onClose={() => setIsRuleDrawerOpen(false)}
        onSubmit={handleRuleSubmit}
      />

      <AllergenDrawer
        isOpen={isAllergenDrawerOpen}
        allergen={editingAllergen}
        isLoading={isLoading}
        onClose={() => setIsAllergenDrawerOpen(false)}
        onSubmit={handleAllergenSubmit}
      />

      {/* Modal Đồng Bộ Chuẩn Quốc Gia (VN-RDA 2024 & Quy chuẩn Dinh dưỡng) */}
    </div>
  );
};
