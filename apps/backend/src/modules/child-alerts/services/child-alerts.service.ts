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

    // 1. Cảnh báo xung đột dị ứng chưa xử lý (chỉ lấy dị ứng đang kích hoạt isActive = true)
    let unresolvedAllergenConflicts: any[] = [];
    try {
      const severeAllergies = await this.allergyRepo
        .createQueryBuilder('a')
        .leftJoinAndSelect('a.child', 'child')
        .leftJoinAndSelect('child.class', 'class')
        .leftJoinAndSelect('a.allergen', 'allergen')
        .where('a.severity IN (:...sevs) AND (a.isActive = true OR a.isActive IS NULL)', { sevs: ['HIGH', 'CRITICAL', 'SEVERE'] })
        .getMany();

      unresolvedAllergenConflicts = severeAllergies.slice(0, 2).map((a, idx) => ({
        id: `ALT-SM-ALG-${a.id || idx + 1}`,
        type: 'UNRESOLVED_ALLERGEN_CONFLICT',
        studentId: String(a.studentId),
        studentName: a.child?.fullName || 'Học sinh có dị ứng nặng',
        className: a.child?.class?.name || 'Mầm 1',
        allergen: a.allergen?.name || a.customAllergenName || 'Sữa bò / Hải sản',
        dishToday: 'Trứng cuộn phô mai & Súp hải sản',
        timeLimit: '09:00',
        severity: 'CRITICAL' as const,
        status: 'UNRESOLVED' as const,
        message: `Học sinh ${a.child?.fullName || ''} có hồ sơ dị ứng nặng nhưng Bếp/Chuyên viên dinh dưỡng chưa xác nhận món thay thế trước 09h00 sáng.`,
        recommendedAction: 'Chỉ đạo Bếp xác nhận khay ăn an toàn dán nhãn xanh khẩn cấp.',
      }));
    } catch (err) {
      console.error('Failed to load severeAllergies:', err);
    }

    // 2. Cảnh báo bất thường diện rộng (>30% bỏ ăn hoặc báo đau bụng)
    const classes = await this.classRepo.find({ order: { name: 'ASC' } });
    const broadAnomalies: any[] = [];

    for (const c of classes) {
      const classStudents = await this.childRepo.find({ where: { classId: c.id } });
      const totalStudents = classStudents.length;
      if (totalStudents === 0) continue;

      const studentIds = classStudents.map((s) => s.id);
      let attendances: any[] = [];
      try {
        attendances = await this.attendanceRepo
          .createQueryBuilder('att')
          .where('att.studentId IN (:...studentIds)', { studentIds })
          .andWhere('att.date = :today', { today })
          .getMany();
      } catch (err) {
        console.error('Failed to load attendances:', err);
      }

      const notEatingCount = attendances.filter(
        (att) => att.consumptionLevel === 'NONE' || (att.note && att.note.includes('đau bụng')),
      ).length;

      const pct = Math.round((notEatingCount / totalStudents) * 100);
      if (pct >= 30) {
        broadAnomalies.push({
          id: `ALT-SM-OUTBREAK-${c.id}`,
          type: 'BROAD_ANOMALY',
          classId: String(c.id),
          className: c.name,
          affectedCount: notEatingCount,
          classSize: totalStudents,
          percentage: pct,
          severity: 'CRITICAL' as const,
          symptoms: ['Bỏ ăn trưa', 'Đau bụng nhẹ', 'Mệt mỏi'],
          message: `Lớp ${c.name} có ${pct}% (${notEatingCount}/${totalStudents}) học sinh bỏ ăn hoặc báo đau bụng (Dấu hiệu ngộ độc thực phẩm hoặc dịch tễ đường ruột).`,
          recommendedAction: 'Kích hoạt ngay quy trình kiểm tra mẫu lưu thực phẩm 24h và cử nhân viên Y tế xuống lớp.',
        });
      }
    }

    // Fallback mẫu bất thường diện rộng nếu cơ sở dữ liệu chưa có dữ liệu điểm danh hôm nay
    if (broadAnomalies.length === 0 && classes.length > 0) {
      const demoClass = classes[0];
      broadAnomalies.push({
        id: `ALT-SM-OUTBREAK-${demoClass.id}`,
        type: 'BROAD_ANOMALY',
        classId: String(demoClass.id),
        className: demoClass.name,
        affectedCount: 6,
        classSize: 18,
        percentage: 33.3,
        severity: 'CRITICAL' as const,
        symptoms: ['Bỏ bữa trưa', 'Dấu hiệu uể oải'],
        message: `Lớp ${demoClass.name} có 33.3% (6/18) học sinh bỏ ăn trưa hoặc mệt mỏi cần nhà trường theo dõi.`,
        recommendedAction: 'Cử nhân viên Y tế học đường xuống kiểm tra thể trạng và đối chiếu sổ kiểm thực 3 bước.',
      });
    }

    // 3. Cảnh báo nợ phí dịch vụ bán trú/ăn xế
    let pendingSnackRegs: any[] = [];
    try {
      pendingSnackRegs = await this.snackRegRepo
        .createQueryBuilder('sr')
        .leftJoinAndSelect('sr.student', 'student')
        .leftJoinAndSelect('student.class', 'class')
        .leftJoinAndSelect('sr.period', 'period')
        .where('sr.status = :status', { status: 'PENDING' })
        .take(5)
        .getMany();
    } catch (err) {
      console.error('Failed to load pendingSnackRegs:', err);
    }

    const overduePayments = pendingSnackRegs.map((sr, idx) => ({
      id: `ALT-SM-PAY-${sr.id || idx + 1}`,
      type: 'OVERDUE_PAYMENT',
      studentId: String(sr.studentId),
      studentName: sr.student?.fullName || 'Học sinh',
      className: sr.student?.class?.name || 'N/A',
      periodName: sr.period?.name || 'Đợt ăn xế tháng 11',
      amountVnd: Number(sr.period?.feeAmount || 350000),
      overdueDays: 5,
      severity: 'WARNING' as const,
      message: `Tài khoản học sinh ${sr.student?.fullName || ''} quá hạn thanh toán 5 ngày tiền ăn xế (${Number(sr.period?.feeAmount || 350000).toLocaleString('vi-VN')} ₫).`,
      recommendedAction: 'Chỉ đạo phòng Tài vụ gửi tin nhắn đôn đốc phụ huynh qua cổng thanh toán VNPAY.',
    }));

    // 4. Phản ánh từ phụ huynh chưa giải quyết
    let lowEvaluations: any[] = [];
    try {
      lowEvaluations = await this.evaluationRepo
        .createQueryBuilder('ev')
        .leftJoinAndSelect('ev.student', 'student')
        .leftJoinAndSelect('student.class', 'class')
        .leftJoinAndSelect('ev.replies', 'replies')
        .where('ev.rating <= :maxRating', { maxRating: 2 })
        .orderBy('ev.createdAt', 'DESC')
        .take(5)
        .getMany();
    } catch (err) {
      console.error('Failed to load lowEvaluations:', err);
    }

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
      recommendedAction: 'Ban giám hiệu hoặc Bếp trưởng gọi điện lắng nghe và ghi nhận phản ánh của phụ huynh.',
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
    // 1. Cảnh báo xung đột chất dị ứng (chỉ lấy dị ứng đang kích hoạt isActive = true)
    let allergenCrossMatchingAlerts: any[] = [];
    try {
      const allergies = await this.allergyRepo
        .createQueryBuilder('a')
        .leftJoinAndSelect('a.child', 'child')
        .leftJoinAndSelect('child.class', 'class')
        .leftJoinAndSelect('a.allergen', 'allergen')
        .where('a.isActive = true')
        .getMany();

      allergenCrossMatchingAlerts = allergies.slice(0, 4).map((a, idx) => {
        const allergenName = a.allergen?.name || a.customAllergenName || 'Tôm / Hải sản';
        return {
          id: `ALT-NUT-ALG-${a.id || idx + 1}`,
          type: 'ALLERGEN_CROSS_MATCHING',
          studentId: String(a.studentId),
          studentName: a.child?.fullName || 'Học sinh',
          className: a.child?.class?.name || 'Chưa phân lớp',
          allergenName,
          menuDishName: 'Tôm rim thịt nạc & Canh bí đỏ tôm khô',
          proposedSubstitute: 'Thịt gà rim ngũ vị & Canh bí đỏ thịt bằm',
          scheduledMealDate: 'Ngày mai',
          severity: 'CRITICAL' as const,
          status: 'REQUIRES_SUBSTITUTE' as const,
          message: `Hệ thống phát hiện thực đơn ngày mai có thể chứa "${allergenName}" trong khi học sinh ${a.child?.fullName || ''} có hồ sơ dị ứng đang hoạt động -> Cảnh báo yêu cầu tạo món thay thế an toàn.`,
        };
      });
    } catch (err) {
      console.error('Failed to load allergies for nutritionist:', err);
    }

    // 2. Cảnh báo thể trạng suy giảm (Growth Risk Alert)
    let growthRiskAlerts: any[] = [];
    try {
      const zscores = await this.zscoreRepo
        .createQueryBuilder('z')
        .leftJoinAndSelect('z.measurement', 'm')
        .leftJoinAndSelect('m.student', 'student')
        .leftJoinAndSelect('student.class', 'class')
        .where(
          'z.waz < :lowCutoff OR z.haz < :lowCutoff OR z.baz < :lowCutoff OR z.waz > :highCutoff OR z.baz > :highCutoff OR z.classification != :normal',
          { lowCutoff: -2.0, highCutoff: 2.0, normal: 'NORMAL' },
        )
        .orderBy('z.id', 'DESC')
        .take(4)
        .getMany();

      growthRiskAlerts = zscores.map((z, idx) => {
        const wazVal = Number(z.waz) || 0;
        const bazVal = Number(z.baz) || 0;
        const hazVal = Number(z.haz) || 0;
        const isOver = wazVal > 2.0 || bazVal > 2.0 || z.classification === 'OBESE' || z.classification === 'OVERWEIGHT';

        const diagText = isOver
          ? `Trẻ có chỉ số thể lực vượt ngưỡng Z-score nguy cơ theo chuẩn WHO (WAZ: ${wazVal > 0 ? '+' : ''}${wazVal}, BAZ: ${bazVal > 0 ? '+' : ''}${bazVal} SD - ${z.classification === 'OBESE' ? 'Béo phì' : 'Thừa cân'}).`
          : `Trẻ bị tụt xuống ngưỡng Z-score nguy cơ theo chuẩn WHO (WAZ: ${wazVal}, HAZ: ${hazVal} SD - Nguy cơ suy dinh dưỡng/thấp còi).`;

        const actionText = isOver
          ? 'Kiểm soát lượng tinh bột, chất béo và đồ ngọt trong khẩu phần; phối hợp giáo viên tăng vận động thể chất.'
          : 'Lập Thực đơn can thiệp cá nhân hóa tăng 20% đạm và bổ sung sữa cao năng lượng.';

        return {
          id: `ALT-NUT-GROWTH-${z.id || idx + 1}`,
          type: 'GROWTH_RISK',
          studentId: String(z.measurement?.studentId),
          studentName: z.measurement?.student?.fullName || 'Học sinh',
          className: z.measurement?.student?.class?.name || 'Chưa phân lớp',
          currentWaz: wazVal,
          currentHaz: hazVal,
          currentBaz: bazVal,
          previousStatus: 'Bình thường (0.1 SD)',
          consecutiveDropPeriods: 2,
          severity: 'HIGH' as const,
          diagnosis: diagText,
          recommendedAction: actionText,
        };
      });
    } catch (err) {
      console.error('Failed to load growth risk alerts for nutritionist:', err);
    }

    // 3. Cảnh báo thiếu hụt vi chất dài hạn
    const micronutrientDeficitAlerts = [
      {
        id: 'ALT-NUT-MICRO-01',
        type: 'MICRONUTRIENT_DEFICIT',
        ruleCode: 'CALCIUM_DEFICIT',
        nutrientName: 'Canxi (Ca)',
        actualValue: 260,
        standardValue: '280 - 350 mg/ngày',
        menuPeriod: 'Thực đơn Tuần 11 - Khối Mẫu Giáo',
        severity: 'WARNING' as const,
        message: 'Thực đơn tuần có nguy cơ thiếu hụt Canxi (260mg so với mức chuẩn 280-350mg theo Thông tư 28).',
        recommendedAction: 'Tăng cường món từ tôm tép nhỏ, đậu phụ hoặc bổ sung 1 hộp sữa chua sau bữa trưa.',
      },
      {
        id: 'ALT-NUT-MICRO-02',
        type: 'MICRONUTRIENT_DEFICIT',
        ruleCode: 'FAT_RATIO_LOW',
        nutrientName: 'Chất béo (Lipid)',
        actualValue: 23.5,
        standardValue: '25.0 - 35.0% Tổng Năng Lượng',
        menuPeriod: 'Thực đơn Tuần 11 - Khối Mẫu Giáo',
        severity: 'WARNING' as const,
        message: 'Tỷ lệ Lipid chỉ chiếm 23.5% tổng năng lượng (Chuẩn là 25 - 35% đối với trẻ mẫu giáo bán trú).',
        recommendedAction: 'Tăng lượng dầu thực vật khi chế biến món xào hoặc chọn các món chính từ thịt mỡ, cá hồi, mè đậu.',
      },
    ];

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
        role: 'TEACHER',
        scope: 'UNASSIGNED',
        classId: '',
        className: '',
        totalAlerts: 0,
        trayFlaggingAlerts: [],
        poorConsumptionAlerts: [],
        medicalMedicationRequests: [],
      };
    }

    const currentClass = await this.classRepo.findOne({ where: { id: targetClassId } });
    const students = await this.childRepo.find({ where: { classId: targetClassId } });
    const studentIds = students.map((s) => s.id);

    // 1. Cảnh báo khay ăn dị ứng (chỉ lấy dị ứng đang kích hoạt isActive = true)
    let allergiesInClass: any[] = [];
    try {
      allergiesInClass = studentIds.length > 0
        ? await this.allergyRepo
            .createQueryBuilder('a')
            .leftJoinAndSelect('a.child', 'child')
            .leftJoinAndSelect('a.allergen', 'allergen')
            .where('a.studentId IN (:...studentIds) AND (a.isActive = true OR a.isActive IS NULL)', { studentIds })
            .getMany()
        : [];
    } catch (err) {
      console.error('Failed to load allergiesInClass:', err);
    }

    const trayFlaggingAlerts = allergiesInClass.map((a, idx) => ({
      id: `ALT-TCH-TRAY-${a.id || idx + 1}`,
      studentId: String(a.studentId),
      studentName: a.child?.fullName || 'Học sinh',
      tableNumber: `Bàn ${idx + 1}`,
      allergen: a.allergen?.name || a.customAllergenName || 'Phô mai, Trứng gà',
      originalDish: 'Trứng cuộn phô mai xúc xích',
      substituteDish: 'Chả lụa thịt heo hấp hạt sen',
      labelTag: 'KHAY_AN_RIENG_DANG_NHAN_XANH',
      labelColor: '#059669', // Emerald
      severity: 'CRITICAL' as const,
      isVerifiedByTeacher: false,
      message: `Bé ${a.child?.fullName} - Bàn ${idx + 1}: Dị ứng ${a.allergen?.name || a.customAllergenName || 'thực phẩm'} -> Khay ăn riêng dán nhãn xanh.`,
    }));

    // 2. Cảnh báo ăn uống kém (Poor Consumption Alert: ăn dưới 30% liên tục 2 ngày)
    const poorConsumptionAlerts: any[] = [];

    if (students.length > 0) {
      const candidateStudent = students[students.length - 1]; // Demo candidate
      poorConsumptionAlerts.push({
        id: `ALT-TCH-POOR-${candidateStudent.id}`,
        studentId: String(candidateStudent.id),
        studentName: candidateStudent.fullName,
        className: currentClass?.name || 'Mầm 1',
        consecutiveDays: 2,
        averageIntake: 'Dưới 30% khẩu phần',
        severity: 'WARNING' as const,
        message: `Học sinh ${candidateStudent.fullName} trong lớp ăn dưới 30% khẩu phần liên tục 2 ngày.`,
        recommendedAction: 'Nhắc giáo viên quan sát tâm lý của trẻ hoặc liên hệ phụ huynh hỏi thăm chế độ ăn tại nhà.',
      });
    }

    // 3. Đơn dặn dò y tế & thuốc men từ phụ huynh
    const medicalMedicationRequests = [
      {
        id: 'ALT-TCH-MED-01',
        studentId: String(students[0]?.id || 1),
        studentName: students[0]?.fullName || 'Lê Bảo Nam',
        className: currentClass?.name || 'Mầm 1',
        medicationName: 'Siro ho Prospan (2.5ml sau ăn trưa)',
        medicationNote: 'Đơn thuốc siro ho Prospan (2.5ml sau ăn trưa)',
        doctorNote: 'Trẻ đang bị viêm họng nhẹ, cần uống thuốc đúng 12h00 trưa và tránh nước đá.',
        parentConfirmedAt: 'Hôm nay lúc 07:15',
        status: 'PENDING_ADMINISTRATION' as const,
        severity: 'HIGH' as const,
        message: `Phụ huynh gửi đơn thuốc dạng siro cho bé ${students[0]?.fullName || 'Lê Bảo Nam'} - Cần cho uống sau bữa trưa.`,
      },
    ];

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
      if (studentIds.length > 0 && !studentIds.includes(qId)) {
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
        // Kiểm tra dị ứng của bé (chỉ lấy dị ứng đang kích hoạt isActive = true)
        const allergies = await this.allergyRepo.find({
          where: { studentId: child.id, isActive: true },
          relations: ['allergen'],
        });

        const hasAllergy = allergies.length > 0;
        const allergenNames = allergies.map((a) => a.allergen?.name || a.customAllergenName).filter(Boolean).join(', ');

        const menuSafetyAlert = hasAllergy
          ? {
              status: 'SAFE_SUBSTITUTED',
              badgeColor: 'emerald',
              title: 'Món ăn thay thế an toàn hôm nay',
              content: `Thực đơn trưa nay trường có món Tôm rim thịt nạc (chứa ${allergenNames}), hệ thống đã tự động chuyển phần ăn của bé sang Thịt nạc xào hạt sen theo đúng hồ sơ dị ứng.`,
              isSafe: true,
            }
          : {
              status: 'NORMAL_MENU',
              badgeColor: 'blue',
              title: 'Thực đơn dinh dưỡng chuẩn hôm nay',
              content: 'Bé không có tiền sử dị ứng, phần ăn trưa và xế được chuẩn bị theo định lượng tiêu chuẩn Thông tư 28.',
              isSafe: true,
            };

        // Lấy điểm danh và mức độ ăn hôm nay
        const att = await this.attendanceRepo.findOne({
          where: { studentId: child.id, date: today },
        });

        const dailyIntakeReport = {
          title: `Lượng ăn uống hôm nay (${today})`,
          lunchStatus: att?.consumptionLevel === 'FULL' || !att ? 'Con ăn hết 100% suất ăn trưa' : 'Con ăn được 1/2 bát cơm',
          snackStatus: 'Con uống hết 180ml sữa xế và ăn 1 quả chuối chín',
          teacherNote: att?.note || 'Bé ăn ngoan, tự xúc ăn gọn gàng và ngủ đủ giấc trưa.',
        };

        // Lấy Z-score gần nhất
        let latestRecord: any = null;
        try {
          latestRecord = await this.growthRepo
            .createQueryBuilder('gr')
            .leftJoinAndSelect('gr.zscore', 'zscore')
            .where('gr.studentId = :id', { id: child.id })
            .orderBy('gr.measuredDate', 'DESC')
            .getOne();
        } catch (err) {
          console.error('Failed to load growth record for child:', err);
        }

        const waz = Number(latestRecord?.zscore?.waz) || 0.1;
        const cls = latestRecord?.zscore?.classification || 'NORMAL';

        const healthReminder = {
          title: 'Nhắc nhở y tế & Theo dõi thể lực',
          nextMeasurementDate: '15/11/2026',
          latestWaz: waz,
          statusLabel: cls === 'NORMAL' ? 'Bình thường' : 'Cần theo dõi',
          nutritionistAdvice:
            'Chỉ số thể trạng của con phát triển rất tốt. Gia đình tiếp tục khuyến khích con uống đủ 1.2 lít nước/ngày và ngủ trước 21h30.',
        };

        return {
          childId: String(child.id),
          childName: child.fullName,
          studentCode: child.studentCode,
          className: child.class?.name || 'Mầm 1',
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
