import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MealDistributionsService } from '../../../src/modules/nutrition-engine/services/meal-distributions.service';
import { MealEnergyDistribution } from '../../../src/modules/nutrition-engine/entities/meal-energy-distribution.entity';
import { NutritionIntakeStandard } from '../../../src/modules/nutrition-engine/entities/nutrition-intake-standard.entity';

describe('MealDistributionsService (Unit Tests)', () => {
  let service: MealDistributionsService;

  const mockRows: any[] = [
    {
      id: 1,
      schoolId: 1,
      ageGroup: 'MAU_GIAO',
      mealType: 'BREAKFAST',
      mealLabel: 'Buổi sáng',
      mealTime: '09:00',
      displayOrder: 1,
      energyPctMin: 5,
      energyPctMax: 10,
      waterPctMin: 10,
      waterPctMax: 15,
      waterMlMin: 150,
      waterMlMax: 250,
      isActive: true,
      note: 'Bữa phụ sáng',
    },
    {
      id: 2,
      schoolId: 1,
      ageGroup: 'MAU_GIAO',
      mealType: 'LUNCH',
      mealLabel: 'Bữa trưa chính',
      mealTime: '11:00',
      displayOrder: 2,
      energyPctMin: 30,
      energyPctMax: 35,
      waterPctMin: 30,
      waterPctMax: 35,
      waterMlMin: 450,
      waterMlMax: 600,
      isActive: true,
      note: 'Bữa trưa',
    },
    {
      id: 3,
      schoolId: 1,
      ageGroup: 'MAU_GIAO',
      mealType: 'AFTERNOON_SNACK',
      mealLabel: 'Bữa phụ chiều',
      mealTime: '14:30',
      displayOrder: 3,
      energyPctMin: 10,
      energyPctMax: 15,
      waterPctMin: 15,
      waterPctMax: 20,
      waterMlMin: 250,
      waterMlMax: 350,
      isActive: true,
      note: 'Bữa chiều',
    },
  ];

  const mockDistributionRepo = {
    count: jest.fn().mockResolvedValue(3),
    find: jest.fn().mockResolvedValue(mockRows.map(r => ({ ...r, schoolId: null }))),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockRows),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    })),
    findOne: jest.fn().mockImplementation(({ where: { id, mealType, ageGroup } }) => {
      if (id === 1) return Promise.resolve({ ...mockRows[0] });
      if (id === 999) return Promise.resolve(null);
      if (mealType && ageGroup) return Promise.resolve(mockRows.find(r => r.mealType === mealType && r.ageGroup === ageGroup) || null);
      return Promise.resolve(null);
    }),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve(Array.isArray(entity) ? entity : { id: entity.id || 10, ...entity })),
    remove: jest.fn((entity) => Promise.resolve(entity)),
    manager: {
      transaction: jest.fn(async (cb) => {
        const mgr = {
          delete: jest.fn().mockResolvedValue({}),
          insert: jest.fn().mockResolvedValue({}),
          save: jest.fn().mockResolvedValue({}),
        };
        return cb(mgr);
      }),
    },
  };

  const mockIntakeRepo = {
    findOne: jest.fn().mockImplementation(({ where }) => {
      const scope = where?.mealScope || 'ALL_DAY';
      if (scope === 'ALL_DAY') {
        return Promise.resolve({
          id: 1,
          schoolId: 1,
          standardName: 'Chuẩn Mầm non Bán trú 01/VBHN-BGDĐT',
          ageGroup: 'MAU_GIAO',
          mealScope: 'ALL_DAY',
          energyKcalMin: 1230,
          energyKcalMax: 1320,
          waterMlMin: 1600,
          waterMlMax: 2000,
          proteinRatioMin: 13,
          proteinRatioMax: 20,
          lipidRatioMin: 25,
          lipidRatioMax: 35,
          carbohydrateRatioMin: 52,
          carbohydrateRatioMax: 60,
          isActive: true,
        });
      }
      return Promise.resolve({
        id: 2,
        schoolId: 1,
        standardName: 'Chuẩn Mẫu giáo tại trường',
        ageGroup: 'MAU_GIAO',
        mealScope: 'DAYBOARDING',
        energyKcalMin: 615,
        energyKcalMax: 726,
        waterMlMin: 800,
        waterMlMax: 1100,
        isActive: true,
      });
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealDistributionsService,
        {
          provide: getRepositoryToken(MealEnergyDistribution),
          useValue: mockDistributionRepo,
        },
        {
          provide: getRepositoryToken(NutritionIntakeStandard),
          useValue: mockIntakeRepo,
        },
      ],
    }).compile();

    service = module.get<MealDistributionsService>(MealDistributionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return distributions for valid ageGroup', async () => {
      mockDistributionRepo.count.mockResolvedValue(3);
      const res = await service.findAll(1, 'MAU_GIAO');
      expect(res).toHaveLength(3);
      expect(mockDistributionRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should reject invalid ageGroup', async () => {
      await expect(service.findAll(1, 'INVALID_AGE')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOverview', () => {
    it('should calculate energy, nutrients and water per meal for MAU_GIAO', async () => {
      mockDistributionRepo.count.mockResolvedValue(3);
      const overview = await service.getOverview(1, 'MAU_GIAO');

      expect(overview.ageGroup).toBe('MAU_GIAO');
      expect(overview.meals).toHaveLength(3);
      expect(overview.dailyStandard.water.min).toBe(1600);
      expect(overview.dailyStandard.water.max).toBe(2000);

      // Sáng: 5% - 10% năng lượng, 150 - 250 ml nước
      const breakfast = overview.meals.find(m => m.mealType === 'BREAKFAST');
      expect(breakfast).toBeDefined();
      expect(breakfast?.energyPct.min).toBe(5);
      expect(breakfast?.energyPct.max).toBe(10);
      expect(breakfast?.energyKcal.min).toBe(61.5);
      expect(breakfast?.energyKcal.max).toBe(132);
      expect(breakfast?.waterMl.min).toBe(150);
      expect(breakfast?.waterMl.max).toBe(250);

      // Trưa: 30% - 35% năng lượng, 450 - 600 ml nước
      const lunch = overview.meals.find(m => m.mealType === 'LUNCH');
      expect(lunch).toBeDefined();
      expect(lunch?.energyPct.min).toBe(30);
      expect(lunch?.energyPct.max).toBe(35);
      expect(lunch?.waterMl.min).toBe(450);
      expect(lunch?.waterMl.max).toBe(600);

      // Tổng tại trường: nước 150+450+250 = 850ml đến 250+600+350 = 1200ml
      expect(overview.totals.atSchool.waterMl.min).toBe(850);
      expect(overview.totals.atSchool.waterMl.max).toBe(1200);

      // Ở nhà còn lại
      expect(overview.totals.atHome.waterMl).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update valid distribution range', async () => {
      const updated = await service.update(1, { energyPctMin: 6, energyPctMax: 11 }, 1);
      expect(mockDistributionRepo.save).toHaveBeenCalled();
      expect(updated.energyPctMin).toBe(6);
      expect(updated.energyPctMax).toBe(11);
    });

    it('should reject when min > max', async () => {
      await expect(
        service.update(1, { energyPctMin: 20, energyPctMax: 10 }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent id', async () => {
      await expect(
        service.update(999, { energyPctMin: 5, energyPctMax: 10 }, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetDefaults', () => {
    it('should reset to 01/VBHN-BGDĐT defaults for given age group', async () => {
      const res = await service.resetDefaults('MAU_GIAO', 1);
      expect(mockDistributionRepo.manager.transaction).toHaveBeenCalled();
      expect(res).toBeDefined();
    });
  });
});
