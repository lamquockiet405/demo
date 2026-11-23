import { normalizeSearch } from '../../common/utils/search';
import { currentStudent, currentYearDate } from '../academic-years/current-year-scope';
import { resolveListYear } from '../academic-years/resolve-list-year';
import { SerializedWrite } from '../../common/utils/serialized-write';
import { readState, writeState } from "../../common/utils/persisted-state";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Raw, Repository } from "typeorm";
import { SnackServicePeriod } from "./entities/snack-service-period.entity";
import { SnackRegistration } from "./entities/snack-registration.entity";
import { Child } from "../children/entities/child.entity";
import { CreateSnackServicePeriodDto } from "./dto/create-snack-service-period.dto";
import { UpdateSnackServiceDto } from "./dto/update-snack-service.dto";
import { RegisterSnackServiceDto } from "./dto/register-snack-service.dto";

export interface SnackMenuDayItem {
  dayOfWeek: number;
  dayLabel: string;
  servingTime: string;
  mainDish: string;
  drinkItem: string;
  fruitOrSide: string;
  caloriesKcal: number;
  proteinG: number;
  calciumMg: number;
  allergenTags: string[];
  nutritionNote?: string;
}

@Injectable()
export class SnackServicesService implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.periodRepo.query(`
        ALTER TABLE snack_service_periods DROP CONSTRAINT IF EXISTS snack_service_periods_status_check;
        ALTER TABLE snack_service_periods ADD CONSTRAINT snack_service_periods_status_check CHECK (status::text = ANY (ARRAY['OPEN'::text, 'CLOSED'::text, 'LOCKED'::text, 'PAYMENT_LOCKED'::text]));
        ALTER TABLE snack_service_periods ADD COLUMN IF NOT EXISTS week_number INT;
        ALTER TABLE snack_service_periods ADD COLUMN IF NOT EXISTS is_payment_locked BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      await this.migrateLegacyMonthlyPeriods();
    } catch (err: any) {
      // safe fallback if already altered
    }
  }

  /** Chuyển dữ liệu gói cũ theo tháng sang đúng một tuần phục vụ. */
  private async migrateLegacyMonthlyPeriods() {
    const periods = await this.periodRepo.find({ order: { id: "ASC" } });
    for (const period of periods) {
      const start = new Date(`${period.startDate}T12:00:00`);
      const end = new Date(`${period.endDate}T12:00:00`);
      const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      if (!Number.isFinite(spanDays) || spanDays <= 7) continue;

      const monday = new Date(start);
      const day = monday.getDay();
      monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      const sundayBefore = new Date(monday);
      sundayBefore.setDate(monday.getDate() - 1);
      const iso = (value: Date) => value.toISOString().slice(0, 10);
      const weekNumber = period.weekNumber || Math.ceil(start.getDate() / 7);
      const weeks = Math.max(1, Math.ceil(this.servingDays(period.startDate, period.endDate) / 5));
      const weeklyFee = Math.round(Number(period.feeAmount || 0) / weeks);

      period.startDate = iso(monday);
      period.endDate = iso(friday);
      period.registrationDeadline = iso(sundayBefore);
      period.feeAmount = weeklyFee;
      period.weekNumber = weekNumber;
      period.name = period.name
        .replace(/Tháng\s*\d{1,2}\s*\/\s*\d{4}/gi, `Tuần ${weekNumber}`)
        .replace(/Tuần\s*\d+/gi, `Tuần ${weekNumber}`);
      if (!/Tuần\s*\d+/i.test(period.name)) {
        period.name = `${period.name} - Tuần ${weekNumber}`;
      }
      const saved = await this.periodRepo.save(period);
      const currentOptions = await this.options(Number(saved.id));
      await this.saveOptions(Number(saved.id), {
        ...currentOptions,
        billingCycle: "WEEKLY",
        servingDays: 5,
        pricePerUnit: weeklyFee / 5,
        pricePerUnitPerDay: weeklyFee / 5,
      });
    }
  }

  private async options(id: number): Promise<any> {
    return readState(this.periodRepo.manager, `snack-period:${id}`, {});
  }

  private async saveOptions(id: number, patch: any) {
    await writeState(this.periodRepo.manager, `snack-period:${id}`, {
      ...(await this.options(id)),
      ...patch,
    });
  }

  private async requireWeeklyMenu(startDate: string, endDate: string) {
    const [menu] = await this.periodRepo.manager.query(
      `SELECT id
         FROM menus
        WHERE week_start_date = $1
          AND week_end_date = $2
          AND status NOT IN ('REJECTED', 'ARCHIVED')
        ORDER BY id DESC
        LIMIT 1`,
      [startDate, endDate],
    );
    if (!menu) {
      throw new BadRequestException(
        `Chưa có thực đơn tuần tương ứng (${startDate} đến ${endDate}). Vui lòng tạo và lưu thực đơn tuần trước khi tạo dịch vụ ăn xế.`,
      );
    }
  }

  private validateWeeklyPeriod(startDate: string, endDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new BadRequestException("Tuần phục vụ phải dùng ngày hợp lệ theo định dạng YYYY-MM-DD.");
    }
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (!Number.isFinite(days) || days !== 4 || start.getUTCDay() !== 1 || end.getUTCDay() !== 5) {
      throw new BadRequestException("Tuần phục vụ phải bắt đầu từ Thứ Hai và kết thúc vào Thứ Sáu.");
    }
  }

  private servingDays(start: string, end: string, months?: string[]): number {
    const cursor = new Date(start + "T00:00:00Z"),
      last = new Date(end + "T00:00:00Z");
    if (
      !Number.isFinite(cursor.getTime()) ||
      !Number.isFinite(last.getTime()) ||
      last < cursor
    )
      throw new BadRequestException("Khoảng ngày phục vụ không hợp lệ");
    let count = 0;
    while (cursor <= last) {
      if (
        cursor.getUTCDay() !== 0 &&
        cursor.getUTCDay() !== 6 &&
        (!months?.length || months.includes(cursor.toISOString().slice(0, 7)))
      )
        count++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }

  constructor(
    @InjectRepository(SnackServicePeriod)
    private readonly periodRepo: Repository<SnackServicePeriod>,
    @InjectRepository(SnackRegistration)
    private readonly regRepo: Repository<SnackRegistration>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) { }

  isNutritionistOnly(user?: any): boolean {
    if (!user) return false;
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) =>
        typeof r === "string"
          ? r.toUpperCase()
          : String(r?.code || r?.name || "").toUpperCase(),
      )
      : user.role
        ? [String(user.role).toUpperCase()]
        : [];
    const hasManager = roles.some((r) =>
      [
        "SUPER_ADMIN",
        "PRINCIPAL",
        "SCHOOL_MANAGER",
        "SCHOOL_MANAGEMENT",
      ].includes(r),
    );
    return !hasManager && roles.includes("NUTRITIONIST");
  }

  normalizeBreakfastText(text?: string): string {
    return text || "";
  }

  getDefaultSnackMenuSchedule(periodName?: string): SnackMenuDayItem[] {
    return [
      {
        dayOfWeek: 2,
        dayLabel: "Thứ Hai",
        servingTime: "16:30 - 17:00",
        mainDish: "Cháo cá, bí đỏ",
        drinkItem: "Nước chanh dây, hạt chia, mật ong",
        fruitOrSide: "Chuối Laba chín cây",
        caloriesKcal: 125,
        proteinG: 5.8,
        calciumMg: 45,
        allergenTags: ["Hải sản"],
      },
      {
        dayOfWeek: 3,
        dayLabel: "Thứ Ba",
        servingTime: "16:30 - 17:00",
        mainDish: "Hủ tiếu nam vang (mực, tim, gan, tôm)- cần tây",
        drinkItem: "Sâm bí đao, hạt chia, đường phèn",
        fruitOrSide: "Dưa hấu cắt lát",
        caloriesKcal: 135,
        proteinG: 6.2,
        calciumMg: 50,
        allergenTags: ["Hải sản"],
      },
      {
        dayOfWeek: 4,
        dayLabel: "Thứ Tư",
        servingTime: "16:30 - 17:00",
        mainDish: "Miến gà cần tây, cà rốt",
        drinkItem: "Nước ép cam",
        fruitOrSide: "Thanh long ruột đỏ",
        caloriesKcal: 128,
        proteinG: 5.5,
        calciumMg: 48,
        allergenTags: [],
      },
      {
        dayOfWeek: 5,
        dayLabel: "Thứ Năm",
        servingTime: "16:30 - 17:00",
        mainDish: "Bánh mexico thịt",
        drinkItem: "Sữa trái cây",
        fruitOrSide: "Táo Envy cắt lát",
        caloriesKcal: 145,
        proteinG: 6.5,
        calciumMg: 85,
        allergenTags: ["Gluten", "Sữa"],
      },
      {
        dayOfWeek: 6,
        dayLabel: "Thứ Sáu",
        servingTime: "16:30 - 17:00",
        mainDish: "Bánh bao xá xíu",
        drinkItem: "Sữa đậu xanh",
        fruitOrSide: "Đu đủ chín đỏ",
        caloriesKcal: 145,
        proteinG: 6.8,
        calciumMg: 80,
        allergenTags: ["Gluten"],
      },
    ];
  }

  async getMenuScheduleForPeriod(
    periodId: number,
    periodName?: string,
  ): Promise<SnackMenuDayItem[]> {
    const period = await this.periodRepo.findOne({ where: { id: periodId } });
    if (!period) return [];

    // Nguồn chính là thực đơn tuần đã tạo trong module Menus. Như vậy gói
    // dịch vụ và thực đơn không thể hiển thị lệch tuần hoặc lệch món xế.
    const rows = await this.periodRepo.manager.query(
      `SELECT md.date,
              md.day_of_week AS "dayOfWeek",
              d.name AS "dishName",
              c.code AS "categoryCode",
              COALESCE(dn.energy_kcal, 0) AS "caloriesKcal",
              COALESCE(dn.protein_g, 0) AS "proteinG",
              COALESCE(dn.calcium_mg, 0) AS "calciumMg"
       FROM menus m
       JOIN menu_versions mv ON mv.menu_id = m.id
       JOIN menu_days md ON md.menu_version_id = mv.id
       JOIN menu_meals mm ON mm.menu_day_id = md.id
       JOIN menu_dishes mds ON mds.menu_meal_id = mm.id
       JOIN dishes d ON d.id = mds.dish_id
       LEFT JOIN dish_categories c ON c.id = d.category_id
       LEFT JOIN dish_nutrition dn ON dn.dish_id = d.id
       WHERE m.week_start_date = $1
         AND m.week_end_date = $2
         AND m.status IN ('PUBLISHED', 'ACTIVE', 'APPROVED', 'DRAFT')
         AND mv.version_number = (
           SELECT MAX(mv2.version_number) FROM menu_versions mv2 WHERE mv2.menu_id = m.id
         )
         AND mm.meal_type IN ('AFTERNOON_SNACK', 'LATE_SNACK')
       ORDER BY md.day_of_week ASC, mds.display_order ASC, mds.id ASC`,
      [period.startDate, period.endDate],
    );

    if (rows.length > 0) {
      const byDay = new Map<number, any[]>();
      for (const row of rows) {
        const day = Number(row.dayOfWeek);
        const list = byDay.get(day) || [];
        list.push(row);
        byDay.set(day, list);
      }
      const dayLabels = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu"];
      return [...byDay.entries()].map(([dayOfWeek, dishes]) => {
        const names = dishes.map((dish) => String(dish.dishName));
        const drink = dishes.find(
          (dish) =>
            dish.categoryCode === "DRINK" ||
            String(dish.dishName).toLowerCase().startsWith("nước ") ||
            String(dish.dishName).toLowerCase().startsWith("sâm ") ||
            String(dish.dishName).toLowerCase().startsWith("sữa "),
        );
        const side = dishes.find((dish) => ["DESSERT", "FRUIT"].includes(dish.categoryCode));
        const main =
          dishes.find(
            (dish) =>
              dish.categoryCode === "SNACK_AFTERNOON" ||
              (!["DRINK", "DESSERT", "FRUIT"].includes(dish.categoryCode) &&
                !String(dish.dishName).toLowerCase().startsWith("nước ") &&
                !String(dish.dishName).toLowerCase().startsWith("sâm ") &&
                !String(dish.dishName).toLowerCase().startsWith("sữa ")),
          ) || dishes[0];
        return {
          dayOfWeek,
          dayLabel: dayLabels[dayOfWeek - 2] || `Ngày ${dayOfWeek}`,
          servingTime: "16:30 - 17:00",
          mainDish: main?.dishName || names[0] || "",
          drinkItem: "",
          fruitOrSide: side?.dishName || "",
          caloriesKcal: Math.round(dishes.reduce((sum, dish) => sum + Number(dish.caloriesKcal || 0), 0)),
          proteinG: Math.round(dishes.reduce((sum, dish) => sum + Number(dish.proteinG || 0), 0) * 10) / 10,
          calciumMg: Math.round(dishes.reduce((sum, dish) => sum + Number(dish.calciumMg || 0), 0) * 10) / 10,
          allergenTags: [],
          nutritionNote: periodName || undefined,
        };
      });
    }

    const savedSchedule = (await this.options(Number(periodId))).menuSchedule;
    return savedSchedule && savedSchedule.length > 0
      ? savedSchedule
      : this.getDefaultSnackMenuSchedule(periodName);
  }

  async findAll(
    currentUser?: any,
    query?: {
      search?: string;
      status?: string;
      grade?: string;
      academicYearId?: number;
      allAcademicYears?: boolean;
    },
  ) {
    const isNutritionist = this.isNutritionistOnly(currentUser);
    const schoolId = Number(currentUser?.tenantId) || 1;
    const academicYearId = await resolveListYear(
      this.periodRepo.manager,
      schoolId,
      query || {},
    );

    const whereClause: any = {};
    if (academicYearId) {
      const [year] = await this.periodRepo.manager.query(
        `SELECT start_date::text AS start_date, end_date::text AS end_date FROM academic_year WHERE id = $1`,
        [academicYearId],
      );
      if (year) {
        whereClause.startDate = Raw(
          (alias) => `${alias} >= :yearStartDate AND ${alias} <= :yearEndDate`,
          { yearStartDate: year.start_date, yearEndDate: year.end_date },
        );
      }
    } else if (academicYearId === null) {
      whereClause.id = -1;
    }

    const periods = await this.periodRepo.find({
      where: whereClause,
      relations: ["registrations"],
      order: { startDate: "DESC" },
    });

    const totalStudents = await this.childRepo.count({ where: { id: currentStudent(schoolId) } });

    const mappedItems = await Promise.all(
      periods.map(async (p) => {
        const options = await this.options(Number(p.id));
        const regCount = (p.registrations || []).length;
        const paidCount = (p.registrations || []).filter(
          (r) => r.status === "PAID",
        ).length;
        const targetCount = totalStudents;
        const percentage = Math.min(
          100,
          Math.round((regCount / (targetCount || 1)) * 100),
        );
        const displayName = this.normalizeBreakfastText(p.name);
        const menuSchedule = await this.getMenuScheduleForPeriod(
          Number(p.id),
          displayName,
        );
        const weeklyPrice = Number(p.feeAmount);
        const pricePerUnit =
          options.pricePerUnitPerDay ?? options.pricePerUnit ?? null;

        return {
          ...options,
          id: String(p.id),
          name: displayName,
          description: this.normalizeBreakfastText(
            options.description ?? options.nutritionNotes ?? "",
          ),
          serviceType: options.serviceType || "AFTER_SCHOOL_SNACK",
          billingCycle: "WEEKLY",
          pricePerUnit,
          weeklyPrice,
          feeAmount: weeklyPrice,
          startDate: p.startDate,
          endDate: p.endDate,
          registrationDeadline: p.registrationDeadline,
          appliedGrade: options.isWholeSchool
            ? "Tất cả các khối"
            : (options.appliedGrades || []).join(", "),
          appliedGrades: options.appliedGrades || [],
          servingDays: options.servingDays ?? null,
          registrationPeriod: `${p.startDate} ~ ${p.endDate}`,
          registeredCount: isNutritionist ? 0 : regCount,
          targetCount,
          percentage: isNutritionist ? 0 : percentage,
          progressNote: isNutritionist
            ? "Chế độ Chuyên gia Dinh dưỡng (Chỉ lên thực đơn ăn xế)"
            : `Đã có ${regCount}/${targetCount} bé tham gia (${paidCount} bé đã đóng tiền)`,
          weekNumber: p.weekNumber ?? options.weekNumber ?? null,
          isPaymentLocked:
            p.isPaymentLocked ||
            p.status === "LOCKED" ||
            p.status === "PAYMENT_LOCKED",
          status: (p.isPaymentLocked || p.status === "LOCKED" || p.status === "PAYMENT_LOCKED"
            ? "LOCKED"
            : p.status === "CLOSED" && options.status === "DRAFT"
              ? "DRAFT"
              : p.status) as "OPEN" | "UPCOMING" | "CLOSED" | "DRAFT" | "LOCKED",
          statusLabel:
            p.isPaymentLocked || p.status === "LOCKED" || p.status === "PAYMENT_LOCKED"
              ? "Đã khóa đóng tiền"
              : p.status === "OPEN"
                ? "Đang mở đóng tiền"
                : p.status === "UPCOMING"
                  ? "Sắp mở"
                  : "Đã đóng gói",
          badges: [],
          isActive: p.status === "OPEN" && !p.isPaymentLocked,
          enrolledCount: isNutritionist ? 0 : regCount,
          paidCount: isNutritionist ? 0 : paidCount,
          totalRevenue: isNutritionist
            ? 0
            : paidCount * (Number(p.feeAmount) || 0),
          menuSchedule,
          hidePaymentInfo: isNutritionist,
        };
      }),
    );

    const items = mappedItems.filter((item) => {
      if (
        query?.search &&
        !normalizeSearch(item.name).includes(normalizeSearch(query.search))
      ) {
        return false;
      }
      if (
        query?.status &&
        query.status !== "ALL" &&
        item.status !== query.status
      ) {
        return false;
      }
      if (
        query?.grade &&
        query.grade !== "ALL" &&
        !item.isWholeSchool &&
        !item.appliedGrades.includes(query.grade)
      )
        return false;
      return true;
    });

    const totalRegistered = items.reduce(
      (acc, i) => acc + i.registeredCount,
      0,
    );
    const totalCollected = items.reduce((acc, i) => acc + i.totalRevenue, 0);
    const expectedMonthly = items.reduce(
      (acc, i) => acc + i.targetCount * i.monthlyEstimatedPrice,
      0,
    );

    const summary = {
      activeBatches: {
        total: items.length,
        open: items.filter((i) => i.status === "OPEN" && !i.isPaymentLocked).length,
        locked: items.filter((i) => i.isPaymentLocked || i.status === "LOCKED").length,
        upcoming: items.filter((i) => i.status === "UPCOMING").length,
        closed: items.filter((i) => i.status === "CLOSED").length,
      },
      studentParticipation: {
        registered: isNutritionist ? 0 : totalRegistered,
        total: totalStudents,
        percentage:
          !isNutritionist && totalStudents > 0
            ? Math.min(100, Math.round((totalRegistered / totalStudents) * 100))
            : 0,
        remaining: Math.max(0, (totalStudents || 14) - totalRegistered),
      },
      revenue: {
        expectedMonthly: isNutritionist ? 0 : expectedMonthly,
        collected: isNutritionist ? 0 : totalCollected,
        collectedPercentage:
          !isNutritionist && expectedMonthly > 0
            ? Math.round((totalCollected / expectedMonthly) * 100)
            : isNutritionist
              ? 0
              : null,
      },
      satisfaction: {
        ratePercent: null,
        ratingScore: null,
        totalReviews: 0,
      },
    };

    return {
      success: true,
      data: items,
      items,
      summary,
      totalCount: items.length,
      activePeriod: items.find((i) => i.status === "OPEN") || items[0] || null,
      hidePaymentInfo: isNutritionist,
    };
  }

  async findOne(id: number, currentUser?: any) {
    const isNutritionist = this.isNutritionistOnly(currentUser);
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: [
        "registrations",
        "registrations.student",
        "registrations.student.class",
        "registrations.student.allergies",
        "registrations.student.allergies.allergen",
      ],
    });

    if (!p) throw new NotFoundException("Không tìm thấy gói dịch vụ ăn xế");

    const registrations = isNutritionist
      ? []
      : (p.registrations || []).map((r) => {
        const allergyList = (r.student?.allergies || [])
          .filter((a) => a.isActive !== false)
          .map((a) => a.allergen?.name || a.customAllergenName || a.allergen?.code)
          .filter(Boolean);
        return {
          id: String(r.id),
          studentId: String(r.studentId),
          studentName: r.student?.fullName || "Học sinh",
          studentCode: r.student?.studentCode || "",
          className: r.student?.class?.name || "",
          status: r.status,
          registeredAt: r.registeredAt ? r.registeredAt.toISOString() : null,
          amount: p.feeAmount,
          hasAllergy: allergyList.length > 0,
          allergens: allergyList,
        };
      });

    const options = await this.options(Number(p.id));
    const pricePerUnit =
      options.pricePerUnitPerDay ?? options.pricePerUnit ?? null;
    const menuSchedule = await this.getMenuScheduleForPeriod(
      Number(p.id),
      p.name,
    );

    const periodData = {
      id: String(p.id),
      tenantId: null,
      name: this.normalizeBreakfastText(p.name),
      description: this.normalizeBreakfastText(
        options.description ?? options.nutritionNotes ?? "",
      ),
      serviceType: "AFTER_SCHOOL_SNACK",
      billingCycle: "WEEKLY",
      pricePerUnit,
      startDate: p.startDate,
      endDate: p.endDate,
      availableFrom: p.startDate,
      availableTo: p.endDate,
      registrationDeadline: p.registrationDeadline,
      feeAmount: Number(p.feeAmount),
      isActive: p.status === "OPEN",
      status:
        p.status === "CLOSED" && options.status === "DRAFT"
          ? "DRAFT"
          : p.status,
      registrations,
      menuSchedule,
      hidePaymentInfo: isNutritionist,
    };

    return {
      success: true,
      ...options,
      ...periodData,
      data: { ...options, ...periodData },
    };
  }

  @SerializedWrite('snack-period', 'periodRepo')
  async createPeriod(dto: CreateSnackServicePeriodDto) {
    // 1. Luồng ngoại lệ: Ngày kết thúc nhận đơn <= ngày bắt đầu nhận đơn
    if (dto.registrationStart && dto.registrationEnd) {
      if (
        new Date(dto.registrationEnd).getTime() <=
        new Date(dto.registrationStart).getTime()
      ) {
        throw new BadRequestException("Ngày kết thúc phải sau ngày bắt đầu");
      }
    }

    // 2. Luồng ngoại lệ: Chưa chọn ít nhất 1 tháng phục vụ
    if (dto.serviceMonths !== undefined && dto.serviceMonths.length === 0) {
      throw new BadRequestException("Vui lòng chọn ít nhất 1 tháng phục vụ");
    }
    if (!dto.serviceMonths?.length && (!dto.startDate || !dto.endDate)) {
      throw new BadRequestException("Vui lòng chọn ít nhất 1 tháng phục vụ");
    }

    // 3. Luồng ngoại lệ: Chọn "Giới hạn chỗ" nhưng không nhập chỉ tiêu
    if (
      dto.capacityMode === "LIMITED" &&
      (!dto.totalQuota || dto.totalQuota <= 0)
    ) {
      throw new BadRequestException("Vui lòng nhập tổng chỉ tiêu");
    }

    // 4. Tính toán thời gian bắt đầu và kết thúc phục vụ
    let startDate = dto.startDate;
    let endDate = dto.endDate;

    if (dto.serviceMonths && dto.serviceMonths.length > 0) {
      const sortedMonths = [...dto.serviceMonths].sort();
      startDate = `${sortedMonths[0]}-01`;
      const [yearStr, monthStr] =
        sortedMonths[sortedMonths.length - 1].split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${sortedMonths[sortedMonths.length - 1]}-${String(lastDay).padStart(2, "0")}`;
    }

    if (!startDate) {
      startDate =
        dto.registrationStart || new Date().toISOString().slice(0, 10);
    }
    if (!endDate) {
      endDate =
        dto.registrationEnd ||
        new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    }

    if (!dto.serviceMonths?.length) {
      this.validateWeeklyPeriod(startDate, endDate);
    }

    // Dịch vụ ăn xế luôn phải gắn với một thực đơn tuần đã tồn tại.
    await this.requireWeeklyMenu(startDate, endDate);

    // 5. Điều kiện tiên quyết: Không tồn tại đợt đăng ký nào đang OPEN cùng tháng phục vụ (chỉ chặn khi không có periodCode riêng biệt hoặc trùng tên gói)
    const isDraft = dto.status === "DRAFT" || dto.status === "CLOSED";
    if (!isDraft) {
      const openPeriods = await this.periodRepo.find({
        where: { status: "OPEN" },
      });
      const hasConflict = openPeriods.some((p) => {
        const dateOverlap = p.startDate <= endDate && p.endDate >= startDate;
        if (!dateOverlap) return false;
        return (
          Boolean(dto.name) &&
          p.name?.trim().toLowerCase() === dto.name?.trim().toLowerCase()
        );
      });
      if (hasConflict) {
        throw new BadRequestException(
          `Đã tồn tại gói dịch vụ "${dto.name || ''}" đang mở trong khoảng thời gian này. Vui lòng đặt tên khác hoặc đóng đợt cũ trước khi tạo đợt mới.`,
        );
      }
    }

    // 6. Tên gói, hạn chót nhận đơn, và tính toán phí
    const name =
      dto.name ||
      (dto.serviceMonths?.length
        ? `Dịch vụ ăn xế Tháng ${dto.serviceMonths.join(", ")}`
        : dto.periodCode
          ? `Dịch vụ ăn xế ${dto.periodCode}`
          : "Dịch vụ ăn xế");

    const registrationDeadline =
      dto.registrationEnd ||
      dto.registrationDeadline ||
      dto.registrationStart ||
      startDate;

    const servingDays = this.servingDays(startDate, endDate, dto.serviceMonths);
    const pricePerDay =
      dto.pricePerUnitPerDay !== undefined
        ? Number(dto.pricePerUnitPerDay)
        : undefined;
    const feeAmount =
      dto.feeAmount !== undefined
        ? Number(dto.feeAmount)
        : pricePerDay == null
          ? NaN
          : pricePerDay * servingDays;
    if (!Number.isFinite(feeAmount) || feeAmount < 0)
      throw new BadRequestException("Nhập mức phí hoặc đơn giá phục vụ hợp lệ");

    // 7. DB Status: Bản ghi snack_service_periods hỗ trợ OPEN, CLOSED, LOCKED
    const statusVal =
      dto.status === "LOCKED" || dto.status === "PAYMENT_LOCKED"
        ? "LOCKED"
        : isDraft
          ? "CLOSED"
          : "OPEN";
    const isLocked =
      dto.isPaymentLocked ?? (statusVal === "LOCKED");

    const period = this.periodRepo.create({
      name,
      startDate,
      endDate,
      registrationDeadline,
      feeAmount,
      status: statusVal,
      weekNumber: dto.weekNumber ?? null,
      isPaymentLocked: isLocked,
    });

    const saved = await this.periodRepo.save(period);
    await this.saveOptions(Number(saved.id), {
      ...dto,
      servingDays,
      description: dto.nutritionNotes || "",
    });

    return {
      success: true,
      message: isDraft
        ? `Đã lưu bản nháp gói "${saved.name}" thành công!`
        : `Đã khởi tạo gói "${saved.name}" thành công và mở cổng cho phụ huynh đăng ký!`,
      data: {
        ...saved,
        periodCode: dto.periodCode,
        appliedGrades: dto.appliedGrades,
        isWholeSchool: dto.isWholeSchool,
        registrationStart: dto.registrationStart,
        registrationEnd: dto.registrationEnd,
        serviceMonths: dto.serviceMonths,
        pricePerUnitPerDay: dto.pricePerUnitPerDay,
        capacityMode: dto.capacityMode,
        kitchenCapacity: dto.kitchenCapacity,
        totalQuota: dto.totalQuota,
        quotaPerGrade: dto.quotaPerGrade,
        autoRefundEnabled: dto.autoRefundEnabled,
        autoCloseEnabled: dto.autoCloseEnabled,
        autoCloseThresholdPercent: dto.autoCloseThresholdPercent,
        nutritionNotes: dto.nutritionNotes,
        status: isDraft ? "DRAFT" : saved.status,
      },
    };
  }

  async updatePeriod(id: number, dto: UpdateSnackServiceDto) {
    // 1. Kiểm tra sự tồn tại của đợt dịch vụ
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: ["registrations"],
    });
    if (!p) throw new NotFoundException("Không tìm thấy gói dịch vụ ăn xế");

    const paidCount = (p.registrations || []).filter(
      (r) => r.status === "PAID",
    ).length;

    // 2. Điều kiện tiên quyết: Đợt chưa CLOSED (nếu đã đóng, không sửa đơn giá khi đã có đăng ký PAID)
    if (p.status === "CLOSED") {
      const isPriceModified =
        dto.pricePerUnit !== undefined || dto.feeAmount !== undefined;
      if (isPriceModified && paidCount > 0) {
        throw new BadRequestException(
          "Đợt dịch vụ đã đóng và có học sinh đã thanh toán, không thể chỉnh sửa đơn giá",
        );
      }
    }

    // 3. Luồng ngoại lệ: Tên gói để trống
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException("Vui lòng nhập tên gói dịch vụ");
    }

    // 4. Luồng ngoại lệ: Đơn giá nhập âm
    if (
      (dto.pricePerUnit !== undefined && dto.pricePerUnit < 0) ||
      (dto.feeAmount !== undefined && dto.feeAmount < 0)
    ) {
      throw new BadRequestException("Đơn giá không được âm");
    }

    // 5. Luồng ngoại lệ: Ngày kết thúc trước ngày bắt đầu
    const newStartDate = dto.startDate || dto.availableFrom || p.startDate;
    const newEndDate = dto.endDate || dto.availableTo || p.endDate;
    if (
      newStartDate &&
      newEndDate &&
      new Date(newEndDate).getTime() < new Date(newStartDate).getTime()
    ) {
      throw new BadRequestException("Ngày kết thúc phải sau ngày bắt đầu");
    }
    if (dto.startDate || dto.endDate || dto.availableFrom || dto.availableTo) {
      await this.requireWeeklyMenu(newStartDate, newEndDate);
    }

    // 6. Cảnh báo khi giảm đơn giá nếu đã có học sinh thanh toán (PAID)
    let calculatedFee = p.feeAmount;
    if (dto.feeAmount !== undefined) {
      calculatedFee = Number(dto.feeAmount);
    } else if (dto.pricePerUnit !== undefined) {
      calculatedFee =
        Number(dto.pricePerUnit) * this.servingDays(newStartDate, newEndDate);
    }

    let warning: string | undefined = undefined;
    if (paidCount > 0 && calculatedFee < Number(p.feeAmount)) {
      warning = `Đã có ${paidCount} trẻ đã thanh toán. Thay đổi đơn giá sẽ ảnh hưởng đến các kỳ tính phí kế tiếp`;
    }

    // 7. Cập nhật các trường
    if (dto.name !== undefined) p.name = dto.name.trim();
    if (dto.startDate || dto.availableFrom)
      p.startDate = dto.startDate || dto.availableFrom || p.startDate;
    if (dto.endDate || dto.availableTo)
      p.endDate = dto.endDate || dto.availableTo || p.endDate;
    if (dto.registrationDeadline !== undefined) {
      const targetStart = dto.startDate || dto.availableFrom || p.startDate;
      if (targetStart && dto.registrationDeadline) {
        const startD = new Date(`${targetStart}T00:00:00Z`);
        const deadD = new Date(`${dto.registrationDeadline}T00:00:00Z`);
        const diffDays = Math.round((startD.getTime() - deadD.getTime()) / 86400000);
        if (diffDays < 2) {
          throw new BadRequestException("Hạn chót đóng tiền phải trước ngày bắt đầu ít nhất 2 ngày.");
        }
      }
      p.registrationDeadline = dto.registrationDeadline;
    }
    p.feeAmount = calculatedFee;

    if (dto.status !== undefined) {
      p.status = dto.status;
      if (dto.status === "LOCKED" || dto.status === "PAYMENT_LOCKED") {
        p.isPaymentLocked = true;
      } else if (dto.status === "OPEN") {
        p.isPaymentLocked = false;
      }
    } else if (dto.isActive !== undefined) {
      p.status = dto.isActive ? "OPEN" : "CLOSED";
      if (!dto.isActive) p.isPaymentLocked = false;
    }

    if (dto.isPaymentLocked !== undefined) {
      p.isPaymentLocked = dto.isPaymentLocked;
      if (p.isPaymentLocked && p.status === "OPEN") {
        p.status = "LOCKED";
      }
    }

    if (dto.weekNumber !== undefined) {
      p.weekNumber = dto.weekNumber;
    }

    await this.saveOptions(Number(id), {
      ...dto,
      servingDays: this.servingDays(newStartDate, newEndDate),
    });
    const options = await this.options(Number(id));

    delete (p as any).registrations;
    const saved = await this.periodRepo.save(p);

    const pricePerUnit =
      dto.pricePerUnit !== undefined
        ? dto.pricePerUnit
        : (options.pricePerUnitPerDay ?? options.pricePerUnit ?? null);
    const updatedData = {
      id: String(saved.id),
      name: saved.name,
      serviceType: dto.serviceType || "AFTER_SCHOOL_SNACK",
      billingCycle: "WEEKLY",
      pricePerUnit,
      startDate: saved.startDate,
      endDate: saved.endDate,
      availableFrom: saved.startDate,
      availableTo: saved.endDate,
      registrationDeadline: saved.registrationDeadline,
      feeAmount: Number(saved.feeAmount),
      isActive: saved.status === "OPEN",
      status: saved.status,
      description: options.description ?? options.nutritionNotes ?? "",
    };

    return {
      success: true,
      message: "Cập nhật cấu hình gói dịch vụ ăn xế thành công!",
      warning,
      data: updatedData,
    };
  }

  /**
   * CGDD hoặc Hiệu trưởng lên thực đơn ăn xế cho gói dịch vụ
   */
  async updateMenuSchedule(
    id: number,
    payload: { menuSchedule: SnackMenuDayItem[]; description?: string },
  ) {
    const p = await this.periodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException("Không tìm thấy gói dịch vụ ăn xế");

    if (
      !Array.isArray(payload.menuSchedule) ||
      payload.menuSchedule.length === 0
    ) {
      throw new BadRequestException("Vui lòng nhập đầy đủ lịch thực đơn ăn xế");
    }

    await this.saveOptions(Number(id), payload);

    return {
      success: true,
      message: `Đã lưu và cập nhật thực đơn ăn xế cho gói "${p.name}" thành công!`,
      data: {
        id: String(p.id),
        name: p.name,
        menuSchedule: payload.menuSchedule,
      },
    };
  }

  async closePeriod(id: number) {
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: ["registrations"],
    });
    if (!p) throw new NotFoundException("Không tìm thấy kỳ dịch vụ ăn xế");

    const totalCount = (p.registrations || []).length;
    const paidCount = (p.registrations || []).filter(
      (r) => r.status === "PAID",
    ).length;
    const pendingCount = (p.registrations || []).filter(
      (r) => r.status === "PENDING",
    ).length;

    let warning: string | undefined = undefined;
    if (totalCount === 0) {
      warning = "Chưa có phụ huynh nào đăng ký trong đợt này";
    } else if (pendingCount > 0) {
      warning = `Còn ${pendingCount} đơn chờ thanh toán (PENDING). Danh sách chốt phục vụ gồm ${paidCount} học sinh đã thanh toán.`;
    }

    delete (p as any).registrations;
    p.status = "CLOSED";
    const saved = await this.periodRepo.save(p);

    return {
      success: true,
      message: `Đã đóng đợt đăng ký cho '${saved.name}'. Phụ huynh sẽ không thấy gói này nữa.`,
      warning,
      data: {
        id: String(saved.id),
        name: saved.name,
        status: saved.status,
        totalRegistrations: totalCount,
        paidCount,
        pendingCount,
        rosterClosed: true,
      },
    };
  }

  async openPeriod(id: number) {
    const p = await this.periodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException("Không tìm thấy kỳ dịch vụ ăn xế");

    // Kiểm tra xung đột: Không tồn tại đợt đăng ký khác đang OPEN cùng khoảng thời gian
    const openPeriods = await this.periodRepo.find({
      where: { status: "OPEN" },
    });
    const hasConflict = openPeriods.some(
      (op) =>
        Number(op.id) !== Number(p.id) &&
        op.startDate <= p.endDate &&
        op.endDate >= p.startDate,
    );
    if (hasConflict) {
      throw new BadRequestException(
        "Đã tồn tại đợt đăng ký khác đang mở cho tháng phục vụ này. Vui lòng đóng đợt cũ trước khi mở lại đợt này.",
      );
    }

    delete (p as any).registrations;
    p.status = "OPEN";
    const saved = await this.periodRepo.save(p);

    return {
      success: true,
      message: `Đã mở lại đợt đăng ký cho '${saved.name}'. Phụ huynh có thể tiếp tục đăng ký.`,
      data: {
        id: String(saved.id),
        name: saved.name,
        status: saved.status,
      },
    };
  }

  async togglePeriod(id: number) {
    const p = await this.periodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException("Không tìm thấy kỳ dịch vụ ăn xế");

    if (p.status === "OPEN") {
      return this.closePeriod(id);
    } else {
      return this.openPeriod(id);
    }
  }

  async togglePeriodLock(id: number) {
    const p = await this.periodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException("Không tìm thấy gói thực đơn ăn xế");

    const willLock = p.status === "OPEN" && !p.isPaymentLocked;
    p.status = willLock ? "LOCKED" : "OPEN";
    p.isPaymentLocked = willLock;

    delete (p as any).registrations;
    await this.periodRepo.save(p);
    return {
      success: true,
      message: willLock
        ? "Đã khóa dịch vụ, phụ huynh không thể đóng tiền nữa"
        : "Đã mở lại cổng đóng tiền cho gói thực đơn ăn xế",
      data: {
        id: String(p.id),
        name: p.name,
        status: p.status,
        isPaymentLocked: p.isPaymentLocked,
      },
    };
  }

  async getDayboardingSummary() {
    const result = await this.findAll();
    return {
      success: true,
      summary: result.summary,
      services: result.items,
      classes: [],
      students: [],
    };
  }

  async createService(dto: any) {
    const startDate = dto.startDate || new Date().toISOString().slice(0, 10);
    const endDate =
      dto.endDate ||
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const feeAmount =
      dto.feeAmount !== undefined
        ? Number(dto.feeAmount)
        : Number(dto.pricePerUnit) * this.servingDays(startDate, endDate);
    if (!dto.name?.trim() || !Number.isFinite(feeAmount) || feeAmount < 0)
      throw new BadRequestException("Nhập tên và mức phí hợp lệ");

    if (dto.registrationDeadline && startDate) {
      const startD = new Date(`${startDate}T00:00:00Z`);
      const deadD = new Date(`${dto.registrationDeadline}T00:00:00Z`);
      const diffDays = Math.round((startD.getTime() - deadD.getTime()) / 86400000);
      if (diffDays < 2) {
        throw new BadRequestException("Hạn chót đóng tiền phải trước ngày bắt đầu ít nhất 2 ngày.");
      }
    }

    const period = this.periodRepo.create({
      name: dto.name || "Gói Ăn Xế Chiều Mới",
      startDate,
      endDate,
      registrationDeadline: dto.registrationDeadline || endDate,
      feeAmount,
      status:
        dto.status === "CLOSED" || dto.status === "DRAFT" ? "CLOSED" : "OPEN",
    });

    const saved = await this.periodRepo.save(period);
    await this.saveOptions(Number(saved.id), {
      ...dto,
      servingDays: this.servingDays(startDate, endDate),
    });

    return {
      success: true,
      message: "Đã tạo gói dịch vụ ăn xế mới thành công!",
      data: saved,
    };
  }

  async deleteService(id: number) {
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: ["registrations"],
    });
    if (!p) throw new NotFoundException("Không tìm thấy gói dịch vụ ăn xế");

    const paidCount = (p.registrations || []).filter(
      (r) => r.status === "PAID",
    ).length;
    if (paidCount > 0) {
      throw new BadRequestException(
        `Gói "${p.name}" đã có ${paidCount} phụ huynh hoàn tất thanh toán (PAID), không thể xóa. Vui lòng chọn Đóng đợt để lưu trữ đối soát.`,
      );
    }

    delete (p as any).registrations;
    if (typeof (this.periodRepo as any).delete === "function") {
      await (this.periodRepo as any).delete(id);
    } else if (typeof (this.periodRepo as any).remove === "function") {
      await (this.periodRepo as any).remove(p);
    }

    await writeState(this.periodRepo.manager, `snack-period:${id}`, {});

    return {
      success: true,
      message: `Đã xóa gói dịch vụ ăn xế "${p.name}" thành công!`,
    };
  }

  /**
   * Dành cho Phụ huynh: Xem các gói ăn xế đang mở công bố và Lịch Ăn Xế (chỉ hiển thị khi đã đóng tiền PAID)
   */
  async getParentSnackOverview(parentId: number, studentId?: number) {
    const allPeriods = await this.periodRepo.find({
      order: { id: "DESC" },
    });

    let child: Child | null = null;
    try {
      if (studentId) {
        child = await this.childRepo.findOne({
          where: { id: studentId },
          relations: ["class"],
        });
      }
      if (!child && typeof (this.childRepo as any).query === "function") {
        const rows = await this.childRepo.query(
          `SELECT student_id FROM student_parents WHERE parent_id = $1 LIMIT 1`,
          [parentId],
        );
        if (rows?.[0]?.student_id) {
          child = await this.childRepo.findOne({
            where: { id: Number(rows[0].student_id) },
            relations: ["class"],
          });
        }
      }
    } catch {
      // Fallback
    }

    if (!child) {
      const defaultPreviewSchedule = allPeriods.length > 0
        ? await this.getMenuScheduleForPeriod(Number(allPeriods[0].id), allPeriods[0].name)
        : [];
      return {
        hasPaidAnyPackage: false,
        student: null,
        paidPackageName: null,
        publishedPackages: await Promise.all(allPeriods
          .filter((p) => p.status === "OPEN")
          .map(async (p) => ({
            periodId: Number(p.id),
            periodName: this.normalizeBreakfastText(p.name),
            periodStatus: p.status,
            startDate: p.startDate,
            endDate: p.endDate,
            feeAmount: Number(p.feeAmount) || 0,
            description: (p as any).description || "",
            isPaid: false,
            canViewSchedule: true,
            menuSchedule: await this.getMenuScheduleForPeriod(Number(p.id), p.name),
          }))),
        activeSchedule: defaultPreviewSchedule,
      };
    }

    const registrations = await this.regRepo.find({
      where: child ? [{ studentId: child.id }, { parentId }] : [{ parentId }],
      relations: ["period", "student", "student.class"],
      order: { id: "DESC" },
    });

    // Kiểm tra xem phụ huynh đã có ít nhất 1 gói đã thanh toán (PAID) chưa
    const paidRegistrations = registrations.filter((r) => r.status === "PAID");
    const hasPaidAnyPackage = paidRegistrations.length > 0;

    // Danh sách các gói đã công bố (OPEN) hoặc đã đăng ký của phụ huynh
    const publishedPackages = await Promise.all(
      allPeriods
        .filter(
          (p) =>
            p.status === "OPEN" ||
            registrations.some((r) => Number(r.periodId) === Number(p.id)),
        )
        .map(async (p) => {
          const options = await this.options(Number(p.id));
          const reg = registrations.find(
            (r) => Number(r.periodId) === Number(p.id),
          );
          const isPaid = reg?.status === "PAID";
          const totalFee = Number(p.feeAmount);
          const pricePerDay =
            options.pricePerUnitPerDay ?? options.pricePerUnit ?? null;

          return {
            periodId: Number(p.id),
            periodName: this.normalizeBreakfastText(p.name),
            description: this.normalizeBreakfastText(
              options.description ?? options.nutritionNotes ?? "",
            ),
            startDate: p.startDate,
            endDate: p.endDate,
            registrationDeadline: p.registrationDeadline,
            servingDays: options.servingDays ?? null,
            pricePerDay,
            feeAmount: totalFee,
            periodStatus: p.status,
            registrationId: reg ? Number(reg.id) : null,
            paymentStatus: reg ? reg.status : "NOT_REGISTERED",
            isPaid,
            canViewSchedule: true,
            // Cho phép phụ huynh xem trước thực đơn suất ăn xế của gói
            menuSchedule: await this.getMenuScheduleForPeriod(Number(p.id), p.name),
          };
        }),
    );

    const defaultPreviewSchedule =
      allPeriods.length > 0
        ? await this.getMenuScheduleForPeriod(Number(allPeriods[0].id), allPeriods[0].name)
        : [];

    return {
      success: true,
      student: child
        ? {
          id: Number(child.id),
          fullName: child.fullName,
          studentCode: child.studentCode,
          className: child.class?.name || "",
        }
        : null,
      hasPaidAnyPackage,
      activeSchedule: hasPaidAnyPackage
        ? await this.getMenuScheduleForPeriod(
          Number(paidRegistrations[0].periodId),
          paidRegistrations[0].period?.name,
        )
        : defaultPreviewSchedule,
      paidPackageName: hasPaidAnyPackage
        ? this.normalizeBreakfastText(paidRegistrations[0].period?.name)
        : null,
      publishedPackages,
    };
  }

  @SerializedWrite('snack-registration', 'regRepo')
  async registerEnrollment(dto: RegisterSnackServiceDto, currentUser?: any) {
    let periodId = Number((dto as any).periodId ?? (dto as any).period_id ?? (dto as any).serviceId);
    let studentId = Number((dto as any).studentId ?? (dto as any).student_id ?? (dto as any).childId);

    if (!studentId || isNaN(studentId)) {
      throw new BadRequestException("Vui lòng chọn học sinh đăng ký");
    }

    if (!periodId || isNaN(periodId)) {
      const defaultPeriod =
        (await this.periodRepo.findOne({
          where: { status: "OPEN" },
          order: { id: "DESC" },
        })) ||
        (await this.periodRepo.findOne({
          order: { id: "DESC" },
        }));
      if (defaultPeriod) {
        periodId = Number(defaultPeriod.id);
      } else {
        throw new BadRequestException("Vui lòng chọn đợt đăng ký ăn xế");
      }
    }

    // 1. Kiểm tra đợt dịch vụ
    const period = await this.periodRepo.findOne({
      where: { id: periodId },
      relations: ["registrations"],
    });
    if (!period) throw new NotFoundException("Không tìm thấy kỳ dịch vụ ăn xế");

    // Pre-condition: Đợt phải đang OPEN
    if (period.status !== "OPEN") {
      throw new BadRequestException(
        "Đã hết thời gian đăng ký (đợt dịch vụ đã đóng)",
      );
    }

    // Pre-condition: Kiểm tra hạn chót đăng ký (registrationDeadline)
    if (period.registrationDeadline) {
      const deadline = new Date(period.registrationDeadline);
      deadline.setHours(23, 59, 59, 999);
      if (new Date().getTime() > deadline.getTime()) {
        throw new BadRequestException("Đã hết thời gian đăng ký");
      }
    }

    // 2. Kiểm tra học sinh
    const child = await this.childRepo.findOne({
      where: { id: studentId },
      relations: ["allergies", "allergies.allergen", "class"],
    });
    if (!child) throw new NotFoundException("Không tìm thấy học sinh");

    // 3. Kiểm tra đơn đăng ký trùng lặp của trẻ trong đợt này
    const existingReg = await this.regRepo.findOne({
      where: { periodId, studentId },
    });
    if (existingReg) {
      if (existingReg.status === "PAID") {
        throw new BadRequestException(
          "Bé đã đăng ký và thanh toán thành công rồi",
        );
      }
      if (existingReg.status === "PENDING") {
        return {
          success: true,
          isExisting: true,
          message: "Bé đã có đơn đăng ký đang chờ thanh toán",
          warning:
            "Đơn đăng ký của bé đang ở trạng thái chờ thanh toán. Vui lòng hoàn tất thanh toán.",
          data: {
            id: String(existingReg.id),
            periodId: String(existingReg.periodId),
            studentId: String(existingReg.studentId),
            studentName: child.fullName,
            studentCode: child.studentCode,
            className: child.class?.name || "",
            parentId: String(existingReg.parentId),
            status: existingReg.status,
            feeAmount: Number(period.feeAmount),
            hasAllergy: (child.allergies || []).length > 0,
            allergyNames: (child.allergies || []).map(
              (a) => a.allergen?.name || a.allergen?.code,
            ),
            registeredAt: existingReg.registeredAt
              ? existingReg.registeredAt.toISOString()
              : new Date().toISOString(),
          },
        };
      }
    }

    // 4. Kiểm tra chỉ tiêu (Quota capacity) nếu giới hạn
    const totalRegistrations = (period.registrations || []).filter(
      (r) => r.status !== "CANCELLED",
    ).length;
    const options = await this.options(periodId);
    const quotaLimit =
      options.capacityMode === "LIMITED" ? Number(options.totalQuota) : null;
    if (
      quotaLimit != null &&
      Number.isFinite(quotaLimit) &&
      totalRegistrations >= quotaLimit
    ) {
      throw new BadRequestException(
        "Đã đủ chỉ tiêu cho khối lớp của bé. Liên hệ nhà trường để được hỗ trợ",
      );
    }

    // 5. Kiểm tra quy tắc Dị ứng (Allergy Rules Check)
    const allergyCheck = await this.checkAllergySafety(periodId, studentId);
    let warningNote = allergyCheck.warning;

    if (allergyCheck.isConflict) {
      if (!dto.acceptRisk) {
        throw new BadRequestException(
          `Thực đơn không phù hợp với hồ sơ dị ứng của trẻ: ${allergyCheck.conflictingAllergens.join(", ")}`,
        );
      } else {
        warningNote = `Trẻ có hồ sơ dị ứng (${allergyCheck.conflictingAllergens.join(", ")}). Phụ huynh/quản lý đã xác nhận chấp nhận rủi ro và bếp đã nhận cảnh báo đặc biệt để chuẩn bị suất ăn thay thế.`;
      }
    }

    // 6. Xác định parentId
    let parentId = dto.parentId;
    if (!parentId) {
      try {
        const parentRows = await this.childRepo.query(
          `SELECT parent_id FROM student_parents WHERE student_id = $1 ORDER BY is_primary DESC LIMIT 1`,
          [studentId],
        );
        if (parentRows && parentRows.length > 0 && parentRows[0].parent_id) {
          parentId = Number(parentRows[0].parent_id);
        }
      } catch (e) {
        // Fallback
      }
    }
    if (!parentId)
      throw new BadRequestException(
        "Học sinh chưa có phụ huynh liên kết để đăng ký dịch vụ.",
      );

    // 7. Tạo hoặc cập nhật bản ghi đăng ký mới trong DB
    const regStatus = dto.markAsPaid ? "PAID" : "PENDING";
    let saved: any;
    if (existingReg?.id) {
      const updateRows = await this.regRepo.manager.query(
        `UPDATE snack_registrations 
         SET status = $1, parent_id = $2, registered_at = NOW() 
         WHERE id = $3 
         RETURNING id, period_id, student_id, parent_id, status, registered_at`,
        [regStatus, Number(parentId), existingReg.id]
      );
      saved = updateRows[0];
    } else {
      const insertRows = await this.regRepo.manager.query(
        `INSERT INTO snack_registrations (period_id, student_id, parent_id, status, registered_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, period_id, student_id, parent_id, status, registered_at`,
        [Number(period.id), Number(child.id), Number(parentId), regStatus]
      );
      saved = insertRows[0];
    }

    return {
      success: true,
      message:
        regStatus === "PAID"
          ? `Đăng ký và xác nhận thanh toán thành công cho bé ${child.fullName} vào đợt '${period.name}'`
          : `Đăng ký thành công cho bé ${child.fullName} vào đợt '${period.name}'. Vui lòng hoàn tất thanh toán.`,
      warning: warningNote,
      data: {
        id: String(saved.id),
        periodId: String(saved.period_id ?? saved.periodId ?? period.id),
        studentId: String(saved.student_id ?? saved.studentId ?? child.id),
        studentName: child.fullName,
        studentCode: child.studentCode,
        className: child.class?.name || "",
        parentId: String(saved.parent_id ?? saved.parentId ?? parentId),
        status: saved.status,
        feeAmount: Number(period.feeAmount),
        hasAllergy: (child.allergies || []).length > 0,
        allergyNames: (child.allergies || []).map(
          (a) => a.allergen?.name || a.allergen?.code,
        ),
        registeredAt: saved.registeredAt
          ? saved.registeredAt.toISOString()
          : new Date().toISOString(),
      },
    };
  }

  async checkAllergySafety(periodId: number, studentId: number) {
    const period = await this.periodRepo.findOne({ where: { id: periodId } });
    if (!period) throw new NotFoundException("Không tìm thấy kỳ dịch vụ ăn xế");

    const child = await this.childRepo.findOne({
      where: { id: studentId },
      relations: ["allergies", "allergies.allergen", "class"],
    });
    if (!child) throw new NotFoundException("Không tìm thấy học sinh");

    const allergies = (child.allergies || []).filter((a) => a.isActive !== false);
    if (allergies.length === 0) {
      return {
        success: true,
        hasAllergy: false,
        isConflict: false,
        isDangerous: false,
        severity: "NONE",
        conflictingAllergens: [],
        allergyNames: [],
        warning: undefined,
        statusMessage:
          "Trẻ không có hồ sơ dị ứng thực phẩm. Đủ điều kiện đăng ký an toàn.",
      };
    }

    const menuText = [
      period.name,
      "Suất ăn xế nhẹ lúc 17h00 - Sữa tươi, bánh ngũ cốc và trái cây tươi",
    ]
      .join(" ")
      .toLowerCase();

    const allergenKeywords: Record<string, string[]> = {
      MILK: ["sữa", "bơ", "phô mai", "váng sữa", "milk", "cheese", "butter"],
      EGG: ["trứng", "egg", "mayonnaise"],
      PEANUT: ["đậu phộng", "lạc", "peanut"],
      TREE_NUT: [
        "hạt dẻ",
        "hạnh nhân",
        "hạt điều",
        "óc chó",
        "macca",
        "tree nut",
        "almond",
        "walnut",
      ],
      SEAFOOD: [
        "hải sản",
        "tôm",
        "cua",
        "cá",
        "mực",
        "nghêu",
        "sò",
        "seafood",
        "shrimp",
        "fish",
      ],
      WHEAT: ["lúa mì", "bột mì", "mì", "bánh mì", "gluten", "wheat"],
      SOY: ["đậu nành", "đậu hũ", "đậu phụ", "soy", "tofu"],
      SESAME: ["mè", "vừng", "sesame"],
    };

    const conflictingAllergens: string[] = [];
    let maxSeverity: "LOW" | "MEDIUM" | "HIGH" = "LOW";

    for (const alg of allergies) {
      const code = (alg.allergen?.code || "").toUpperCase();
      const name = alg.allergen?.name || "Dị ứng thực phẩm";
      const kws = allergenKeywords[code] || [name.toLowerCase()];
      const matches = kws.some((kw) => menuText.includes(kw));

      if (matches) {
        conflictingAllergens.push(name);
        const sev = (alg.severity || "MEDIUM").toUpperCase() as
          "LOW" | "MEDIUM" | "HIGH";
        if (sev === "HIGH" || (sev === "MEDIUM" && maxSeverity === "LOW")) {
          maxSeverity = sev;
        }
      }
    }

    const isConflict = conflictingAllergens.length > 0;
    const isDangerous = isConflict && maxSeverity === "HIGH";
    const allAllergyNames = allergies.map(
      (a) => a.allergen?.name || a.allergen?.code || "Dị ứng",
    );

    let statusMessage = "";
    let warning: string | undefined = undefined;

    if (!isConflict) {
      statusMessage = "Trẻ có hồ sơ dị ứng nhưng thực đơn an toàn";
      warning = `Trẻ có hồ sơ dị ứng (${allAllergyNames.join(", ")}) - Bếp đã được thông báo`;
    } else if (isDangerous) {
      statusMessage = `Thực đơn không phù hợp với hồ sơ dị ứng của trẻ: ${conflictingAllergens.join(", ")} (Mức độ nguy hiểm cao)`;
      warning = statusMessage;
    } else {
      statusMessage = `Thực đơn có chứa chất gây dị ứng: ${conflictingAllergens.join(", ")}`;
      warning = statusMessage;
    }

    return {
      success: true,
      hasAllergy: true,
      isConflict,
      isDangerous,
      severity: isConflict ? maxSeverity : "SAFE",
      conflictingAllergens,
      allergyNames: allAllergyNames,
      warning,
      statusMessage,
    };
  }

  @SerializedWrite('snack-registration', 'regRepo')
  async confirmPayment(registrationId: number) {
    const reg = await this.regRepo.findOne({
      where: { id: registrationId },
      relations: ["student", "student.class", "period"],
    });
    if (!reg) throw new NotFoundException("Không tìm thấy thông tin đăng ký");

    reg.status = "PAID";
    const saved = await this.regRepo.save(reg);

    const studentName = reg.student?.fullName || "Bé";
    const periodName = reg.period?.name || "Ăn xế";

    return {
      success: true,
      message: `Bé ${studentName} đã được đăng ký thành công đợt ăn xế ${periodName}`,
      data: {
        id: String(saved.id),
        periodId: String(saved.periodId),
        studentId: String(saved.studentId),
        studentName,
        status: saved.status,
        registeredAt: saved.registeredAt,
      },
    };
  }

  async getStudentsAvailable(periodId?: number) {
    const students = await this.childRepo.find({
      where: { id: currentStudent() },
      relations: ["class", "allergies", "allergies.allergen"],
      order: { fullName: "ASC" },
    });

    let registeredStudentIds: number[] = [];
    if (periodId) {
      const regs = await this.regRepo.find({
        where: { periodId },
      });
      registeredStudentIds = regs.map((r) => Number(r.studentId));
    }

    return {
      success: true,
      data: students.map((s) => ({
        id: String(s.id),
        studentCode: s.studentCode,
        fullName: s.fullName,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        className: s.class?.name || "Chưa xếp lớp",
        classId: s.classId ? String(s.classId) : undefined,
        hasAllergy: (s.allergies || []).length > 0,
        allergies: (s.allergies || []).map((a) => ({
          allergenName: a.allergen?.name || "Dị ứng",
          allergenCode: a.allergen?.code || "",
          severity: a.severity,
          note: a.note,
        })),
        isRegistered: registeredStudentIds.includes(Number(s.id)),
      })),
    };
  }
}
