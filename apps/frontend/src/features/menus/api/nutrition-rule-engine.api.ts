import { apiClient } from '../../../core/api/axios';

export interface NutritionRule {
  id: string;
  tenantId: string | null;
  name: string;
  targetAgeGroup: string;
  mealScope: string;
  minCaloriesKcal: number;
  maxCaloriesKcal: number;
  minProteinPercent: number;
  maxProteinPercent: number;
  minFatPercent: number;
  maxFatPercent: number;
  minCarbPercent: number;
  maxCarbPercent: number;
  minCalciumMg: number;
  minIronMg: number;
  minZincMg: number;
  maxSodiumMg: number | null;
  caPRatioMin: number;
  caPRatioMax: number;
  isStrict: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isSystemRule?: boolean;
  isDeleted?: boolean;
}

export interface AllergenCatalog {
  id: string;
  tenantId: string | null;
  code: string;
  nameVi: string;
  nameEn: string | null;
  commonFoods: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isSystemStandard?: boolean;
  isDeleted?: boolean;
}

export interface NutritionEngineStats {
  activeRulesCount: number;
  complianceRatePercent: number;
  nutritionWarningsCount: number;
  allergicChildrenCount: number;
  configuredAllergensCount: number;
}

export interface ScanViolationDetail {
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: 'MACRO_NUTRIENT' | 'MICRO_NUTRIENT' | 'ALLERGEN' | 'REPETITION';
  title: string;
  message: string;
  recommendation: string;
  childInfo?: { id: string; name: string; className?: string; allergen: string };
  dishInfo?: { id: string; name: string; mealTime?: string };
}

export interface MenuScanResult {
  menuId: string;
  menuTitle: string;
  targetAgeGroup: string;
  appliedRuleName: string;
  complianceScore: number;
  overallStatus: 'PASS' | 'WARNING' | 'VIOLATION';
  summaryNutrition: {
    totalEnergyKcal: number;
    totalProteinG: number;
    totalLipidG: number;
    totalGlucidG: number;
    proteinCalories: number;
    lipidCalories: number;
    glucidCalories: number;
    proteinRatioPercent: number;
    lipidRatioPercent: number;
    glucidRatioPercent: number;
    calciumMg: number;
    ironMg: number;
    zincMg: number;
    caPRatio: number;
  };
  standardReference: {
    minEnergyKcal: number;
    maxEnergyKcal: number;
    minProteinPercent: number;
    maxProteinPercent: number;
    minFatPercent: number;
    maxFatPercent: number;
    minCarbPercent: number;
    maxCarbPercent: number;
  };
  violations: ScanViolationDetail[];
  actionableRecommendations: string[];
}

export interface CreateNutritionRulePayload {
  name: string;
  targetAgeGroup: string;
  mealScope?: string;
  minCaloriesKcal: number;
  maxCaloriesKcal: number;
  minProteinPercent: number;
  maxProteinPercent: number;
  minFatPercent: number;
  maxFatPercent: number;
  minCarbPercent: number;
  maxCarbPercent: number;
  minCalciumMg?: number;
  minIronMg?: number;
  minZincMg?: number;
  maxSodiumMg?: number;
  caPRatioMin?: number;
  caPRatioMax?: number;
  isStrict?: boolean;
  isActive?: boolean;
}

export interface UpdateNutritionRulePayload extends Partial<CreateNutritionRulePayload> {}

export interface CreateAllergenPayload {
  code: string;
  nameVi: string;
  nameEn?: string;
  commonFoods?: string;
  description?: string;
}

export interface UpdateAllergenPayload extends Partial<CreateAllergenPayload> {
  isActive?: boolean;
}

export interface EvaluateMenuPayload {
  menuId?: string;
  targetAgeGroup?: string;
  ruleId?: string;
  targetDate?: string;
}

export const nutritionEngineApi = {
  // --- QUY CHUẨN DINH DƯỠNG ---
  async getNutritionRules(params?: {
    targetAgeGroup?: string;
    search?: string;
    includeDeleted?: boolean;
  }): Promise<NutritionRule[]> {
    const res = await apiClient.get<NutritionRule[]>('/nutrition-rules', { params });
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    if (Array.isArray((raw as any)?.data)) return (raw as any).data;
    return [];
  },

  async getNutritionStats(): Promise<NutritionEngineStats> {
    const res = await apiClient.get<NutritionEngineStats>('/nutrition-rules/stats');
    return res.data;
  },

  async syncRdaStandards(): Promise<{
    success: boolean;
    message: string;
    syncedCount: number;
    source: string;
    version: string;
    syncedAt: string;
  }> {
    const res = await apiClient.post('/nutrition-rules/sync-rda');
    return res.data?.data || res.data;
  },

  async getRuleById(id: string): Promise<NutritionRule> {
    const res = await apiClient.get<NutritionRule>(`/nutrition-rules/${id}`);
    return res.data;
  },

  async createNutritionRule(payload: CreateNutritionRulePayload): Promise<NutritionRule> {
    const res = await apiClient.post<NutritionRule>('/nutrition-rules', payload);
    return res.data;
  },

  async updateNutritionRule(id: string, payload: UpdateNutritionRulePayload): Promise<NutritionRule> {
    const res = await apiClient.put<NutritionRule>(`/nutrition-rules/${id}`, payload);
    return res.data;
  },

  async softDeleteNutritionRule(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/nutrition-rules/${id}`);
    return res.data;
  },

  async restoreNutritionRule(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.patch<{ success: boolean; message: string }>(
      `/nutrition-rules/${id}/restore`,
    );
    return res.data;
  },

  // --- QUY TẮC & DANH MỤC DỊ ỨNG ---
  async getAllergens(params?: { search?: string; includeDeleted?: boolean }): Promise<AllergenCatalog[]> {
    const res = await apiClient.get<AllergenCatalog[]>('/allergens', { params });
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    if (Array.isArray((raw as any)?.data)) return (raw as any).data;
    return [];
  },

  async createAllergen(payload: CreateAllergenPayload): Promise<AllergenCatalog> {
    const res = await apiClient.post<AllergenCatalog>('/allergens', payload);
    return res.data;
  },

  async updateAllergen(id: string, payload: UpdateAllergenPayload): Promise<AllergenCatalog> {
    const res = await apiClient.put<AllergenCatalog>(`/allergens/${id}`, payload);
    return res.data;
  },

  async softDeleteAllergen(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/allergens/${id}`);
    return res.data;
  },

  async restoreAllergen(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.patch<{ success: boolean; message: string }>(
      `/allergens/${id}/restore`,
    );
    return res.data;
  },

  // --- BẢNG 1: QUY TẮC TẦN SUẤT & CƠ CẤU MÓN (Món mặn, Cơm, Canh... & 10 nhóm PL7) ---
  async getFrequencyRules(params?: { targetType?: string; ageGroup?: string; mealSlot?: string; isActive?: boolean }): Promise<DishFrequencyRule[]> {
    const res = await apiClient.get<DishFrequencyRule[]>('/nutrition-rules/frequency-rules', { params });
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.data)) return (raw as any).data;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  },

  async getFrequencyRuleSummary(): Promise<{ total: number; active: number; dishCategoryRules: number; foodGroupRules: number }> {
    const res = await apiClient.get('/nutrition-rules/frequency-rules/summary');
    return (res.data as any)?.data || res.data;
  },

  async getFoodGroupsCatalog(): Promise<{
    dishCategories: Array<{ id: number; code: string; name: string; isRequiredInMeal: boolean; displayOrder: number }>;
    foodCategories: Array<{ id: number; name: string }>;
    standardFoodGroups: Array<{ code: string; name: string }>;
  }> {
    const res = await apiClient.get('/nutrition-rules/frequency-rules/food-groups-catalog');
    return (res.data as any)?.data || res.data;
  },

  async createFrequencyRule(payload: Partial<DishFrequencyRule>): Promise<DishFrequencyRule> {
    const res = await apiClient.post<DishFrequencyRule>('/nutrition-rules/frequency-rules', payload);
    return (res.data as any)?.data || res.data;
  },

  async updateFrequencyRule(id: number | string, payload: Partial<DishFrequencyRule>): Promise<DishFrequencyRule> {
    const res = await apiClient.put<DishFrequencyRule>('/nutrition-rules/frequency-rules/' + id, payload);
    return (res.data as any)?.data || res.data;
  },

  async toggleFrequencyRule(id: number | string): Promise<DishFrequencyRule> {
    const res = await apiClient.patch<DishFrequencyRule>('/nutrition-rules/frequency-rules/' + id + '/toggle');
    return (res.data as any)?.data || res.data;
  },

  async deleteFrequencyRule(id: number | string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>('/nutrition-rules/frequency-rules/' + id);
    return res.data;
  },

  // --- BẢNG 2: QUY TẮC GIÃN CÁCH LẶP MÓN (CHỐNG NGÁN) ---
  async getSpacingRules(params?: { targetType?: string; ageGroup?: string; mealSlot?: string; isActive?: boolean }): Promise<DishSpacingRule[]> {
    const res = await apiClient.get<DishSpacingRule[]>('/nutrition-rules/spacing-rules', { params });
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.data)) return (raw as any).data;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  },

  async getSpacingRuleSummary(): Promise<{ total: number; active: number; categoryRules: number; specificDishRules: number }> {
    const res = await apiClient.get('/nutrition-rules/spacing-rules/summary');
    return (res.data as any)?.data || res.data;
  },

  async getDishesCatalog(): Promise<{
    categories: Array<{ id: number; code: string; name: string }>;
    dishes: Array<{ id: number; name: string; categoryCode: string; categoryName: string }>;
  }> {
    const res = await apiClient.get('/nutrition-rules/spacing-rules/dishes-catalog');
    return (res.data as any)?.data || res.data;
  },

  async createSpacingRule(payload: Partial<DishSpacingRule>): Promise<DishSpacingRule> {
    const res = await apiClient.post<DishSpacingRule>('/nutrition-rules/spacing-rules', payload);
    return (res.data as any)?.data || res.data;
  },

  async updateSpacingRule(id: number | string, payload: Partial<DishSpacingRule>): Promise<DishSpacingRule> {
    const res = await apiClient.put<DishSpacingRule>('/nutrition-rules/spacing-rules/' + id, payload);
    return (res.data as any)?.data || res.data;
  },

  async toggleSpacingRule(id: number | string): Promise<DishSpacingRule> {
    const res = await apiClient.patch<DishSpacingRule>('/nutrition-rules/spacing-rules/' + id + '/toggle');
    return (res.data as any)?.data || res.data;
  },

  async deleteSpacingRule(id: number | string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>('/nutrition-rules/spacing-rules/' + id);
    return res.data;
  },

  // --- BẢNG 3: ĐỊNH MỨC NĂNG LƯỢNG & VI CHẤT (PHỤ LỤC 1 - 6) ---
  async getIntakeStandards(params?: { ageGroup?: string; gender?: string; mealScope?: string; isActive?: boolean }): Promise<NutritionIntakeStandard[]> {
    const res = await apiClient.get<NutritionIntakeStandard[]>('/nutrition-rules/intake-standards', { params });
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.data)) return (raw as any).data;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  },

  async getIntakeStandardSummary(): Promise<{ total: number; active: number; mauGiaoCount: number; nhaTreCount: number }> {
    const res = await apiClient.get('/nutrition-rules/intake-standards/summary');
    return (res.data as any)?.data || res.data;
  },

  async createIntakeStandard(payload: Partial<NutritionIntakeStandard>): Promise<NutritionIntakeStandard> {
    const res = await apiClient.post<NutritionIntakeStandard>('/nutrition-rules/intake-standards', payload);
    return (res.data as any)?.data || res.data;
  },

  async updateIntakeStandard(id: number | string, payload: Partial<NutritionIntakeStandard>): Promise<NutritionIntakeStandard> {
    const res = await apiClient.put<NutritionIntakeStandard>('/nutrition-rules/intake-standards/' + id, payload);
    return (res.data as any)?.data || res.data;
  },

  async toggleIntakeStandard(id: number | string): Promise<NutritionIntakeStandard> {
    const res = await apiClient.patch<NutritionIntakeStandard>('/nutrition-rules/intake-standards/' + id + '/toggle');
    return (res.data as any)?.data || res.data;
  },

  async deleteIntakeStandard(id: number | string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>('/nutrition-rules/intake-standards/' + id);
    return res.data;
  },

  // --- QUÉT & ĐÁNH GIÁ THỰC ĐƠN BẰNG RULE ENGINE ---
  async evaluateMenu(payload: EvaluateMenuPayload): Promise<MenuScanResult> {
    const res = await apiClient.post<MenuScanResult>('/rule-engine/evaluate-menu', payload);
    return res.data;
  },
};

// ── TypeScript Interfaces cho 3 Bảng Quy Tắc ──────────────────────────────────
export interface DishFrequencyRule {
  id: number;
  schoolId: number;
  ruleName: string;
  mealSlot: string; // 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'ALL'
  targetType: string; // 'DISH_CATEGORY' hoặc 'FOOD_GROUP'
  targetId?: number | null;
  targetCode: string;
  targetName: string;
  ageGroup: string;
  periodType: string; // 'PER_DAY', 'PER_WEEK', 'PER_CYCLE_4_WEEKS'
  minOccurrences: number;
  maxOccurrences: number;
  isRequiredInMeal: boolean;
  severity: string; // 'ERROR', 'WARNING', 'INFO'
  isActive: boolean;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DishSpacingRule {
  id: number;
  schoolId: number;
  ruleName: string;
  mealSlot: string;
  targetType: string; // 'DISH_CATEGORY', 'SPECIFIC_DISH'
  targetId?: number | null;
  targetName?: string | null;
  ageGroup: string;
  minSpacingDays: number;
  noRepeatInSameWeek: boolean;
  noRepeatInSameDay: boolean;
  priorityOrder: number;
  severity: string;
  isActive: boolean;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NutritionIntakeStandard {
  id: number;
  schoolId: number;
  standardName: string;
  ageGroup: string;
  gender: string;
  mealScope: string;
  energyKcalMin: number;
  energyKcalMax: number;
  proteinRatioMin: number;
  proteinRatioMax: number;
  lipidRatioMin: number;
  lipidRatioMax: number;
  carbohydrateRatioMin: number;
  carbohydrateRatioMax: number;
  fiberGMin?: number | null;
  fiberGMax?: number | null;
  calciumMgMin: number | null;
  ironAbsorptionRate: string | null;
  ironMgMin: number | null;
  zincAbsorptionLevel: string | null;
  zincMgMin: number | null;
  vitaminARaeMcgMin: number | null;
  isActive: boolean;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
