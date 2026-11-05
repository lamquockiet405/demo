import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DailyMealAttendance } from "../../attendance/entities/daily-meal-attendance.entity";
import { DailyMealPortion } from "../../meal-portions/entities/daily-meal-portion.entity";
import { InspectionRecord } from "../../inspections/entities/inspection-record.entity";
import { InspectionSampleItem } from "../../inspections/entities/inspection-sample-item.entity";
import { MealCoordinationNote } from "../../attendance/entities/meal-coordination-note.entity";
import { Child } from "../../children/entities/child.entity";
import { ClassEntity } from "../../classes/entities/class.entity";
import { ChildAllergy } from "../../children/entities/child-allergy.entity";
import { User } from "../../auth/entities/user.entity";
import { AuditLogsService } from "../../audit-logs/services/audit-logs.service";
import { SignInspectionDto } from "../dto/sign-inspection.dto";
import { TeacherSensoryEvaluationDto } from "../dto/teacher-sensory-evaluation.dto";

export interface ClassBreakdownItem {
  classId: string;
  className: string;
  ageGroup: string;
  enrolled: number;
  presentLunch: number;
  presentSnack: number;
  excusedAbsence: number;
  unexcusedAbsence: number;
  specialDiet: number;
  specialDietChildren: Array<{
    studentId: number;
    studentName: string;
    allergenName: string;
    safeSubstitute: string;
  }>;
}

export interface DishWasteItem {
  dishCategory: string;
  dishName: string;
  wastePercent: number;
  flagged: boolean;
  consecutiveDays: number;
  warning?: string;
}

export interface MealOperationsReportResponse {
  date: string;
  schoolName: string;
  reconciliation: {
    totalEnrolledStudents: number;
    actualLunchCount: number;
    actualSnackCount: number;
    absentExcusedCount: number;
    absentUnexcusedCount: number;
    totalRefundAmountVnd: number;
    refundPerMealVnd: number;
    specialDietCount: number;
    classBreakdown: ClassBreakdownItem[];
  };
  foodSafetyInspection: {
    decisionStandard: string;
    step1RawCheck: {
      timeRange: string;
      supplierName: string;
      freshness: string;
      packagingIntegrity: string;
      transportTempC: number;
      result: string;
      inspectorName: string;
      checkedAt: string;
      notes: string;
    };
    step2ProcessingCheck: {
      timeRange: string;
      equipmentHygiene: string;
      oneWayKitchenCompliance: boolean;
      coreBoilingTempC: number;
      tempTarget: string;
      result: string;
      inspectorName: string;
      checkedAt: string;
      notes: string;
    };
    step3PreServingCheck: {
      timeRange: string;
      sensoryColorSmell: string;
      trayCount: number;
      result: string;
      inspectorName: string;
      checkedAt: string;
      notes: string;
    };
    sampleRetention24h: {
      fridgeUnit: string;
      storageTempC: number;
      tempRangeStandard: string;
      status: string;
      sampleCount: number;
      samples: Array<{
        dishName: string;
        sampleCode: string;
        weightOrVolume: string;
        isStandard: boolean;
        storedAt: string;
      }>;
      signatories: {
        kitchenHead: { signed: boolean; name: string; signedAt: string | null };
        medicalStaff: {
          signed: boolean;
          name: string;
          signedAt: string | null;
        };
        schoolManager: {
          signed: boolean;
          name: string;
          signedAt: string | null;
        };
      };
    };
  };
  consumptionAndPlateWaste: {
    schoolAverageConsumptionRate: number;
    portionDistribution: {
      full100Pct: number;
      twoThirds: number;
      half: number;
      lessThanOneThird: number;
    };
    dishWasteIndex: DishWasteItem[];
    teacherSensoryFeedback: Array<{
      classId: number;
      className: string;
      temperature: string;
      taste: string;
      cleanliness: string;
      trayCountReceived: number;
      plateWastePercent: number;
      comment: string;
      recordedAt: string;
    }>;
  };
}

@Injectable()
export class MealOperationsService {
  constructor(
    @InjectRepository(DailyMealAttendance)
    private readonly attendanceRepo: Repository<DailyMealAttendance>,
    @InjectRepository(DailyMealPortion)
    private readonly portionRepo: Repository<DailyMealPortion>,
    @InjectRepository(InspectionRecord)
    private readonly inspectionRepo: Repository<InspectionRecord>,
    @InjectRepository(InspectionSampleItem)
    private readonly sampleRepo: Repository<InspectionSampleItem>,
    @InjectRepository(MealCoordinationNote)
    private readonly mealNoteRepo: Repository<MealCoordinationNote>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ChildAllergy)
    private readonly allergyRepo: Repository<ChildAllergy>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  private getTodayDateStr(): string {
    return new Date().toISOString().split("T")[0];
  }

  /**
   * UC94: Lấy toàn bộ báo cáo chu trình vận hành khép kín hàng ngày (Daily Closed-Loop Meal Operations)
   */
  async getDailyMealOperationsReport(
    targetDate?: string,
    schoolId?: number,
  ): Promise<MealOperationsReportResponse> {
    const date = targetDate || this.getTodayDateStr();
    const REFUND_PER_MEAL_VND = null; // 35,000 VND / suất ăn

    // 1. Fetch Classes & Children
    const classes = await this.classRepo.find({ order: { name: "ASC" } });
    const allChildren = await this.childRepo.find({
      relations: ["allergies", "allergies.allergen"],
    });
    const totalEnrolled = allChildren.length;

    // 2. Fetch Attendance for Date
    const attendances = await this.attendanceRepo.find({
      where: { date },
      relations: ["student"],
    });

    const lunchAttendances = attendances.filter((a) => a.mealType === "LUNCH");
    const snackAttendances = attendances.filter(
      (a) => a.mealType === "AFTERNOON_SNACK",
    );

    // 3. Fetch Portions if attendance is not yet recorded for this date
    const portions = await this.portionRepo.find({ where: { date } });

    // 4. Fetch Allergies
    const allergies = await this.allergyRepo.find({
      relations: ["child", "allergen"],
    });

    // 5. Build Class Breakdown
    let totalLunchPresent = 0;
    let totalSnackPresent = 0;
    let totalExcused = 0;
    let totalUnexcused = 0;
    const specialDietStudentIds = new Set(allergies.map((a) => a.studentId));

    const classBreakdown: ClassBreakdownItem[] = classes.map((cls) => {
      const clsStudents = allChildren.filter(
        (c) => Number(c.classId) === Number(cls.id),
      );
      const enrolled = clsStudents.length;

      const clsLunchAtt = lunchAttendances.filter((a) =>
        clsStudents.some((c) => Number(c.id) === Number(a.studentId)),
      );
      const clsSnackAtt = snackAttendances.filter((a) =>
        clsStudents.some((c) => Number(c.id) === Number(a.studentId)),
      );

      let presentLunch = clsLunchAtt.filter((a) => a.isAttended).length;
      let presentSnack = clsSnackAtt.filter((a) => a.isAttended).length;

      const excused = clsLunchAtt.filter(
        (a) => !a.isAttended && /nghỉ phép|có phép|ốm/i.test(a.note || ""),
      ).length;
      const unexcused = clsLunchAtt.filter(
        (a) => !a.isAttended && !/nghỉ phép|có phép|ốm/i.test(a.note || ""),
      ).length;
      totalLunchPresent += presentLunch;
      totalSnackPresent += presentSnack;
      totalExcused += excused;
      totalUnexcused += unexcused;

      // Children with allergies in this class
      const clsAllergyChildren = clsStudents
        .filter((c) => specialDietStudentIds.has(c.id))
        .map((c) => {
          const childAllergies = allergies.filter(
            (a) => Number(a.studentId) === Number(c.id),
          );
          const allergenNames = childAllergies
            .map((a) => a.allergen?.name || "Chất dị ứng")
            .join(", ");
          const safeSubstitute = "Chưa có xác nhận món thay thế";
          return {
            studentId: c.id,
            studentName: c.fullName,
            allergenName: allergenNames,
            safeSubstitute,
          };
        });

      return {
        classId: String(cls.id),
        className: cls.name,
        ageGroup: cls.ageGroup || "MẦM NON",
        enrolled,
        presentLunch,
        presentSnack,
        excusedAbsence: excused,
        unexcusedAbsence: unexcused,
        specialDiet: clsAllergyChildren.length,
        specialDietChildren: clsAllergyChildren,
      };
    });

    const totalRefundAmountVnd = null;

    // 6. Block 2: Food Safety Inspection (Decision 1246/QĐ-BYT)
    const inspectionRecords = await this.inspectionRepo.find({
      where: { date },
      relations: ["inspector"],
    });

    const step1Rec = inspectionRecords.find(
      (r) => r.inspectionStep === "STEP_1_RAW_CHECK",
    );
    const step2Rec = inspectionRecords.find(
      (r) => r.inspectionStep === "STEP_2_PROCESSING_CHECK",
    );
    const step3Rec = inspectionRecords.find(
      (r) => r.inspectionStep === "STEP_3_PRE_SERVING_CHECK",
    );

    const recordInfo = (r: any) => ({
      result: r?.result || "NOT_RECORDED",
      inspectorName: r?.inspector?.fullName || "",
      checkedAt: null,
      notes: r?.note || "",
    });
    const foodSafetyInspection = {
      decisionStandard: "Kiểm thực 3 bước",
      step1RawCheck: {
        timeRange: null,
        supplierName: null,
        freshness: null,
        packagingIntegrity: null,
        transportTempC: null,
        ...recordInfo(step1Rec),
      },
      step2ProcessingCheck: {
        timeRange: null,
        equipmentHygiene: null,
        oneWayKitchenCompliance: null,
        coreBoilingTempC: null,
        tempTarget: null,
        ...recordInfo(step2Rec),
      },
      step3PreServingCheck: {
        timeRange: null,
        sensoryColorSmell: null,
        trayCount: null,
        ...recordInfo(step3Rec),
      },
      sampleRetention24h: await this.getFoodSampleRetention(date),
    };
    const schools = await this.childRepo.manager.query(
      "SELECT name FROM schools WHERE id=$1",
      [schoolId || 1],
    );

    // 7. Block 3: Consumption & Plate Waste Report
    const consumptionAndPlateWaste = await this.getConsumptionAndPlateWaste(
      date,
      lunchAttendances,
      classes,
    );

    return {
      date,
      schoolName: schools[0]?.name || "",
      reconciliation: {
        totalEnrolledStudents: totalEnrolled,
        actualLunchCount: totalLunchPresent,
        actualSnackCount: totalSnackPresent,
        absentExcusedCount: totalExcused,
        absentUnexcusedCount: totalUnexcused,
        totalRefundAmountVnd,
        refundPerMealVnd: REFUND_PER_MEAL_VND,
        specialDietCount: specialDietStudentIds.size,
        classBreakdown,
      },
      foodSafetyInspection,
      consumptionAndPlateWaste,
    };
  }

  /**
   * Lấy dữ liệu mẫu lưu 24h & Chữ ký điện tử 3 bên
   */
  private async getFoodSampleRetention(date: string) {
    const samples = await this.sampleRepo.find({
      where: { date },
      order: { storedAt: "ASC" },
    });
    const sampleList = samples.map((s) => ({
      dishName: s.dishName,
      sampleCode: s.sampleCode,
      weightOrVolume:
        s.sampleWeightG == null ? "Chưa ghi nhận" : s.sampleWeightG + "g",
      isStandard:
        s.sampleWeightG == null ? null : Number(s.sampleWeightG) >= 100,
      storedAt: s.storedAt?.toISOString() || null,
    }));
    const unsigned = { signed: false, name: null, signedAt: null };
    return {
      fridgeUnit: samples[0]?.fridgeUnit || null,
      storageTempC: null,
      tempRangeStandard: null,
      status: samples.length ? "RECORDED" : "NO_DATA",
      sampleCount: samples.length,
      samples: sampleList,
      signatories: {
        kitchenHead: { ...unsigned },
        medicalStaff: { ...unsigned },
        schoolManager: { ...unsigned },
      },
    };
  }

  /**
   * Tính toán Báo cáo Tiêu thụ & Thức ăn thừa (Plate Waste)
   */
  private async getConsumptionAndPlateWaste(
    date: string,
    lunchAttendances: DailyMealAttendance[],
    classes: ClassEntity[],
  ) {
    const evaluated = lunchAttendances.filter(
      (a) => a.isAttended && a.consumptionLevel,
    );
    const pct = (level: string) =>
      evaluated.length
        ? Math.round(
            (evaluated.filter((a) => a.consumptionLevel === level).length /
              evaluated.length) *
              1000,
          ) / 10
        : null;
    const notes = await this.mealNoteRepo.find({
      where: { date },
      relations: ["fromUser"],
    });
    const teacherSensoryFeedback = notes
      .filter((n) => n.content?.includes("Cảm quan:"))
      .map((n) => ({
        classId: null,
        className:
          classes.find((c) => n.content.includes("[" + c.name + "]"))?.name ||
          "",
        temperature: null,
        taste: null,
        cleanliness: null,
        trayCountReceived: null,
        plateWastePercent: null,
        comment: n.content,
        recordedAt: n.createdAt?.toISOString() || null,
      }));
    return {
      schoolAverageConsumptionRate: null,
      portionDistribution: {
        full100Pct: pct("FULL"),
        twoThirds: pct("TWO_THIRDS"),
        half: pct("HALF"),
        lessThanOneThird: pct("NONE"),
      },
      dishWasteIndex: [],
      teacherSensoryFeedback,
    };
  }

  /**
   * Ký duyệt điện tử biên bản kiểm thực 3 bước hoặc lưu mẫu 24h
   */
  async signInspection(dto: SignInspectionDto, userId: number) {
    const existing = await this.inspectionRepo.findOne({
      where: { date: dto.date, inspectionStep: dto.step },
    });

    let rec: InspectionRecord;
    if (existing) {
      existing.result = "PASS";
      existing.note = `${dto.notes || "Đã ký duyệt điện tử"}. Ký bởi: ${dto.signerName} (${dto.role})`;
      existing.inspectorId = userId;
      rec = await this.inspectionRepo.save(existing);
    } else {
      rec = this.inspectionRepo.create({
        date: dto.date,
        inspectionStep: dto.step,
        inspectorId: userId,
        result: "PASS",
        note: `${dto.notes || "Ký duyệt điện tử"}. Ký bởi: ${dto.signerName} (${dto.role})`,
      });
      rec = await this.inspectionRepo.save(rec);
    }

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId,
        userName: dto.signerName,
        userRole: dto.role,
        action: "SIGN_FOOD_INSPECTION",
        targetEntity: "FOOD_INSPECTION",
        targetId: String(rec.id),
        ipAddress: "127.0.0.1",
        details: {
          step: dto.step,
          date: dto.date,
          role: dto.role,
          signerName: dto.signerName,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: `Đã ký duyệt thành công ${dto.step} cho ngày ${dto.date}`,
      recordId: rec.id,
      signedAt: new Date().toISOString(),
    };
  }

  /**
   * Giáo viên gửi đánh giá nhanh cảm quan khay thức ăn
   */
  async submitTeacherSensory(dto: TeacherSensoryEvaluationDto, userId: number) {
    const cls = await this.classRepo.findOne({ where: { id: dto.classId } });
    const content = `[${cls?.name || `Lớp #${dto.classId}`}] Cảm quan: Nhiệt độ ${dto.temperature}, Vị: ${dto.taste}, Vệ sinh: ${dto.cleanliness}. Nhận ${dto.trayCountReceived || 0} khay. Thừa: ${dto.plateWastePercent || 0}%. Ghi chú: ${dto.comment || "Không"}`;

    const note = this.mealNoteRepo.create({
      date: dto.date,
      fromUserId: userId,
      content,
    });
    const saved = await this.mealNoteRepo.save(note);

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId,
        userName: "Giáo viên lớp",
        userRole: "TEACHER",
        action: "SUBMIT_TEACHER_SENSORY_FEEDBACK",
        targetEntity: "MEAL_NOTE",
        targetId: String(saved.id),
        ipAddress: "127.0.0.1",
        details: {
          date: dto.date,
          classId: dto.classId,
          taste: dto.taste,
          temperature: dto.temperature,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message:
        "Đã gửi phản hồi cảm quan bữa ăn của lớp học về nhà bếp thành công",
      id: saved.id,
    };
  }

  /**
   * Kết xuất dữ liệu báo cáo vận hành (để in / lưu trữ hồ sơ thanh tra)
   */
  async exportOperationsReport(date?: string, schoolId?: number) {
    const report = await this.getDailyMealOperationsReport(date, schoolId);
    return {
      title: "BÁO CÁO VẬN HÀNH BỮA ĂN VÀ BÁN TRÚ TOÀN TRƯỜNG",
      standardRef: "Theo Quyết định 1246/QĐ-BYT & Thông tư 28/2016/TT-BGDĐT",
      exportedAt: new Date().toISOString(),
      report,
    };
  }
}
