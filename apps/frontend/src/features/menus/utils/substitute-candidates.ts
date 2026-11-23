import type { DishItem, MenuDishItem } from '../api/weekly-menus.api';

export type DishCategoryType = 'SOUP' | 'MAIN' | 'STAPLE' | 'DRINK' | 'DESSERT' | 'SNACK_MEAL';

const CATEGORY_MAP: Record<string, { code: DishCategoryType; label: string }> = {
  MAIN: { code: 'MAIN', label: 'Món Mặn Chính' },
  SIDE: { code: 'MAIN', label: 'Món Mặn Chính' },
  SOUP: { code: 'SOUP', label: 'Món Canh / Súp Nước' },
  RICE: { code: 'STAPLE', label: 'Cơm / Tinh bột' },
  STAPLE: { code: 'STAPLE', label: 'Cơm / Tinh bột' },
  SNACK_AFTERNOON: { code: 'SNACK_MEAL', label: 'Món Chiều Xế / Cháo / Bánh' },
  SNACK_MEAL: { code: 'SNACK_MEAL', label: 'Món Xế / Điểm Tâm' },
  DESSERT: { code: 'DESSERT', label: 'Món Tráng Miệng' },
  DRINK: { code: 'DRINK', label: 'Món Uống / Sữa' },
  SNACK_MORNING: { code: 'SNACK_MEAL', label: 'Món Nước Sáng / Điểm Tâm' },
};

export const detectDishCategory = (_name: string, dishType?: string): { code: DishCategoryType; label: string } => {
  const dt = (dishType || '').toUpperCase().trim();
  return CATEGORY_MAP[dt] || CATEGORY_MAP.MAIN;
};

export interface SubstituteCandidate {
  id: string;
  name: string;
  categoryLabel: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  suitabilityReason: string;
  hasAllergyConflict?: boolean;
  conflictingAllergens?: string[];
  conflictingChildrenCount?: number;
}

const isLiquidDish = (name: string) => {
  const lower = (name || "").toLowerCase();
  return (
    lower.includes("cháo") ||
    lower.includes("súp") ||
    lower.includes("bún") ||
    lower.includes("phở") ||
    lower.includes("miến") ||
    lower.includes("hủ tiếu") ||
    lower.includes("bánh canh") ||
    lower.includes("nui") ||
    lower.includes("mì") ||
    lower.includes("hoành thánh")
  ) && !lower.includes("khô") && !lower.includes("xào") && !lower.includes("bánh bao") && !lower.includes("bánh bông lan");
};

const isAfternoonSnackDish = (name: string, dishType?: string) => {
  const lower = (name || "").toLowerCase();
  const dt = (dishType || "").toUpperCase();
  if (isLiquidDish(name)) return false;
  return dt === "DRINK" || dt === "DESSERT" || lower.includes("bánh") || lower.includes("chè") || lower.includes("sữa") || lower.includes("nước");
};

// Candidates come from the current database, after the server's allergy checks.
export function buildSubstituteCandidates(
  dishes: DishItem[],
  original: MenuDishItem,
  group: string,
  weekDishes: MenuDishItem[] = [],
): SubstituteCandidate[] {
  const isAfternoon = original.mealTime === "AFTERNOON_SNACK";
  const isLiquidSlot = original.mealTime === "BREAKFAST" || original.mealTime === "MORNING_SNACK" || original.mealTime === "LATE_SNACK";
  const category = detectDishCategory(original.dish?.name || '', original.dish?.dishType);
  const portion = Number(original.portionSizeG) || 100;
  const currentCalories = Number(original.plannedCalories) || 0;
  const usedInWeekIds = new Set(
    (weekDishes || [])
      .filter(md => !md.deletedAt && String(md.id) !== String(original.id))
      .map(md => String(md.dishId)),
  );
  const seen = new Set<string>();
  const validDishes = dishes.filter(dish => {
    const id = Number(dish.id);
    if (!Number.isSafeInteger(id) || id <= 0 || String(dish.id) === String(original.dishId) || seen.has(String(id))) return false;
    if (!dish.isActive || !dish.nutritionAvailable) return false;

    if (isAfternoon) {
      if (!isAfternoonSnackDish(dish.name, dish.dishType)) return false;
    } else if (isLiquidSlot) {
      if (!isLiquidDish(dish.name)) return false;
    } else {
      if (detectDishCategory(dish.name, dish.dishType).code !== category.code) return false;
    }

    seen.add(String(id));
    return true;
  });

  // 1. Ưu tiên tuyệt đối các món AN TOÀN DỊ ỨNG (không chứa bất kỳ dị nguyên nào của học sinh)
  const allergySafeDishes = validDishes.filter(dish => !(dish as any).hasAllergyConflict);
  const basePool = allergySafeDishes.length > 0 ? allergySafeDishes : validDishes;

  // 2. Loại bỏ các món đã xuất hiện trong các ngày/suất riêng khác của cùng tuần để chống lặp thực đơn
  const unusedInWeek = basePool.filter(dish => !usedInWeekIds.has(String(dish.id)));
  const pool = category.code !== 'STAPLE' && unusedInWeek.length > 0 ? unusedInWeek : basePool;

  return pool.map(dish => {
    const ratio = portion / (Number(dish.standardServingSizeG) || 100);
    const scaled = (value: number) => Math.round(Number(value || 0) * ratio * 10) / 10;
    const isUnused = !usedInWeekIds.has(String(dish.id));
    const hasConflict = Boolean((dish as any).hasAllergyConflict);
    const allergens: string[] = Array.isArray((dish as any).conflictingAllergens) ? (dish as any).conflictingAllergens : [];
    const conflictCount = Number((dish as any).conflictingChildrenCount) || 0;
    return {
      id: dish.id, name: dish.name, categoryLabel: category.label,
      calories: scaled(dish.totalCalories), proteinG: scaled(dish.totalProteinG),
      fatG: scaled(dish.totalFatG), carbG: scaled(dish.totalCarbG),
      hasAllergyConflict: hasConflict,
      conflictingAllergens: allergens,
      conflictingChildrenCount: conflictCount,
      suitabilityReason: hasConflict
        ? `Cảnh báo: Chứa dị nguyên (${allergens.join(', ')}) của ${conflictCount} bé · Khẩu phần ${portion}g`
        : `An toàn dị ứng · ${isUnused ? 'Không trùng món trong tuần · ' : ''}Khẩu phần ${portion}g`,
    };
  }).sort((a, b) => {
    if (Boolean(a.hasAllergyConflict) !== Boolean(b.hasAllergyConflict)) {
      return a.hasAllergyConflict ? 1 : -1;
    }
    return (group === 'OBESE' ? a.calories - b.calories : group === 'STUNTED' ? b.calories - a.calories
      : Math.abs(a.calories - currentCalories) - Math.abs(b.calories - currentCalories)) || a.name.localeCompare(b.name, 'vi');
  });
}
