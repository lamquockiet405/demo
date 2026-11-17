import { readState, writeState } from "../../../common/utils/persisted-state";
import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GrowthRecord, GrowthZscore } from "../entities/growth-record.entity";
import { Child } from "../../children/entities/child.entity";
import { ClassEntity } from "../../classes/entities/class.entity";
import { DailyMealAttendance } from "../../attendance/entities/daily-meal-attendance.entity";
import { WhoZscoreService } from "./who-zscore.service";
import {
  QueryGrowthNotificationsDto,
  GrowthNotificationItem,
  ExecutiveGrowthHealthSummary,
} from "../dto/query-growth-notifications.dto";
import {
  AcknowledgeNotificationDto,
  AssignInterventionDietDto,
  RequestConsultationDto,
  ApproveInterventionBudgetDto,
} from "../dto/growth-notification-actions.dto";

@Injectable()
export class GrowthDispatchService {
  // In-service notification store (synced with PostgreSQL data)
  private notifications: GrowthNotificationItem[] = [];

  constructor(
    @InjectRepository(GrowthRecord)
    private readonly growthRepo: Repository<GrowthRecord>,
    @InjectRepository(GrowthZscore)
    private readonly zscoreRepo: Repository<GrowthZscore>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @Optional()
    @InjectRepository(ClassEntity)
    private readonly classRepo?: Repository<ClassEntity>,
    @Optional()
    @InjectRepository(DailyMealAttendance)
    private readonly attendanceRepo?: Repository<DailyMealAttendance>,
    private readonly whoService?: WhoZscoreService,
  ) {}

  /**
   * Quét dữ liệu thực từ PostgreSQL để tìm trẻ bất thường và tự động phát thông báo theo 4 Role
   */
  async scanAndDispatchNotifications(schoolId?: number, allowedClassIds?: number[]): Promise<{
    scannedCount: number;
    abnormalCount: number;
    dispatchedNotificationsCount: number;
    summary: string;
  }> {
    this.notifications = await readState(
      this.childRepo.manager,
      "growth-notifications:" + (schoolId || 1),
      [],
    );
    const students = (await this.childRepo.find({ where: { id: currentStudent(schoolId || 1) }, relations: ["class"] })).filter(s=>allowedClassIds===undefined||allowedClassIds.includes(Number(s.classId)));

    let abnormalCount = 0;
    let newNotificationsCount = 0;

    for (const student of students) {
      // Lấy 2 bản ghi đo đạc gần nhất
      const records = await this.growthRepo.find({
        where: { studentId: student.id, measuredDate: currentYearDate(schoolId || 1) },
        relations: ["zscore"],
        order: { measuredDate: "DESC" },
        take: 2,
      });

      if (records.length === 0) continue;

      const latest = records[0];
      const dob = new Date(student.dateOfBirth),
        measured = new Date(latest.measuredDate);
      const ageInMonths =
        (measured.getUTCFullYear() - dob.getUTCFullYear()) * 12 +
        measured.getUTCMonth() -
        dob.getUTCMonth();
      const previous = records.length > 1 ? records[1] : null;

      const waz = latest.zscore?.waz != null ? Number(latest.zscore.waz) : 0;
      const haz = latest.zscore?.haz != null ? Number(latest.zscore.haz) : 0;
      const baz = latest.zscore?.baz != null ? Number(latest.zscore.baz) : 0;

      const currWeight = Number(latest.weightKg || 0);
      const prevWeight = previous ? Number(previous.weightKg || 0) : currWeight;
      const weightDelta = Number((currWeight - prevWeight).toFixed(2));

      const isUnderweight = waz < -2.0;
      const isSevereUnderweight = waz < -3.0;
      const isStunted = haz < -2.0;
      const isSevereStunted = haz < -3.0;
      const isWasted = baz < -2.0;
      const isOverweight = baz > 2.0;
      const isObese = baz > 3.0;
      const isWeightLossFaltering = previous && weightDelta <= -0.5;

      const isAbnormal =
        isUnderweight ||
        isStunted ||
        isWasted ||
        isOverweight ||
        isObese ||
        isWeightLossFaltering;

      if (isAbnormal) {
        abnormalCount++;

        const isCritical =
          isSevereUnderweight ||
          isSevereStunted ||
          isObese ||
          (isWeightLossFaltering && weightDelta <= -0.8);
        const severity: "CRITICAL" | "HIGH" = isCritical ? "CRITICAL" : "HIGH";
        const channels: ("APP_PUSH" | "SMS" | "MODAL_ALERT" | "BADGE")[] =
          isCritical ? ["APP_PUSH"] : ["APP_PUSH"];

        // Kiểm tra xem đã phát thông báo cho trẻ này chưa
        const alreadyDispatched = this.notifications.some(
          (n) => n.studentId === Number(student.id),
        );

        if (!alreadyDispatched) {
          const baseId = this.notifications.length + 1;

          // 1. Thông báo cho PARENT (Thấu cảm, bảo mật)
          this.notifications.push({
            id: baseId,
            studentId: Number(student.id),
            studentName: student.fullName,
            className: student.class?.name || "",
            classId: student.classId ? Number(student.classId) : null,
            gradeLevel: student.class?.ageGroup || "",
            ageInMonths,
            notificationType: isWeightLossFaltering
              ? "WEIGHT_LOSS_FALTERING"
              : isUnderweight
                ? "ABNORMAL_ZSCORE"
                : isStunted
                  ? "STUNTING_RISK"
                  : "OBESITY_RISK",
            severity,
            targetRole: "PARENT",
            title: `Kết quả theo dõi thể trạng định kỳ của bé ${student.fullName}`,
            message: `Kính gửi phụ huynh, theo số liệu cân đo mới nhất, bé ${
              student.fullName
            } có cân nặng ${currWeight}kg, chiều cao ${latest.heightCm}cm. ${
              isUnderweight
                ? "Bé đang thuộc ngưỡng nhẹ cân, cần được tăng cường dinh dưỡng."
                : isObese
                  ? "Bé thuộc ngưỡng thừa cân/béo phì, cần điều chỉnh lượng tinh bột và dầu mỡ."
                  : "Bé có dấu hiệu sụt cân so với kỳ đo trước."
            } Nhà trường kính mời phụ huynh đặt lịch hẹn tư vấn dinh dưỡng 1-1 qua ứng dụng KidMeal.`,
            metadata: {
              waz,
              haz,
              baz,
              weightKg: currWeight,
              heightCm: Number(latest.heightCm),
              previousWeightKg: prevWeight,
              weightDeltaKg: weightDelta,
              recommendationText:
                "Tham khảo thực đơn phục hồi từ chuyên gia dinh dưỡng của trường và chú ý chế độ ăn uống tại nhà.",
            },
            channels,
            slaTargetHours: isCritical ? 24 : 48,
            hoursElapsed: 1.0,
            isOverdue: false,
            status: "DISPATCHED",
            statusLabel: "Đã gửi tới phụ huynh",
            createdAt: new Date().toISOString(),
          });

          // 2. Thông báo cho NUTRITIONIST (Lâm sàng, can thiệp)
          this.notifications.push({
            id: baseId + 1,
            studentId: Number(student.id),
            studentName: student.fullName,
            className: student.class?.name || "",
            classId: Number(student.classId || 1),
            gradeLevel: student.class?.ageGroup || "",
            ageInMonths,
            notificationType: isWeightLossFaltering
              ? "WEIGHT_LOSS_FALTERING"
              : isUnderweight
                ? "ABNORMAL_ZSCORE"
                : isStunted
                  ? "STUNTING_RISK"
                  : "OBESITY_RISK",
            severity,
            targetRole: "NUTRITIONIST",
            title: `[LÂM SÀNG] Cảnh báo trẻ lệch chuẩn Z-score: ${student.fullName}`,
            message: `Học sinh ${student.fullName} (${student.class?.name}) phát hiện lệch chuẩn: WAZ ${waz}SD, HAZ ${haz}SD, BAZ ${baz}SD. Yêu cầu lập Thực đơn can thiệp cá nhân hóa (Personalized Diet Plan).`,
            metadata: {
              waz,
              haz,
              baz,
              weightKg: currWeight,
              heightCm: Number(latest.heightCm),
              previousWeightKg: prevWeight,
              weightDeltaKg: weightDelta,
              recommendationText:
                "Điều chỉnh tăng/giảm khẩu phần calo và lập phiếu tư vấn dinh dưỡng cá nhân.",
            },
            channels: ["MODAL_ALERT", "BADGE"],
            slaTargetHours: isCritical ? 24 : 48,
            hoursElapsed: 1.0,
            isOverdue: false,
            status: "DISPATCHED",
            statusLabel: "Chờ Dinh dưỡng xử lý",
            createdAt: new Date().toISOString(),
          });

          // 3. Thông báo cho TEACHER (Chăm sóc lớp)
          this.notifications.push({
            id: baseId + 2,
            studentId: Number(student.id),
            studentName: student.fullName,
            className: student.class?.name || "",
            classId: Number(student.classId || 1),
            gradeLevel: student.class?.ageGroup || "",
            ageInMonths,
            notificationType: isWeightLossFaltering
              ? "WEIGHT_LOSS_FALTERING"
              : isUnderweight
                ? "ABNORMAL_ZSCORE"
                : isStunted
                  ? "STUNTING_RISK"
                  : "OBESITY_RISK",
            severity,
            targetRole: "TEACHER",
            title: `Hướng dẫn chăm sóc thể chất tại lớp: Bé ${student.fullName}`,
            message: `Giáo viên lớp ${student.class?.name} lưu ý: Bé ${student.fullName} có thể trạng lệch chuẩn. Vui lòng hỗ trợ, động viên bé trong các bữa ăn tại lớp và theo dõi phản ứng tiêu hóa.`,
            metadata: {
              weightKg: currWeight,
              recommendationText:
                "Động viên ăn hết suất, chia nhỏ bữa ăn, tạo tâm lý thoải mái cho bé.",
            },
            channels: ["APP_PUSH", "BADGE"],
            slaTargetHours: isCritical ? 24 : 48,
            hoursElapsed: 1.0,
            isOverdue: false,
            status: "DISPATCHED",
            statusLabel: "Chờ GV xác nhận",
            createdAt: new Date().toISOString(),
          });

          newNotificationsCount += 3;
        }
      }
    }

    if (this.childRepo?.manager?.query) {
      for (const notification of this.notifications.slice(
        -newNotificationsCount || this.notifications.length,
      )) {
        let recipients: any[] = [];
        if (notification.targetRole === "PARENT")
          recipients = await this.childRepo.manager.query(
            "SELECT parent_id AS user_id FROM student_parents WHERE student_id=$1",
            [notification.studentId],
          );
        else if (notification.targetRole === "TEACHER" && notification.classId)
          recipients = await this.childRepo.manager.query(
            "SELECT homeroom_teacher_id AS user_id FROM classes WHERE id=$1 AND homeroom_teacher_id IS NOT NULL",
            [notification.classId],
          );
        else if (notification.targetRole === "NUTRITIONIST")
          recipients = await this.childRepo.manager.query(
            "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code=$1",
            ["NUTRITIONIST"],
          );
        for (const recipient of recipients)
          await this.childRepo.manager.query(
            "INSERT INTO notifications(user_id,title,content,type) VALUES ($1,$2,$3,$4)",
            [
              recipient.user_id,
              notification.title,
              notification.message,
              "GROWTH_ALERT",
            ],
          );
      }
    }
    await writeState(
      this.childRepo.manager,
      "growth-notifications:" + (schoolId || 1),
      this.notifications,
    );
    return {
      scannedCount: students.length,
      abnormalCount,
      dispatchedNotificationsCount: newNotificationsCount,
      summary: `Đã hoàn thành quét ${students.length} học sinh, phát hiện ${abnormalCount} trường hợp thể trạng bất thường và điều phối thông báo tự động theo 4 vai trò.`,
    };
  }

  /**
   * Lọc thông báo theo đúng Phân quyền & Phạm vi Dữ liệu (Role-Specific Visibility Scoping)
   */
  async getNotificationsByRole(
    role: string,
    userId: number,
    query: QueryGrowthNotificationsDto,
  ): Promise<GrowthNotificationItem[]> {
    const targetRole = role.toUpperCase();

    this.notifications = await readState(
      this.childRepo.manager,
      "growth-notifications:1",
      [],
    );
    let filtered = [...this.notifications];

    // Áp dụng Visibility Scoping nghiêm ngặt:
    if (targetRole === "PARENT") {
      // Phụ huynh chỉ thấy thông báo của con mình
      const links = this.childRepo?.manager?.query
        ? await this.childRepo.manager.query(
            "SELECT student_id FROM student_parents WHERE parent_id = $1",
            [userId],
          )
        : [];
      const allowed = new Set(links.map((r: any) => Number(r.student_id)));
      const studentId = query.studentId;
      filtered = filtered.filter(
        (n) =>
          n.targetRole === "PARENT" &&
          allowed.has(n.studentId) &&
          (!studentId || n.studentId === Number(studentId)),
      );
    } else if (targetRole === "TEACHER") {
      // Giáo viên chỉ thấy thông báo các học sinh trong lớp mình phụ trách
      const assigned = await this.classRepo.find({
        where: { homeroomTeacherId: userId },
      });
      const allowedClasses = new Set(assigned.map((c) => Number(c.id)));
      filtered = filtered.filter(
        (n) =>
          allowedClasses.has(n.classId) &&
          n.targetRole === "TEACHER" &&
          (!query.classId || n.classId === Number(query.classId)),
      );
    } else if (targetRole === "NUTRITIONIST") {
      // Dinh dưỡng thấy thông báo toàn trường với góc nhìn lâm sàng
      filtered = filtered.filter((n) => n.targetRole === "NUTRITIONIST");
    } else if (targetRole === "SCHOOL_MANAGER") {
      // Ban Giám Hiệu thấy toàn bộ các ca khẩn cấp và báo cáo tổng hợp
      filtered = filtered.filter(
        (n) => n.severity === "CRITICAL" || n.targetRole === "PARENT",
      );
    }

    // Bộ lọc Severity
    if (query.severity && query.severity !== "ALL") {
      filtered = filtered.filter((n) => n.severity === query.severity);
    }

    // Bộ lọc Status
    if (query.status && query.status !== "ALL") {
      filtered = filtered.filter((n) => n.status === query.status);
    }

    return filtered;
  }

  /**
   * Giáo viên / Dinh dưỡng xác nhận đã tiếp nhận chăm sóc (Acknowledge)
   */
  async acknowledgeNotification(
    id: number,
    userId: number,
    role: string,
    note?: string,
  ): Promise<GrowthNotificationItem> {
    this.notifications = await readState(
      this.childRepo.manager,
      "growth-notifications:1",
      [],
    );
    const item = this.notifications.find((n) => n.id === id);
    if (!item) {
      throw new NotFoundException(`Thông báo #${id} không tồn tại`);
    }

    item.status = "ACKNOWLEDGED";
    item.statusLabel = "Đã tiếp nhận chăm sóc";
    item.acknowledgedBy =
      role === "NUTRITIONIST"
        ? "Chuyên viên Dinh dưỡng"
        : role === "TEACHER"
          ? "Giáo viên chủ nhiệm lớp"
          : "Ban Giám Hiệu";
    item.acknowledgedAt = new Date().toISOString();

    if (note) {
      item.metadata.recommendationText = note;
    }

    await writeState(
      this.childRepo.manager,
      "growth-notifications:1",
      this.notifications,
    );
    return item;
  }

  /**
   * Chuyên viên Dinh dưỡng lập Thực đơn can thiệp cá nhân hóa (Personalized Diet Plan)
   */
  async assignInterventionDiet(
    payload: AssignInterventionDietDto,
    nutritionistId: number,
  ): Promise<GrowthNotificationItem> {
    this.notifications = await readState(
      this.childRepo.manager,
      "growth-notifications:1",
      [],
    );
    const item = this.notifications.find(
      (n) => n.id === payload.notificationId,
    );
    if (!item) {
      throw new NotFoundException(
        `Thông báo #${payload.notificationId} không tồn tại`,
      );
    }

    item.status = "INTERVENTION_APPLIED";
    item.statusLabel = "Đã áp dụng thực đơn can thiệp";
    item.metadata.interventionDietTitle = payload.interventionDietTitle;
    item.metadata.recommendationText = `${payload.nutritionGuidance} (Hẹn tái cân: ${
      payload.recheckDate || "sau 2 tuần"
    })`;
    item.acknowledgedBy = String(nutritionistId);
    item.acknowledgedAt = new Date().toISOString();

    await writeState(
      this.childRepo.manager,
      "growth-notifications:1",
      this.notifications,
    );
    return item;
  }

  /**
   * Phụ huynh đặt lịch hẹn tư vấn 1-1 với Chuyên viên Dinh dưỡng
   */
  async requestConsultation(
    payload: RequestConsultationDto,
    parentId: number,
  ): Promise<{ success: boolean; message: string; consultationDate: string }> {
    this.notifications = await readState(
      this.childRepo.manager,
      "growth-notifications:1",
      [],
    );
    const item = this.notifications.find(
      (n) => n.id === payload.notificationId,
    );
    if (!item) {
      throw new NotFoundException(
        `Thông báo #${payload.notificationId} không tồn tại`,
      );
    }

    item.consultationPreferredDate = payload.preferredDate;
    item.status = "READ";
    item.statusLabel = "Đã đặt lịch hẹn tư vấn 1-1";

    await writeState(
      this.childRepo.manager,
      "growth-notifications:1",
      this.notifications,
    );
    return {
      success: true,
      message: `Đã đặt lịch tư vấn dinh dưỡng 1-1 cho bé ${item.studentName} vào lúc ${payload.preferredDate}. Bác sĩ/Chuyên viên dinh dưỡng của trường sẽ liên hệ xác nhận với phụ huynh.`,
      consultationDate: payload.preferredDate,
    };
  }

  /**
   * Ban Giám Hiệu phê duyệt ngân sách tài trợ dinh dưỡng can thiệp
   */
  async approveInterventionBudget(
    payload: ApproveInterventionBudgetDto,
    managerId: number,
  ): Promise<{
    success: boolean;
    approvedCount: number;
    totalAmount: number;
    message: string;
  }> {
    this.notifications = await readState(
      this.childRepo.manager,
      "growth-notifications:1",
      [],
    );
    let count = 0;
    for (const id of payload.notificationIds) {
      const item = this.notifications.find((n) => n.id === id);
      if (item) {
        item.metadata.approvedBudgetAmount = payload.approvedBudgetAmount;
        item.status = "INTERVENTION_APPLIED";
        item.statusLabel = "BGH đã phê duyệt ngân sách hỗ trợ";
        count++;
      }
    }

    await writeState(
      this.childRepo.manager,
      "growth-notifications:1",
      this.notifications,
    );
    return {
      success: true,
      approvedCount: count,
      totalAmount: payload.approvedBudgetAmount,
      message: `Hiệu trưởng đã phê duyệt gói ngân sách y tế học đường ${payload.approvedBudgetAmount.toLocaleString(
        "vi-VN",
      )} VNĐ cho ${count} trường hợp học sinh cần can thiệp dinh dưỡng đặc biệt.`,
    };
  }

  /**
   * Báo cáo tổng hợp tình hình thể chất & cảnh báo toàn trường cho School Manager
   */
  async getExecutiveGrowthHealthSummary(
    schoolId: number = 1,
  ): Promise<ExecutiveGrowthHealthSummary> {
    const students = await this.childRepo.find({ where: { id: currentStudent(schoolId) }, relations: ["class"] });
    const records = await this.growthRepo.find({
      where: { studentId: currentStudent(schoolId), measuredDate: currentYearDate(schoolId) },
      relations: ["zscore"],
      order: { measuredDate: "DESC" },
    });
    const latest = new Map<number, any>();
    for (const r of records)
      if (!latest.has(Number(r.studentId)) && r.zscore)
        latest.set(Number(r.studentId), r);
    const measured = students.filter((c) => latest.has(Number(c.id)));
    const under = (r: any) => r.zscore.waz != null && Number(r.zscore.waz) < -2;
    const stunted = (r: any) =>
      r.zscore.haz != null && Number(r.zscore.haz) < -2;
    const obese = (r: any) => r.zscore.baz != null && Number(r.zscore.baz) > 2;
    const abnormal = (r: any) =>
      under(r) ||
      stunted(r) ||
      obese(r) ||
      (r.zscore.baz != null && Number(r.zscore.baz) < -2);
    const pct = (n: number) =>
      measured.length ? Math.round((n / measured.length) * 1000) / 10 : null;
    const scoped = measured.map((c) => latest.get(Number(c.id)));
    const schools = this.childRepo?.manager?.query
      ? await this.childRepo.manager.query(
          "SELECT name FROM schools WHERE id=$1",
          [schoolId],
        )
      : [];
    this.notifications = await readState(
      this.childRepo.manager,
      "growth-notifications:" + schoolId,
      [],
    );
    return {
      schoolId,
      schoolName: schools[0]?.name || "",
      totalStudents: students.length,
      screenedStudents: measured.length,
      normalDevelopmentRate: pct(scoped.filter((r) => !abnormal(r)).length),
      underweightRate: pct(scoped.filter(under).length),
      stuntedRate: pct(scoped.filter(stunted).length),
      obesityRate: pct(scoped.filter(obese).length),
      abnormalAlertCount: this.notifications.filter((n) =>
        ["CRITICAL", "HIGH"].includes(n.severity),
      ).length,
      criticalCasesCount: this.notifications.filter(
        (n) => n.severity === "CRITICAL",
      ).length,
      interventionsAppliedCount: this.notifications.filter(
        (n) => n.status === "INTERVENTION_APPLIED",
      ).length,
      pendingInterventionsCount: this.notifications.filter(
        (n) => n.status === "DISPATCHED",
      ).length,
      kpiComplianceStatus: null,
      topRiskClasses: [],
    };
  }
}
import { currentStudent, currentYearDate } from '../../academic-years/current-year-scope';
