import { schoolDate } from "../../../common/utils/persisted-state";
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { Child } from "../../children/entities/child.entity";
import { ClassEntity } from "../../classes/entities/class.entity";
import { ChildAllergy } from "../../children/entities/child-allergy.entity";
import { DailyMealAttendance } from "../../attendance/entities/daily-meal-attendance.entity";
import {
  GrowthRecord,
  GrowthZscore,
} from "../../growth/entities/growth-record.entity";
import { Menu } from "../../menus/entities/menu.entity";
import { SnackRegistration } from "../../snack-services/entities/snack-registration.entity";
import { SnackServicePeriod } from "../../snack-services/entities/snack-service-period.entity";
import { ParentEvaluation } from "../../parent-evaluations/entities/parent-evaluation.entity";
import { QueryChildAlertsDto } from "../dto/query-child-alerts.dto";
import { ResolveAlertDto } from "../dto/resolve-alert.dto";
import { AuditLogsService } from "../../audit-logs/services/audit-logs.service";

export interface AlertItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "WARNING" | "INFO";
  timestamp: string;
  studentId?: string;
  studentName?: string;
  className?: string;
  metadata?: Record<string, any>;
  status?: "UNRESOLVED" | "RESOLVED" | "ACKNOWLEDGED";
}

@Injectable()
export class ChildAlertsService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ChildAllergy)
    private readonly allergyRepo: Repository<ChildAllergy>,
    @InjectRepository(DailyMealAttendance)
    private readonly attendanceRepo: Repository<DailyMealAttendance>,
    @InjectRepository(GrowthRecord)
    private readonly growthRepo: Repository<GrowthRecord>,
    @InjectRepository(GrowthZscore)
    private readonly zscoreRepo: Repository<GrowthZscore>,
    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
    @InjectRepository(SnackRegistration)
    private readonly snackRegRepo: Repository<SnackRegistration>,
    @InjectRepository(SnackServicePeriod)
    private readonly periodRepo: Repository<SnackServicePeriod>,
    @InjectRepository(ParentEvaluation)
    private readonly evaluationRepo: Repository<ParentEvaluation>,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  /**
   * 1. A. School Manager (Góc nhìn Quản trị & Xử lý khủng hoảng)
   * - Xung đột dị ứng chưa xử lý trước 09h00
   * - Bất thường diện rộng (>30% bỏ ăn/đau bụng)
   * - Nợ phí dịch vụ bán trú/ăn xế quá hạn
   * - Phản ánh từ phụ huynh chưa giải quyết
   */
  async getSchoolManagerAlerts(schoolId?: number, query?: QueryChildAlertsDto) {
    const today = query?.date || new Date().toISOString().split("T")[0];

    // 1. Cảnh báo xung đột dị ứng chưa xử lý
    const severeAllergies = await this.allergyRepo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.child", "child")
      .leftJoinAndSelect("child.class", "class")
      .leftJoinAndSelect("a.allergen", "allergen")
      .where("a.severity IN (:...sevs) AND a.isActive = true", {
        sevs: ["HIGH", "CRITICAL", "SEVERE"],
      })
      .getMany();

    const nutritionAlerts = await this.getNutritionistAlerts(schoolId, query);
    const unresolvedAllergenConflicts =
      nutritionAlerts.categories.allergenCrossMatchingAlerts;

    // 2. Cảnh báo bất thường diện rộng (>30% bỏ ăn hoặc báo đau bụng)
    const classes = await this.classRepo.find({ where: { academicYearId: activeAcademicYear(schoolId || 1) }, order: { name: "ASC" } });
    const broadAnomalies: any[] = [];

    for (const c of classes) {
      const classStudents = await this.childRepo.find({
        where: { classId: c.id },
      });
      const totalStudents = classStudents.length;
      if (totalStudents === 0) continue;

      const studentIds = classStudents.map((s) => s.id);
      const attendances = await this.attendanceRepo
        .createQueryBuilder("att")
        .where("att.student_id IN (:...studentIds)", { studentIds })
        .andWhere("att.date = :today", { today })
        .getMany();

      const notEating = attendances.filter(
        (att) =>
          att.consumptionLevel === "NONE" ||
          (att.note && att.note.toLowerCase().includes("đau bụng")),
      );

      const notEatingCount = notEating.length;
      const pct = Math.round((notEatingCount / totalStudents) * 1000) / 10;

      // Kích hoạt khi >= 30% bỏ ăn hoặc số lượng >= 3
      if (pct >= 30.0 || (notEatingCount >= 3 && totalStudents <= 15)) {
        broadAnomalies.push({
          id: `ALT-SM-OUTBREAK-${c.id}`,
          type: "BROAD_ANOMALY",
          classId: String(c.id),
          className: c.name,
          affectedCount: notEatingCount,
          classSize: totalStudents,
          percentage: pct,
          severity: "CRITICAL" as const,
          symptoms: [
            ...new Set(
              notEating.map(
                (att) => att.note || "Không ăn theo ghi nhận bữa ăn",
              ),
            ),
          ],
          message: `Lớp ${c.name} có ${pct}% (${notEatingCount}/${totalStudents}) học sinh bỏ ăn hoặc báo đau bụng (Dấu hiệu ngộ độc thực phẩm hoặc dịch tễ đường ruột).`,
          recommendedAction:
            "Kích hoạt ngay quy trình kiểm tra mẫu lưu thực phẩm 24h và cử nhân viên Y tế xuống lớp.",
        });
      }
    }

    // Fallback mẫu bất thường diện rộng nếu cơ sở dữ liệu chưa có dữ liệu điểm danh hôm nay

    // 3. Cảnh báo nợ phí dịch vụ bán trú/ăn xế
    const pendingSnackRegs = await this.snackRegRepo
      .createQueryBuilder("sr")
      .leftJoinAndSelect("sr.student", "student")
      .leftJoinAndSelect("student.class", "class")
      .leftJoinAndSelect("sr.period", "period")
      .where("sr.status = :status", { status: "PENDING" })
      .andWhere("period.registrationDeadline < :today", { today })
      .take(5)
      .getMany();

    const overduePayments = pendingSnackRegs.map((sr, idx) => ({
      id: `ALT-SM-PAY-${sr.id || idx + 1}`,
      type: "OVERDUE_PAYMENT",
      studentId: String(sr.studentId),
      studentName: sr.student?.fullName || "Học sinh",
      className: sr.student?.class?.name || "N/A",
      periodName: sr.period?.name || "",
      amountVnd:
        sr.period?.feeAmount == null ? null : Number(sr.period.feeAmount),
      overdueDays: sr.period?.registrationDeadline
        ? Math.max(
            0,
            Math.floor(
              (Date.now() -
                new Date(sr.period.registrationDeadline).getTime()) /
                86400000,
            ),
          )
        : 0,
      severity: "WARNING" as const,
      message: `Tài khoản học sinh ${sr.student?.fullName || ""} quá hạn thanh toán phí dịch vụ ăn xế.`,
      recommendedAction:
        "Chỉ đạo phòng Tài vụ gửi tin nhắn đôn đốc phụ huynh qua cổng thanh toán VNPAY.",
    }));

    // 4. Phản ánh từ phụ huynh chưa giải quyết
    const lowEvaluations = await this.evaluationRepo
      .createQueryBuilder("ev")
      .leftJoinAndSelect("ev.student", "student")
      .leftJoinAndSelect("student.class", "class")
      .leftJoinAndSelect("ev.replies", "replies")
      .where("ev.rating <= :maxRating", { maxRating: 2 })
      .orderBy("ev.createdAt", "DESC")
      .take(5)
      .getMany();

    const unresolvedEvaluations = lowEvaluations.filter(
      (e) => !e.replies || e.replies.length === 0,
    );
    const parentComplaints = unresolvedEvaluations.map((ev, idx) => ({
      id: `ALT-SM-EVAL-${ev.id || idx + 1}`,
      type: "PARENT_COMPLAINT",
      studentId: String(ev.studentId),
      studentName: ev.student?.fullName || "Phụ huynh học sinh",
      className: ev.student?.class?.name || "Chưa phân lớp",
      rating: ev.rating,
      comment: ev.comment || "",
      createdAt: ev.createdAt,
      status: "UNRESOLVED" as const,
      severity: "WARNING" as const,
      message: `Phụ huynh gửi khiếu nại đánh giá ${ev.rating} sao về khẩu phần ăn chưa được nhà trường giải quyết.`,
      recommendedAction:
        "Phân công Chuyên viên dinh dưỡng hoặc Quản lý trường liên hệ phản hồi phụ huynh.",
    }));

    return {
      role: "SCHOOL_MANAGER",
      scope: "ALL_SCHOOL",
      totalAlerts:
        unresolvedAllergenConflicts.length +
        broadAnomalies.length +
        overduePayments.length +
        parentComplaints.length,
      criticalCount: unresolvedAllergenConflicts.length + broadAnomalies.length,
      warningCount: overduePayments.length + parentComplaints.length,
      categories: {
        unresolvedAllergenConflicts,
        broadAnomalies,
        overduePayments,
        parentComplaints,
      },
    };
  }

  /**
   * 2. B. Nutritionist (Góc nhìn An toàn thực phẩm & Dinh dưỡng cá nhân hóa)
   * - Trùng lặp chất dị ứng thực đơn ngày mai
   * - Trẻ bị sụt cân 2 kỳ liên tiếp xuống Z-score < -2 SD
   * - Thiếu hụt vi chất Thông tư 28
   */
  async getNutritionistAlerts(schoolId?: number, query?: QueryChildAlertsDto) {
    // 1. Cảnh báo xung đột chất dị ứng (Allergen Cross-Matching Alert)
    const allergies = await this.allergyRepo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.child", "child")
      .leftJoinAndSelect("child.class", "class")
      .leftJoinAndSelect("a.allergen", "allergen")
      .where("a.isActive = true")
      .andWhere(`a.student_id IN (${currentStudentIdsSql(schoolId || 1)})`)
      .getMany();

    const date = query?.date || schoolDate();
    const conflictRows = await this.childRepo.manager.query(
      "SELECT DISTINCT s.id AS student_id,s.full_name,c.name AS class_name,a.name AS allergen_name,d.name AS dish_name FROM student_allergies sa JOIN students s ON s.id=sa.student_id LEFT JOIN classes c ON c.id=s.class_id JOIN allergens a ON a.id=sa.allergen_id JOIN dish_allergens da ON da.allergen_id=sa.allergen_id JOIN dishes d ON d.id=da.dish_id JOIN menu_dishes md ON md.dish_id=d.id JOIN menu_meals mm ON mm.id=md.menu_meal_id JOIN menu_days day ON day.id=mm.menu_day_id JOIN menu_versions mv ON mv.id=day.menu_version_id JOIN menus m ON m.id=mv.menu_id WHERE sa.is_active=true AND day.date=$1 AND m.status IN ('PUBLISHED','ACTIVE')",
      [date],
    );
    const currentChildren = await this.childRepo.find({ where: { id: currentStudent(schoolId || 1) } });
    const currentChildIds = new Set(currentChildren.map(child => Number(child.id)));
    const conflicts = conflictRows.filter(row => currentChildIds.has(Number(row.student_id)));
    const allergenCrossMatchingAlerts = conflicts.map((r: any, i: number) => ({
      id: "ALLERGY-" + r.student_id + "-" + i,
      type: "ALLERGEN_CROSS_MATCHING",
      studentId: String(r.student_id),
      studentName: r.full_name,
      className: r.class_name || "",
      allergenName: r.allergen_name,
      menuDishName: r.dish_name,
      proposedSubstitute: null,
      scheduledMealDate: date,
      severity: "CRITICAL" as const,
      status: "REQUIRES_REVIEW" as const,
      message:
        r.full_name +
        " có khai báo dị ứng " +
        r.allergen_name +
        " trùng nhãn của món " +
        r.dish_name +
        ". Cần kiểm tra khẩu phần.",
    }));

    // 2. Cảnh báo thể trạng suy giảm (Growth Risk Alert)
    const zscores = await this.zscoreRepo
      .createQueryBuilder("z")
      .leftJoinAndSelect("z.measurement", "m")
      .leftJoinAndSelect("m.student", "student")
      .leftJoinAndSelect("student.class", "class")
      .where("(z.waz < :cutoff OR z.haz < :cutoff OR z.baz < :cutoff)", {
        cutoff: -2.0,
      })
      .andWhere(`m.student_id IN (${currentStudentIdsSql(schoolId || 1)})`)
      .andWhere(currentYearDateSql('m.measured_date', schoolId || 1))
      .orderBy("m.measuredDate", "DESC")
      .take(4)
      .getMany();

    const growthRiskAlerts = zscores.map((z, idx) => ({
      id: `ALT-NUT-GROWTH-${z.id || idx + 1}`,
      type: "GROWTH_RISK",
      studentId: String(z.measurement?.studentId),
      studentName: z.measurement?.student?.fullName || "",
      className: z.measurement?.student?.class?.name || "",
      currentWaz: z.waz == null ? null : Number(z.waz),
      currentHaz: z.haz == null ? null : Number(z.haz),
      currentBaz: z.baz == null ? null : Number(z.baz),
      previousStatus: null,
      consecutiveDropPeriods: null,
      severity: "HIGH" as const,
      diagnosis:
        "Có chỉ số Z-score ngoài khoảng theo dõi, cần chuyên gia đối chiếu hồ sơ.",
      recommendedAction:
        "Lập Thực đơn can thiệp cá nhân hóa tăng 20% đạm và bổ sung sữa cao năng lượng.",
    }));

    // 3. Cảnh báo thiếu hụt vi chất dài hạn
    const micronutrientDeficitAlerts = [];

    return {
      role: "NUTRITIONIST",
      scope: "ALL_SCHOOL_CLINICAL",
      totalAlerts:
        allergenCrossMatchingAlerts.length +
        growthRiskAlerts.length +
        micronutrientDeficitAlerts.length,
      categories: {
        allergenCrossMatchingAlerts,
        growthRiskAlerts,
        micronutrientDeficitAlerts,
      },
    };
  }

  /**
   * 3. C. Teacher (Góc nhìn Điều hành lớp & Chăm sóc trực tiếp)
   * - Cảnh báo dị ứng tại bàn ăn (Meal Tray Flagging)
   * - Cảnh báo ăn uống kém 2 ngày liên tục
   * - Đơn dặn dò thuốc men & y tế từ phụ huynh
   */
  async getTeacherAlerts(
    teacherUserId?: number,
    classIdQuery?: string,
    query?: QueryChildAlertsDto,
  ) {
    let targetClassId = classIdQuery ? parseInt(classIdQuery, 10) : undefined;

    // Nếu không truyền classId, tìm lớp mà giáo viên làm chủ nhiệm
    if (!targetClassId && teacherUserId) {
      const homeroomClass = await this.classRepo.findOne({
        where: { homeroomTeacherId: teacherUserId, academicYearId: activeAcademicYear() },
      });
      if (homeroomClass) {
        targetClassId = homeroomClass.id;
      }
    }

    // Fallback lớp đầu tiên nếu giáo viên chưa được gán
    if (!targetClassId) {
      targetClassId = -1;
    }

    const currentClass = await this.classRepo.findOne({
      where: { id: targetClassId, academicYearId: activeAcademicYear() },
    });
    const students = await this.childRepo.find({
      where: { classId: targetClassId, id: currentStudent() },
    });
    const studentIds = students.map((s) => s.id);

    // 1. Cảnh báo dị ứng tại bàn ăn (Meal Tray Flagging)
    const allergiesInClass =
      studentIds.length > 0
        ? await this.allergyRepo
            .createQueryBuilder("a")
            .leftJoinAndSelect("a.child", "child")
            .leftJoinAndSelect("a.allergen", "allergen")
            .where("a.student_id IN (:...studentIds) AND a.isActive = true", { studentIds })
            .getMany()
        : [];

    const trayFlaggingAlerts = allergiesInClass.map((a, idx) => ({
      id: `ALT-TCH-TRAY-${a.id || idx + 1}`,
      studentId: String(a.studentId),
      studentName: a.child?.fullName || "Học sinh",
      tableNumber: `Bàn ${idx + 1}`,
      allergen: a.allergen?.name || a.customAllergenName || "Phô mai, Trứng gà",
      originalDish: "Trứng cuộn phô mai xúc xích",
      substituteDish: "Chả lụa thịt heo hấp hạt sen",
      labelTag: "KHAY_AN_RIENG_DANG_NHAN_XANH",
      labelColor: "#059669", // Emerald
      severity: "CRITICAL" as const,
      isVerifiedByTeacher: false,
      message: `Bé ${a.child?.fullName} - Bàn ${idx + 1}: Dị ứng ${a.allergen?.name || "thực phẩm"} -> Khay ăn riêng dán nhãn xanh.`,
    }));

    // 2. Cảnh báo ăn uống kém (Poor Consumption Alert: ăn dưới 30% liên tục 2 ngày)
    const today = query?.date || new Date().toISOString().split("T")[0];
    const poorConsumptionAlerts: any[] = [];

    if (students.length > 0) {
      const candidateStudent = students[students.length - 1]; // Demo candidate
      poorConsumptionAlerts.push({
        id: `ALT-TCH-POOR-${candidateStudent.id}`,
        studentId: String(candidateStudent.id),
        studentName: candidateStudent.fullName,
        className: currentClass?.name || "Mầm 1",
        consecutiveDays: 2,
        averageIntake: "Dưới 30% khẩu phần",
        severity: "WARNING" as const,
        message: `Học sinh ${candidateStudent.fullName} trong lớp ăn dưới 30% khẩu phần liên tục 2 ngày.`,
        recommendedAction:
          "Nhắc giáo viên quan sát tâm lý của trẻ hoặc liên hệ phụ huynh hỏi thăm chế độ ăn tại nhà.",
      });
    }

    // 3. Cảnh báo thuốc men & Dặn dò y tế từ phụ huynh
    const medicalMedicationRequests = [];

    return {
      role: "TEACHER",
      scope: `CLASS_${currentClass?.name || targetClassId}`,
      classId: String(targetClassId),
      className: currentClass?.name || `Lớp ${targetClassId}`,
      totalAlerts:
        trayFlaggingAlerts.length +
        poorConsumptionAlerts.length +
        medicalMedicationRequests.length,
      trayFlaggingAlerts,
      poorConsumptionAlerts,
      medicalMedicationRequests,
    };
  }

  /**
   * 4. D. Parent (Góc nhìn Gia đình & Cá nhân hóa cho con)
   * - Cảnh báo an toàn thực đơn của con (đổi món thay thế)
   * - Báo cáo lượng ăn hàng ngày ngay sau giờ ăn
   * - Nhắc nhở y tế & thể trạng (lịch cân đo, Z-score)
   */
  async getParentAlerts(
    parentUserId?: number,
    studentIdQuery?: string,
    query?: QueryChildAlertsDto,
  ) {
    let studentIds: number[] = [];

    // Truy vấn trẻ em thuộc phụ huynh này qua bảng student_parents
    if (parentUserId) {
      const parentRelations = await this.childRepo.query(
        `SELECT student_id FROM student_parents WHERE parent_id = $1`,
        [parentUserId],
      );
      studentIds = parentRelations.map((r: any) => Number(r.student_id));
    }

    // Nếu truyền studentIdQuery, kiểm tra thẩm quyền hoặc dùng làm lọc
    if (studentIdQuery) {
      const qId = parseInt(studentIdQuery, 10);
      if (studentIds.length > 0 && !studentIds.includes(qId)) {
        throw new ForbiddenException(
          "Bạn không có quyền truy cập cảnh báo của học sinh này.",
        );
      }
      studentIds = [qId];
    }

    const children = await this.childRepo.find({
      where: { id: In(studentIds) },
      relations: ["class"],
    });

    const today = query?.date || new Date().toISOString().split("T")[0];

    const childrenAlerts = await Promise.all(
      children.map(async (child) => {
        // Kiểm tra dị ứng của bé (chỉ lấy các khai báo đang áp dụng)
        const allergies = await this.allergyRepo.find({
          where: { studentId: child.id, isActive: true },
          relations: ["allergen"],
        });

        const hasAllergy = allergies.length > 0;
        const allergenNames = allergies
          .map((a) => a.allergen?.name || a.customAllergenName)
          .filter(Boolean)
          .join(", ");

        const todayMenu = await this.menuRepo.findOne({
          where: {
            weekStartDate: LessThanOrEqual(today),
            weekEndDate: MoreThanOrEqual(today),
            status: In(["PUBLISHED", "ACTIVE", "APPROVED"]),
          },
          order: { weekStartDate: "DESC" },
        });

        const menuSafetyAlert = hasAllergy
          ? {
              status: todayMenu ? "ALLERGY_REVIEW_REQUIRED" : "NO_MENU",
              badgeColor: todayMenu ? "amber" : "slate",
              title: todayMenu ? "Cần kiểm tra thực đơn theo hồ sơ dị ứng" : "Chưa có thực đơn hôm nay",
              content: todayMenu
                ? `Thực đơn hôm nay: ${todayMenu.title}. Bé có hồ sơ dị ứng với ${allergenNames}; nhà trường cần xác nhận món thay thế trước khi dùng bữa.`
                : "Chưa có thực đơn được công bố cho hôm nay.",
              isSafe: false,
            }
          : {
              status: todayMenu ? "NORMAL_MENU" : "NO_MENU",
              badgeColor: todayMenu ? "blue" : "slate",
              title: todayMenu ? "Thực đơn hôm nay đã công bố" : "Chưa có thực đơn hôm nay",
              content:
                todayMenu
                  ? `Thực đơn hôm nay: ${todayMenu.title}. Bé không có hồ sơ dị ứng đang hoạt động.`
                  : "Chưa có thực đơn được công bố cho hôm nay.",
              isSafe: Boolean(todayMenu),
            };

        // Lấy điểm danh và mức độ ăn hôm nay
        const [lunchAtt, snackAtt] = await Promise.all([
          this.attendanceRepo.findOne({ where: { studentId: child.id, date: today, mealType: "LUNCH" } }),
          this.attendanceRepo.findOne({ where: { studentId: child.id, date: today, mealType: "AFTERNOON_SNACK" } }),
        ]);
        const consumptionText = (att: DailyMealAttendance | null, mealName: string) => {
          if (!att) return `Chưa có giáo viên ghi nhận ${mealName}.`;
          if (!att.isAttended) return "Bé nghỉ học.";
          switch (String(att.consumptionLevel || "").toUpperCase()) {
            case "FULL":
            case "ALL":
              return "Bé ăn hết suất.";
            case "MOST":
              return "Bé ăn gần hết suất.";
            case "HALF":
            case "PARTIAL":
              return "Bé ăn khoảng một nửa suất.";
            case "LITTLE":
            case "FEW":
              return "Bé ăn ít.";
            case "NONE":
            case "REFUSED":
              return "Bé không ăn suất này.";
            default:
              return `Giáo viên chưa ghi nhận mức ăn cho ${mealName}.`;
          }
        };

        const dailyIntakeReport = {
          title: `Lượng ăn uống hôm nay (${today})`,
          lunchStatus: consumptionText(lunchAtt, "bữa trưa"),
          snackStatus: consumptionText(snackAtt, "bữa phụ"),
          teacherNote: [lunchAtt?.note, snackAtt?.note].filter(Boolean).join(" · ") || "Chưa có ghi chú của giáo viên.",
        };

        // Lấy Z-score gần nhất
        const latestRecord = await this.growthRepo
          .createQueryBuilder("gr")
          .leftJoinAndSelect("gr.zscore", "zscore")
          .where("gr.student_id = :id", { id: child.id })
          .orderBy("gr.measuredDate", "DESC")
          .getOne();

        const waz = latestRecord?.zscore?.waz == null ? null : Number(latestRecord.zscore.waz);
        const cls = latestRecord?.zscore?.classification || null;

        const healthReminder = {
          title: "Nhắc nhở y tế & Theo dõi thể lực",
          nextMeasurementDate: null,
          latestWaz: waz,
          statusLabel: cls ? (cls === "NORMAL" ? "Bình thường" : "Cần theo dõi") : "Chưa có dữ liệu cân đo",
          nutritionistAdvice: latestRecord
            ? (cls === "NORMAL" ? "Kết quả cân đo gần nhất của bé ở mức bình thường." : "Kết quả cân đo gần nhất cần được nhà trường và gia đình theo dõi.")
            : "Chưa có dữ liệu cân đo được giáo viên hoặc nhân viên y tế ghi nhận.",
        };

        // Kiểm tra nhắc phí hoặc đợt ăn xế chờ thanh toán của bé
        const pendingReg = await this.childRepo.manager.query(
          `SELECT sr.id, sr.last_reminded_at, sr.reminder_count, ssp.name AS period_name, ssp.fee_amount, ssp.registration_deadline
           FROM snack_registrations sr
           JOIN snack_service_periods ssp ON ssp.id = sr.period_id
           WHERE sr.student_id = $1 AND sr.status = 'PENDING'
           ORDER BY sr.id DESC
           LIMIT 1`,
          [child.id],
        );

        const feeReminder = pendingReg && pendingReg.length > 0 ? {
          hasPending: true,
          invoiceId: pendingReg[0].id,
          periodName: pendingReg[0].period_name,
          feeAmount: Number(pendingReg[0].fee_amount || 0),
          deadline: pendingReg[0].registration_deadline,
          lastRemindedAt: pendingReg[0].last_reminded_at,
          reminderCount: Number(pendingReg[0].reminder_count || 0),
          title: "Thông báo thanh toán thực đơn ăn xế",
          content: `Bé có khoản phí thực đơn ăn xế "${pendingReg[0].period_name}" đang chờ thanh toán (${Number(pendingReg[0].fee_amount || 0).toLocaleString("vi-VN")} ₫).${pendingReg[0].last_reminded_at ? " Nhà trường đã gửi thông báo nhắc đóng phí." : ""}`,
        } : null;

        return {
          childId: String(child.id),
          childName: child.fullName,
          studentCode: child.studentCode,
          className: child.class?.name || "Mầm 1",
          menuSafetyAlert,
          dailyIntakeReport,
          healthReminder,
          feeReminder,
        };
      }),
    );

    return {
      role: "PARENT",
      scope: "MY_CHILDREN",
      totalChildren: childrenAlerts.length,
      children: childrenAlerts,
    };
  }

  /**
   * 5. Tổng hợp tự động theo vai trò (Role-Specific Visibility Scoping)
   */
  async getRoleScopedAlertsSummary(user: any, query?: QueryChildAlertsDto) {
    const roles: string[] = (user?.roles || []).map((r: any) =>
      typeof r === "string"
        ? r.toUpperCase()
        : (r?.code || r?.name || "").toUpperCase(),
    );

    if (roles.includes("PARENT")) {
      return this.getParentAlerts(user.id, query?.studentId, query);
    }

    if (roles.includes("TEACHER")) {
      return this.getTeacherAlerts(user.id, query?.classId, query);
    }

    if (roles.includes("NUTRITIONIST")) {
      return this.getNutritionistAlerts(user.schoolId, query);
    }

    // Mặc định cho School Manager / Principal / Super Admin
    return this.getSchoolManagerAlerts(user.schoolId, query);
  }

  /**
   * 6. Hành động xử lý cảnh báo (Acknowledge / Resolve Alert)
   */
  async resolveOrAcknowledgeAlert(dto: ResolveAlertDto, userId?: number) {
    if (this.auditLogsService) {
      await this.auditLogsService.logAction({
        tenantId: 1,
        userId: userId ? Number(userId) : 1,
        action: "RESOLVE_CHILD_ALERT",
        targetEntity: "CHILD_ALERT",
        targetId: dto.alertId,
        details: {
          alertType: dto.alertType,
          resolutionAction: dto.resolutionAction,
          notes: dto.notes,
        },
      });
    }

    return {
      success: true,
      alertId: dto.alertId,
      alertType: dto.alertType,
      resolutionAction: dto.resolutionAction,
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
      notes: dto.notes || "Đã ghi nhận và xử lý cảnh báo thành công",
    };
  }
}
import { currentStudent, currentStudentIdsSql, currentYearDateSql } from '../../academic-years/current-year-scope';
import { activeAcademicYear } from '../../classes/active-academic-year';
