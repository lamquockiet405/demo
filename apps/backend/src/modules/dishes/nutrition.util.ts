import { Dish } from './entities/dish.entity';

export function hasVerifiedNutrition(dish?: Dish): boolean {
  return Boolean(dish?.nutrition && dish.nutritionVerified !== false);
}

export function hasReferenceNutrition(dish?: Dish): boolean {
  return Boolean(dish?.nutrition && dish.nutritionVerified === false && dish.recipes?.length);
}

// Explicitly enabled reference recipes may be used in drafts, but are still
// unverified for nutrition scanning and approval.
export function hasPlanningNutrition(dish?: Dish): boolean {
  return hasVerifiedNutrition(dish) || Boolean(
    dish?.nutrition && dish.sourceMetadata?.recipeStatus === 'APPROVED_REFERENCE' &&
    dish.sourceMetadata?.menuPlanningEnabled === true &&
    dish.nutrition.sourceMetadata?.status === 'APPROVED_REFERENCE',
  );
}

// dish_nutrition is cached per standard serving, not per 100 g of cooked dish.
export function getPortionNutrition(dish?: Dish, portionSizeG?: number | null) {
  const standardSize = Number(dish?.standardServingSizeG) || 100;
  const factor = portionSizeG == null ? 1 : Number(portionSizeG) / standardSize;
  const nutrition = hasPlanningNutrition(dish) ? dish.nutrition : null;
  return {
    energyKcal: Number(nutrition?.energyKcal ?? 0) * factor,
    proteinG: Number(nutrition?.proteinG ?? 0) * factor,
    fatG: Number(nutrition?.fatG ?? 0) * factor,
    carbG: Number(nutrition?.carbG ?? 0) * factor,
    fiberG: Number(nutrition?.fiberG ?? 0) * factor,
    calciumMg: Number(nutrition?.calciumMg ?? 0) * factor,
    ironMg: Number(nutrition?.ironMg ?? 0) * factor,
    zincMg: Number(nutrition?.zincMg ?? 0) * factor,
  };
}
