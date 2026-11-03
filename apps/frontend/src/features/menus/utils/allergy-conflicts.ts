import type { AllergyConflictItem, MenuDishItem } from '../api/weekly-menus.api';

export function getDishAllergyConflicts(conflicts: AllergyConflictItem[] = [], dish: Pick<MenuDishItem, 'id' | 'dishId'>): AllergyConflictItem[] {
  return conflicts.filter(conflict => {
    if (conflict.menuDishId) {
      return String(conflict.menuDishId) === String(dish.id)
        && (!conflict.dishId || String(conflict.dishId) === String(dish.dishId));
    }
    return !!conflict.dishId && String(conflict.dishId) === String(dish.dishId);
  });
}

export interface AffectedAllergyChild {
  childId: string;
  childName: string;
  className: string;
  severity: AllergyConflictItem['severity'];
  allergen: string;
  allergens: string[];
  matchReasons: string[];
}

export function groupAllergyConflictsByChild(conflicts: AllergyConflictItem[] = []): AffectedAllergyChild[] {
  const children = new Map<string, AffectedAllergyChild>();
  const severityRank = { MILD: 1, MODERATE: 2, SEVERE: 3, ANAPHYLACTIC: 4 };
  for (const conflict of conflicts) {
    const key = conflict.childId || `${conflict.childName}|${conflict.className}`;
    let child = children.get(key);
    if (!child) {
      child = { childId: conflict.childId, childName: conflict.childName, className: conflict.className,
        severity: conflict.severity, allergen: '', allergens: [], matchReasons: [] };
      children.set(key, child);
    }
    if (conflict.allergenDetected && !child.allergens.includes(conflict.allergenDetected)) child.allergens.push(conflict.allergenDetected);
    for (const reason of conflict.matchReasons || []) if (!child.matchReasons.includes(reason)) child.matchReasons.push(reason);
    if (severityRank[conflict.severity] > severityRank[child.severity]) child.severity = conflict.severity;
    child.allergen = child.allergens.join(', ');
  }
  return [...children.values()];
}
