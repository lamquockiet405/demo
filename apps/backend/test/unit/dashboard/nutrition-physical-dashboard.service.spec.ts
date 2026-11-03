import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NutritionPhysicalDashboardService } from '../../../src/modules/dashboard/services/nutrition-physical-dashboard.service';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { GrowthRecord, GrowthZscore } from '../../../src/modules/growth/entities/growth-record.entity';
import { Menu } from '../../../src/modules/menus/entities/menu.entity';
import { ClassEntity } from '../../../src/modules/classes/entities/class.entity';
import { AuditLogsService } from '../../../src/modules/audit-logs/services/audit-logs.service';

describe('NutritionPhysicalDashboardService (UC92 Unit Tests)', () => {
  let service: NutritionPhysicalDashboardService;

  const mockStudents: any[] = [
    {
      id: 1,
      fullName: 'Nguyễn Văn An',
      studentCode: 'HS001',
      gender: 'MALE',
      dateOfBirth: '2023-05-15',
      classId: 10,
      class: { id: 10, name: 'Khối Mầm 1', ageGroup: 'MAU_GIAO' },
    },
    {
      id: 2,
      fullName: 'Trần Thị Bình',
      studentCode: 'HS002',
      gender: 'FEMALE',
      dateOfBirth: '2024-02-10',
      classId: 20,
      class: { id: 20, name: 'Nhà trẻ 1', ageGroup: 'NHA_TRE' },
    },
    {
      id: 3,
      fullName: 'Lê Hoàng Cường',
      studentCode: 'HS003',
      gender: 'MALE',
      dateOfBirth: '2021-08-20',
      classId: 30,
      class: { id: 30, name: 'Lớp Lá 2', ageGroup: 'MAU_GIAO' },
    },
  ];

  const mockRecords: any[] = [
    {
      id: 101,
      studentId: 1,
      measuredDate: '2026-10-25',
      heightCm: 98.5,
      weightKg: 14.8,
      zscore: {
        id: 1,
        waz: 0.1,
        haz: 0.2,
        baz: 0.05,
        classification: 'NORMAL',
      },
    },
    {
      id: 102,
      studentId: 2,
      measuredDate: '2026-10-26',
      heightCm: 81.0,
      weightKg: 9.8,
      zscore: {
        id: 2,
        waz: -2.3, // Underweight
        haz: -2.1, // Stunted
        baz: -1.2,
        classification: 'UNDERWEIGHT',
      },
    },
    {
      id: 103,
      studentId: 3,
      measuredDate: '2026-10-27',
      heightCm: 116.0,
      weightKg: 28.5,
      zscore: {
        id: 3,
        waz: 2.4,
        haz: 0.4,
        baz: 2.8, // Obese
        classification: 'OBESE',
      },
    },
  ];

  const mockClasses: any[] = [
    { id: 10, name: 'Khối Mầm 1', ageGroup: 'MAU_GIAO' },
    { id: 20, name: 'Nhà trẻ 1', ageGroup: 'NHA_TRE' },
    { id: 30, name: 'Lớp Lá 2', ageGroup: 'MAU_GIAO' },
  ];

  const mockChildRepo = {
    find: jest.fn().mockResolvedValue(mockStudents),
    findOne: jest.fn().mockImplementation(({ where: { id } }) => {
      const found = mockStudents.find((s) => s.id === id);
      return Promise.resolve(found || null);
    }),
  };

  const mockGrowthRepo = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockRecords),
    })),
  };

  const mockZscoreRepo = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };

  const mockMenuRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockClassRepo = {
    find: jest.fn().mockResolvedValue(mockClasses),
  };

  const mockAuditLogsService = {
    logAction: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionPhysicalDashboardService,
        {
          provide: getRepositoryToken(Child),
          useValue: mockChildRepo,
        },
        {
          provide: getRepositoryToken(GrowthRecord),
          useValue: mockGrowthRepo,
        },
        {
          provide: getRepositoryToken(GrowthZscore),
          useValue: mockZscoreRepo,
        },
        {
          provide: getRepositoryToken(Menu),
          useValue: mockMenuRepo,
        },
        {
          provide: getRepositoryToken(ClassEntity),
          useValue: mockClassRepo,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<NutritionPhysicalDashboardService>(NutritionPhysicalDashboardService);
  });

  describe('1. School Manager Overview (Executive KPI & Growth Standards)', () => {
    it('should aggregate school-wide physical status and evaluate targets', async () => {
      const result = await service.getSchoolManagerOverview();

      expect(result).toBeDefined();
      expect(result.kpis).toBeDefined();
      expect(result.kpis.totalStudents).toBe(3);
      expect(result.kpis.evaluatedStudents).toBe(3);

      // Student 1: Normal, Student 2: Underweight & Stunted, Student 3: Obese
      expect(result.kpis.normalCount).toBe(1);
      expect(result.kpis.underweightCount).toBe(1);
      expect(result.kpis.stuntedCount).toBe(1);
      expect(result.kpis.overweightObeseCount).toBe(1);

      // Targets: Normal > 90%, Underweight < 3%, Stunted < 3%, Overweight < 5%
      expect(result.kpis.normalTarget).toBe(90.0);
      expect(result.kpis.underweightTarget).toBe(3.0);
      expect(result.kpis.stuntedTarget).toBe(3.0);
      expect(result.kpis.overweightObeseTarget).toBe(5.0);
      expect(result.kpis.menuComplianceRate).toBeGreaterThan(90);
    });

    it('should provide grade-level breakdowns for Nursery, Mam, Choi, and La', async () => {
      const result = await service.getSchoolManagerOverview();

      expect(result.gradeBreakdown).toBeDefined();
      expect(result.gradeBreakdown.length).toBe(4);

      const nhaTre = result.gradeBreakdown.find((g) => g.gradeCode === 'NHA_TRE');
      expect(nhaTre).toBeDefined();
      expect(nhaTre?.totalStudents).toBe(1);
      expect(nhaTre?.underweightCount).toBe(1);

      const la = result.gradeBreakdown.find((g) => g.gradeCode === 'LA');
      expect(la).toBeDefined();
      expect(la?.overweightObeseCount).toBe(1);
    });

    it('should include historical progression trends and executive action list', async () => {
      const result = await service.getSchoolManagerOverview();

      expect(result.historicalTrends).toBeDefined();
      expect(result.historicalTrends.length).toBeGreaterThanOrEqual(4);
      expect(result.executiveActions).toBeDefined();
      expect(result.executiveActions.some((a) => a.id === 'ACT_BUDGET')).toBe(true);
      expect(result.executiveActions.some((a) => a.id === 'ACT_MEETING')).toBe(true);
      expect(result.executiveActions.some((a) => a.id === 'ACT_REPORT')).toBe(true);
    });
  });

  describe('2. Nutritionist Clinical Overview (Circular 28 Compliance & At-Risk Children)', () => {
    it('should compute TT28 nutritional compliance metrics (Calories, PLG ratio, Animal Protein, Micronutrients)', async () => {
      const result = await service.getNutritionistClinicalOverview();

      expect(result.clinicalNutrition).toBeDefined();
      expect(result.clinicalNutrition.dailyAvgCalories).toBe(685);
      expect(result.clinicalNutrition.targetCaloriesRange).toContain('600 - 726');

      // PLG ratio standard 14% : 26% : 60%
      expect(result.clinicalNutrition.plgRatio.proteinPct).toBeCloseTo(14, 0);
      expect(result.clinicalNutrition.plgRatio.fatPct).toBeCloseTo(26, 0);
      expect(result.clinicalNutrition.plgRatio.carbPct).toBeCloseTo(60, 0);

      // Animal protein > 50%
      expect(result.clinicalNutrition.animalProtein.pct).toBeGreaterThan(50);
      expect(result.clinicalNutrition.animalProtein.status).toBe('PASS');

      // 5 Micronutrients
      expect(result.clinicalNutrition.micronutrients.length).toBe(5);
      const calcium = result.clinicalNutrition.micronutrients.find((m) => m.name.includes('Canxi'));
      expect(calcium).toBeDefined();
      expect(calcium?.status).toBe('OPTIMAL');
    });

    it('should accurately detect and diagnose at-risk students (|Z| > 2 SD)', async () => {
      const result = await service.getNutritionistClinicalOverview();

      expect(result.atRiskStudents).toBeDefined();
      expect(result.atRiskStudents.length).toBe(2); // Student 2 (underweight & stunted) and Student 3 (obese)

      const stuntedStudent = result.atRiskStudents.find((s) => s.id === '2');
      expect(stuntedStudent).toBeDefined();
      expect(stuntedStudent?.waz).toBe(-2.3);
      expect(stuntedStudent?.haz).toBe(-2.1);
      expect(stuntedStudent?.diagnosis).toContain('Suy dinh dưỡng');
      expect(stuntedStudent?.recommendedAction).toContain('sữa cao năng lượng');

      const obeseStudent = result.atRiskStudents.find((s) => s.id === '3');
      expect(obeseStudent).toBeDefined();
      expect(obeseStudent?.baz).toBe(2.8);
      expect(obeseStudent?.diagnosis).toContain('Béo phì');
      expect(obeseStudent?.recommendedAction).toContain('tinh bột');
    });

    it('should filter at-risk children by classId when provided', async () => {
      const result = await service.getNutritionistClinicalOverview(undefined, 20);

      expect(result.atRiskStudents.length).toBe(1);
      expect(result.atRiskStudents[0].id).toBe('2');
    });
  });

  describe('3. Executive & Clinical Next Action Handlers', () => {
    it('should successfully approve budget for Nursery micronutrient supplementation (School Manager Action)', async () => {
      const result = await service.approveBudget(
        {
          gradeCode: 'NHA_TRE',
          amountVnd: 15000000,
          notes: 'Duyệt cấp kinh phí bổ sung sữa giàu Canxi & D3',
        },
        99,
      );

      expect(result.success).toBe(true);
      expect(result.approvalCode).toContain('NS-NHA_TRE-');
      expect(result.amountVnd).toBe(15000000);
      expect(mockAuditLogsService.logAction).toHaveBeenCalled();
    });

    it('should successfully create personalized intervention diet for at-risk child (Nutritionist Action)', async () => {
      const result = await service.createPersonalizedDiet(
        {
          studentId: 2,
          dietType: 'HIGH_CALORIE_MICRONUTRIENT',
          adjustmentNotes: 'Tăng 20% đạm thịt gà/bò nạc trong bữa trưa, thêm 1 hộp sữa chua sau giờ ngủ',
          targetCalories: 750,
          extraSupplements: ['Canxi & D3', 'Kẽm vi lượng'],
        },
        88,
      );

      expect(result.success).toBe(true);
      expect(result.studentName).toBe('Trần Thị Bình');
      expect(result.dietPlanId).toContain('DIET-2-');
      expect(mockAuditLogsService.logAction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if student does not exist when creating personalized diet', async () => {
      await expect(
        service.createPersonalizedDiet({
          studentId: 9999,
          dietType: 'CUSTOM',
          adjustmentNotes: 'N/A',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully schedule parent consultation via app (Nutritionist Action)', async () => {
      const result = await service.scheduleParentConsultation(
        {
          studentId: 3,
          scheduledDate: '2026-11-12T14:30:00Z',
          consultationTopic: 'Tư vấn chế độ ăn kiểm soát cân nặng cho trẻ thừa cân',
        },
        88,
      );

      expect(result.success).toBe(true);
      expect(result.studentName).toBe('Lê Hoàng Cường');
      expect(result.consultationId).toContain('CS-3-');
      expect(result.status).toBe('CONFIRMED');
      expect(result.notificationSentToParent).toBe(true);
      expect(mockAuditLogsService.logAction).toHaveBeenCalled();
    });

    it('should export formatted nutrition summary report for Department of Education (PGD&ĐT)', async () => {
      const result = await service.exportNutritionReport();

      expect(result).toBeDefined();
      expect(result.schoolName).toBeDefined();
      expect(result.kpis).toBeDefined();
      expect(result.gradeBreakdown).toBeDefined();
      expect(result.clinicalSummary).toBeDefined();
      expect(result.standardReference).toContain('Thông tư số 28/2016/TT-BGDĐT');
    });
  });
});

