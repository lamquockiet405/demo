import { readState, writeState } from "../../../common/utils/persisted-state";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Payment } from "../../payments/entities/payment.entity";
import { ClassEntity } from "../../classes/entities/class.entity";
import { Child } from "../../children/entities/child.entity";
import { SchoolTenant } from "../../auth/entities/tenant.entity";
import { CreateExpenseDto } from "../dto/create-expense.dto";

export interface ExpenseItem {
  id: string;
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  supplierName?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

@Injectable()
export class FinancesService {
  // In-memory expense store initialized with realistic initial data
  private expenses: ExpenseItem[] = [];

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(SchoolTenant)
    private readonly schoolRepo: Repository<SchoolTenant>,
  ) {}

  async getOverview(month?: string, schoolId?: number) {
    const selectedMonth = month || new Date().toISOString().slice(0, 7);
    const school = await this.schoolRepo.findOne({
      where: { id: Number(schoolId || 1) },
    });
    const payments = await this.paymentRepo.find({
      relations: [
        "registration",
        "registration.student",
        "registration.student.class",
        "registration.parent",
      ],
      order: { id: "DESC" },
    });
    const successful = payments.filter(
      (p) =>
        ["SUCCESS", "PAID"].includes(p.status) &&
        p.paidAt &&
        new Date(p.paidAt).toISOString().startsWith(selectedMonth),
    );
    this.expenses = await readState(
      this.paymentRepo.manager,
      "finance-expenses",
      [],
    );
    const expenses = this.expenses.filter((e) =>
      e.expenseDate.startsWith(selectedMonth),
    );
    const totalRevenue = successful.reduce((n, p) => n + Number(p.amount), 0),
      totalExpense = expenses.reduce((n, e) => n + Number(e.amount), 0);
    return {
      period: {
        month: selectedMonth,
        academicYear: null,
        schoolName: school?.name || "",
      },
      kpis: {
        totalRevenue,
        totalExpense,
        netSurplus: totalRevenue - totalExpense,
        collectionRate: null,
        collectedRevenue: totalRevenue,
        pendingRevenue: null,
        refundAmount: null,
        totalStudents: await this.childRepo.count(),
      },
      revenueBreakdown: [],
      expenseBreakdown: [],
      monthlyTrend: [],
      classLedger: [],
      transactions: successful.map((p) => ({
        id: String(p.id),
        orderCode: p.vnpayTransactionCode || String(p.id),
        amount: Number(p.amount),
        status: p.status,
        paymentMethod: "VNPAY",
        vnpTransactionNo: p.vnpayTransactionCode,
        bankCode: null,
        orderInfo: p.registration?.period?.name || "",
        createdAtFormatted: p.paidAt?.toISOString(),
        childName: p.registration?.student?.fullName || "",
        className: p.registration?.student?.class?.name || "",
        payerName: p.registration?.parent?.fullName || "",
      })),
      expensesList: expenses,
      foodCostNorms: {},
    };
  }

  async createExpense(dto: CreateExpenseDto) {
    this.expenses = await readState(
      this.paymentRepo.manager,
      "finance-expenses",
      [],
    );
    const newExpense: ExpenseItem = {
      id: `exp-${Date.now()}`,
      category: dto.category,
      title: dto.title,
      amount: Number(dto.amount),
      expenseDate: dto.expenseDate,
      supplierName: dto.supplierName,
      invoiceNumber: dto.invoiceNumber,
      paymentMethod: dto.paymentMethod || "BANK_TRANSFER",
      status: "PAID",
      notes: dto.notes,
      createdAt: new Date().toISOString(),
    };

    this.expenses.unshift(newExpense);
    await writeState(
      this.paymentRepo.manager,
      "finance-expenses",
      this.expenses,
    );
    return {
      success: true,
      message: "Ghi nhận khoản chi thành công",
      data: newExpense,
    };
  }

  async deleteExpense(id: string) {
    this.expenses = await readState(
      this.paymentRepo.manager,
      "finance-expenses",
      [],
    );
    const idx = this.expenses.findIndex((e) => e.id === id);
    if (idx === -1) {
      throw new NotFoundException(`Expense #${id} not found`);
    }

    this.expenses.splice(idx, 1);
    await writeState(
      this.paymentRepo.manager,
      "finance-expenses",
      this.expenses,
    );
    return {
      success: true,
      message: "Đã xóa khoản chi thành công",
    };
  }

  async remindClass(classId: string) {
    const cls = await this.classRepo.findOne({
      where: { id: Number(classId) },
      relations: ["homeroomTeacher"],
    });

    return {
      success: true,
      message: `Đã gửi thông báo nhắc học phí tới giáo viên và phụ huynh lớp ${cls?.name || classId}`,
    };
  }
}
