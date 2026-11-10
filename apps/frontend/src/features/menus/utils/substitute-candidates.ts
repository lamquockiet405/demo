import type { DishItem, MenuDishItem } from '../api/weekly-menus.api';

export type DishCategoryType = 'SOUP' | 'MAIN' | 'STAPLE' | 'DRINK' | 'SNACK_MEAL';

export const detectDishCategory = (name: string, dishType?: string): { code: DishCategoryType; label: string } => {
  const n = (name || '').toLowerCase();
  const dt = (dishType || '').toUpperCase();

  if (dt === 'SOUP' || n.startsWith('canh')) {
    return { code: 'SOUP', label: 'Món Canh' };
  }
  if (n.startsWith('cháo') || n.includes('súp') || n.includes('bún') || n.includes('phở') || n.includes('miến') || n.includes('hủ tiếu') || n.includes('bánh canh') || n.includes('nui') || n.includes('bánh bao')) {
    return { code: 'SNACK_MEAL', label: 'Món Xế / Cháo / Súp' };
  }
  if (n.startsWith('cơm') || n.includes('xôi') || n.includes('bánh mì')) {
    return { code: 'STAPLE', label: 'Cơm / Tinh bột' };
  }
  if (dt === 'DRINK' || n.includes('sữa') || n.includes('yaourt') || n.includes('sữa chua') || n.includes('nước') || n.includes('chè') || n.includes('sâm') || n.includes('nha đam') || n.includes('chuối') || n.includes('dưa') || n.includes('hồng')) {
    return { code: 'DRINK', label: 'Món Uống / Tráng Miệng' };
  }
  return { code: 'MAIN', label: 'Món Mặn Chính' };
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
}

// Candidates come from the current database, after the server's allergy checks.
export function buildSubstituteCandidates(dishes: DishItem[], original: MenuDishItem, group: string): SubstituteCandidate[] {
  const category = detectDishCategory(original.dish?.name || '', original.dish?.dishType);
  const portion = Number(original.portionSizeG) || 100;
  const currentCalories = Number(original.plannedCalories) || 0;
  const seen = new Set<string>();
  return dishes.filter(dish => {
    const id = Number(dish.id);
    if (!Number.isSafeInteger(id) || id <= 0 || String(dish.id) === String(original.dishId) || seen.has(String(id))) return false;
    if (!dish.isActive || !dish.nutritionAvailable || detectDishCategory(dish.name, dish.dishType).code !== category.code) return false;
    seen.add(String(id));
    return true;
  }).map(dish => {
    const ratio = portion / (Number(dish.standardServingSizeG) || 100);
    const scaled = (value: number) => Math.round(Number(value || 0) * ratio * 10) / 10;
    return {
      id: dish.id, name: dish.name, categoryLabel: category.label,
      calories: scaled(dish.totalCalories), proteinG: scaled(dish.totalProteinG),
      fatG: scaled(dish.totalFatG), carbG: scaled(dish.totalCarbG),
      suitabilityReason: `Cùng nhóm món · Dinh dưỡng từ công thức đã lưu, khẩu phần ${portion}g`,
    };
  }).sort((a, b) => (group === 'OBESE' ? a.calories - b.calories : group === 'STUNTED' ? b.calories - a.calories
    : Math.abs(a.calories - currentCalories) - Math.abs(b.calories - currentCalories)) || a.name.localeCompare(b.name, 'vi'));
}
