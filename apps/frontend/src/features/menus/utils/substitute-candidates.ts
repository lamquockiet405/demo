import type { DishItem, MenuDishItem } from '../api/weekly-menus.api';

export type DishCategoryType = 'SOUP' | 'MAIN' | 'STAPLE' | 'DRINK' | 'DESSERT' | 'SNACK_MEAL';

const CATEGORY_MAP: Record<string, { code: DishCategoryType; label: string }> = {
  MAIN: { code: 'MAIN', label: 'Món Mặn Chính' },
  SIDE: { code: 'MAIN', label: 'Món Mặn Chính' },
  SOUP: { code: 'SOUP', label: 'Món Canh' },
  RICE: { code: 'STAPLE', label: 'Cơm / Tinh bột' },
  STAPLE: { code: 'STAPLE', label: 'Cơm / Tinh bột' },
  SNACK_AFTERNOON: { code: 'SNACK_MEAL', label: 'Món Xế / Cháo / Súp' },
  SNACK_MEAL: { code: 'SNACK_MEAL', label: 'Món Xế / Cháo / Súp' },
  DESSERT: { code: 'DESSERT', label: 'Món Tráng Miệng' },
  DRINK: { code: 'DRINK', label: 'Món Uống / Sữa' },
  SNACK_MORNING: { code: 'DRINK', label: 'Món Uống / Sữa' },
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

// Candidates come from the current database, after the server's allergy checks.
export function buildSubstituteCandidates(
  dishes: DishItem[],
  original: MenuDishItem,
  group: string,
  weekDishes: MenuDishItem[] = [],
): SubstituteCandidate[] {
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
    if (!dish.isActive || !dish.nutritionAvailable || detectDishCategory(dish.name, dish.dishType).code !== category.code) return false;
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
