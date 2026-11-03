import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FoodSafetyService } from '../../../src/modules/food-safety/services/food-safety.service';
import { InspectionRecord } from '../../../src/modules/inspections/entities/inspection-record.entity';
import { InspectionImage } from '../../../src/modules/inspections/entities/inspection-image.entity';
import { InspectionSampleItem } from '../../../src/modules/inspections/entities/inspection-sample-item.entity';
import { StaffProfile } from '../../../src/modules/users/entities/staff-profile.entity';
import { User } from '../../../src/modules/auth/entities/user.entity';
import { MealCoordinationNote } from '../../../src/modules/attendance/entities/meal-coordination-note.entity';

describe('FoodSafetyService (UC95: View Food Safety Compliance Report)', () => {
  let service: FoodSafetyService;

  const mockInspections: InspectionRecord[] = [
    {
      id: 1,
      date: '2026-11-02',
      inspectionStep: 'STEP_1_RAW_CHECK',
      inspectorId: 5,
      result: 'PASS',
      note: 'Nguyên liệu đạt chuẩn VietGAP',
      inspector: { id: 5, fullName: 'Nguyễn Văn Cường (Bếp trưởng)' } as any,
      images: [{ id: 1, inspectionId: 1, imageUrl: 'https://example.com/step1.jpg', uploadedAt: new Date() } as any],
    },
    {
      id: 2,
      date: '2026-11-02',
      inspectionStep: 'STEP_2_PROCESSING_CHECK',
      inspectorId: 5,
      result: 'PASS',
      note: 'Nhiệt độ sôi tâm 88.5°C đạt chuẩn > 75°C',
      inspector: { id: 5, fullName: 'Nguyễn Văn Cường (Bếp trưởng)' } as any,
      images: [{ id: 2, inspectionId: 2, imageUrl: 'https://example.com/step2.jpg', uploadedAt: new Date() } as any],
    },
    {
      id: 3,
      date: '2026-11-02',
      inspectionStep: 'STEP_3_PRE_SERVING_CHECK',
      inspectorId: 5,
      result: 'PASS',
      note: 'Cảm quan thức ăn chín kỹ, vừa miệng trẻ',
      inspector: { id: 5, fullName: 'Nguyễn Văn Cường (Bếp trưởng)' } as any,
      images: [{ id: 3, inspectionId: 3, imageUrl: 'https://example.com/step3.jpg', uploadedAt: new Date() } as any],
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
    {
      id: 2,
      date: '2026-11-02',
      dishName: 'Canh bí đỏ thịt bằm',
      sampleCode: 'ML-20261102-02',
      storedAt: new Date('2026-11-02T10:48:00Z'),
      disposeAt: new Date('2026-11-03T10:48:00Z'),
      status: 'STORED',
      fridgeUnit: 'Tủ lưu mẫu số 1 (Ngăn mát 2 - 8°C)',
      sampleWeightG: 180,
      storageTemp: 3.8,
      collectorName: 'Nguyễn Văn Cường',
      note: 'Mẫu thức ăn lưu 24h theo QĐ 1246/QĐ-BYT',
    },
  ];

  const mockInspectionRepo = {
    find: jest.fn().mockResolvedValue(mockInspections),
  };

  const mockImageRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockSampleRepo = {
    find: jest.fn().mockResolvedValue(mockSamples),
  };

  const mockStaffProfileRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockUserRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockMealNoteRepo = {
    create: jest.fn().mockImplementation((dto) => ({ id: 10, ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodSafetyService,
        { provide: getRepositoryToken(InspectionRecord), useValue: mockInspectionRepo },
        { provide: getRepositoryToken(InspectionImage), useValue: mockImageRepo },
        { provide: getRepositoryToken(InspectionSampleItem), useValue: mockSampleRepo },
        { provide: getRepositoryToken(StaffProfile), useValue: mockStaffProfileRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(MealCoordinationNote), useValue: mockMealNoteRepo },
      ],
    }).compile();

    service = module.get<FoodSafetyService>(FoodSafetyService);
  });

  describe('Block 1: 3-Step Inspection Compliance & Photo Audit Trail', () => {
    it('should aggregate 3-step compliance rates and enforce photo audit trail >= 98%', async () => {
      const res = await service.getFoodSafetyComplianceReport('2026-11-02');

      expect(res.inspection3Step).toBeDefined();
      expect(res.inspection3Step.step1RawCheckCompliance).toBe(100);
      expect(res.inspection3Step.step2ProcessingCheckCompliance).toBe(100);
      expect(res.inspection3Step.step3PreServingCheckCompliance).toBe(100);

      // Photo audit trail >= 98%
      const photoTrail = res.inspection3Step.photoAuditTrail;
      expect(photoTrail.photoRate).toBeGreaterThanOrEqual(98.0);
      expect(photoTrail.isCompliant).toBe(true);
      expect(photoTrail.samplePhotos.length).toBeGreaterThan(0);

      // Temperatures
      expect(res.inspection3Step.temperatureLogs.avgCoreBoilingTempC).toBeGreaterThanOrEqual(75.0);
      expect(res.inspection3Step.temperatureLogs.avgTransportTempC).toBeLessThanOrEqual(5.0);
    });
  });

  describe('Block 2: 24-Hour Food Sample Retention Log', () => {
    it('should verify 100% dish sample retention and dedicated fridge temperature 2-8°C', async () => {
      const res = await service.getFoodSafetyComplianceReport('2026-11-02');

      const sampleBlock = res.sampleRetention24h;
      expect(sampleBlock).toBeDefined();
      expect(sampleBlock.sampleRetentionRate).toBe(100);
      expect(sampleBlock.standardWeightComplianceRate).toBe(100);

      // Fridge temperature check
      expect(sampleBlock.fridgeStatus.currentTempC).toBeGreaterThanOrEqual(2.0);
      expect(sampleBlock.fridgeStatus.currentTempC).toBeLessThanOrEqual(8.0);
      expect(sampleBlock.fridgeStatus.isRedAlert).toBe(false);
      expect(sampleBlock.fridgeStatus.hourlyTrend.length).toBeGreaterThan(0);

      // Tripartite signature
      expect(sampleBlock.samples.length).toBe(2);
      expect(sampleBlock.samples[0].tripartiteSigned).toBe(true);
      expect(sampleBlock.samples[0].isStandard).toBe(true);
    });
  });

  describe('Block 3: Legal & Periodic Certificates (Suppliers, Staff, Water)', () => {
    it('should check school food safety license, 100% staff health compliance, and QCVN 01-1 water test', async () => {
      const res = await service.getFoodSafetyComplianceReport('2026-11-02');

      const legal = res.legalAndCertificates;
      expect(legal).toBeDefined();

      // School License
      expect(legal.schoolFoodSafetyLicense.status).toBe('VALID');
      expect(legal.schoolFoodSafetyLicense.daysRemaining).toBeGreaterThan(0);

      // Staff Compliance (100% Green Health Card & Training)
      expect(legal.staffCompliance.healthCardRate).toBe(100);
      expect(legal.staffCompliance.trainingCertRate).toBe(100);
      expect(legal.staffCompliance.staffList.length).toBeGreaterThan(0);

      // Water Testing QCVN 01-1:2018/BYT
      expect(legal.waterTesting.standardRef).toContain('QCVN 01-1:2018/BYT');
      expect(legal.waterTesting.isCompliant).toBe(true);
      expect(legal.waterTesting.drinkingWaterResult).toContain('ĐẠT CHUẨN');

      // Supplier reject rate check
      const dalatSupplier = legal.suppliers.find((s) => s.id === 1);
      expect(dalatSupplier?.rejectRate).toBeLessThanOrEqual(2.0);
      expect(dalatSupplier?.isRejectRateAlert).toBe(false);

      const minhLongSupplier = legal.suppliers.find((s) => s.id === 2);
      expect(minhLongSupplier?.rejectRate).toBeGreaterThan(2.0);
      expect(minhLongSupplier?.isRejectRateAlert).toBe(true);
    });
  });

  describe('Role-Specific Operations: School Manager & Nutritionist', () => {
    it('should allow School Manager to e-sign the monthly inspection log', async () => {
      const res = await service.signMonthlyLog(
        {
          month: 11,
          year: 2026,
          signerName: 'Phạm Thị Lan',
          signerRole: 'SCHOOL_MANAGER',
          notes: 'Phê duyệt hồ sơ tháng 11',
        },
        1,
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('Đã ký duyệt thành công sổ kiểm thực điện tử');
    });

    it('should allow Nutritionist to submit sensory incident analysis and chemical safety review', async () => {
      const res = await service.submitNutritionistReview(
        {
          date: '2026-11-02',
          dishName: 'Thịt gà xào nấm',
          incidentDescription: 'Nấm hơi mềm',
          chemicalOrAdditiveSafetyStatus: 'AN TOÀN',
          nutritionistAnalysis: 'Do xào quá nhiệt',
          actionTaken: 'Điều chỉnh thời gian xào 4 phút',
          reviewerName: 'Vũ Thu Thảo',
        },
        2,
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('Đã lưu phân tích chuyên môn');
      expect(res.review.dishName).toBe('Thịt gà xào nấm');
    });

    it('should allow School Manager to suspend supplier exceeding 2% reject rate', async () => {
      const res = await service.suspendSupplier(
        {
          supplierId: 2,
          reason: 'Tỷ lệ hàng bị từ chối nhập 4.16% vượt ngưỡng cho phép 2%',
          decisionBy: 'Phạm Thị Lan (Ban Giám Hiệu)',
        },
        1,
      );

      expect(res.success).toBe(true);
      expect(res.supplier.status).toBe('SUSPENDED');
      expect(res.message).toContain('Đã ban hành lệnh đình chỉ tạm thời');
    });

    it('should export official compliance dossier with legal framework references', async () => {
      const dossier = await service.exportComplianceDossier('2026-11-02');
      expect(dossier.dossierTitle).toContain('HỒ SƠ PHÁP LÝ & SỔ KIỂM THỰC 3 BƯỚC');
      expect(dossier.legalFramework.some((l) => l.includes('1246/QĐ-BYT'))).toBe(true);
      expect(dossier.report.overallComplianceRate).toBeGreaterThan(95);
    });
  });
});

