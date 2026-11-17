import type { MenuDishItem } from '../api/weekly-menus.api';

// Only persisted selections can establish a group's daily meal plan.
export function calculateSelectedDietNutrition(masterDishes: MenuDishItem[], selections: MenuDishItem[]) {
  const empty = {
    calo: 0, p: 0, l: 0, g: 0, pPct: 0, lPct: 0, gPct: 0,
    isOptimal: false, statusType: 'empty' as const,
    statusText: 'Chưa chọn món', badgeText: '', noteText: '',
  };
  const selected = selections.filter(item => !item.deletedAt);
  if (!selected.length) return empty;

  const masters = masterDishes.filter(item => !item.deletedAt);
  const replaced = new Set<string>();
  for (const item of selected) {
    const originalId = (item as MenuDishItem & { oldDishId?: string | number }).oldDishId;
    const originalName = item.specialDietNotes?.match(/Thay cho:\s*(.*?)\s*->/i)?.[1]?.trim().toLowerCase();
    const original = masters.find(master =>
      master.mealTime === item.mealTime && !replaced.has(String(master.id)) &&
      (originalId != null
        ? String(master.dishId) === String(originalId)
        : originalName
          ? master.dish?.name.trim().toLowerCase() === originalName
          : !!master.dish?.name && (item.specialDietNotes || '').toLowerCase().includes(master.dish.name.trim().toLowerCase())),
    );
    if (!original) return { ...empty, statusText: 'Chưa xác định món gốc', noteText: 'Cần kiểm tra liên kết món thay thế' };
    replaced.add(String(original.id));
  }

  const actualDishes = [...masters.filter(item => !replaced.has(String(item.id))), ...selected];
  const fields = ['totalCalories', 'totalProteinG', 'totalFatG', 'totalCarbG'] as const;
  const hasValidDishes = actualDishes.some(item => item.dish && (item.nutritionAvailable !== false || Number(item.plannedCalories) > 0 || Number(item.dish.totalCalories) > 0));
  if (!hasValidDishes) {
    return { ...empty, statusText: 'Chưa đủ định lượng', noteText: 'Cần xác nhận công thức món đã chọn' };
  }

  let calo = 0, p = 0, l = 0, g = 0;
  for (const item of actualDishes) {
    const dish = item.dish!;
    const portion = Number(item.portionSizeG ?? 100);
    const standard = Number(dish.standardServingSizeG ?? 100);
    if (!Number.isFinite(portion) || portion <= 0 || !Number.isFinite(standard) || standard <= 0) {
      return { ...empty, statusText: 'Chưa đủ định lượng', noteText: 'Cần xác nhận khẩu phần món đã chọn' };
    }
    const ratio = portion / standard;
    calo += item.plannedCalories != null && Number.isFinite(Number(item.plannedCalories))
      ? Number(item.plannedCalories) : Number(dish.totalCalories) * ratio;
    p += Number(dish.totalProteinG) * ratio;
    l += Number(dish.totalFatG) * ratio;
    g += Number(dish.totalCarbG) * ratio;
  }
  const macroCalories = p * 4 + l * 9 + g * 4;
  const pPct = macroCalories > 0 ? Math.round(p * 4 / macroCalories * 100) : 0;
  const lPct = macroCalories > 0 ? Math.round(l * 9 / macroCalories * 100) : 0;
  return {
    calo: Math.round(calo), p: Math.round(p * 10) / 10, l: Math.round(l * 10) / 10, g: Math.round(g * 10) / 10,
    pPct, lPct, gPct: macroCalories > 0 ? Math.max(0, 100 - pPct - lPct) : 0,
    isOptimal: false, statusType: 'warning' as const,
    statusText: `Đã chọn ${selected.length} món riêng`, badgeText: 'Tính từ món đã lưu',
    noteText: 'Món chung còn lại và món thay thế đã chọn; chưa kết luận phù hợp dinh dưỡng hoặc dị ứng',
  };
}
