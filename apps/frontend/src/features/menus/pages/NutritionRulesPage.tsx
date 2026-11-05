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

export const NutritionRulesPage: React.FC = () => {
  const navigate = useNavigate(),
    location = useLocation();
  const [activeTab, setActiveTab] = useState<
    "STANDARDS" | "ALLERGENS" | "SCANNER"
  >("STANDARDS");

  useEffect(() => {
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
          "Đã tạo mới quy chuẩn dinh dưỡng Thông tư 28 thành công.",
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
        `Xác nhận chuyển quy chuẩn "${rule.name}" vào danh sách lưu trữ (xóa mềm)?`,
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

  const kpiCards = [
    {
      label: "Quy Chuẩn Áp Dụng",
      val: stats?.activeRulesCount ?? 0,
      unit: "chuẩn",
      sub: "Thông tư 28 & Chuẩn trường",
      icon: Scale,
      iconCls: "bg-teal-50 text-teal-600",
      valCls: "text-slate-900",
      subCls: "text-teal-700",
    },
    {
      label: "Tỷ Lệ Tuân Thủ",
      val: `${stats?.complianceRatePercent ?? "—"}%`,
      unit: "",
      sub: "Đạt cân đối Calo & P:L:G",
      icon: ShieldCheck,
      iconCls: "bg-emerald-50 text-emerald-600",
      valCls: "text-emerald-600",
      subCls: "text-emerald-700",
      dot: true,
    },
    {
      label: "Cảnh Báo Vi Phạm",
      val: stats?.nutritionWarningsCount ?? 0,
      unit: "mục",
      sub: "Cần BGH xem xét điều chỉnh",
      icon: AlertTriangle,
      iconCls: "bg-amber-50 text-amber-600",
      valCls: "text-amber-600",
      subCls: "text-amber-700",
    },
    {
      label: "Trẻ Có Hồ Sơ Dị Ứng",
      val: stats?.allergicChildrenCount ?? 0,
      unit: "bé",
      sub: "Theo dõi cách ly thực phẩm",
      icon: HeartPulse,
      iconCls: "bg-rose-50 text-rose-600",
      valCls: "text-rose-600",
      subCls: "text-rose-700",
    },
    {
      label: "Danh Mục Dị Ứng",
      val: stats?.configuredAllergensCount ?? "—",
      unit: "nhóm",
      sub: "Codex & BYT chuẩn hóa",
      icon: Salad,
      iconCls: "bg-indigo-50 text-indigo-600",
      valCls: "text-indigo-600",
      subCls: "text-indigo-700",
    },
  ];

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
          <span className="text-xs font-semibold">{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              CHUYÊN VIÊN DINH DƯỠNG & BGH
            </span>
            <span className="text-xs text-slate-400">
              • Thông tư 28/2016 & 51/2020/TT-BGDĐT
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            {location.pathname.startsWith("/nutritionist")
              ? "Quy chuẩn dinh dưỡng, dị ứng & Rule Engine"
              : "Cấu hình tiêu chuẩn dinh dưỡng"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình tỷ lệ P-L-G, quản trị danh mục dị ứng Codex và quét kiểm
            tra thực đơn tự động.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshAll}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl shadow-xs transition"
            title="Làm mới dữ liệu từ Database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {activeTab === "STANDARDS" && (
            <>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setIsRuleDrawerOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-teal-600/25 transition"
              >
                <Plus className="w-4 h-4" /> <span>Thêm Tiêu Chuẩn Mới</span>
              </button>
            </>
          )}

          {activeTab === "ALLERGENS" && (
            <button
              onClick={() => {
                setEditingAllergen(null);
                setIsAllergenDrawerOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-rose-600/25 transition"
            >
              <Plus className="w-4 h-4" /> <span>Thêm Nhóm Chuẩn Codex</span>
            </button>
          )}

          {activeTab === "SCANNER" && (
            <button
              onClick={handleTriggerScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-600/25 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isScanning
                  ? "Đang Quét Rule Engine..."
                  : "Quét Kiểm Tra Tự Động"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards
          .filter(
            (_, i) => location.pathname.startsWith("/nutritionist") || i === 0,
          )
          .map((c) => (
            <div
              key={c.label}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {c.label}
                </span>
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center ${c.iconCls}`}
                >
                  <c.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span
                  className={`text-2xl font-black tracking-tight ${c.valCls}`}
                >
                  {c.val}
                </span>
                {c.unit && (
                  <span className="text-xs text-slate-400 font-medium ml-1">
                    {c.unit}
                  </span>
                )}
              </div>
              <div
                className={`mt-2 text-[11px] font-semibold flex items-center gap-1 ${c.subCls}`}
              >
                {c.dot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <span>{c.sub}</span>
              </div>
            </div>
          ))}
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          {
            id: "STANDARDS" as const,
            label: "Tiêu Chuẩn Dinh Dưỡng (Thông tư 28)",
            count: rules.length,
            icon: Scale,
            activeCls: "bg-teal-600 text-white shadow-md shadow-teal-600/25",
            badgeCls: "bg-teal-700 text-teal-100",
          },
          {
            id: "ALLERGENS" as const,
            label: "Quy Tắc & Danh Mục Dị Ứng",
            count: allergens.length,
            icon: ShieldAlert,
            activeCls: "bg-rose-600 text-white shadow-md shadow-rose-600/25",
            badgeCls: "bg-rose-700 text-rose-100",
          },
          {
            id: "SCANNER" as const,
            label: "Bộ Quét & Kiểm Tra Thực Đơn (Rule Engine)",
            count: null,
            icon: Sparkles,
            activeCls:
              "bg-indigo-600 text-white shadow-md shadow-indigo-600/25",
            badgeCls: "",
          },
        ]
          .filter(
            (t) =>
              location.pathname.startsWith("/nutritionist") ||
              t.id === "STANDARDS",
          )
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                activeTab === t.id
                  ? t.activeCls
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === t.id ? t.badgeCls : "bg-slate-200 text-slate-700"}`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
      </div>

      {/* TAB 1: STANDARDS */}
      {activeTab === "STANDARDS" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                placeholder="Tìm quy chuẩn theo tên hoặc nhóm tuổi..."
                className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={ruleAgeFilter}
                onChange={(e) => setRuleAgeFilter(e.target.value)}
                className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="">Tất cả độ tuổi</option>
                <option value="MAU_GIAO">Mẫu giáo (3 - 6 tuổi)</option>
                <option value="NHA_TRE">Nhà trẻ (12 - 36 tháng)</option>
                <option value="TODDLER_18_36M">Nhà trẻ (18 - 36 tháng)</option>
                <option value="KINDERGARTEN_3_4Y">Mẫu giáo (3 - 4 tuổi)</option>
                <option value="ALL_AGES">Mọi lứa tuổi</option>
              </select>

              <label className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={includeDeletedRules}
                  onChange={(e) => setIncludeDeletedRules(e.target.checked)}
                  className="w-3.5 h-3.5 text-teal-600 rounded-sm"
                />
                <span>Xem quy chuẩn đã xóa mềm</span>
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Tên Quy Chuẩn</th>
                    <th className="py-3.5 px-4">Nhóm Tuổi</th>
                    <th className="py-3.5 px-4">Năng Lượng (Kcal)</th>
                    <th className="py-3.5 px-4">Cơ Cấu P : L : G (%)</th>
                    <th className="py-3.5 px-4">Vi Chất Canxi / Ca:P</th>
                    <th className="py-3.5 px-4">Phân Loại</th>
                    <th className="py-3.5 px-5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-slate-400"
                      >
                        <Scale className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700">
                          Chưa tìm thấy quy chuẩn dinh dưỡng phù hợp
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rules.map((item) => {
                      const isDeleted = item.isDeleted;
                      const isToddler = ["TODDLER_18_36M", "NHA_TRE"].includes(
                        item.targetAgeGroup || (item as any).ageGroup,
                      );
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/70 transition-colors ${isDeleted ? "bg-slate-50/50 opacity-70" : ""}`}
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs ${item.isSystemRule ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}
                              >
                                {item.isSystemRule ? "BGD" : "TRƯỜNG"}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {item.name ||
                                    `Quy chuẩn TT 28 (${item.targetAgeGroup})`}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  Phạm vi:{" "}
                                  {item.mealScope === "DAYBOARDING"
                                    ? "Bán trú tại trường (50-70% Calo)"
                                    : "Cả ngày (100% Calo)"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                              {isToddler
                                ? "Nhà trẻ (12-36 tháng)"
                                : item.targetAgeGroup === "ALL_AGES"
                                  ? "Mọi lứa tuổi"
                                  : "Mẫu giáo (3-6 tuổi)"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {item.minCaloriesKcal ??
                              (item as any).minEnergyKcal ??
                              "—"}{" "}
                            -{" "}
                            {item.maxCaloriesKcal ??
                              (item as any).maxEnergyKcal ??
                              "—"}{" "}
                            Kcal
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                P: {item.minProteinPercent ?? "—"}-
                                {item.maxProteinPercent ?? "—"}%
                              </span>
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                L: {item.minFatPercent ?? "—"}-
                                {item.maxFatPercent ?? "—"}%
                              </span>
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                G: {item.minCarbPercent ?? "—"}-
                                {item.maxCarbPercent ?? "—"}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            <div>Ca: ≥ {item.minCalciumMg ?? "—"}mg</div>
                            <div className="text-slate-400">
                              Ca/P: {item.caPRatioMin || 1.0} -{" "}
                              {item.caPRatioMax || 1.5}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {isDeleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Archive className="w-3 h-3" /> Đã xóa mềm
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                Chuẩn Áp Dụng
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isDeleted ? (
                                <button
                                  onClick={() => handleRestoreRule(item)}
                                  className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />{" "}
                                  <span>Khôi phục</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingRule(item);
                                      setIsRuleDrawerOpen(true);
                                    }}
                                    className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition"
                                    title="Chỉnh sửa quy chuẩn"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleSoftDeleteRule(item)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                    title="Chuyển vào lưu trữ"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
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
          </div>
        </div>
      )}

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
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-teal-800 text-white p-6 rounded-3xl shadow-lg">
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Hệ Thống Kiểm Duyệt Tự Động
                KidMeal Rule Engine
              </span>
              <h2 className="text-xl font-black">
                Quét & Thẩm Định Thực Đơn Theo Thông Tư 28 và Hồ Sơ Dị Ứng
              </h2>
              <p className="text-xs text-indigo-200 leading-relaxed">
                Tự động rà soát vi chất, năng lượng Calo, cơ cấu P:L:G, đối
                chiếu trực tiếp danh sách nguyên liệu thực đơn với cơ sở dữ liệu
                trẻ dị ứng toàn trường để phát hiện nguy cơ phản vệ.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleTriggerScan}
                  disabled={isScanning}
                  className="px-5 py-2.5 rounded-2xl bg-teal-400 hover:bg-teal-300 text-slate-900 font-extrabold text-xs shadow-md transition flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {isScanning
                      ? "Đang Phân Tích Thực Đơn..."
                      : "Bắt Đầu Quét Thực Đơn Tuần Hiện Tại"}
                  </span>
                </button>
              </div>
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
                    <span className="text-[10px] font-bold text-slate-400">
                      / 100 ĐIỂM
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Trạng Thái Thẩm Định:
                    </span>
                    <span
                      className={`text-lg font-black mt-0.5 inline-block ${
                        scanResult.overallStatus === "PASS"
                          ? "text-emerald-600"
                          : scanResult.overallStatus === "WARNING"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {scanResult.overallStatus === "PASS"
                        ? "✓ ĐẠT CHUẨN THÔNG TƯ 28"
                        : scanResult.overallStatus === "WARNING"
                          ? "⚠ CẦN ĐIỀU CHỈNH"
                          : "✕ PHÁT HIỆN VI PHẠM"}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      {scanResult.menuTitle}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Quy chuẩn áp dụng:
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {scanResult.appliedRuleName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Chuẩn Calo: {scanResult.standardReference.minEnergyKcal} -{" "}
                      {scanResult.standardReference.maxEnergyKcal} Kcal/trẻ
                    </p>
                  </div>
                  <div className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100">
                    Thực tế: {scanResult.summaryNutrition.totalEnergyKcal}{" "}
                    Kcal/suất
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Tổng số phát hiện:
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-black text-slate-900">
                        {scanResult.violations.length}
                      </span>
                      <span className="text-xs text-slate-400">mục lưu ý</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      {
                        scanResult.violations.filter(
                          (v) => v.severity === "CRITICAL",
                        ).length
                      }{" "}
                      Nghiêm trọng
                    </span>
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      {
                        scanResult.violations.filter(
                          (v) => v.severity === "WARNING",
                        ).length
                      }{" "}
                      Cảnh báo
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-teal-600" />
                  <span>
                    Cơ Cấu Tỷ Lệ Năng Lượng Thực Tế vs Tiêu Chuẩn Thông Tư 28
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Đạm (Protein - P)",
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
                      label: "Béo (Lipid - L)",
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
                      label: "Bột Đường (Glucid - G)",
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
                        <span className="font-bold">{m.label}</span>
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
                      <p className="text-[11px] opacity-85">
                        Chuẩn: {m.min}% - {m.max}% (Thực tế: {m.g}g)
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {scanResult.violations.length > 0 && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" /> Chi Tiết
                      Xung Đột Dị Ứng & Cảnh Báo Dinh Dưỡng
                    </span>
                    <span className="text-xs text-slate-400 font-normal">
                      {scanResult.violations.length} mục cần can thiệp
                    </span>
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
                              {v.title}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.severity === "CRITICAL" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}
                            >
                              {v.severity === "CRITICAL"
                                ? "NGUY HIỂM"
                                : "CẢNH BÁO"}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1">{v.message}</p>
                          <div className="mt-2 text-slate-800 font-semibold bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                            <span className="text-teal-700">
                              Khuyến nghị giải quyết:{" "}
                            </span>
                            {v.recommendation}
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
                  <span>
                    Kế Hoạch Khắc Phục Đề Xuất Cho Bếp & Ban Giám Hiệu
                  </span>
                </h3>
                <ul className="space-y-2 text-xs text-emerald-900 font-medium">
                  {scanResult.actionableRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>{rec}</span>
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

      {/* Modal Đồng Bộ Chuẩn Quốc Gia (VN-RDA 2024 & Thông tư 28/51) */}
    </div>
  );
};
