import { DishesService } from '../../../src/modules/dishes/dishes.service';
import { FoodsService } from '../../../src/modules/foods/services/foods.service';
import { getPortionNutrition } from '../../../src/modules/dishes/nutrition.util';

describe('Recipe weights and reference provenance', () => {
  it('returns reference recipes and calculated values without marking them verified', async () => {
    const dish = {
      id: 1, name: 'Món có công thức tham khảo', nutritionVerified: false,
      recipes: [{ id: 3, ingredientId: 4, grossWeightG: 70, netWeightG: 50,
        ingredient: { name: 'Gạo tẻ máy', unit: 'g' }, sourceMetadata: { status: 'REFERENCE_UNVERIFIED' } }],
      nutrition: { energyKcal: 173, proteinG: 3.95, sourceMetadata: { status: 'REFERENCE_UNVERIFIED' } },
    };
    const service = new DishesService({ findOne: jest.fn().mockResolvedValue(dish) } as any,
      {} as any, {} as any, {} as any, {} as any);
    const result = await service.findOne(1);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0].netWeightG).toBe(50);
    expect(result.referenceNutrition.energyKcal).toBe(173);
    expect(result.nutritionStatus).toBe('REFERENCE');
    expect(result.nutritionAvailable).toBe(false);
    expect(getPortionNutrition(dish as any).energyKcal).toBe(0);
  });

  it('calculates using edible net weight, not gross weight or cooked portion weight', async () => {
    const ingredient = { energyKcal100g: 346, proteinG: 7.9, fatG: 1, carbG: 76.3,
      fiberG: 0.4, calciumMg: 30, ironMg: 1.3, zincMg: 1.5 };
    const saved: any[] = [];
    const service = new DishesService({} as any, {} as any,
      { find: jest.fn().mockResolvedValue([{ grossWeightG: 70, netWeightG: 50, ingredient }]) } as any,
      { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((row) => row),
        save: jest.fn(async (row) => { saved.push(row); return row; }) } as any, {} as any);
    expect(await service.recalculateDishNutrition(1)).toBe(true);
    expect(saved[0].energyKcal).toBe(173);
    expect(saved[0].proteinG).toBe(3.95);
    expect(saved[0].fatG).toBe(0.5);
    expect(saved[0].sourceMetadata.status).toBe('COMPUTED_FROM_RECIPE');
  });

  it('keeps unverified ingredient numbers separate from verified composition', async () => {
    const food = { id: 1, name: 'Nguyên liệu mẫu', energyKcal100g: 100, proteinG: 5,
      sourceMetadata: { kind: 'LEGACY_UNVERIFIED', missingNutrients: ['energyKcal100g', 'proteinG'] } };
    const service = new FoodsService({ findOne: jest.fn().mockResolvedValue(food) } as any, {} as any);
    const result = await service.findOne(1);
    expect(result.energyKcal100g).toBeNull();
    expect(result.referenceValues.energyKcal100g).toBe(100);
    expect(result.nutritionComplete).toBe(false);
  });
});
