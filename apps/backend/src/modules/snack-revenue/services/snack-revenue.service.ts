import { Injectable, Optional, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SnackServicePeriod } from "../../snack-services/entities/snack-service-period.entity";
import { SnackRegistration } from "../../snack-services/entities/snack-registration.entity";
import { Payment } from "../../payments/entities/payment.entity";
import { DailyMealAttendance } from "../../attendance/entities/daily-meal-attendance.entity";
import { Child } from "../../children/entities/child.entity";
import { ClassEntity } from "../../classes/entities/class.entity";
import { User } from "../../auth/entities/user.entity";
import { AuditLogsService } from "../../audit-logs/services/audit-logs.service";
import { QuerySnackRevenueDto } from "../dto/query-snack-revenue.dto";
import { SendDebtReminderDto } from "../dto/send-debt-reminder.dto";

export interface AgingDebtItem {
  registrationId: number;
  studentId: number;
  studentName: string;
  className: string;
  parentName: string;
  parentPhone: string;
  amount: number;
  registeredAt: string;
  daysOverdue: number;
  status: string;
}

export interface StudentCreditItem {
  studentId: number;
  studentName: string;
  className: string;
  parentName: string;
  excusedDaysCount: number;
  refundAmount: number;
  status: "CREDITED_NEXT_MONTH" | "REFUNDED_CASH";
}

export interface GradeRevenueBreakdown {
  gradeLevel: string;
  gradeName: string;
  registeredCount: number;
  expectedRevenue: number;
  collectedRevenue: number;
  collectionRate: number;
}

export interface VnpayTransactionItem {
  transactionCode: string;
  studentName: string;
  className: string;
  parentName?: string;
  parentPhone?: string;
  packageName?: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  bankRef: string;
  status: "MATCHED" | "PENDING_CLEARING";
}

export interface SnackRevenueReportResponse {
  schoolName: string;
  period: {
    month: number;
    year: number;
    periodName: string;
    daysInMonth: number;
    serviceFeePerDay: number;
  };
  collectionSummary: {
    expectedRevenue: number;
    collectedRevenue: number;
    pendingDebtAmount: number;
    collectionRate: number;
    isTargetReached: boolean;
    targetRate: number;
    totalRegisteredStudents: number;
    paidStudents: number;
    pendingStudents: number;
  };
  attendanceReconciliation: {
    totalExcusedAbsences: number;
    refundPerSnack: number;
    totalRefundAmount: number;
    creditBalanceAppliedNextMonth: number;
    reconciliationStudents: StudentCreditItem[];
  };
  costStructure: {
    ingredientCost70Pct: {
      percentage: number;
      amount: number;
      description: string;
    };
    serviceCost20Pct: {
      percentage: number;
      amount: number;
      description: string;
    };
    paymentFeeAndAdmin10Pct: {
      percentage: number;
      amount: number;
      description: string;
    };
    netOperatingSurplus: number;
  };
  gradeBreakdown: GradeRevenueBreakdown[];
  agingDebts: AgingDebtItem[];
  vnpayTransactions: VnpayTransactionItem[];
}

@Injectable()
export class SnackRevenueService {
  constructor(
    @InjectRepository(SnackServicePeriod)
    private readonly periodRepo: Repository<SnackServicePeriod>,
    @InjectRepository(SnackRegistration)
    private readonly registrationRepo: Repository<SnackRegistration>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(DailyMealAttendance)
    private readonly attendanceRepo: Repository<DailyMealAttendance>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  /**
   * UC96: Xem Báo Cáo Doanh Thu Dịch Vụ Ăn Xế (Chỉ dành riêng cho School Manager)
   */
  async getSnackRevenueReport(
    query?: QuerySnackRevenueDto,
    schoolId?: number,
  ): Promise<SnackRevenueReportResponse> {
    const now = new Date();
    const month = query?.month || now.getMonth() + 1,
      year = query?.year || now.getFullYear();
    const start = new Date(Date.UTC(year, month - 1, 1))
        .toISOString()
        .slice(0, 10),
      end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const classes = await this.classRepo.find({ where: { academicYearId: activeAcademicYear(schoolId || 1) }, order: { name: "ASC" } });
    const registrations = await this.registrationRepo.find({
      where: { studentId: currentStudent(schoolId || 1), period: { startDate: currentYearDate(schoolId || 1) } },
      relations: ["student", "period", "parent"],
      order: { registeredAt: "DESC" },
    });
    const activeRegs = registrations.filter(
      (r) =>
        r.period &&
        r.period.startDate <= end &&
        r.period.endDate >= start &&
        !["CANCELLED", "REJECTED"].includes(r.status),
    );
    const payments = await this.paymentRepo.find({
      where: { registration: { studentId: currentStudent(schoolId || 1), period: { startDate: currentYearDate(schoolId || 1) } } },
      relations: [
        "registration",
        "registration.student",
        "registration.parent",
        "registration.period",
      ],
      order: { paidAt: "DESC" },
    });
    const paid = payments.filter(
      (p) =>
        ["SUCCESS", "PAID"].includes(p.status) &&
        p.paidAt &&
        new Date(p.paidAt).toISOString().slice(0, 10) >= start &&
        new Date(p.paidAt).toISOString().slice(0, 10) <= end,
    );
    const pendingRegs = activeRegs.filter((r) => r.status === "PENDING"),
      paidRegs = activeRegs.filter((r) => r.status === "PAID");
    const fee = (r: any) => Number(r.period?.feeAmount || 0);
    const expectedRevenue = activeRegs.reduce((sum, r) => sum + fee(r), 0),
      collectedRevenue = paid.reduce((sum, p) => sum + Number(p.amount), 0),
      pendingDebtAmount = pendingRegs.reduce((sum, r) => sum + fee(r), 0);
    const rate = (a: number, b: number) =>
      b > 0 ? Math.round((a / b) * 1000) / 10 : null;
    const gradeCodes = [
      ...new Set(classes.map((c) => c.ageGroup).filter(Boolean)),
    ];
    const gradeBreakdown = gradeCodes.map((code) => {
      const ids = new Set(
        classes.filter((c) => c.ageGroup === code).map((c) => Number(c.id)),
      );
      const regs = activeRegs.filter((r) =>
        ids.has(Number(r.student?.classId)),
      );
      const expected = regs.reduce((sum, r) => sum + fee(r), 0);
      const collected = paid
        .filter((p) => ids.has(Number(p.registration?.student?.classId)))
        .reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        gradeLevel: code,
        gradeName: code,
        registeredCount: regs.length,
        expectedRevenue: expected,
        collectedRevenue: collected,
        collectionRate: rate(collected, expected),
      };
    });
    const agingDebts = pendingRegs.map((r) => ({
      registrationId: r.id,
      studentId: r.studentId,
      studentName: r.student?.fullName || "",
      className:
        classes.find((c) => Number(c.id) === Number(r.student?.classId))
          ?.name || "",
      parentName: r.parent?.fullName || "",
      parentPhone: r.parent?.phone || "",
      amount: fee(r),
      registeredAt: r.registeredAt?.toISOString() || null,
      daysOverdue: r.period?.registrationDeadline
        ? Math.max(
            0,
            Math.floor(
              (Date.now() -
                new Date(
                  r.period.registrationDeadline + "T23:59:59+07:00",
                ).getTime()) /
                86400000,
            ),
          )
        : 0,
      status: r.status,
    }));
    const vnpayTransactions = paid.map((p) => {
      let raw: any = {};
      try {
        raw = JSON.parse(p.rawResponse || "{}");
      } catch {}
      return {
        transactionCode: p.vnpayTransactionCode || String(p.id),
        studentName: p.registration?.student?.fullName || "",
        className:
          classes.find(
            (c) => Number(c.id) === Number(p.registration?.student?.classId),
          )?.name || "",
        parentName: p.registration?.parent?.fullName || "",
        parentPhone: p.registration?.parent?.phone || "",
        packageName: p.registration?.period?.name || "",
        amount: Number(p.amount),
        paymentMethod: "VNPAY",
        paidAt: p.paidAt.toISOString(),
        bankRef: raw.vnp_BankTranNo || "",
        status: "MATCHED" as const,
      };
    });
    const schools = await this.childRepo.manager.query(
      "SELECT name FROM schools WHERE id = $1",
      [schoolId || 1],
    );
    return {
      schoolName: schools[0]?.name || "",
      period: {
        month,
        year,
        periodName: "Tháng " + month + "/" + year,
        daysInMonth: null,
        serviceFeePerDay: null,
      },
      collectionSummary: {
        expectedRevenue,
        collectedRevenue,
        pendingDebtAmount,
        collectionRate: rate(collectedRevenue, expectedRevenue),
        isTargetReached:
          expectedRevenue > 0 && collectedRevenue >= expectedRevenue,
        targetRate: null,
        totalRegisteredStudents: activeRegs.length,
        paidStudents: paidRegs.length,
        pendingStudents: pendingRegs.length,
      },
      attendanceReconciliation: {
        totalExcusedAbsences: 0,
        refundPerSnack: null,
        totalRefundAmount: null,
        creditBalanceAppliedNextMonth: null,
        reconciliationStudents: [],
      },
      costStructure: {
        ingredientCost70Pct: {
          percentage: null,
          amount: null,
          description: "Chưa có sổ chi phí nguyên liệu",
        },
        serviceCost20Pct: {
          percentage: null,
          amount: null,
          description: "Chưa có sổ chi phí dịch vụ",
        },
        paymentFeeAndAdmin10Pct: {
          percentage: null,
          amount: null,
          description: "Chưa có dữ liệu phí đối soát",
        },
        netOperatingSurplus: null,
      },
      gradeBreakdown,
      agingDebts,
      vnpayTransactions,
    };
  }

  /**
   * Helper: Sinh danh sách đăng ký thực tế khi DB chưa có đủ bản ghi demo
   */

  /**
   * Gửi tin nhắn đôn đốc phụ huynh đóng phí dịch vụ ăn xế (SMS / App Push)
   */
  async sendDebtReminder(dto: SendDebtReminderDto, userId: number) {
    const ids = [...new Set(dto.registrationIds)];
    let remindedCount = 0;
    for (const id of ids) {
      const reg = await this.registrationRepo.findOne({
        where: { id },
        relations: ["period", "student"],
      });
      if (!reg || reg.status !== "PENDING" || !reg.parentId) continue;
      await this.registrationRepo.manager.query(
        "INSERT INTO notifications(user_id,title,content,type) VALUES ($1,$2,$3,$4)",
        [
          reg.parentId,
          "Nhắc thanh toán dịch vụ ăn phụ",
          dto.customMessage ||
            (reg.student?.fullName || "") + " · " + (reg.period?.name || ""),
          "PAYMENT_REMINDER",
        ],
      );
      remindedCount++;
    }
    return {
      success: true,
      remindedCount,
      channel: "APP_PUSH",
      message:
        "Đã lưu " +
        remindedCount +
        " thông báo nhắc phí trong tài khoản phụ huynh.",
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Xuất báo cáo tài chính quyết toán phục vụ cơ quan thuế và họp phụ huynh
   */
  async exportFinancialReport(query?: QuerySnackRevenueDto) {
    const report = await this.getSnackRevenueReport(query);

    return {
      reportTitle: "BÁO CÁO DOANH THU & QUYẾT TOÁN TÀI CHÍNH DỊCH VỤ ĂN XẾ",
      financialPeriod: `Tháng ${report.period.month}/${report.period.year}`,
      issuedBy: report.schoolName,
      issuedAt: new Date().toISOString(),
      report,
    };
  }
}
import { currentStudent, currentYearDate } from '../../academic-years/current-year-scope';
import { activeAcademicYear } from '../../classes/active-academic-year';
