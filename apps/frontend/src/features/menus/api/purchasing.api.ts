import { apiClient } from '../../../core/api/axios';

export interface ClassBreakdown {
  classId: string;
  className: string;
  ageGroup: string;
  studentCount: number;
}

export interface PurchasingIngredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  refuseRatePercent: number; // Tỉ lệ thải bỏ (%)
  netPerPortionG: number; // Định lượng tinh mỗi suất (g)
  grossPerPortionG: number; // Định lượng thô mỗi suất (g)
  totalNetKg: number; // Tổng khối lượng tinh (kg)
  totalGrossKg: number; // Tổng khối lượng thô cần mua (kg)
  refuseLossKg: number; // Hao hụt thải bỏ sơ chế (kg)
  dishesUsed: string[]; // Danh sách các món ăn sử dụng
}

export interface PurchasingSummary {
  totalIngredients: number;
  totalGrossKg: number;
  totalNetKg: number;
  totalRefuseLossKg: number;
  categoriesCount: number;
}

export interface DailyPurchasingSuggestionResponse {
  date: string;
  dayOfWeek: number;
  dayOfWeekLabel: string;
  menuId: number;
  menuTitle: string;
  menuStatus: string;
  mealFilter: string;
  totalStudents: number;
  portionsCount: number;
  isCustomPortions: boolean;
  classesBreakdown: ClassBreakdown[];
  dishesInDay: string[];
  summary: PurchasingSummary;
  ingredients: PurchasingIngredient[];
  categories: string[];
}

export interface AvailableMenuDay {
  menuDayId: number;
  menuId: number;
  menuTitle: string;
  date: string | null;
  dayOfWeek: number;
  dayOfWeekLabel: string;
  mealsCount: number;
  dishesCount: number;
}

export interface PurchasingQueryParams {
  date?: string;
  mealType?: string;
  customPortions?: number;
  menuId?: number;
}

export const purchasingApi = {
  getDailySuggestion: async (params?: PurchasingQueryParams): Promise<DailyPurchasingSuggestionResponse> => {
    const res = await apiClient.get<DailyPurchasingSuggestionResponse>('/menus/purchasing/daily-suggestion', {
      params,
    });
    return res.data;
  },

  getAvailableMenuDays: async (): Promise<AvailableMenuDay[]> => {
    const res = await apiClient.get<AvailableMenuDay[]>('/menus/purchasing/available-days');
    return res.data;
  },
};

