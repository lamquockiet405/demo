import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NutritionRulesService } from '../../../src/modules/nutrition-engine/services/nutrition-rules.service';
import { AllergenRulesService } from '../../../src/modules/nutrition-engine/services/allergen-rules.service';
import { NutritionalStandard } from '../../../src/modules/nutrition-engine/entities/nutrition-rule.entity';
import { AllergenCatalog } from '../../../src/modules/nutrition-engine/entities/allergen-catalog.entity';

describe('UC42 & UC43: NutritionRulesService & AllergenRulesService', () => {
  let rulesService: NutritionRulesService;
  let allergenService: AllergenRulesService;
  let mockRuleRepo: any;
  let mockAllergenRepo: any;

  beforeEach(async () => {
    mockRuleRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          ageGroup: 'MAU_GIAO',
          mealScope: 'DAYBOARDING',
          minEnergyKcal: 615,
          maxEnergyKcal: 726,
          minProteinPct: 13,
          maxProteinPct: 20,
          minFatPct: 25,
          maxFatPct: 35,
          minCarbPct: 52,
          maxCarbPct: 60,
          status: 'ACTIVE',
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        ageGroup: 'MAU_GIAO',
        mealScope: 'DAYBOARDING',
        minEnergyKcal: 615,
        maxEnergyKcal: 726,
        minProteinPct: 13,
        maxProteinPct: 20,
        minFatPct: 25,
        maxFatPct: 35,
        minCarbPct: 52,
        maxCarbPct: 60,
        status: 'ACTIVE',
      }),
      count: jest.fn().mockResolvedValue(4),
      query: jest.fn().mockResolvedValue([{ cnt: 8 }]),
      create: jest.fn().mockImplementation((dto) => ({ id: 2, ...dto })),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    mockAllergenRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, code: 'SEAFOOD', name: 'Hải sản giáp xác', description: 'Tôm, cua, mực' },
        { id: 2, code: 'CUSTOM_ALG', name: 'Kiến ba khoang', description: '[INACTIVE] Dị ứng phụ' },
      ]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 3, ...dto })),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionRulesService,
        AllergenRulesService,
        { provide: getRepositoryToken(NutritionalStandard), useValue: mockRuleRepo },
        { provide: getRepositoryToken(AllergenCatalog), useValue: mockAllergenRepo },
      ],
    }).compile();

    rulesService = module.get<NutritionRulesService>(NutritionRulesService);
    allergenService = module.get<AllergenRulesService>(AllergenRulesService);
  });

  // --- UC42: Configure Nutritional Standards ---
  it('UC42: should return all nutritional rules complying with Circular 28/51', async () => {
    const rules = await rulesService.findAll({ search: 'Mẫu giáo' });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ minEnergyKcal: 615, maxEnergyKcal: 726, minProteinPercent: 13, maxProteinPercent: 20 });
  });

  it('UC42: should fetch stats in parallel via Promise.all', async () => {
    const stats = await rulesService.getStats();
    expect(stats.activeRulesCount).toBe(4);
    expect(stats.allergicChildrenCount).toBe(8);
    expect(stats.configuredAllergensCount).toBe(8);
  });

  it('UC42: should create a nutritional standard and reject invalid min > max ranges', async () => {
    await expect(
      rulesService.create({ minCaloriesKcal: 800, maxCaloriesKcal: 600 }),
    ).rejects.toThrow(BadRequestException);

    const created = await rulesService.create({
      targetAgeGroup: 'NHA_TRE',
      mealScope: 'DAYBOARDING',
      minCaloriesKcal: 600,
      maxCaloriesKcal: 651,
      minCarbPercent: 47,
      maxCarbPercent: 50,
    });
    expect(created.minCaloriesKcal).toBe(600);
    expect(created.maxCaloriesKcal).toBe(651);
  });

  it('UC42: should update, soft-delete, restore, and batch sync VN-RDA 2024 standards', async () => {
    const updated = await rulesService.update(1, { minCaloriesKcal: 620, maxCaloriesKcal: 730 });
    expect(updated.minCaloriesKcal).toBe(620);

    const removed = await rulesService.remove(1);
    expect(removed.success).toBe(true);

    const restored = await rulesService.restore(1);
    expect(restored.success).toBe(true);

    const synced = await rulesService.syncRdaStandards();
    expect(synced.syncedCount).toBe(4);
    expect(mockRuleRepo.save).toHaveBeenCalled();
  });

  // --- UC43: Configure Allergy Rules ---
  it('UC43: should list active allergens and support search + includeDeleted filter', async () => {
    const activeOnly = await allergenService.findAll();
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].code).toBe('SEAFOOD');
    expect(activeOnly[0].isSystemStandard).toBe(true);

    const withDeleted = await allergenService.findAll({ includeDeleted: true, search: 'custom' });
    expect(withDeleted).toHaveLength(1);
    expect(withDeleted[0].code).toBe('CUSTOM_ALG');
  });

  it('UC43: should create new allergen rule and reject duplicate code', async () => {
    mockAllergenRepo.findOne.mockResolvedValueOnce({ id: 1, code: 'SEAFOOD' });
    await expect(allergenService.create({ code: 'seafood', nameVi: 'Hải sản' })).rejects.toThrow(ConflictException);

    mockAllergenRepo.findOne.mockResolvedValueOnce(null);
    const created = await allergenService.create({ code: 'kiwi', nameVi: 'Quả Kiwi', commonFoods: 'Sinh tố Kiwi' });
    expect(created.code).toBe('KIWI');
    expect(created.nameVi).toBe('Quả Kiwi');
  });

  it('UC43: should update, toggle status, soft-delete and restore allergen rule', async () => {
    mockAllergenRepo.findOne.mockResolvedValue({ id: 2, code: 'CUSTOM_ALG', name: 'Dị ứng phụ', description: 'Mô tả' });
    const updated = await allergenService.update(2, { nameVi: 'Dị ứng cập nhật', isActive: false });
    expect(updated.isDeleted).toBe(true);

    const restored = await allergenService.restore(2);
    expect(restored.success).toBe(true);

    mockAllergenRepo.findOne.mockResolvedValueOnce(null);
    await expect(allergenService.findOne(999)).rejects.toThrow(NotFoundException);
  });
});
