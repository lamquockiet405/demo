import { MenusService } from '../../../src/modules/menus/services/menus.service';
import { getPortionNutrition, hasPlanningNutrition, hasVerifiedNutrition } from '../../../src/modules/dishes/nutrition.util';

const dish = (id: number, code: string, family = String(id), verified = true) => ({
  id, name: `${code} ${id}`, category: { code }, status: 'ACTIVE',
  nutritionVerified: verified, standardServingSizeG: 140,
  sourceMetadata: { drinkFamily: family, ...(verified ? {} : { recipeStatus: 'APPROVED_REFERENCE', menuPlanningEnabled: true }) },
  nutrition: { energyKcal: 90, proteinG: 2, fatG: 1, carbG: 18,
    sourceMetadata: { status: verified ? 'COMPUTED_FROM_RECIPE' : 'APPROVED_REFERENCE' } },
});
function serviceFor(drinks: any[]) {
  const qb: any = {};
  for (const key of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy']) qb[key] = jest.fn().mockReturnValue(qb);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  const dishes = [dish(1, 'RICE'), { ...dish(2, 'RICE'), name: 'Cơm chiên' }, dish(3, 'MAIN'),
    dish(4, 'SNACK_AFTERNOON'), dish(5, 'SNACK_AFTERNOON'), dish(6, 'SNACK_MORNING'), ...drinks];
  return new MenusService({} as any, {} as any, {} as any, {} as any,
    { createQueryBuilder: () => qb } as any, { findOne: async () => null } as any,
    { find: async () => dishes } as any,
    { findOne: async () => ({ minEnergyKcal: 1, maxEnergyKcal: 2000,
      minProteinPct: 0, maxProteinPct: 100, minFatPct: 0, maxFatPct: 100, minCarbPct: 0, maxCarbPct: 100 }) } as any,
    {} as any);
}
const previewFor = async (drinks: any[], daysCount = 5) => {
  const result = await serviceFor(drinks).autoGenerate({ weekStartDate: '2026-11-09', previewOnly: true, daysCount });
  if (!('dailySummary' in result)) throw new Error('Expected preview');
  return result;
};

describe('Reference drink planning and rotation', () => {
  it('uses five different drink families across a week, despite aliases and calorie differences', async () => {
    const drinks = [dish(10, 'DRINK', 'ORANGE'), dish(11, 'DRINK', 'ORANGE'),
      dish(12, 'DRINK', 'SOY'), dish(13, 'DRINK', 'YOGURT'), dish(14, 'DRINK', 'MELON'), dish(15, 'DRINK', 'BEAN')];
    drinks[0].nutrition.energyKcal = 1000;
    const result = await previewFor(drinks);
    const chosen: string[] = [];
    for (const day of result.dailySummary) {
      const afternoon = day.dishes.filter(d => d.mealTime === 'AFTERNOON_SNACK');
      expect(afternoon.filter(d => d.dishType === 'DRINK')).toHaveLength(1);
      expect(afternoon.filter(d => d.dishType === 'SNACK_AFTERNOON')).toHaveLength(1);
      expect(day.dishes.filter(d => d.mealTime === 'BREAKFAST').some(d => d.dishType === 'DRINK')).toBe(false);
      const id = Number(afternoon.find(d => d.dishType === 'DRINK')!.dishId);
      chosen.push(drinks.find(d => d.id === id)!.sourceMetadata.drinkFamily);
    }
    expect(new Set(chosen).size).toBe(5);
  });

  it('balances a short drink catalog and reports insufficient variety', async () => {
    const drinks = [dish(10, 'DRINK', 'ORANGE'), dish(11, 'DRINK', 'SOY')];
    const result = await previewFor(drinks, 6);
    const ids = result.dailySummary.map(day => day.dishes.find(d => d.dishType === 'DRINK')!.dishId);
    expect(ids.filter(id => id === '10')).toHaveLength(3);
    expect(ids.filter(id => id === '11')).toHaveLength(3);
    expect(result.antiFatigueReport.violations.some(v => v.startsWith('LIMITED_DRINK_VARIETY:'))).toBe(true);
  });

  it('includes explicitly enabled references in drafts without marking them verified or compliant', async () => {
    const reference = dish(10, 'DRINK', 'ORANGE', false);
    expect(hasVerifiedNutrition(reference as any)).toBe(false);
    expect(hasPlanningNutrition(reference as any)).toBe(true);
    expect(getPortionNutrition(reference as any, 70).energyKcal).toBe(45);
    const result = await previewFor([reference]);
    expect(result.dailySummary.every(day => day.dishes.some(d => d.dishId === '10'))).toBe(true);
    expect(result.dailySummary.every(day => !day.isCompliant)).toBe(true);
    expect(result.antiFatigueReport.violations.some(v => v.startsWith('REFERENCE_NUTRITION:'))).toBe(true);
    reference.sourceMetadata.menuPlanningEnabled = false;
    expect(hasPlanningNutrition(reference as any)).toBe(false);
  });
});
