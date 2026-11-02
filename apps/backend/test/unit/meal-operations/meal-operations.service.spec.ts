import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MealOperationsService } from '../../../src/modules/meal-operations/services/meal-operations.service';
import { DailyMealAttendance } from '../../../src/modules/attendance/entities/daily-meal-attendance.entity';
import { DailyMealPortion } from '../../../src/modules/meal-portions/entities/daily-meal-portion.entity';
import { InspectionRecord } from '../../../src/modules/inspections/entities/inspection-record.entity';
import { InspectionSampleItem } from '../../../src/modules/inspections/entities/inspection-sample-item.entity';
import { MealCoordinationNote } from '../../../src/modules/attendance/entities/meal-coordination-note.entity';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { ClassEntity } from '../../../src/modules/classes/entities/class.entity';
import { ChildAllergy } from '../../../src/modules/children/entities/child-allergy.entity';
import { User } from '../../../src/modules/auth/entities/user.entity';

describe('MealOperationsService (UC94: View Meal Operations Report)', () => {
  let service: MealOperationsService;

  const mockClasses = [
    { id: 1, name: 'Nhà trẻ 1 (18-24 tháng)', ageGroup: 'NHA_TRE', schoolYear: '2025-2026' },
    { id: 2, name: 'Mầm 1 (3-4 tuổi)', ageGroup: 'MAM', schoolYear: '2025-2026' },
    { id: 3, name: 'Chồi 1 (4-5 tuổi)', ageGroup: 'CHOI', schoolYear: '2025-2026' },
    { id: 4, name: 'Lá 1 (5-6 tuổi)', ageGroup: 'LA', schoolYear: '2025-2026' },
  ];

  const mockChildren = [
    { id: 101, fullName: 'Nguyễn Gia Bảo', classId: 1, gender: 'MALE' },
    { id: 102, fullName: 'Trần Minh Anh', classId: 1, gender: 'FEMALE' },
    { id: 103, fullName: 'Lê Hoàng Nam', classId: 2, gender: 'MALE' },
    { id: 104, fullName: 'Phạm Quỳnh Chi', classId: 2, gender: 'FEMALE' },
    { id: 105, fullName: 'Đỗ Hải Đăng', classId: 3, gender: 'MALE' },
  ];

  const mockAllergies = [
    {
      id: 1,
      studentId: 101,
      allergenId: 1,
      severity: 'HIGH',
      allergen: { id: 1, name: 'Tôm & Hải sản', code: 'SEAFOOD' },
    },
    {
      id: 2,
      studentId: 104,
      allergenId: 2,
      severity: 'MEDIUM',
      allergen: { id: 2, name: 'Sữa bò (Lactose)', code: 'COW_MILK' },
    },
  ];

  const mockAttendances: DailyMealAttendance[] = [
    {
      id: 1,
      studentId: 101,
      date: '2026-11-02',
      mealType: 'LUNCH',
      isAttended: true,
      consumptionLevel: 'FULL',
      note: 'Ăn hết',
      recordedBy: 2,
      student: mockChildren[0] as any,
      recorder: null as any,
    },
    {
      id: 2,
      studentId: 102,
      date: '2026-11-02',
      mealType: 'LUNCH',
      isAttended: false,
      consumptionLevel: 'NONE',
      note: 'Nghỉ ốm có phép trước 08h00',
      recordedBy: 2,
      student: mockChildren[1] as any,
      recorder: null as any,
    },
    {
      id: 3,
      studentId: 103,
      date: '2026-11-02',
      mealType: 'LUNCH',
      isAttended: true,
      consumptionLevel: 'PARTIAL',
      note: 'Ăn 2/3 suất',
      recordedBy: 2,
      student: mockChildren[2] as any,
      recorder: null as any,
    },
    {
      id: 4,
      studentId: 104,
      date: '2026-11-02',
      mealType: 'LUNCH',
      isAttended: true,
      consumptionLevel: 'FULL',
      note: 'Dị ứng sữa, ăn món riêng',
      recordedBy: 2,
      student: mockChildren[3] as any,
      recorder: null as any,
    },
    {
      id: 5,
      studentId: 105,
      date: '2026-11-02',
      mealType: 'LUNCH',
      isAttended: true,
      consumptionLevel: 'FULL',
      note: 'Ăn ngoan',
      recordedBy: 2,
      student: mockChildren[4] as any,
      recorder: null as any,
    },
    // Afternoon snacks
    {
      id: 6,
      studentId: 101,
      date: '2026-11-02',
      mealType: 'AFTERNOON_SNACK',
      isAttended: true,
      consumptionLevel: 'FULL',
      note: 'Uống sữa hạt',
      recordedBy: 2,
      student: mockChildren[0] as any,
      recorder: null as any,
    },
    {
      id: 7,
      studentId: 103,
      date: '2026-11-02',
      mealType: 'AFTERNOON_SNACK',
      isAttended: true,
      consumptionLevel: 'FULL',
      note: '',
      recordedBy: 2,
      student: mockChildren[2] as any,
      recorder: null as any,
    },
  ];

  const mockInspections: InspectionRecord[] = [
    {
      id: 1,
      date: '2026-11-02',
      inspectionStep: 'STEP_1_RAW_CHECK',
      inspectorId: 5,
      result: 'PASS',
      note: 'Nguyên liệu thịt heo và rau củ tươi, có tem niêm phong đạt chuẩn',
      inspector: { id: 5, fullName: 'Nguyễn Văn Cường (Bếp trưởng)' } as any,
      images: [],
    },
  ];

  const mockSamples: InspectionSampleItem[] = [
    {
      id: 1,
      date: '2026-11-02',
      dishName: 'Thịt heo rim ngũ vị',
      sampleCode: 'ML-20261102-01',
      storedAt: new Date('2026-11-02T10:45:00Z'),
      disposeAt: new Date('2026-11-03T10:45:00Z'),
      status: 'STORED',
      fridgeUnit: 'Tủ lưu mẫu số 1 (Ngăn mát 2 - 8°C)',
      sampleWeightG: 120,
      storageTemp: 3.8,
      collectorName: 'Nguyễn Văn Cường',
      note: 'Mẫu thức ăn lưu 24h theo QĐ 1246/QĐ-BYT',
    },
  ];

  const mockNotes: MealCoordinationNote[] = [
    {
      id: 1,
      date: '2026-11-02',
      fromUserId: 2,
      content: '[Nhà trẻ 1 (18-24 tháng)] Trẻ ăn ngon miệng, thịt rim rất mềm.',
      createdAt: new Date(),
      fromUser: { id: 2, fullName: 'Cô Thu (GV)' } as any,
    },
  ];

  const mockAttendanceRepo = {
    find: jest.fn().mockImplementation((opts) => {
      if (opts?.where?.date) {
        return Promise.resolve(mockAttendances.filter((a) => a.date === opts.where.date));
      }
      return Promise.resolve(mockAttendances);
    }),
  };

  const mockPortionRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockInspectionRepo = {
    find: jest.fn().mockResolvedValue(mockInspections),
    findOne: jest.fn().mockImplementation((opts) => {
      const match = mockInspections.find(
        (i) => i.date === opts.where.date && i.inspectionStep === opts.where.inspectionStep,
      );
      return Promise.resolve(match || null);
    }),
    create: jest.fn().mockImplementation((dto) => ({ id: 99, ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: entity.id || 99, ...entity })),
  };

  const mockSampleRepo = {
    find: jest.fn().mockResolvedValue(mockSamples),
    create: jest.fn().mockImplementation((dto) => ({ id: 99, ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: entity.id || 99, ...entity })),
  };

  const mockMealNoteRepo = {
    find: jest.fn().mockResolvedValue(mockNotes),
    create: jest.fn().mockImplementation((dto) => ({ id: 99, ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: entity.id || 99, ...entity })),
  };

  const mockChildRepo = {
    find: jest.fn().mockResolvedValue(mockChildren),
  };

  const mockClassRepo = {
    find: jest.fn().mockResolvedValue(mockClasses),
    findOne: jest.fn().mockImplementation((opts) => {
      return Promise.resolve(mockClasses.find((c) => c.id === opts.where.id) || null);
    }),
  };

  const mockAllergyRepo = {
    find: jest.fn().mockResolvedValue(mockAllergies),
  };

  const mockUserRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1, fullName: 'Admin' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealOperationsService,
        { provide: getRepositoryToken(DailyMealAttendance), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(DailyMealPortion), useValue: mockPortionRepo },
        { provide: getRepositoryToken(InspectionRecord), useValue: mockInspectionRepo },
        { provide: getRepositoryToken(InspectionSampleItem), useValue: mockSampleRepo },
        { provide: getRepositoryToken(MealCoordinationNote), useValue: mockMealNoteRepo },
        { provide: getRepositoryToken(Child), useValue: mockChildRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        { provide: getRepositoryToken(ChildAllergy), useValue: mockAllergyRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<MealOperationsService>(MealOperationsService);
  });

  describe('Block 1: Meal Reconciliation & Attendance (Cân đối suất ăn & Hoàn phí)', () => {
    it('should aggregate headcounts, refund amounts, and special diets accurately', async () => {
      const res = await service.getDailyMealOperationsReport('2026-11-02');

      expect(res.date).toBe('2026-11-02');
      expect(res.reconciliation).toBeDefined();
      expect(res.reconciliation.totalEnrolledStudents).toBe(5);
      expect(res.reconciliation.actualLunchCount).toBe(4);
      expect(res.reconciliation.absentExcusedCount).toBe(1);
      // 1 excused absent * 35,000 VND
      expect(res.reconciliation.totalRefundAmountVnd).toBe(35000);
      expect(res.reconciliation.specialDietCount).toBe(2);

      // Verify class breakdown
      expect(res.reconciliation.classBreakdown.length).toBe(4);
      const class1 = res.reconciliation.classBreakdown.find((c) => c.classId === '1');
      expect(class1).toBeDefined();
      expect(class1?.enrolled).toBe(2);
      expect(class1?.presentLunch).toBe(1);
      expect(class1?.excusedAbsence).toBe(1);
      expect(class1?.specialDiet).toBe(1);
      expect(class1?.specialDietChildren[0].safeSubstitute).toContain('Thịt heo rim ngũ vị');
    });
  });

  describe('Block 2: Food Safety Inspection & 24h Sample Retention (QĐ 1246/QĐ-BYT)', () => {
    it('should verify 3-step food inspection compliance and sample retention parameters', async () => {
      const res = await service.getDailyMealOperationsReport('2026-11-02');

      const safety = res.foodSafetyInspection;
      expect(safety).toBeDefined();
      expect(safety.decisionStandard).toContain('Quyết định 1246/QĐ-BYT');

      // Step 1: Raw check
      expect(safety.step1RawCheck.result).toBe('PASS');
      expect(safety.step1RawCheck.transportTempC).toBeLessThanOrEqual(-18);

      // Step 2: Processing check
      expect(safety.step2ProcessingCheck.coreBoilingTempC).toBeGreaterThanOrEqual(75);
      expect(safety.step2ProcessingCheck.oneWayKitchenCompliance).toBe(true);

      // Step 3: Pre-serving check
      expect(safety.step3PreServingCheck.result).toBe('PASS');

      // 24h Retention & 3-party e-signatures
      expect(safety.sampleRetention24h.storageTempC).toBeGreaterThanOrEqual(2);
      expect(safety.sampleRetention24h.storageTempC).toBeLessThanOrEqual(8);
      expect(safety.sampleRetention24h.signatories.kitchenHead.signed).toBe(true);
      expect(safety.sampleRetention24h.signatories.medicalStaff.signed).toBe(true);
      expect(safety.sampleRetention24h.signatories.schoolManager.signed).toBe(true);
    });
  });

  describe('Block 3: Consumption & Plate Waste Management', () => {
    it('should calculate consumption distribution and flag dishes with high waste for 3 consecutive days', async () => {
      const res = await service.getDailyMealOperationsReport('2026-11-02');

      const wasteBlock = res.consumptionAndPlateWaste;
      expect(wasteBlock).toBeDefined();
      expect(wasteBlock.portionDistribution.full100Pct).toBeGreaterThan(0);
      expect(wasteBlock.schoolAverageConsumptionRate).toBeGreaterThan(50);

      // Verify Waste Index
      const soupWaste = wasteBlock.dishWasteIndex.find((d) => d.dishCategory === 'Canh');
      expect(soupWaste).toBeDefined();
      expect(soupWaste?.wastePercent).toBeGreaterThan(25);
      expect(soupWaste?.flagged).toBe(true);
      expect(soupWaste?.consecutiveDays).toBe(3);
      expect(soupWaste?.warning).toContain('Tỷ lệ thừa > 25% liên tục 3 ngày');

      // Verify Teacher Feedback
      expect(wasteBlock.teacherSensoryFeedback.length).toBeGreaterThan(0);
      expect(wasteBlock.teacherSensoryFeedback[0].temperature).toBe('ẤM NÓNG');
    });
  });

  describe('E-signing & Teacher Feedback Operations', () => {
    it('should allow role-based electronic signature for food inspection', async () => {
      const signRes = await service.signInspection(
        {
          date: '2026-11-02',
          step: 'STEP_3_PRE_SERVING_CHECK',
          role: 'SCHOOL_MANAGER',
          signerName: 'Phạm Thị Lan',
          notes: 'Nghiệm thu đạt chuẩn 100%',
        },
        1,
      );

      expect(signRes.success).toBe(true);
      expect(signRes.message).toContain('Đã ký duyệt thành công STEP_3_PRE_SERVING_CHECK');
      expect(mockInspectionRepo.save).toHaveBeenCalled();
    });

    it('should record teacher sensory evaluation and store note', async () => {
      const evalRes = await service.submitTeacherSensory(
        {
          date: '2026-11-02',
          classId: 1,
          temperature: 'ẤM NÓNG',
          taste: 'Vừa miệng',
          cleanliness: 'Rất sạch sẽ',
          trayCountReceived: 18,
          plateWastePercent: 4.5,
          comment: 'Trẻ ăn ngon miệng',
        },
        2,
      );

      expect(evalRes.success).toBe(true);
      expect(evalRes.message).toContain('Đã gửi phản hồi cảm quan');
      expect(mockMealNoteRepo.save).toHaveBeenCalled();
    });

    it('should generate export operations report with legal reference metadata', async () => {
      const exportData = await service.exportOperationsReport('2026-11-02');
      expect(exportData.title).toBe('BÁO CÁO VẬN HÀNH BỮA ĂN VÀ BÁN TRÚ TOÀN TRƯỜNG');
      expect(exportData.standardRef).toContain('Quyết định 1246/QĐ-BYT');
      expect(exportData.report.reconciliation).toBeDefined();
    });
  });
});
