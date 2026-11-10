import { BadRequestException } from '@nestjs/common';
import { MenuScannerService } from '../../../src/modules/nutrition-engine/services/menu-scanner.service';
import { NutritionCalculatorService } from '../../../src/modules/nutrition-engine/services/nutrition-calculator.service';
import { getPortionNutrition } from '../../../src/modules/dishes/nutrition.util';

describe('MenuScannerService source nutrition', () => {
  const dish = {
    id: 7, name: 'Món có công thức', standardServingSizeG: 200, nutritionVerified: true,
    nutrition: { energyKcal: 300, proteinG: 10, fatG: 0, carbG: 65, calciumMg: 0, ironMg: 0, zincMg: 0, fiberG: 0 },
  } as any;
  let service: MenuScannerService;
  let dishRepo: any;
  let versionRepo: any;

  beforeEach(() => {
    dishRepo = { find: jest.fn().mockResolvedValue([dish]) };
    versionRepo = { findOne: jest.fn() };
    service = new MenuScannerService({ findOne: jest.fn().mockResolvedValue(null) } as any,
      dishRepo, new NutritionCalculatorService(), versionRepo);
  });

  it('keeps real zero nutrients and scales each occurrence by its portion', async () => {
    const result = await service.evaluateMenu({ dishes: [{ dishId: 7, portionSizeG: 100 }, { dishId: 7, portionSizeG: 50 }] });
    expect(result.summaryNutrition.totalEnergyKcal).toBe(225);
    expect(result.summaryNutrition.totalProteinG).toBe(7.5);
    expect(result.summaryNutrition.totalLipidG).toBe(0);
    expect(result.summaryNutrition.calciumMg).toBe(0);
    expect(result.summaryNutrition.caPRatio).toBeNull();
  });

  it('does not substitute random dishes or fabricated values for an empty selection', async () => {
    const result = await service.evaluateMenu({ dishes: [] });
    expect(dishRepo.find).not.toHaveBeenCalled();
    expect(result.summaryNutrition.totalEnergyKcal).toBe(0);
    expect(result.overallStatus).toBe('VIOLATION');
    expect(result.menuId).toBeNull();
  });

  it('rejects source dishes without verified quantities', async () => {
    dishRepo.find.mockResolvedValue([{ ...dish, nutritionVerified: false }]);
    await expect(service.evaluateMenu({ dishes: [{ dishId: 7 }] })).rejects.toThrow(BadRequestException);
  });

  it('evaluates actual latest menu occurrences and compares the daily average', async () => {
    versionRepo.findOne.mockResolvedValue({
      menu: { title: 'Tuần đã chọn', ageGroup: 'NHA_TRE' },
      days: [
        { date: '2025-09-08', meals: [{ dishes: [{ dish, portionSizeG: 100 }, { dish, portionSizeG: 100 }] }] },
        { date: '2025-09-09', meals: [{ dishes: [{ dish, portionSizeG: 200 }] }] },
      ],
    });
    const result = await service.evaluateMenu({ menuId: 2 });
    expect(result.menuTitle).toBe('Tuần đã chọn');
    expect(result.targetAgeGroup).toBe('NHA_TRE');
    expect(result.summaryNutrition.totalEnergyKcal).toBe(300);
    expect(dishRepo.find).not.toHaveBeenCalled();
    const day = await service.evaluateMenu({ menuId: 2, targetDate: '2025-09-08' });
    expect(day.summaryNutrition.totalEnergyKcal).toBe(300);
  });

  it('uses the full standard serving for null portions and hides unverified caches', () => {
    expect(getPortionNutrition(dish, null).energyKcal).toBe(300);
    expect(getPortionNutrition(dish, 0).energyKcal).toBe(0);
    expect(getPortionNutrition({ ...dish, nutritionVerified: false }).energyKcal).toBe(0);
  });
});
