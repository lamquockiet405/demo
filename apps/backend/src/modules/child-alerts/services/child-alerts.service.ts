import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Child } from '../../children/entities/child.entity';
import { ClassEntity } from '../../classes/entities/class.entity';
import { ChildAllergy } from '../../children/entities/child-allergy.entity';
import { DailyMealAttendance } from '../../attendance/entities/daily-meal-attendance.entity';
import { GrowthRecord, GrowthZscore } from '../../growth/entities/growth-record.entity';
import { Menu } from '../../menus/entities/menu.entity';
import { SnackRegistration } from '../../snack-services/entities/snack-registration.entity';
import { SnackServicePeriod } from '../../snack-services/entities/snack-service-period.entity';
import { ParentEvaluation } from '../../parent-evaluations/entities/parent-evaluation.entity';
import { QueryChildAlertsDto } from '../dto/query-child-alerts.dto';
import { ResolveAlertDto } from '../dto/resolve-alert.dto';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';

export interface AlertItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  timestamp: string;
  studentId?: string;
  studentName?: string;
  className?: string;
  metadata?: Record<string, any>;
  status?: 'UNRESOLVED' | 'RESOLVED' | 'ACKNOWLEDGED';
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
    const today = query?.date || new Date().toISOString().split('T')[0];

    // Chỉ báo xung đột dị ứng khi có kết quả đối chiếu thực đơn thực tế.
    const unresolvedAllergenConflicts: any[] = [];

    // 2. Cảnh báo bất thường diện rộng (>30% bỏ ăn hoặc báo đau bụng)
    const classes = await this.classRepo.find({ order: { name: 'ASC' } });
    const broadAnomalies: any[] = [];

    for (const c of classes) {
      const classStudents = await this.childRepo.find({ where: { classId: c.id } });
      const totalStudents = classStudents.length;
      if (totalStudents === 0) continue;

      const studentIds = classStudents.map((s) => s.id);
      const attendances = await this.attendanceRepo
        .createQueryBuilder('att')
        .where('att.student_id IN (:...studentIds)', { studentIds })
        .andWhere('att.date = :today', { today })
        .getMany();

      const notEating = attendances.filter(
        (att) => att.consumptionLevel === 'NONE' || (att.note && att.note.toLowerCase().includes('đau bụng')),
      );

      const notEatingCount = notEating.length;
      const pct = Math.round((notEatingCount / totalStudents) * 1000) / 10;

      // Kích hoạt khi >= 30% bỏ ăn hoặc số lượng >= 3
      if (pct >= 30.0 || (notEatingCount >= 3 && totalStudents <= 15)) {
        broadAnomalies.push({
          id: `ALT-SM-OUTBREAK-${c.id}`,
          type: 'BROAD_ANOMALY',
          classId: String(c.id),
          className: c.name,
          affectedCount: notEatingCount,
          classSize: totalStudents,
          percentage: pct,
          severity: 'CRITICAL' as const,
          symptoms: ['Không ăn trưa hoặc có ghi chú đau bụng'],
          message: `Lớp ${c.name} có ${notEatingCount}/${totalStudents} học sinh không ăn trưa hoặc được ghi chú đau bụng trong ngày.`,
          recommendedAction: 'Kiểm tra nhật ký điểm danh và xác minh tình trạng từng học sinh với giáo viên.',
        });
      }
    }

    // 3. Cảnh báo nợ phí dịch vụ bán trú/ăn xế
    const pendingSnackRegs = await this.snackRegRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.student', 'student')
      .leftJoinAndSelect('student.class', 'class')
      .leftJoinAndSelect('sr.period', 'period')
      .where('sr.status = :status', { status: 'PENDING' })
      .take(5)
      .getMany();

    const overduePayments = pendingSnackRegs
      .filter((sr) => sr.period?.registrationDeadline && sr.period.registrationDeadline < today)
      .map((sr, idx) => ({
      id: `ALT-SM-PAY-${sr.id || idx + 1}`,
      type: 'OVERDUE_PAYMENT',
      studentId: String(sr.studentId),
      studentName: sr.student?.fullName || 'Học sinh',
      className: sr.student?.class?.name || 'N/A',
      periodName: sr.period?.name || '',
      amountVnd: Number(sr.period?.feeAmount || 0),
      overdueDays: Math.max(0, Math.floor((Date.parse(today) - Date.parse(sr.period!.registrationDeadline)) / 86400000)),
      severity: 'WARNING' as const,
      message: `Tài khoản học sinh ${sr.student?.fullName || ''} quá hạn thanh toán phí dịch vụ ăn xế.`,
      recommendedAction: 'Chỉ đạo phòng Tài vụ gửi tin nhắn đôn đốc phụ huynh qua cổng thanh toán VNPAY.',
    }));

    // 4. Phản ánh từ phụ huynh chưa giải quyết
    const lowEvaluations = await this.evaluationRepo
      .createQueryBuilder('ev')
      .leftJoinAndSelect('ev.student', 'student')
      .leftJoinAndSelect('student.class', 'class')
      .leftJoinAndSelect('ev.replies', 'replies')
      .where('ev.rating <= :maxRating', { maxRating: 2 })
      .orderBy('ev.created_at', 'DESC')
      .take(5)
      .getMany();

    const unresolvedEvaluations = lowEvaluations.filter((e) => !e.replies || e.replies.length === 0);
    const parentComplaints = unresolvedEvaluations.map((ev, idx) => ({
      id: `ALT-SM-EVAL-${ev.id || idx + 1}`,
      type: 'PARENT_COMPLAINT',
      studentId: String(ev.studentId),
      studentName: ev.student?.fullName || 'Phụ huynh học sinh',
      className: ev.student?.class?.name || 'Chưa phân lớp',
      rating: ev.rating,
      comment: ev.comment || '',
      createdAt: ev.createdAt,
      status: 'UNRESOLVED' as const,
      severity: 'WARNING' as const,
      message: `Phụ huynh gửi khiếu nại đánh giá ${ev.rating} sao về khẩu phần ăn chưa được nhà trường giải quyết.`,
      recommendedAction: 'Phân công Chuyên viên dinh dưỡng hoặc Quản lý trường liên hệ phản hồi phụ huynh.',
    }));

    return {
      role: 'SCHOOL_MANAGER',
      scope: 'ALL_SCHOOL',
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
    const allergenCrossMatchingAlerts: any[] = [];

    // 2. Cảnh báo thể trạng suy giảm (Growth Risk Alert)
    const zscores = await this.zscoreRepo
      .createQueryBuilder('z')
      .leftJoinAndSelect('z.measurement', 'm')
      .leftJoinAndSelect('m.student', 'student')
      .leftJoinAndSelect('student.class', 'class')
      .where('z.waz < :cutoff OR z.haz < :cutoff OR z.baz < :cutoff', { cutoff: -2.0 })
      .orderBy('m.measured_date', 'DESC')
      .take(4)
      .getMany();

    const growthRiskAlerts = zscores.map((z, idx) => ({
      id: `ALT-NUT-GROWTH-${z.id || idx + 1}`,
      type: 'GROWTH_RISK',
      studentId: String(z.measurement?.studentId),
      studentName: z.measurement?.student?.fullName || 'Học sinh',
      className: z.measurement?.student?.class?.name || 'Chưa phân lớp',
      currentWaz: z.waz == null ? null : Number(z.waz),
      currentHaz: z.haz == null ? null : Number(z.haz),
      currentBaz: z.baz == null ? null : Number(z.baz),
      previousStatus: 'Chưa có dữ liệu kỳ trước',
      consecutiveDropPeriods: 0,
      severity: 'HIGH' as const,
      diagnosis: 'Có chỉ số Z-score dưới ngưỡng -2 SD trong lần đo gần nhất.',
      recommendedAction: 'Kiểm tra hồ sơ tăng trưởng trước khi lập kế hoạch can thiệp.',
    }));

    const micronutrientDeficitAlerts: any[] = [];

    return {
      role: 'NUTRITIONIST',
      scope: 'ALL_SCHOOL_CLINICAL',
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
  async getTeacherAlerts(teacherUserId?: number, classIdQuery?: string, query?: QueryChildAlertsDto) {
    let targetClassId = classIdQuery ? parseInt(classIdQuery, 10) : undefined;

    // Nếu không truyền classId, tìm lớp mà giáo viên làm chủ nhiệm
    if (!targetClassId && teacherUserId) {
      const homeroomClass = await this.classRepo.findOne({
        where: { homeroomTeacherId: teacherUserId },
      });
      if (homeroomClass) {
        targetClassId = homeroomClass.id;
      }
    }

    if (!targetClassId) {
      return {
        role: 'TEACHER', scope: 'UNASSIGNED', classId: '', className: '',
        totalAlerts: 0, trayFlaggingAlerts: [], poorConsumptionAlerts: [], medicalMedicationRequests: [],
      };
    }

    const currentClass = await this.classRepo.findOne({ where: { id: targetClassId } });
    const trayFlaggingAlerts: any[] = [];
    const poorConsumptionAlerts: any[] = [];
    const medicalMedicationRequests: any[] = [];

    return {
      role: 'TEACHER',
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
  async getParentAlerts(parentUserId?: number, studentIdQuery?: string, query?: QueryChildAlertsDto) {
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
      if (!studentIds.includes(qId)) {
        throw new ForbiddenException('Bạn không có quyền truy cập cảnh báo của học sinh này.');
      }
      studentIds = [qId];
    }

    if (studentIds.length === 0) {
      return { role: 'PARENT', scope: 'MY_CHILDREN', totalChildren: 0, children: [] };
    }

    const children = await this.childRepo.find({
      where: { id: In(studentIds) },
      relations: ['class'],
    });

    const today = query?.date || new Date().toISOString().split('T')[0];

    const childrenAlerts = await Promise.all(
      children.map(async (child) => {
        // Kiểm tra dị ứng của bé
        const allergies = await this.allergyRepo.find({
          where: { studentId: child.id },
          relations: ['allergen'],
        });

        const hasAllergy = allergies.length > 0;
        const allergenNames = allergies.map((a) => a.allergen?.name).join(', ');

        const menuSafetyAlert = hasAllergy
          ? {
              status: 'NOT_ASSESSED',
              badgeColor: 'amber',
              title: 'Hồ sơ dị ứng của bé',
              content: `Dị ứng đã khai báo: ${allergenNames}. Chưa có kết quả đối chiếu với thực đơn hôm nay.`,
              isSafe: false,
            }
          : {
              status: 'NOT_ASSESSED',
              badgeColor: 'slate',
              title: 'Hồ sơ dị ứng của bé',
              content: 'Chưa có dị ứng được khai báo trong hồ sơ. Chưa có kết quả đối chiếu thực đơn hôm nay.',
              isSafe: false,
            };

        // Lấy điểm danh và mức độ ăn hôm nay
        const att = await this.attendanceRepo.findOne({
          where: { studentId: child.id, date: today },
        });

        const dailyIntakeReport = {
          title: `Lượng ăn uống hôm nay (${today})`,
          lunchStatus: att?.consumptionLevel ? `Mức ăn trưa: ${att.consumptionLevel}` : 'Chưa ghi nhận mức ăn trưa',
          snackStatus: 'Chưa ghi nhận mức ăn xế',
          teacherNote: att?.note || '',
        };

        // Lấy Z-score gần nhất
        const latestRecord = await this.growthRepo
          .createQueryBuilder('gr')
          .leftJoinAndSelect('gr.zscore', 'zscore')
          .where('gr.student_id = :id', { id: child.id })
          .orderBy('gr.measured_date', 'DESC')
          .getOne();

        const waz = latestRecord?.zscore?.waz == null ? null : Number(latestRecord.zscore.waz);
        const cls = latestRecord?.zscore?.classification || '';

        const healthReminder = {
          title: 'Nhắc nhở y tế & Theo dõi thể lực',
          nextMeasurementDate: '',
          latestWaz: waz,
          statusLabel: cls || 'Chưa có kết quả đánh giá',
          nutritionistAdvice: '',
        };

        return {
          childId: String(child.id),
          childName: child.fullName,
          studentCode: child.studentCode,
          className: child.class?.name || 'Chưa phân lớp',
          menuSafetyAlert,
          dailyIntakeReport,
          healthReminder,
        };
      }),
    );

    return {
      role: 'PARENT',
      scope: 'MY_CHILDREN',
      totalChildren: childrenAlerts.length,
      children: childrenAlerts,
    };
  }

  /**
   * 5. Tổng hợp tự động theo vai trò (Role-Specific Visibility Scoping)
   */
  async getRoleScopedAlertsSummary(user: any, query?: QueryChildAlertsDto) {
    const roles: string[] = (user?.roles || []).map((r: any) =>
      typeof r === 'string' ? r.toUpperCase() : (r?.code || r?.name || '').toUpperCase(),
    );

    if (roles.includes('PARENT')) {
      return this.getParentAlerts(user.id, query?.studentId, query);
    }

    if (roles.includes('TEACHER')) {
      return this.getTeacherAlerts(user.id, query?.classId, query);
    }

    if (roles.includes('NUTRITIONIST')) {
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
        action: 'RESOLVE_CHILD_ALERT',
        targetEntity: 'CHILD_ALERT',
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
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      notes: dto.notes || 'Đã ghi nhận và xử lý cảnh báo thành công',
    };
  }
}
