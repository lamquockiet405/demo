import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FrequencyRulesService } from '../../../src/modules/nutrition-engine/services/frequency-rules.service';
import { SpacingRulesService } from '../../../src/modules/nutrition-engine/services/spacing-rules.service';
import { IntakeStandardsService } from '../../../src/modules/nutrition-engine/services/intake-standards.service';
import { DishFrequencyRule } from '../../../src/modules/nutrition-engine/entities/dish-frequency-rule.entity';
import { DishSpacingRule } from '../../../src/modules/nutrition-engine/entities/dish-spacing-rule.entity';
import { NutritionIntakeStandard } from '../../../src/modules/nutrition-engine/entities/nutrition-intake-standard.entity';
import { DishCategory } from '../../../src/modules/dishes/entities/dish-category.entity';
import { FoodCategory } from '../../../src/modules/foods/entities/food-category.entity';
import { Dish } from '../../../src/modules/dishes/entities/dish.entity';

describe('Nutrition Rules & Spacing Engine (Unit Tests)', () => {
  let freqService: FrequencyRulesService;
  let spacingService: SpacingRulesService;
  let intakeService: IntakeStandardsService;

  const mockFreqRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, ruleName: 'Món mặn max 2/chu kỳ', targetCode: 'MAIN', targetType: 'DISH_CATEGORY', minOccurrences: 0, maxOccurrences: 2, isActive: true },
      ]),
    })),
    findOne: jest.fn().mockImplementation(({ where: { id } }) => {
      if (id === 1) {
        return Promise.resolve({ id: 1, ruleName: 'Món mặn max 2', minOccurrences: 0, maxOccurrences: 2, isActive: true });
      }
      return Promise.resolve(null);
    }),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    remove: jest.fn((entity) => Promise.resolve(entity)),
    count: jest.fn().mockResolvedValue(5),
  };

  const mockSpacingRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, ruleName: 'Giãn cách món mặn 14 ngày', targetType: 'DISH_CATEGORY', minSpacingDays: 14, isActive: true },
      ]),
    })),
    findOne: jest.fn().mockImplementation(({ where: { id } }) => {
      if (id === 1) {
        return Promise.resolve({ id: 1, ruleName: 'Giãn cách món mặn 14 ngày', minSpacingDays: 14, isActive: true });
      }
      return Promise.resolve(null);
    }),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    remove: jest.fn((entity) => Promise.resolve(entity)),
    count: jest.fn().mockResolvedValue(3),
  };

  const mockIntakeRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, standardName: 'Định mức Mẫu giáo bán trú', ageGroup: 'MAU_GIAO', energyKcalMin: 615, energyKcalMax: 726, isActive: true },
      ]),
    })),
    findOne: jest.fn().mockImplementation(({ where: { id } }) => {
      if (id === 1) {
        return Promise.resolve({ id: 1, standardName: 'Định mức Mẫu giáo', energyKcalMin: 615, energyKcalMax: 726, isActive: true });
      }
      return Promise.resolve(null);
    }),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    remove: jest.fn((entity) => Promise.resolve(entity)),
    count: jest.fn().mockResolvedValue(4),
  };

  const mockDishCatRepo = {
    find: jest.fn().mockResolvedValue([
      { id: 1, code: 'MAIN', name: 'Món chính', isRequiredInMeal: true, displayOrder: 1 },
      { id: 2, code: 'SOUP', name: 'Canh / Súp', isRequiredInMeal: true, displayOrder: 2 },
    ]),
  };

  const mockFoodCatRepo = {
    find: jest.fn().mockResolvedValue([
      { id: 1, name: 'Thịt' },
      { id: 2, name: 'Cá' },
    ]),
  };

  const mockDishRepo = {
    find: jest.fn().mockResolvedValue([
      { id: 1, name: 'Thịt lợn kho tàu', category: { code: 'MAIN', name: 'Món chính' } },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrequencyRulesService,
        SpacingRulesService,
        IntakeStandardsService,
        { provide: getRepositoryToken(DishFrequencyRule), useValue: mockFreqRepo },
        { provide: getRepositoryToken(DishSpacingRule), useValue: mockSpacingRepo },
        { provide: getRepositoryToken(NutritionIntakeStandard), useValue: mockIntakeRepo },
        { provide: getRepositoryToken(DishCategory), useValue: mockDishCatRepo },
        { provide: getRepositoryToken(FoodCategory), useValue: mockFoodCatRepo },
        { provide: getRepositoryToken(Dish), useValue: mockDishRepo },
      ],
    }).compile();

    freqService = module.get<FrequencyRulesService>(FrequencyRulesService);
    spacingService = module.get<SpacingRulesService>(SpacingRulesService);
    intakeService = module.get<IntakeStandardsService>(IntakeStandardsService);
  });

  describe('FrequencyRulesService (Bảng 1: Cơ cấu loại món & Tần suất)', () => {
    it('should query frequency rules from database', async () => {
      const rules = await freqService.findAll(1, { targetType: 'DISH_CATEGORY' });
      expect(rules).toHaveLength(1);
      expect(rules[0].targetCode).toBe('MAIN');
    });

    it('should throw BadRequestException if minOccurrences > maxOccurrences', async () => {
      await expect(
        freqService.create({
          ruleName: 'Lỗi',
          mealSlot: 'LUNCH',
          targetType: 'DISH_CATEGORY',
          targetCode: 'MAIN',
          targetName: 'Món mặn',
          minOccurrences: 5,
          maxOccurrences: 2,
        } as any, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should toggle rule active state', async () => {
      const result = await freqService.toggleActive(1, 1);
      expect(result.isActive).toBe(false);
    });

    it('should return food groups catalog with 10 standard groups (Annex 7)', async () => {
      const catalog = await freqService.getFoodGroupsCatalog();
      expect(catalog.standardFoodGroups).toHaveLength(10);
      expect(catalog.standardFoodGroups[0].code).toBe('CEREAL');
      expect(catalog.dishCategories).toHaveLength(2);
    });
  });

  describe('SpacingRulesService (Bảng 2: Giãn cách lặp món)', () => {
    it('should query spacing rules from database', async () => {
      const rules = await spacingService.findAll(1);
      expect(rules).toHaveLength(1);
      expect(rules[0].minSpacingDays).toBe(14);
    });

    it('should return dishes catalog for dropdown selection', async () => {
      const catalog = await spacingService.getDishesCatalog();
      expect(catalog.dishes).toHaveLength(1);
      expect(catalog.dishes[0].name).toBe('Thịt lợn kho tàu');
    });

    it('should toggle spacing rule active state', async () => {
      const result = await spacingService.toggleActive(1, 1);
      expect(result.isActive).toBe(false);
    });
  });

  describe('IntakeStandardsService (Bảng 3: Định mức năng lượng & vi chất PL 1-6)', () => {
    it('should query intake standards from database', async () => {
      const standards = await intakeService.findAll(1, { ageGroup: 'MAU_GIAO' });
      expect(standards).toHaveLength(1);
      expect(standards[0].energyKcalMin).toBe(615);
    });

    it('should throw BadRequestException if energyKcalMin > energyKcalMax', async () => {
      await expect(
        intakeService.create({
          standardName: 'Lỗi Calorie',
          ageGroup: 'MAU_GIAO',
          energyKcalMin: 800,
          energyKcalMax: 600,
        } as any, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

