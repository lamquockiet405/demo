import { normalizeSearch } from '../../../core/utils/search';
import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from 'react';
import {
  Scale,
  Clock,
  Activity,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit2,
  Trash2,
  Check,
  X,
  Utensils,
  Apple,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import {
  nutritionEngineApi,
  DishFrequencyRule,
  DishSpacingRule,
  NutritionIntakeStandard,
} from '../api/nutrition-rule-engine.api';
import { FrequencyRuleDrawer } from '../components/FrequencyRuleDrawer';
import { SpacingRuleDrawer } from '../components/SpacingRuleDrawer';
import { IntakeStandardDrawer } from '../components/IntakeStandardDrawer';

type ActiveTab = 'MEAL_STRUCTURE' | 'FOOD_GROUPS' | 'SPACING' | 'INTAKE_STANDARDS';

export const FoodGroupRulesPage: React.FC = () => {
  useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>('MEAL_STRUCTURE');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>('ALL');

  // Dữ liệu thực từ Database
  const [frequencyRules, setFrequencyRules] = useState<DishFrequencyRule[]>([]);
  const [spacingRules, setSpacingRules] = useState<DishSpacingRule[]>([]);
  const [intakeStandards, setIntakeStandards] = useState<NutritionIntakeStandard[]>([]);
  const [catalogs, setCatalogs] = useState<{
    foodGroups: any;
    dishes: any;
  }>({ foodGroups: null, dishes: null });

  // State cho các Drawers
  const [isFreqDrawerOpen, setIsFreqDrawerOpen] = useState(false);
  const [selectedFreqRule, setSelectedFreqRule] = useState<DishFrequencyRule | null>(null);

  const [isSpacingDrawerOpen, setIsSpacingDrawerOpen] = useState(false);
  const [selectedSpacingRule, setSelectedSpacingRule] = useState<DishSpacingRule | null>(null);

  const [isIntakeDrawerOpen, setIsIntakeDrawerOpen] = useState(false);
  const [selectedIntakeStandard, setSelectedIntakeStandard] = useState<NutritionIntakeStandard | null>(null);

  // Tải dữ liệu ban đầu
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [freqData, spacingData, intakeData, foodCat, dishCat] = await Promise.all([
        nutritionEngineApi.getFrequencyRules(),
        nutritionEngineApi.getSpacingRules(),
        nutritionEngineApi.getIntakeStandards(),
        nutritionEngineApi.getFoodGroupsCatalog().catch(() => null),
        nutritionEngineApi.getDishesCatalog().catch(() => null),
      ]);

      setFrequencyRules(freqData || []);
      setSpacingRules(spacingData || []);
      setIntakeStandards(intakeData || []);
      setCatalogs({ foodGroups: foodCat, dishes: dishCat });
    } catch (err: any) {
      console.error('Lỗi khi tải quy tắc dinh dưỡng:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers cho Frequency Rules
  const handleSaveFreqRule = async (payload: Partial<DishFrequencyRule>, id?: number) => {
    setIsSubmitting(true);
    try {
      if (id) {
        await nutritionEngineApi.updateFrequencyRule(id, payload);
      } else {
        await nutritionEngineApi.createFrequencyRule(payload);
      }
      setIsFreqDrawerOpen(false);
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFreqRule = async (id: number) => {
    try {
      await nutritionEngineApi.toggleFrequencyRule(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFreqRule = async (id: number) => {
    if (!window.confirm(translateText('Bạn có chắc chắn muốn xóa quy tắc tần suất này?'))) return;
    try {
      await nutritionEngineApi.deleteFrequencyRule(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handlers cho Spacing Rules
  const handleSaveSpacingRule = async (payload: Partial<DishSpacingRule>, id?: number) => {
    setIsSubmitting(true);
    try {
      if (id) {
        await nutritionEngineApi.updateSpacingRule(id, payload);
      } else {
        await nutritionEngineApi.createSpacingRule(payload);
      }
      setIsSpacingDrawerOpen(false);
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSpacingRule = async (id: number) => {
    try {
      await nutritionEngineApi.toggleSpacingRule(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSpacingRule = async (id: number) => {
    if (!window.confirm(translateText('Bạn có chắc chắn muốn xóa quy tắc giãn cách này?'))) return;
    try {
      await nutritionEngineApi.deleteSpacingRule(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handlers cho Intake Standards
  const handleSaveIntakeStandard = async (payload: Partial<NutritionIntakeStandard>, id?: number) => {
    setIsSubmitting(true);
    try {
      if (id) {
        await nutritionEngineApi.updateIntakeStandard(id, payload);
      } else {
        await nutritionEngineApi.createIntakeStandard(payload);
      }
      setIsIntakeDrawerOpen(false);
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleIntakeStandard = async (id: number) => {
    try {
      await nutritionEngineApi.toggleIntakeStandard(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteIntakeStandard = async (id: number) => {
    if (!window.confirm(translateText('Bạn có chắc chắn muốn xóa định mức dinh dưỡng này?'))) return;
    try {
      await nutritionEngineApi.deleteIntakeStandard(id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Lọc dữ liệu theo tab
  const mealStructureRules = frequencyRules.filter(
    (r) =>
      r.targetType === 'DISH_CATEGORY' &&
      (ageGroupFilter === 'ALL' || r.ageGroup === ageGroupFilter || r.ageGroup === 'ALL') &&
      (!searchQuery || normalizeSearch(r.ruleName).includes(normalizeSearch(searchQuery)) || normalizeSearch(r.targetName).includes(normalizeSearch(searchQuery)))
  );

  const foodGroupRules = frequencyRules.filter(
    (r) =>
      r.targetType === 'FOOD_GROUP' &&
      (ageGroupFilter === 'ALL' || r.ageGroup === ageGroupFilter || r.ageGroup === 'ALL') &&
      (!searchQuery || normalizeSearch(r.ruleName).includes(normalizeSearch(searchQuery)) || normalizeSearch(r.targetName).includes(normalizeSearch(searchQuery)))
  );

  const filteredSpacingRules = spacingRules.filter(
    (r) =>
      (ageGroupFilter === 'ALL' || r.ageGroup === ageGroupFilter || r.ageGroup === 'ALL') &&
      (!searchQuery || normalizeSearch(r.ruleName).includes(normalizeSearch(searchQuery)) || (r.targetName && normalizeSearch(r.targetName).includes(normalizeSearch(searchQuery))))
  );

  const filteredIntakeStandards = intakeStandards.filter(
    (s) =>
      (ageGroupFilter === 'ALL' || s.ageGroup === ageGroupFilter) &&
      (!searchQuery || normalizeSearch(s.standardName).includes(normalizeSearch(searchQuery)))
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{translateText("Cấu hình Quy tắc Nhóm Thực phẩm, Tần suất & Khoảng cách Món")}</h1>
              <p className="text-xs text-slate-500">{translateText("Thiết lập cơ cấu khay ăn (09:00, 11:00, 14:30), 10 nhóm thực phẩm Phụ lục 7 và định mức vi chất Phụ lục 1-6")}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{translateText("Làm mới")}</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'SPACING') {
                setSelectedSpacingRule(null);
                setIsSpacingDrawerOpen(true);
              } else if (activeTab === 'INTAKE_STANDARDS') {
                setSelectedIntakeStandard(null);
                setIsIntakeDrawerOpen(true);
              } else {
                setSelectedFreqRule(null);
                setIsFreqDrawerOpen(true);
              }
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{translateText("Thêm quy tắc mới")}</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI CARDS TỔNG QUAN ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div
          onClick={() => setActiveTab('MEAL_STRUCTURE')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'MEAL_STRUCTURE'
              ? 'bg-emerald-50/80 border-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{translateText("Cơ cấu loại món (3 Bữa)")}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{frequencyRules.filter((r) => r.targetType === 'DISH_CATEGORY').length}</div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">{translateText("Món mặn, Cơm, Canh, Xế...")}</p>
        </div>

        {/* KPI 2 */}
        <div
          onClick={() => setActiveTab('FOOD_GROUPS')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'FOOD_GROUPS'
              ? 'bg-amber-50/80 border-amber-300 shadow-sm ring-2 ring-amber-500/20'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{translateText("10 Nhóm Thực phẩm (PL7)")}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Apple className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{frequencyRules.filter((r) => r.targetType === 'FOOD_GROUP').length}</div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">{translateText("Thịt, Cá, Trứng, Sữa, Rau...")}</p>
        </div>

        {/* KPI 3 */}
        <div
          onClick={() => setActiveTab('SPACING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'SPACING'
              ? 'bg-blue-50/80 border-blue-300 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{translateText("Giãn cách món (Chống ngán)")}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{spacingRules.length}</div>
          <p className="text-[11px] text-blue-700 font-medium mt-1">{translateText("Giãn cách ngày lặp lại")}</p>
        </div>

        {/* KPI 4 */}
        <div
          onClick={() => setActiveTab('INTAKE_STANDARDS')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'INTAKE_STANDARDS'
              ? 'bg-purple-50/80 border-purple-300 shadow-sm ring-2 ring-purple-500/20'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{translateText("Định mức dinh dưỡng (PL 1-6)")}</span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{intakeStandards.length}</div>
          <p className="text-[11px] text-purple-700 font-medium mt-1">{translateText("Kcal, P:L:G, Sắt, Kẽm, Canxi...")}</p>
        </div>
      </div>

      {/* ── 4 TABS NAVIGATION & TOOLBAR ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('MEAL_STRUCTURE')}
              className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                activeTab === 'MEAL_STRUCTURE'
                  ? 'text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>{translateText("Cơ cấu Loại Món (09:00, 11:00, 14:30)")}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                {frequencyRules.filter((r) => r.targetType === 'DISH_CATEGORY').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('FOOD_GROUPS')}
              className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                activeTab === 'FOOD_GROUPS'
                  ? 'text-amber-700 border-b-2 border-amber-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Apple className="w-4 h-4" />
              <span>{translateText("Tần Suất 10 Nhóm Thực Phẩm (PL7)")}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                {frequencyRules.filter((r) => r.targetType === 'FOOD_GROUP').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('SPACING')}
              className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                activeTab === 'SPACING'
                  ? 'text-blue-700 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{translateText("Giãn Cách Lặp Món (Chống ngán)")}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800">
                {spacingRules.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('INTAKE_STANDARDS')}
              className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                activeTab === 'INTAKE_STANDARDS'
                  ? 'text-purple-700 border-b-2 border-purple-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>{translateText("Định Mức Dinh Dưỡng & Vi Chất (PL 1-6)")}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800">
                {intakeStandards.length}
              </span>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2 pb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={translateText("Tìm quy tắc...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-40"
              />
            </div>

            <select
              value={ageGroupFilter}
              onChange={(e) => setAgeGroupFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">{translateText("Mẫu giáo (3-6T) - Tất cả")}</option>
              <option value="MAU_GIAO">{translateText("Mẫu giáo (3-6T)")}</option>
            </select>
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="p-6">
          {/* TAB 1: CƠ CẤU BỮA ĂN (MÓN MẶN, CƠM, CANH, PHỤ, TRÁNG MIỆNG, XẾ) */}
          {activeTab === 'MEAL_STRUCTURE' && (
            <div className="space-y-4">
              {/* Bảng chỉ dẫn chuẩn 3 khung giờ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">09:00</span>
                  <span className="text-slate-700"><strong>{translateText("Buổi sáng")}</strong>{translateText(": Món sáng / Sữa tươi / Thức uống (~100-150 Kcal)")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">11:00</span>
                  <span className="text-slate-700"><strong>{translateText("Bữa trưa chính")}</strong>{translateText(": Cơm + Món mặn + Canh + Món phụ + Tráng miệng")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">14:30</span>
                  <span className="text-slate-700"><strong>{translateText("Phụ chiều / Xế")}</strong>{translateText(": Món xế phục hồi (Chè, súp, bún, cháo...)")}</span>
                </div>
              </div>

              {/* Bảng danh sách quy tắc loại món */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="py-3 px-4">{translateText("Tên quy tắc")}</th>
                      <th className="py-3 px-4">{translateText("Loại món / Thành phần")}</th>
                      <th className="py-3 px-4">{translateText("Khung giờ")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Tối thiểu")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Tối đa")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Bắt buộc")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Trạng thái")}</th>
                      <th className="py-3 px-4 text-right">{translateText("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mealStructureRules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">{translateText("Chưa có quy tắc loại món nào trong database. Nhấn ")}<strong>{translateText("\"+ Thêm quy tắc mới\"")}</strong>{translateText(" để thiết lập Món mặn, Cơm, Canh...")}</td>
                      </tr>
                    ) : (
                      mealStructureRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{rule.ruleName}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {rule.targetName}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-700">
                              {translateText(rule.mealSlot === 'LUNCH'
                                ? '11:00 (Bữa trưa)'
                                : rule.mealSlot === 'MORNING_SNACK'
                                ? '09:00 (Buổi sáng)'
                                : rule.mealSlot === 'AFTERNOON_SNACK'
                                ? '14:30 (Xế chiều)'
                                : 'Tất cả bữa')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">{rule.minOccurrences}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-700">{rule.maxOccurrences}</td>
                          <td className="py-3 px-4 text-center">
                            {rule.isRequiredInMeal ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />{translateText(" Bắt buộc")}</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">{translateText("Tùy chọn")}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleFreqRule(rule.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                                rule.isActive
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {translateText(rule.isActive ? 'Đang áp dụng' : 'Ngưng áp dụng')}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedFreqRule(rule);
                                  setIsFreqDrawerOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFreqRule(rule.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          )}

          {/* TAB 2: TẦN SUẤT 10 NHÓM THỰC PHẨM (PHỤ LỤC 7) */}
          {activeTab === 'FOOD_GROUPS' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl text-xs text-amber-900">
                <strong>{translateText("Phụ lục 7 (Chuẩn Bộ GDĐT/BYT)")}</strong>{translateText(": Phân nhóm 10 nguồn nguyên liệu chính thức (Ngũ cốc, Khoai củ, Đậu hạt, Rau củ, Quả chín, Dầu mỡ, Thịt, Thủy sản, Trứng, Sữa).")}</div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="py-3 px-4">{translateText("Tên quy tắc")}</th>
                      <th className="py-3 px-4">{translateText("Nhóm thực phẩm (PL7)")}</th>
                      <th className="py-3 px-4">{translateText("Phạm vi chu kỳ")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Tối thiểu")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Tối đa")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Mức độ")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Trạng thái")}</th>
                      <th className="py-3 px-4 text-right">{translateText("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {foodGroupRules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">{translateText("Chưa có quy tắc nhóm thực phẩm nào. Nhấn ")}<strong>{translateText("\"+ Thêm quy tắc mới\"")}</strong>{translateText(" để cấu hình tần suất Thịt, Cá, Trứng, Sữa...")}</td>
                      </tr>
                    ) : (
                      foodGroupRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{rule.ruleName}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-amber-900">{rule.targetName}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-600">
                              {translateText(rule.periodType === 'PER_WEEK'
                                ? 'Theo tuần (T2 - T6)'
                                : rule.periodType === 'PER_DAY'
                                ? 'Hàng ngày'
                                : 'Chu kỳ 4 tuần')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">{rule.minOccurrences}</td>
                          <td className="py-3 px-4 text-center font-bold text-amber-700">{rule.maxOccurrences}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              {translateText(rule.severity)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleFreqRule(rule.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                                rule.isActive
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {translateText(rule.isActive ? 'Đang áp dụng' : 'Ngưng áp dụng')}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedFreqRule(rule);
                                  setIsFreqDrawerOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFreqRule(rule.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          )}

          {/* TAB 3: GIÃN CÁCH LẶP MÓN (SPACING RULES - CHỐNG NGÁN) */}
          {activeTab === 'SPACING' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl text-xs text-blue-900">
                <strong>{translateText("Quy tắc Giãn cách món ăn (Chống ngán)")}</strong>{translateText(": Thuật toán tự động tạo thực đơn sẽ đọc trực tiếp số ngày giãn cách này để không xếp trùng món ăn trong khoảng thời gian quy định.")}</div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="py-3 px-4">{translateText("Tên quy tắc")}</th>
                      <th className="py-3 px-4">{translateText("Đối tượng áp dụng")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Giãn cách tối thiểu")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Cấm lặp cùng tuần")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Cấm lặp cùng ngày")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Ưu tiên")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Trạng thái")}</th>
                      <th className="py-3 px-4 text-right">{translateText("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSpacingRules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">{translateText("Chưa có quy tắc giãn cách nào trong database. Nhấn ")}<strong>{translateText("\"+ Thêm quy tắc mới\"")}</strong>{translateText(" để thiết lập giãn cách món mặn 14 ngày, canh 7 ngày...")}</td>
                      </tr>
                    ) : (
                      filteredSpacingRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{rule.ruleName}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-blue-900">{rule.targetName || translateText('Tất cả món')}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200">
                              {rule.minSpacingDays}{translateText(" ngày")}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {rule.noRepeatInSameWeek ? (
                              <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {rule.noRepeatInSameDay ? (
                              <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-600">{rule.priorityOrder}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleSpacingRule(rule.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                                rule.isActive
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {translateText(rule.isActive ? 'Đang áp dụng' : 'Ngưng áp dụng')}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedSpacingRule(rule);
                                  setIsSpacingDrawerOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSpacingRule(rule.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          )}

          {/* TAB 4: ĐỊNH MỨC NĂNG LƯỢNG & VI CHẤT (PHỤ LỤC 1 - 6) */}
          {activeTab === 'INTAKE_STANDARDS' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50/50 border border-purple-200/70 rounded-xl text-xs text-purple-900">
                <strong>{translateText("Phụ lục 1 → 6 (Chuẩn Dinh dưỡng Mầm non)")}</strong>{translateText(": Định mức năng lượng Kcal, Tỷ lệ P:L:G (13-20% : 25-35% : 52-60%), Chất xơ, Sắt (10%/15%), Kẽm (3 mức), Canxi, Vitamin A RAE.")}</div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="py-3 px-4">{translateText("Tên định mức")}</th>
                      <th className="py-3 px-4">{translateText("Lứa tuổi / Giới tính")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Năng lượng (Kcal)")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Tỷ lệ P : L : G")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Xơ (g)")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Canxi (mg)")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Sắt (mg)")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Kẽm (mg)")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Vit A (µg)")}</th>
                      <th className="py-3 px-4 text-center">{translateText("Trạng thái")}</th>
                      <th className="py-3 px-4 text-right">{translateText("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIntakeStandards.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">{translateText("Chưa có định mức dinh dưỡng nào trong database. Nhấn ")}<strong>{translateText("\"+ Thêm quy tắc mới\"")}</strong>{translateText(" để thiết lập định mức chuẩn Mẫu giáo, Nhà trẻ...")}</td>
                      </tr>
                    ) : (
                      filteredIntakeStandards.map((std) => (
                        <tr key={std.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{std.standardName}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-purple-900">{translateText(std.ageGroup)}</span>
                            <span className="text-[10px] text-slate-500 block">({translateText(std.gender === 'ALL' ? 'Nam & Nữ' : std.gender)})</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-700">
                            {std.energyKcalMin} - {std.energyKcalMax}
                          </td>
                          <td className="py-3 px-4 text-center text-[11px] font-medium text-slate-700">
                            {std.proteinRatioMin}-{std.proteinRatioMax} : {std.lipidRatioMin}-{std.lipidRatioMax} : {std.carbohydrateRatioMin}-{std.carbohydrateRatioMax}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-emerald-700">{translateText(std.fiberGMin ?? '—')}</td>
                          <td className="py-3 px-4 text-center font-semibold text-blue-700">{translateText(std.calciumMgMin ?? '—')}</td>
                          <td className="py-3 px-4 text-center font-semibold text-rose-700">
                            {translateText(std.ironMgMin ?? '—')} {std.ironAbsorptionRate && <span className="text-[9px] text-slate-400">({translateText(std.ironAbsorptionRate)})</span>}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-indigo-700">{translateText(std.zincMgMin ?? '—')}</td>
                          <td className="py-3 px-4 text-center font-semibold text-teal-700">{translateText(std.vitaminARaeMcgMin ?? '—')}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleIntakeStandard(std.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                                std.isActive
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {translateText(std.isActive ? 'Đang áp dụng' : 'Ngưng áp dụng')}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedIntakeStandard(std);
                                  setIsIntakeDrawerOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-purple-600 rounded-lg hover:bg-slate-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteIntakeStandard(std.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          )}
        </div>
      </div>

      {/* ── DRAWERS ── */}
      <FrequencyRuleDrawer
        isOpen={isFreqDrawerOpen}
        rule={selectedFreqRule}
        catalog={catalogs.foodGroups}
        isLoading={isSubmitting}
        onClose={() => setIsFreqDrawerOpen(false)}
        onSubmit={handleSaveFreqRule}
      />

      <SpacingRuleDrawer
        isOpen={isSpacingDrawerOpen}
        rule={selectedSpacingRule}
        catalog={catalogs.dishes}
        isLoading={isSubmitting}
        onClose={() => setIsSpacingDrawerOpen(false)}
        onSubmit={handleSaveSpacingRule}
      />

      <IntakeStandardDrawer
        isOpen={isIntakeDrawerOpen}
        standard={selectedIntakeStandard}
        isLoading={isSubmitting}
        onClose={() => setIsIntakeDrawerOpen(false)}
        onSubmit={handleSaveIntakeStandard}
      />
    </div>
  );
};
