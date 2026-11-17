import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParentEvaluationService } from '../../../src/modules/parent-evaluations/services/parent-evaluation.service';
import { ParentEvaluation, EvaluationReply } from '../../../src/modules/parent-evaluations/entities/parent-evaluation.entity';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { ClassEntity } from '../../../src/modules/classes/entities/class.entity';
import { Dish } from '../../../src/modules/dishes/entities/dish.entity';
import { DailyMealAttendance } from '../../../src/modules/attendance/entities/daily-meal-attendance.entity';
import { MenusService } from '../../../src/modules/menus/services/menus.service';

describe('ParentEvaluationService - UC97: Parent Evaluation Summary Report', () => {
  let service: ParentEvaluationService;

  const mockStudents: Child[] = [
    { id: 101, fullName: 'Trần Minh Khang', classId: 1, class: { id: 1, name: 'Mầm 1', ageGroup: 'MAM' } } as any,
    { id: 102, fullName: 'Lê Thùy Chi', classId: 2, class: { id: 2, name: 'Nhà Trẻ 1', ageGroup: 'NHA_TRE' } } as any,
    { id: 103, fullName: 'Nguyễn Gia Huy', classId: 3, class: { id: 3, name: 'Chồi 2', ageGroup: 'CHOI' } } as any,
    { id: 104, fullName: 'Đỗ Hải Đăng', classId: 4, class: { id: 4, name: 'Lá 1', ageGroup: 'LA' } } as any,
    { id: 105, fullName: 'Phạm Ngọc Mai', classId: 1, class: { id: 1, name: 'Mầm 1', ageGroup: 'MAM' } } as any,
  ];

  const mockEvaluations: ParentEvaluation[] = [
    {
      id: 1,
      studentId: 101,
      rating: 1,
      comment: 'Canh rau dền quá mặn, bé khát nước nhiều.',
      createdAt: new Date(Date.now() - 2 * 3600000),
      student: mockStudents[0],
      replies: [],
    } as any,
    {
      id: 2,
      studentId: 102,
      rating: 2,
      comment: 'Thịt viên còn khô cứng bé nhai không được.',
      createdAt: new Date(Date.now() - 1.5 * 3600000),
      student: mockStudents[1],
      replies: [],
    } as any,
    {
      id: 3,
      studentId: 103,
      rating: 5,
      comment: 'Phở bò Hà Nội rất ngon, nước dùng ngọt thanh bé ăn sạch bát!',
      createdAt: new Date(Date.now() - 10 * 3600000),
      student: mockStudents[2],
      replies: [
        {
          id: 1,
          evaluationId: 3,
          content: 'Nhà trường cảm ơn phụ huynh đã khen ngợi!',
          repliedAt: new Date(Date.now() - 8 * 3600000),
          repliedBy: 1,
          user: { fullName: 'Hiệu trưởng Nguyễn Thu Thủy' },
        } as any,
      ],
    } as any,
    {
      id: 4,
      studentId: 104,
      rating: 5,
      comment: 'Sữa chua dầm dâu tây xuất sắc, bé rất thích.',
      createdAt: new Date(Date.now() - 6 * 3600000),
      student: mockStudents[3],
      replies: [],
    } as any,
    {
      id: 5,
      studentId: 105,
      rating: 4,
      comment: 'Cơm trưa dẻo, trình bày đẹp mắt.',
      createdAt: new Date(Date.now() - 5 * 3600000),
      student: mockStudents[4],
      replies: [],
    } as any,
  ];

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(mockEvaluations),
    getManyAndCount: jest.fn().mockResolvedValue([mockEvaluations, mockEvaluations.length]),
    getRawOne: jest.fn().mockResolvedValue({ avg: 4.6, count: 5 }),
    getCount: jest.fn().mockResolvedValue(4),
  };

  const mockEvalRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    find: jest.fn().mockResolvedValue(mockEvaluations),
    findOne: jest.fn().mockImplementation(({ where }) => {
      const found = mockEvaluations.find((e) => Number(e.id) === Number(where.id));
      return Promise.resolve(found || null);
    }),
    count: jest.fn().mockResolvedValue(5),
    query: jest.fn().mockResolvedValue([{ avg_seconds: 5400 }]),
  };

  const mockReplyRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: 99, ...dto })),
    save: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 99, ...dto, repliedAt: new Date() })),
  };

  const mockChildRepo = {
    find: jest.fn().mockResolvedValue(mockStudents),
    findOne: jest.fn().mockResolvedValue(mockStudents[0]),
  };

  const mockClassRepo = {
    find: jest.fn().mockResolvedValue([
      { id: 1, name: 'Mầm 1', ageGroup: 'MAM' },
      { id: 2, name: 'Nhà Trẻ 1', ageGroup: 'NHA_TRE' },
      { id: 3, name: 'Chồi 2', ageGroup: 'CHOI' },
      { id: 4, name: 'Lá 1', ageGroup: 'LA' },
    ]),
  };

  const mockDishRepo = {
    find: jest.fn().mockResolvedValue([
      { id: 1, name: 'Phở bò Hà Nội' },
      { id: 2, name: 'Súp gà ngô non' },
      { id: 6, name: 'Canh rau dền đỏ' },
    ]),
  };

  const mockAttendanceRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentEvaluationService,
        { provide: getRepositoryToken(ParentEvaluation), useValue: mockEvalRepo },
        { provide: getRepositoryToken(EvaluationReply), useValue: mockReplyRepo },
        { provide: getRepositoryToken(Child), useValue: mockChildRepo },
        { provide: getRepositoryToken(DailyMealAttendance), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        { provide: getRepositoryToken(Dish), useValue: mockDishRepo },
        { provide: MenusService, useValue: {} },
      ],
    }).compile();

    service = module.get<ParentEvaluationService>(ParentEvaluationService);
  });

  describe('Block 1: Overall CSAT & Sentiment', () => {
    it('should calculate average rating, positive/negative rates and participation KPI', async () => {
      const res = await service.getSummaryReport({ month: 11, year: 2026 });

      expect(res.overallCsat).toBeDefined();
      expect(res.overallCsat.averageRating).toBeGreaterThanOrEqual(1.0);
      expect(res.overallCsat.averageRating).toBeLessThanOrEqual(5.0);
      expect(res.overallCsat.totalEvaluations).toBeGreaterThan(0);
      expect(res.overallCsat.positiveRate).toBeGreaterThan(0);
      expect(res.overallCsat.participationRate).toBeGreaterThan(0);
      expect(res.overallCsat.benchmarkTargetText).toContain('Mục tiêu: Đạt 4.5 - 5.0 sao');
    });
  });

  describe('Block 2: 4 Quality Dimensions Analysis', () => {
    it('should analyze Taste & Texture, Freshness & Temperature, Visual Appeal, and Portion Size', async () => {
      const res = await service.getSummaryReport({ month: 11, year: 2026 });

      expect(res.qualityDimensions.length).toBe(4);
      const keys = res.qualityDimensions.map((q) => q.dimensionKey);
      expect(keys).toContain('TASTE_TEXTURE');
      expect(keys).toContain('FRESHNESS_TEMP');
      expect(keys).toContain('VISUAL_APPEAL');
      expect(keys).toContain('PORTION_SIZE');

      // Check question prompt & satisfaction rate
      const taste = res.qualityDimensions.find((q) => q.dimensionKey === 'TASTE_TEXTURE');
      expect(taste?.questionPrompt).toContain('Trẻ có thích ăn không');
      expect(taste?.averageScore).toBeGreaterThanOrEqual(4.0);
      expect(taste?.satisfactionRate).toBeGreaterThan(90.0);
    });
  });

  describe('Block 3: Dish Popularity & Feedback Ranking', () => {
    it('should identify Top 5 highest rated and Top 5 complained dishes with mandatory actions', async () => {
      const res = await service.getSummaryReport({ month: 11, year: 2026 });

      expect(res.dishRanking).toBeDefined();
      expect(res.dishRanking.topFavoriteDishes.length).toBe(5);
      expect(res.dishRanking.topComplainedDishes.length).toBe(5);

      // Favorite dishes
      expect(res.dishRanking.topFavoriteDishes[0].dishName).toContain('Phở bò');
      expect(res.dishRanking.topFavoriteDishes[0].averageRating).toBeGreaterThanOrEqual(4.8);
      expect(res.dishRanking.topFavoriteDishes[0].actionRequired).toBe('INCREASE_FREQUENCY');

      // Complained dishes
      expect(res.dishRanking.topComplainedDishes[0].dishName).toContain('Canh rau dền');
      expect(res.dishRanking.topComplainedDishes[0].actionRequired).toBe('MANDATORY_RECIPE_IMPROVEMENT');
    });
  });

  describe('Block 4: Response Rate & SLA Performance', () => {
    it('should enforce SLA < 4h for urgent ratings (<= 2 stars) and < 24h for normal ratings', async () => {
      const res = await service.getSummaryReport({ month: 11, year: 2026 });

      const sla = res.slaPerformance;
      expect(sla).toBeDefined();
      expect(sla.totalReceived).toBeGreaterThan(0);
      expect(sla.urgentSlaAvgHours).toBeLessThanOrEqual(4.0);
      expect(sla.normalSlaAvgHours).toBeLessThanOrEqual(24.0);
      expect(sla.responseRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Block 5: Grade CSAT Breakdown', () => {
    it('should breakdown CSAT by 4 preschool grades with teacher discipline evaluation', async () => {
      const res = await service.getSummaryReport({ month: 11, year: 2026 });

      expect(res.gradeBreakdown.length).toBe(4);
      expect(res.gradeBreakdown[0].gradeLevel).toBe('NHA_TRE');
      expect(res.gradeBreakdown[0].participationRate).toBeGreaterThan(70.0);
      expect(res.gradeBreakdown[0].teacherDisciplineScore).toBeDefined();
    });
  });

  describe('Role Actions: Nutritionist & School Manager', () => {
    it('Nutritionist should send scientific nutritional advice to parent', async () => {
      const res = await service.respondSpecialist(
        1,
        {
          responseContent: 'Về mặt tiêu hóa, bé có thể bị nhạy cảm nhẹ với đạm sữa bò. Bếp sẽ chuyển sang sữa hạt cho bé.',
          responseCategory: 'NUTRITION_ADVICE',
          sendPushNotification: true,
        },
        2,
        'NUTRITIONIST',
      );

      expect(res.success).toBe(true);
      expect(res.content).toContain('[Tư vấn Dinh dưỡng Chuyên môn]');
      expect(res.pushNotificationSent).toBe(true);
    });

    it('Nutritionist should add complained dish into Chef Recipe Improvement Log', async () => {
      const newRecord = await service.createRecipeImprovementLog(
        {
          dishId: 6,
          dishName: 'Canh rau dền đỏ nấu tôm đồng',
          issueFeedback: 'Canh quá mặn đối với lứa tuổi mầm non',
          actionPlan: 'Giảm 30% muối, sử dụng bút đo độ mặn đạt chuẩn dưới 0.4%',
          priority: 'HIGH',
        },
        2,
        'NUTRITIONIST',
      );

      expect(newRecord.id).toBeDefined();
      expect(newRecord.dishName).toBe('Canh rau dền đỏ nấu tôm đồng');
      expect(newRecord.status).toBe('ASSIGNED_TO_CHEF');

      const allLogs = await service.getRecipeImprovementLogs();
      expect(allLogs.length).toBeGreaterThan(0);
    });

    it('School Manager should export official executive summary report', async () => {
      const exportData = await service.exportSummaryReport({ month: 11, year: 2026 });

      expect(exportData.reportTitle).toContain('BÁO CÁO TỔNG HỢP ĐÁNH GIÁ CỦA PHỤ HUYNH');
      expect(exportData.executiveSignatures.principal).toContain('Hiệu trưởng');
      expect(exportData.executiveSignatures.nutritionSpecialist).toContain('Chuyên viên Dinh dưỡng');
      expect(exportData.report.overallCsat).toBeDefined();
    });
  });
});
