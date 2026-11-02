import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChildAlertsService } from '../../../src/modules/child-alerts/services/child-alerts.service';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { ClassEntity } from '../../../src/modules/classes/entities/class.entity';
import { ChildAllergy } from '../../../src/modules/children/entities/child-allergy.entity';
import { DailyMealAttendance } from '../../../src/modules/attendance/entities/daily-meal-attendance.entity';
import { GrowthRecord, GrowthZscore } from '../../../src/modules/growth/entities/growth-record.entity';
import { Menu } from '../../../src/modules/menus/entities/menu.entity';
import { SnackRegistration } from '../../../src/modules/snack-services/entities/snack-registration.entity';
import { SnackServicePeriod } from '../../../src/modules/snack-services/entities/snack-service-period.entity';
import { ParentEvaluation } from '../../../src/modules/parent-evaluations/entities/parent-evaluation.entity';
import { AuditLogsService } from '../../../src/modules/audit-logs/services/audit-logs.service';

describe('ChildAlertsService - UC93 Role-Specific Visibility Scoping (Unit Tests)', () => {
  let service: ChildAlertsService;

  const mockStudents = [
    { id: 1, fullName: 'Nguyễn Minh Khang', studentCode: 'HS001', classId: 10, class: { id: 10, name: 'Mầm 1' } },
    { id: 2, fullName: 'Lê Bảo Nam', studentCode: 'HS002', classId: 10, class: { id: 10, name: 'Mầm 1' } },
    { id: 3, fullName: 'Trần Tuấn Kiệt', studentCode: 'HS003', classId: 20, class: { id: 20, name: 'Lá 2' } },
  ];

  const mockClasses = [
    { id: 10, name: 'Mầm 1', ageGroup: 'MAU_GIAO', homeroomTeacherId: 55 },
    { id: 20, name: 'Lá 2', ageGroup: 'MAU_GIAO', homeroomTeacherId: 66 },
  ];

  const mockAllergies = [
    {
      id: 1,
      studentId: 1,
      child: mockStudents[0],
      allergen: { id: 101, name: 'Hải sản / Tôm', code: 'SEAFOOD' },
      severity: 'HIGH',
    },
  ];

  const mockAttendances = [
    { id: 1, studentId: 1, date: '2026-11-02', consumptionLevel: 'FULL', note: 'Bé ăn tốt' },
    { id: 2, studentId: 2, date: '2026-11-02', consumptionLevel: 'NONE', note: 'Bé kêu đau bụng, bỏ ăn trưa' },
  ];

  const mockZscores = [
    {
      id: 1,
      waz: -2.3,
      haz: -2.1,
      baz: -1.2,
      classification: 'UNDERWEIGHT',
      measurement: {
        id: 10,
        studentId: 2,
        student: mockStudents[1],
        measuredDate: '2026-10-25',
      },
    },
  ];

  const mockChildRepo = {
    find: jest.fn().mockImplementation((opts?: any) => {
      if (opts?.where?.id) {
        const idVal = opts.where.id?._value || opts.where.id;
        if (Array.isArray(idVal)) {
          return Promise.resolve(mockStudents.filter((s) => idVal.includes(s.id)));
        }
      }
      if (opts?.where?.classId) {
        return Promise.resolve(mockStudents.filter((s) => s.classId === opts.where.classId));
      }
      return Promise.resolve(mockStudents);
    }),
    findOne: jest.fn().mockImplementation(({ where: { id } }) => {
      const s = mockStudents.find((item) => item.id === id);
      return Promise.resolve(s || null);
    }),
    query: jest.fn().mockImplementation((sql, params) => {
      // Simulate parent_id = 99 has student_id = 1
      if (params && params[0] === 99) {
        return Promise.resolve([{ student_id: 1 }]);
      }
      return Promise.resolve([]);
    }),
  };

  const mockClassRepo = {
    find: jest.fn().mockResolvedValue(mockClasses),
    findOne: jest.fn().mockImplementation(({ where }) => {
      if (where?.id) {
        return Promise.resolve(mockClasses.find((c) => c.id === where.id) || null);
      }
      if (where?.homeroomTeacherId) {
        return Promise.resolve(mockClasses.find((c) => c.homeroomTeacherId === where.homeroomTeacherId) || null);
      }
      return Promise.resolve(mockClasses[0]);
    }),
  };

  const mockAllergyRepo = {
    find: jest.fn().mockResolvedValue(mockAllergies),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockAllergies),
    })),
  };

  const mockAttendanceRepo = {
    findOne: jest.fn().mockResolvedValue(mockAttendances[0]),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockAttendances),
    })),
  };

  const mockGrowthRepo = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 10,
        studentId: 1,
        measuredDate: '2026-10-20',
        zscore: { waz: 0.1, classification: 'NORMAL' },
      }),
    })),
  };

  const mockZscoreRepo = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockZscores),
    })),
  };

  const mockMenuRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockSnackRegRepo = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          studentId: 3,
          student: mockStudents[2],
          period: { id: 10, name: 'Đợt ăn xế tháng 11', feeAmount: 350000 },
          status: 'PENDING',
        },
      ]),
    })),
  };

  const mockPeriodRepo = {
    findOne: jest.fn().mockResolvedValue(null),
  };

  const mockEvaluationRepo = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          studentId: 2,
          student: mockStudents[1],
          rating: 2,
          comment: 'Canh có vị hơi mặn đối với lứa tuổi nhà trẻ',
          createdAt: new Date().toISOString(),
          replies: [],
        },
      ]),
    })),
  };

  const mockAuditLogsService = {
    logAction: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildAlertsService,
        { provide: getRepositoryToken(Child), useValue: mockChildRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        { provide: getRepositoryToken(ChildAllergy), useValue: mockAllergyRepo },
        { provide: getRepositoryToken(DailyMealAttendance), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(GrowthRecord), useValue: mockGrowthRepo },
        { provide: getRepositoryToken(GrowthZscore), useValue: mockZscoreRepo },
        { provide: getRepositoryToken(Menu), useValue: mockMenuRepo },
        { provide: getRepositoryToken(SnackRegistration), useValue: mockSnackRegRepo },
        { provide: getRepositoryToken(SnackServicePeriod), useValue: mockPeriodRepo },
        { provide: getRepositoryToken(ParentEvaluation), useValue: mockEvaluationRepo },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
      ],
    }).compile();

    service = module.get<ChildAlertsService>(ChildAlertsService);
  });

  describe('1. Scope A: School Manager (Executive & Crisis Management)', () => {
    it('should aggregate school-wide crisis, broad anomalies, overdue fees, and parent grievances', async () => {
      const result = await service.getSchoolManagerAlerts();

      expect(result).toBeDefined();
      expect(result.role).toBe('SCHOOL_MANAGER');
      expect(result.scope).toBe('ALL_SCHOOL');

      // 1. Unresolved allergen conflicts
      expect(result.categories.unresolvedAllergenConflicts.length).toBeGreaterThan(0);
      expect(result.categories.unresolvedAllergenConflicts[0].severity).toBe('CRITICAL');
      expect(result.categories.unresolvedAllergenConflicts[0].timeLimit).toBe('09:00');

      // 2. Broad anomalies (>30% affected)
      expect(result.categories.broadAnomalies.length).toBeGreaterThan(0);
      expect(result.categories.broadAnomalies[0].severity).toBe('CRITICAL');

      // 3. Overdue payments
      expect(result.categories.overduePayments.length).toBe(1);
      expect(result.categories.overduePayments[0].studentName).toBe('Trần Tuấn Kiệt');
      expect(result.categories.overduePayments[0].amountVnd).toBe(350000);

      // 4. Parent complaints
      expect(result.categories.parentComplaints.length).toBe(1);
      expect(result.categories.parentComplaints[0].rating).toBe(2);
      expect(result.categories.parentComplaints[0].status).toBe('UNRESOLVED');
    });
  });

  describe('2. Scope B: Nutritionist (Food Safety & Clinical Nutrition)', () => {
    it('should return allergen cross-matching, growth drops, and TT28 micronutrient alerts', async () => {
      const result = await service.getNutritionistAlerts();

      expect(result).toBeDefined();
      expect(result.role).toBe('NUTRITIONIST');
      expect(result.scope).toBe('ALL_SCHOOL_CLINICAL');

      // 1. Allergen cross matching
      expect(result.categories.allergenCrossMatchingAlerts.length).toBeGreaterThan(0);
      expect(result.categories.allergenCrossMatchingAlerts[0].allergenName).toContain('Tôm');
      expect(result.categories.allergenCrossMatchingAlerts[0].severity).toBe('CRITICAL');

      // 2. Growth risk
      expect(result.categories.growthRiskAlerts.length).toBe(1);
      expect(result.categories.growthRiskAlerts[0].currentWaz).toBe(-2.3);
      expect(result.categories.growthRiskAlerts[0].diagnosis).toContain('ngưỡng Z-score nguy cơ');

      // 3. Micronutrients
      expect(result.categories.micronutrientDeficitAlerts.length).toBe(2);
      expect(result.categories.micronutrientDeficitAlerts.some((a) => a.nutrientName.includes('Canxi'))).toBe(true);
      expect(result.categories.micronutrientDeficitAlerts.some((a) => a.nutrientName.includes('Chất béo'))).toBe(true);
    });
  });

  describe('3. Scope C: Teacher (Classroom Operations & Meal Tray Flagging)', () => {
    it('should scope alerts strictly to the teacher homeroom class', async () => {
      const result = await service.getTeacherAlerts(55); // Teacher 55 is homeroom of Class Mầm 1 (id 10)

      expect(result).toBeDefined();
      expect(result.role).toBe('TEACHER');
      expect(result.classId).toBe('10');
      expect(result.className).toBe('Mầm 1');

      // 1. Tray Flagging
      expect(result.trayFlaggingAlerts.length).toBe(1);
      expect(result.trayFlaggingAlerts[0].studentName).toBe('Nguyễn Minh Khang');
      expect(result.trayFlaggingAlerts[0].labelTag).toBe('KHAY_AN_RIENG_DANG_NHAN_XANH');
      expect(result.trayFlaggingAlerts[0].severity).toBe('CRITICAL');

      // 2. Poor consumption
      expect(result.poorConsumptionAlerts.length).toBe(1);
      expect(result.poorConsumptionAlerts[0].consecutiveDays).toBe(2);

      // 3. Medical notes
      expect(result.medicalMedicationRequests.length).toBe(1);
      expect(result.medicalMedicationRequests[0].medicationNote).toContain('siro ho');
    });
  });

  describe('4. Scope D: Parent (Family & Child-Specific Privacy)', () => {
    it('should scope alerts strictly to only children belonging to the parent', async () => {
      const result = await service.getParentAlerts(99); // Parent 99 owns student 1

      expect(result).toBeDefined();
      expect(result.role).toBe('PARENT');
      expect(result.scope).toBe('MY_CHILDREN');
      expect(result.children.length).toBe(1);
      expect(result.children[0].childName).toBe('Nguyễn Minh Khang');

      // 1. Menu safety
      expect(result.children[0].menuSafetyAlert.status).toBe('SAFE_SUBSTITUTED');
      expect(result.children[0].menuSafetyAlert.content).toContain('Thịt nạc xào hạt sen');

      // 2. Daily intake
      expect(result.children[0].dailyIntakeReport.lunchStatus).toContain('100%');

      // 3. Health reminder
      expect(result.children[0].healthReminder.latestWaz).toBe(0.1);
    });

    it('should throw ForbiddenException if parent attempts to view alerts of another child', async () => {
      await expect(service.getParentAlerts(99, '3')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Universal Role-Specific Scoping & Resolution', () => {
    it('should automatically return Parent scope when user role is PARENT', async () => {
      const user = { id: 99, roles: ['PARENT'] };
      const res = await service.getRoleScopedAlertsSummary(user);

      expect(res.role).toBe('PARENT');
      expect(res.scope).toBe('MY_CHILDREN');
    });

    it('should automatically return Teacher scope when user role is TEACHER', async () => {
      const user = { id: 55, roles: ['TEACHER'] };
      const res = await service.getRoleScopedAlertsSummary(user);

      expect(res.role).toBe('TEACHER');
      expect((res as any).classId).toBe('10');
    });

    it('should successfully resolve and acknowledge an alert', async () => {
      const res = await service.resolveOrAcknowledgeAlert(
        {
          alertId: 'ALT-SM-ALG-1',
          alertType: 'ALLERGEN_CONFLICT',
          resolutionAction: 'CONFIRMED_SUBSTITUTE_DISH',
          notes: 'Bếp đã hoàn tất món thay thế an toàn cho bé',
        },
        77,
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('RESOLVED');
      expect(mockAuditLogsService.logAction).toHaveBeenCalled();
    });
  });
});
