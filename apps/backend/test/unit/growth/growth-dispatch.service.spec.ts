import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GrowthDispatchService } from '../../../src/modules/growth/services/growth-dispatch.service';
import { GrowthRecord, GrowthZscore } from '../../../src/modules/growth/entities/growth-record.entity';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { ClassEntity } from '../../../src/modules/classes/entities/class.entity';
import { DailyMealAttendance } from '../../../src/modules/attendance/entities/daily-meal-attendance.entity';
import { WhoZscoreService } from '../../../src/modules/growth/services/who-zscore.service';
import { NotFoundException } from '@nestjs/common';

describe('GrowthDispatchService - UC85: Dispatch Role-Based Abnormal Growth & Nutrition Notifications', () => {
  let service: GrowthDispatchService;

  const mockStudents: Child[] = [
    {
      id: 101,
      fullName: 'Trần Minh Khang',
      classId: 1,
      gender: 'MALE',
      dateOfBirth: new Date(Date.now() - 42 * 30 * 24 * 3600000), // ~42 months
      class: { id: 1, name: 'Mầm 1', ageGroup: 'MAM' },
    } as any,
    {
      id: 102,
      fullName: 'Lê Thùy Chi',
      classId: 2,
      gender: 'FEMALE',
      dateOfBirth: new Date(Date.now() - 28 * 30 * 24 * 3600000), // ~28 months
      class: { id: 2, name: 'Nhà Trẻ 1', ageGroup: 'NHA_TRE' },
    } as any,
    {
      id: 103,
      fullName: 'Nguyễn Gia Huy',
      classId: 3,
      gender: 'MALE',
      dateOfBirth: new Date(Date.now() - 50 * 30 * 24 * 3600000), // ~50 months
      class: { id: 3, name: 'Chồi 2', ageGroup: 'CHOI' },
    } as any,
  ];

  const mockGrowthRecords: GrowthRecord[] = [
    {
      id: 1,
      studentId: 101,
      measuredDate: '2026-11-01',
      weightKg: 12.2,
      heightCm: 95.0,
      zscore: {
        waz: -2.35,
        haz: -1.1,
        baz: -2.15,
        wazClassification: 'UNDERWEIGHT',
        hazClassification: 'NORMAL',
        bazClassification: 'WASTED',
      },
    } as any,
    {
      id: 2,
      studentId: 101,
      measuredDate: '2026-10-01',
      weightKg: 12.8,
      heightCm: 94.5,
    } as any,
    {
      id: 3,
      studentId: 102,
      measuredDate: '2026-11-01',
      weightKg: 10.1,
      heightCm: 81.0,
      zscore: {
        waz: -2.1,
        haz: -2.4,
        baz: -0.5,
        wazClassification: 'UNDERWEIGHT',
        hazClassification: 'STUNTED',
        bazClassification: 'NORMAL',
      },
    } as any,
    {
      id: 4,
      studentId: 103,
      measuredDate: '2026-11-01',
      weightKg: 23.5,
      heightCm: 106.0,
      zscore: {
        waz: 2.8,
        haz: 0.8,
        baz: 3.2,
        wazClassification: 'NORMAL',
        hazClassification: 'NORMAL',
        bazClassification: 'OBESE',
      },
    } as any,
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrowthDispatchService,
        {
          provide: getRepositoryToken(GrowthRecord),
          useValue: {
            find: jest.fn().mockImplementation((options: any) => {
              if (options?.where?.studentId) {
                return Promise.resolve(
                  mockGrowthRecords.filter((r) => r.studentId === options.where.studentId),
                );
              }
              return Promise.resolve(mockGrowthRecords);
            }),
          },
        },
        {
          provide: getRepositoryToken(GrowthZscore),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Child),
          useValue: {
            find: jest.fn().mockResolvedValue(mockStudents),
            findOne: jest.fn().mockImplementation(({ where }: any) => {
              const student = mockStudents.find((s) => s.id === where?.id);
              return Promise.resolve(student || null);
            }),
          },
        },
        {
          provide: getRepositoryToken(ClassEntity),
          useValue: {
            find: jest.fn().mockResolvedValue([
              { id: 1, name: 'Mầm 1' },
              { id: 2, name: 'Nhà Trẻ 1' },
              { id: 3, name: 'Chồi 2' },
            ]),
          },
        },
        {
          provide: getRepositoryToken(DailyMealAttendance),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: WhoZscoreService,
          useValue: {
            calculateZscores: jest.fn().mockReturnValue({
              waz: -2.35,
              haz: -1.1,
              baz: -2.15,
              wazClassification: 'UNDERWEIGHT',
              hazClassification: 'NORMAL',
              bazClassification: 'WASTED',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GrowthDispatchService>(GrowthDispatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1. scanAndDispatchNotifications', () => {
    it('should scan student anthropometric records and dispatch role-based notifications', async () => {
      const result = await service.scanAndDispatchNotifications(1);

      expect(result).toBeDefined();
      expect(result.scannedCount).toBe(3);
      expect(result.abnormalCount).toBeGreaterThanOrEqual(1);
      expect(result.dispatchedNotificationsCount).toBeGreaterThanOrEqual(3);
      expect(result.summary).toContain('Đã hoàn thành quét');
    });
  });

  describe('2. getNotificationsByRole - Role-Specific Visibility Scoping', () => {
    it('PARENT Role: should strictly scope to child-only data without exposing other children', async () => {
      const parentNotifications = await service.getNotificationsByRole('PARENT', 1, {
        role: 'PARENT',
        studentId: 101,
      });

      expect(Array.isArray(parentNotifications)).toBe(true);
      expect(parentNotifications.length).toBeGreaterThan(0);
      for (const item of parentNotifications) {
        expect(item.targetRole).toBe('PARENT');
        expect(item.studentId).toBe(101);
        expect(item.metadata.recommendationText).toBeDefined();
      }
    });

    it('TEACHER Role: should scope to notifications within teacher classId only', async () => {
      const teacherNotifications = await service.getNotificationsByRole('TEACHER', 2, {
        role: 'TEACHER',
        classId: 1,
      });

      expect(Array.isArray(teacherNotifications)).toBe(true);
      for (const item of teacherNotifications) {
        expect(item.targetRole).toBe('TEACHER');
        expect(item.classId).toBe(1);
      }
    });

    it('NUTRITIONIST Role: should view all abnormal records school-wide with clinical metrics', async () => {
      const nutritionistNotifications = await service.getNotificationsByRole('NUTRITIONIST', 3, {
        role: 'NUTRITIONIST',
      });

      expect(Array.isArray(nutritionistNotifications)).toBe(true);
      expect(nutritionistNotifications.length).toBeGreaterThan(0);
      for (const item of nutritionistNotifications) {
        expect(item.targetRole).toBe('NUTRITIONIST');
      }
    });

    it('SCHOOL_MANAGER Role: should view critical alerts across the whole school', async () => {
      const managerNotifications = await service.getNotificationsByRole('SCHOOL_MANAGER', 4, {
        role: 'SCHOOL_MANAGER',
      });

      expect(Array.isArray(managerNotifications)).toBe(true);
      expect(managerNotifications.length).toBeGreaterThan(0);
      for (const item of managerNotifications) {
        expect(item.severity === 'CRITICAL' || item.targetRole === 'PARENT').toBe(true);
      }
    });

    it('Filter by Severity: should correctly filter by CRITICAL severity', async () => {
      const criticals = await service.getNotificationsByRole('ALL', 1, {
        role: 'ALL',
        severity: 'CRITICAL',
      });

      expect(Array.isArray(criticals)).toBe(true);
      for (const item of criticals) {
        expect(item.severity).toBe('CRITICAL');
      }
    });
  });

  describe('3. acknowledgeNotification', () => {
    it('should allow teacher or nutritionist to acknowledge case and update SLA status', async () => {
      const acknowledged = await service.acknowledgeNotification(
        1,
        10,
        'TEACHER',
        'Giáo viên đã nhận tin và sẽ hỗ trợ động viên bé ăn hết suất cơm trưa.',
      );

      expect(acknowledged).toBeDefined();
      expect(acknowledged.id).toBe(1);
      expect(acknowledged.status).toBe('ACKNOWLEDGED');
      expect(acknowledged.statusLabel).toBe('Đã tiếp nhận chăm sóc');
      expect(acknowledged.acknowledgedBy).toBe('Giáo viên chủ nhiệm lớp');
      expect(acknowledged.metadata.recommendationText).toContain('động viên bé');
    });

    it('should throw NotFoundException if notification id does not exist', async () => {
      await expect(service.acknowledgeNotification(999999, 10, 'TEACHER')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('4. assignInterventionDiet', () => {
    it('Nutritionist should assign personalized diet plan and schedule recheck', async () => {
      const updated = await service.assignInterventionDiet(
        {
          notificationId: 2,
          interventionDietTitle: 'Thực đơn phục hồi tăng đạm & vi chất (High Protein/Calorie Diet)',
          calorieAdjustmentKcal: 180,
          nutritionGuidance: 'Thêm 1 cữ sữa tươi 15h30, hầm mềm đùi gà với hạt sen, thêm 5ml dầu oliu.',
          recheckDate: '2026-11-20',
        },
        5,
      );

      expect(updated).toBeDefined();
      expect(updated.status).toBe('INTERVENTION_APPLIED');
      expect(updated.statusLabel).toBe('Đã áp dụng thực đơn can thiệp');
      expect(updated.metadata.interventionDietTitle).toContain('High Protein/Calorie');
      expect(updated.acknowledgedBy).toContain('Lê Hoàng Mai');
    });

    it('should throw NotFoundException for invalid notificationId', async () => {
      await expect(
        service.assignInterventionDiet(
          {
            notificationId: 99999,
            interventionDietTitle: 'Test',
            nutritionGuidance: 'Test',
          },
          5,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('5. requestConsultation', () => {
    it('Parent should successfully book 1-on-1 consultation with school nutritionist', async () => {
      const result = await service.requestConsultation(
        {
          notificationId: 1,
          preferredDate: '2026-11-10 09:30',
          notes: 'Phụ huynh muốn hỏi kỹ về thực đơn bổ sung vi chất cho bé tại nhà.',
        },
        101,
      );

      expect(result.success).toBe(true);
      expect(result.consultationDate).toBe('2026-11-10 09:30');
      expect(result.message).toContain('Đã đặt lịch tư vấn dinh dưỡng 1-1');
    });

    it('should throw NotFoundException if consultation booked for nonexistent notification', async () => {
      await expect(
        service.requestConsultation(
          {
            notificationId: 88888,
            preferredDate: '2026-11-10 10:00',
          },
          101,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('6. approveInterventionBudget', () => {
    it('School Manager should approve nutrition intervention budget for high-risk children', async () => {
      const result = await service.approveInterventionBudget(
        {
          notificationIds: [1, 2],
          approvedBudgetAmount: 2500000,
          decisionNotes: 'Phê duyệt gói ngân sách tài trợ sữa dinh dưỡng và vi chất cho học sinh SDD.',
        },
        1,
      );

      expect(result.success).toBe(true);
      expect(result.approvedCount).toBe(2);
      expect(result.totalAmount).toBe(2500000);
      expect(result.message).toContain('Hiệu trưởng đã phê duyệt');
    });
  });

  describe('7. getExecutiveGrowthHealthSummary', () => {
    it('should compute school-wide growth health KPIs, alert counts, and high-risk classes', async () => {
      const summary = await service.getExecutiveGrowthHealthSummary(1);

      expect(summary).toBeDefined();
      expect(summary.schoolName).toBe('Trường Mầm Non Chất Lượng Cao KidMeal');
      expect(summary.normalDevelopmentRate).toBeGreaterThanOrEqual(90);
      expect(summary.underweightRate).toBeLessThanOrEqual(5);
      expect(summary.kpiComplianceStatus).toBe('EXCELLENT');
      expect(summary.abnormalAlertCount).toBeGreaterThan(0);
      expect(summary.topRiskClasses.length).toBeGreaterThan(0);
      expect(summary.topRiskClasses[0].className).toBe('Lớp Mầm 1');
    });
  });
});
