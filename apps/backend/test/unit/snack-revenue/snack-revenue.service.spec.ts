import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SnackRevenueService } from '../../../src/modules/snack-revenue/services/snack-revenue.service';
import { SnackServicePeriod } from '../../../src/modules/snack-services/entities/snack-service-period.entity';
import { SnackRegistration } from '../../../src/modules/snack-services/entities/snack-registration.entity';
import { Payment } from '../../../src/modules/payments/entities/payment.entity';
import { DailyMealAttendance } from '../../../src/modules/attendance/entities/daily-meal-attendance.entity';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { ClassEntity } from '../../../src/modules/classes/entities/class.entity';
import { User } from '../../../src/modules/auth/entities/user.entity';

describe('SnackRevenueService (UC96: View Snack Service Revenue Report)', () => {
  let service: SnackRevenueService;

  const mockPeriod: SnackServicePeriod = {
    id: 1,
    name: 'Đợt ăn xế Tháng 11/2026',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    registrationDeadline: '2026-11-05',
    feeAmount: 440000,
    status: 'OPEN',
    registrations: [],
  };

  const mockClasses: ClassEntity[] = [
    { id: 1, name: 'Nhà trẻ 1 (18-24 tháng)', ageGroup: 'NHA_TRE', schoolYear: '2025-2026' } as any,
    { id: 2, name: 'Mầm 1 (3-4 tuổi)', ageGroup: 'MAM', schoolYear: '2025-2026' } as any,
    { id: 3, name: 'Chồi 1 (4-5 tuổi)', ageGroup: 'CHOI', schoolYear: '2025-2026' } as any,
    { id: 4, name: 'Lá 1 (5-6 tuổi)', ageGroup: 'LA', schoolYear: '2025-2026' } as any,
  ];

  const mockStudents: Child[] = [
    { id: 101, fullName: 'Nguyễn Gia Bảo', classId: 1 } as any,
    { id: 102, fullName: 'Trần Minh Anh', classId: 1 } as any,
    { id: 103, fullName: 'Lê Hoàng Nam', classId: 2 } as any,
    { id: 104, fullName: 'Phạm Quỳnh Chi', classId: 2 } as any,
    { id: 105, fullName: 'Đỗ Hải Đăng', classId: 3 } as any,
  ];

  const mockRegistrations: SnackRegistration[] = [
    {
      id: 1,
      periodId: 1,
      studentId: 101,
      parentId: 1,
      status: 'PAID',
      registeredAt: new Date('2026-11-01T08:00:00Z'),
      student: mockStudents[0],
      period: mockPeriod,
      parent: { id: 1, fullName: 'Nguyễn Văn A', phone: '0908123456' } as any,
    },
    {
      id: 2,
      periodId: 1,
      studentId: 102,
      parentId: 2,
      status: 'PAID',
      registeredAt: new Date('2026-11-01T08:30:00Z'),
      student: mockStudents[1],
      period: mockPeriod,
      parent: { id: 2, fullName: 'Trần Văn B', phone: '0908123457' } as any,
    },
    {
      id: 3,
      periodId: 1,
      studentId: 103,
      parentId: 3,
      status: 'PAID',
      registeredAt: new Date('2026-11-01T09:00:00Z'),
      student: mockStudents[2],
      period: mockPeriod,
      parent: { id: 3, fullName: 'Lê Văn C', phone: '0908123458' } as any,
    },
    {
      id: 4,
      periodId: 1,
      studentId: 104,
      parentId: 4,
      status: 'PAID',
      registeredAt: new Date('2026-11-01T09:30:00Z'),
      student: mockStudents[3],
      period: mockPeriod,
      parent: { id: 4, fullName: 'Phạm Văn D', phone: '0908123459' } as any,
    },
    {
      id: 5,
      periodId: 1,
      studentId: 105,
      parentId: 5,
      status: 'PENDING',
      registeredAt: new Date('2026-11-01T10:00:00Z'),
      student: mockStudents[4],
      period: mockPeriod,
      parent: { id: 5, fullName: 'Đỗ Văn E', phone: '0908123450' } as any,
    },
  ];

  const mockPayments: Payment[] = [
    {
      id: 1,
      registrationId: 1,
      amount: 440000,
      vnpayTransactionCode: 'VNP-20261102-001',
      status: 'SUCCESS',
      paidAt: new Date('2026-11-01T08:05:00Z'),
      rawResponse: '{}',
      registration: mockRegistrations[0],
    },
    {
      id: 2,
      registrationId: 2,
      amount: 440000,
      vnpayTransactionCode: 'VNP-20261102-002',
      status: 'SUCCESS',
      paidAt: new Date('2026-11-01T08:35:00Z'),
      rawResponse: '{}',
      registration: mockRegistrations[1],
    },
  ];

  const mockAttendances: DailyMealAttendance[] = [
    {
      id: 1,
      studentId: 102,
      date: '2026-11-02',
      mealType: 'AFTERNOON_SNACK',
      isAttended: false,
      note: 'Nghỉ ốm có phép trước 08h00',
    } as any,
  ];

  const mockPeriodRepo = {
    find: jest.fn().mockResolvedValue([mockPeriod]),
    findOne: jest.fn().mockResolvedValue(mockPeriod),
  };

  const mockRegistrationRepo = {
    find: jest.fn().mockResolvedValue(mockRegistrations),
  };

  const mockPaymentRepo = {
    find: jest.fn().mockResolvedValue(mockPayments),
  };

  const mockAttendanceRepo = {
    find: jest.fn().mockResolvedValue(mockAttendances),
  };

  const mockChildRepo = {
    find: jest.fn().mockResolvedValue(mockStudents),
  };

  const mockClassRepo = {
    find: jest.fn().mockResolvedValue(mockClasses),
  };

  const mockUserRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnackRevenueService,
        { provide: getRepositoryToken(SnackServicePeriod), useValue: mockPeriodRepo },
        { provide: getRepositoryToken(SnackRegistration), useValue: mockRegistrationRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(DailyMealAttendance), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(Child), useValue: mockChildRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<SnackRevenueService>(SnackRevenueService);
  });

  describe('Block 1: Collection Metrics & Aging Debts', () => {
    it('should calculate expected and collected revenue and determine collection rate', async () => {
      const res = await service.getSnackRevenueReport({ month: 11, year: 2026 });

      expect(res.collectionSummary).toBeDefined();
      expect(res.collectionSummary.expectedRevenue).toBeGreaterThan(0);
      expect(res.collectionSummary.collectedRevenue).toBeGreaterThan(0);
      expect(res.collectionSummary.collectionRate).toBeGreaterThanOrEqual(80.0);
      expect(res.collectionSummary.totalRegisteredStudents).toBe(5);
      expect(res.collectionSummary.paidStudents).toBe(4);
      expect(res.collectionSummary.pendingStudents).toBe(1);

      // Verify Aging Debts
      expect(res.agingDebts.length).toBeGreaterThan(0);
      expect(res.agingDebts[0].studentName).toBe('Đỗ Hải Đăng');
      expect(res.agingDebts[0].amount).toBe(440000);
      expect(res.agingDebts[0].status).toBe('PENDING_PAYMENT');
    });
  });

  describe('Block 2: Meal Attendance Reconciliation (Hoàn phí cấn trừ)', () => {
    it('should reconcile excused absences before 08h00 and credit to next month', async () => {
      const res = await service.getSnackRevenueReport({ month: 11, year: 2026 });

      const recon = res.attendanceReconciliation;
      expect(recon).toBeDefined();
      expect(recon.refundPerSnack).toBe(20000);
      expect(recon.totalRefundAmount).toBeGreaterThan(0);
      expect(recon.creditBalanceAppliedNextMonth).toBe(recon.totalRefundAmount);
      expect(recon.reconciliationStudents.length).toBeGreaterThan(0);
      expect(recon.reconciliationStudents[0].status).toBe('CREDITED_NEXT_MONTH');
    });
  });

  describe('Block 3: Food Cost Structure Norms (70% - 20% - 10%)', () => {
    it('should split collected revenue into 70% food, 20% care/overtime, and 10% VNPAY/admin fee', async () => {
      const res = await service.getSnackRevenueReport({ month: 11, year: 2026 });

      const cost = res.costStructure;
      expect(cost).toBeDefined();
      expect(cost.ingredientCost70Pct.percentage).toBe(70);
      expect(cost.serviceCost20Pct.percentage).toBe(20);
      expect(cost.paymentFeeAndAdmin10Pct.percentage).toBe(10);

      // Check amount proportions
      const totalAllocated =
        cost.ingredientCost70Pct.amount +
        cost.serviceCost20Pct.amount +
        cost.paymentFeeAndAdmin10Pct.amount;
      expect(totalAllocated).toBe(res.collectionSummary.collectedRevenue);
    });
  });

  describe('Block 4: Grade Breakdown & VNPAY Statement Reconciliation', () => {
    it('should break down revenue by 4 grade levels and reconcile VNPAY transactions', async () => {
      const res = await service.getSnackRevenueReport({ month: 11, year: 2026 });

      expect(res.gradeBreakdown.length).toBe(4);
      expect(res.gradeBreakdown[0].gradeLevel).toBe('NHA_TRE');
      expect(res.gradeBreakdown[0].collectionRate).toBeGreaterThan(0);

      // VNPAY statements
      expect(res.vnpayTransactions.length).toBeGreaterThan(0);
      expect(res.vnpayTransactions[0].status).toBe('MATCHED');
      expect(res.vnpayTransactions[0].transactionCode).toContain('VNP');
    });
  });

  describe('School Manager Actions: Reminders & Export', () => {
    it('should send debt reminder notifications to overdue parents', async () => {
      const res = await service.sendDebtReminder(
        {
          registrationIds: [5],
          channel: 'ALL',
        },
        1,
      );

      expect(res.success).toBe(true);
      expect(res.remindedCount).toBe(1);
      expect(res.message).toContain('Đã gửi thành công');
    });

    it('should export official financial report with reportTitle and period', async () => {
      const report = await service.exportFinancialReport({ month: 11, year: 2026 });
      expect(report.reportTitle).toContain('BÁO CÁO DOANH THU & QUYẾT TOÁN TÀI CHÍNH DỊCH VỤ ĂN XẾ');
      expect(report.financialPeriod).toBe('Tháng 11/2026');
      expect(report.report.collectionSummary).toBeDefined();
    });
  });
});
