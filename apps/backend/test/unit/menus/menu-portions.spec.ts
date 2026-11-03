import { MenusService } from '../../../src/modules/menus/services/menus.service';

describe('Menu portion serialization', () => {
  it('scales totals once and keeps nested dish nutrition per standard serving', async () => {
    const dish = {
      id: 3, name: 'Món thử', standardServingSizeG: 200, nutritionVerified: true,
      nutrition: { energyKcal: 300, proteinG: 10, fatG: 4, carbG: 50 },
    };
    const menuRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, ageGroup: 'MAU_GIAO' }) };
    const versionRepo = { findOne: jest.fn().mockResolvedValue({ id: 2, versionNumber: 1 }) };
    const dayRepo = { find: jest.fn().mockResolvedValue([{ id: 5, dayOfWeek: 2, meals: [{
      id: 6, mealType: 'LUNCH', dishes: [{ id: 8, dishId: 3, dish, portionSizeG: 100 }],
    }] }]) };
    const service = new MenusService(menuRepo as any, versionRepo as any, dayRepo as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const result = await service.findOne(1);
    expect(result.dailyAverageCalories).toBe(150);
    expect(result.dailyAverageProteinG).toBe(5);
    expect(result.menuDishes[0].plannedCalories).toBe(150);
    expect(result.menuDishes[0].dish.totalCalories).toBe(300);
    expect(result.menuDishes[0].dish.totalProteinG).toBe(10);
    expect(result.menuDishes[0].dish.standardServingSizeG).toBe(200);
    expect(result.days[0].meals[0].dishes[0].energyKcal).toBe(150);
    expect(result.nutritionAvailable).toBe(true);
  });
});
