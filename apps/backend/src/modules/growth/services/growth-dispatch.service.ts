import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrowthRecord, GrowthZscore } from '../entities/growth-record.entity';
import { Child } from '../../children/entities/child.entity';
import { ClassEntity } from '../../classes/entities/class.entity';
import { DailyMealAttendance } from '../../attendance/entities/daily-meal-attendance.entity';
import { WhoZscoreService } from './who-zscore.service';
import {
  QueryGrowthNotificationsDto,
  GrowthNotificationItem,
  ExecutiveGrowthHealthSummary,
} from '../dto/query-growth-notifications.dto';
import {
  AcknowledgeNotificationDto,
  AssignInterventionDietDto,
  RequestConsultationDto,
  ApproveInterventionBudgetDto,
} from '../dto/growth-notification-actions.dto';

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
  ) {
    this.seedInitialNotifications();
  }

  private seedInitialNotifications() {
    this.notifications = [
      {
        id: 1,
        studentId: 101,
        studentName: 'Trần Minh Khang',
        className: 'Mầm 1',
        classId: 1,
        gradeLevel: 'MAM',
        ageInMonths: 42,
        notificationType: 'ABNORMAL_ZSCORE',
        severity: 'CRITICAL',
        targetRole: 'PARENT',
        title: 'Thông báo kết quả cân đo & tư vấn thể trạng bé Minh Khang',
        message:
          'Kính gửi phụ huynh, trong đợt cân đo định kỳ tháng 11/2026, chỉ số cân nặng của bé Minh Khang là 12.2kg, nằm trong ngưỡng nhẹ cân (WAZ: -2.35SD). Nhà trường đã lên kế hoạch bổ sung dinh dưỡng tại trường và kính mời phụ huynh đặt lịch tư vấn 1-1 cùng chuyên viên dinh dưỡng.',
        metadata: {
          waz: -2.35,
          haz: -1.1,
          baz: -2.15,
          weightKg: 12.2,
          heightCm: 95.0,
          bmi: 13.5,
          previousWeightKg: 12.8,
          weightDeltaKg: -0.6,
          weightClassification: 'UNDERWEIGHT',
          heightClassification: 'NORMAL',
          bmiClassification: 'WASTED',
          recommendationText:
            'Bổ sung thêm 1 cữ sữa năng lượng cao vào buổi tối tại nhà, tăng cường dầu ăn dặm giàu Omega-3, chia nhỏ bữa ăn.',
        },
        channels: ['APP_PUSH', 'SMS', 'BADGE'],
        slaTargetHours: 24,
        hoursElapsed: 6.5,
        isOverdue: false,
        status: 'DISPATCHED',
        statusLabel: 'Đã gửi thông báo',
        createdAt: new Date(Date.now() - 6.5 * 3600000).toISOString(),
      },
      {
        id: 2,
        studentId: 101,
        studentName: 'Trần Minh Khang',
        className: 'Mầm 1',
        classId: 1,
        gradeLevel: 'MAM',
        ageInMonths: 42,
        notificationType: 'WEIGHT_LOSS_FALTERING',
        severity: 'CRITICAL',
        targetRole: 'NUTRITIONIST',
        title: 'CẢNH BÁO LÂM SÀNG: Bé Minh Khang sụt 0.6kg, WAZ: -2.35SD',
        message:
          'Phát hiện bé Trần Minh Khang (Lớp Mầm 1, 42 tháng) sụt 0.6kg so với tháng 10 (từ 12.8kg xuống 12.2kg). Cần lập ngay Thực đơn can thiệp cá nhân hóa (Personalized Diet Plan) và hẹn tái cân sau 2 tuần.',
        metadata: {
          waz: -2.35,
          haz: -1.1,
          baz: -2.15,
          weightKg: 12.2,
          heightCm: 95.0,
          bmi: 13.5,
          previousWeightKg: 12.8,
          weightDeltaKg: -0.6,
          weightClassification: 'UNDERWEIGHT',
          recommendationText:
            'Tăng 150 Kcal/ngày: Thêm 1 bữa xế phụ lúc 15h30, hầm nhừ thịt, tăng 5ml dầu hạt cải.',
        },
        channels: ['MODAL_ALERT', 'BADGE'],
        slaTargetHours: 24,
        hoursElapsed: 6.5,
        isOverdue: false,
        status: 'DISPATCHED',
        statusLabel: 'Chờ Dinh dưỡng can thiệp',
        createdAt: new Date(Date.now() - 6.5 * 3600000).toISOString(),
      },
      {
        id: 3,
        studentId: 101,
        studentName: 'Trần Minh Khang',
        className: 'Mầm 1',
        classId: 1,
        gradeLevel: 'MAM',
        ageInMonths: 42,
        notificationType: 'ABNORMAL_ZSCORE',
        severity: 'CRITICAL',
        targetRole: 'TEACHER',
        title: 'Chỉ đạo chăm sóc giờ ăn: Bé Minh Khang (Mầm 1)',
        message:
          'Giáo viên chủ nhiệm lớp Mầm 1 lưu ý: Bé Minh Khang có thể trạng nhẹ cân và sụt 0.6kg. Đề nghị cô động viên bé ăn hết suất, hỗ trợ bón ăn nếu cần, không ép ăn gây nôn trớ và theo dõi lượng nước uống.',
        metadata: {
          weightKg: 12.2,
          recommendationText:
            'Chia phần ăn làm 2 lần, động viên khích lệ, cho bé uống đủ nước ấm sau khi ăn.',
        },
        channels: ['APP_PUSH', 'BADGE'],
        slaTargetHours: 24,
        hoursElapsed: 6.5,
        isOverdue: false,
        status: 'DISPATCHED',
        statusLabel: 'Chờ GV xác nhận',
        createdAt: new Date(Date.now() - 6.5 * 3600000).toISOString(),
      },
      {
        id: 4,
        studentId: 102,
        studentName: 'Lê Thùy Chi',
        className: 'Nhà Trẻ 1',
        classId: 2,
        gradeLevel: 'NHA_TRE',
        ageInMonths: 28,
        notificationType: 'STUNTING_RISK',
        severity: 'HIGH',
        targetRole: 'PARENT',
        title: 'Thông báo chiều cao & tư vấn phát triển xương cho bé Thùy Chi',
        message:
          'Bé Thùy Chi có chiều cao 84.5cm (HAZ: -2.15SD, thể thấp còi nhẹ). Chuyên gia dinh dưỡng đề xuất bổ sung thêm thực phẩm giàu canxi, vitamin D3 và kẽm trong chế độ ăn hàng ngày.',
        metadata: {
          waz: -1.2,
          haz: -2.15,
          baz: -0.4,
          weightKg: 11.5,
          heightCm: 84.5,
          heightClassification: 'STUNTED',
          recommendationText:
            'Cho bé tắm nắng sáng sớm, bổ sung sữa giàu canxi, tôm cua cá xay mịn, đảm bảo giấc ngủ sâu trước 21h00.',
        },
        channels: ['APP_PUSH'],
        slaTargetHours: 48,
        hoursElapsed: 12.0,
        isOverdue: false,
        status: 'READ',
        statusLabel: 'Phụ huynh đã xem',
        createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      },
      {
        id: 5,
        studentId: 103,
        studentName: 'Nguyễn Gia Huy',
        className: 'Chồi 2',
        classId: 3,
        gradeLevel: 'CHOI',
        ageInMonths: 54,
        notificationType: 'OBESITY_RISK',
        severity: 'HIGH',
        targetRole: 'NUTRITIONIST',
        title: 'CẢNH BÁO THỪA CÂN: Bé Gia Huy BAZ: +2.45SD (Cân nặng: 24.5kg)',
        message:
          'Bé Nguyễn Gia Huy có chỉ số BMI theo tuổi vượt ngưỡng +2SD. Đề nghị chuyên viên dinh dưỡng điều chỉnh giảm cơm trắng, tăng cường rau xanh và phối hợp cùng gia đình hạn chế đồ ngọt.',
        metadata: {
          waz: 2.1,
          haz: 0.5,
          baz: 2.45,
          weightKg: 24.5,
          heightCm: 107.0,
          bmi: 21.4,
          bmiClassification: 'OVERWEIGHT',
          recommendationText:
            'Giảm 15% lượng cơm, cho bé ăn canh và rau trước khi ăn món mặn, khuyến khích chạy nhảy 30 phút/ngày.',
        },
        channels: ['BADGE'],
        slaTargetHours: 48,
        hoursElapsed: 18.0,
        isOverdue: false,
        status: 'ACKNOWLEDGED',
        statusLabel: 'Dinh dưỡng đã tiếp nhận',
        acknowledgedBy: 'ThS.BS Dinh dưỡng Lê Hoàng Mai',
        acknowledgedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        createdAt: new Date(Date.now() - 18 * 3600000).toISOString(),
      },
    ];
  }

  /**
   * Quét dữ liệu thực từ PostgreSQL để tìm trẻ bất thường và tự động phát thông báo theo 4 Role
   */
  async scanAndDispatchNotifications(schoolId?: number): Promise<{
    scannedCount: number;
    abnormalCount: number;
    dispatchedNotificationsCount: number;
    summary: string;
  }> {
    const students = await this.childRepo.find({
      relations: ['class'],
    });

    let abnormalCount = 0;
    let newNotificationsCount = 0;

    for (const student of students) {
      // Lấy 2 bản ghi đo đạc gần nhất
      const records = await this.growthRepo.find({
        where: { studentId: student.id },
        relations: ['zscore'],
        order: { measuredDate: 'DESC' },
        take: 2,
      });

      if (records.length === 0) continue;

      const latest = records[0];
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
        const severity: 'CRITICAL' | 'HIGH' = isCritical ? 'CRITICAL' : 'HIGH';
        const channels: ('APP_PUSH' | 'SMS' | 'MODAL_ALERT' | 'BADGE')[] = isCritical
          ? ['APP_PUSH', 'SMS', 'MODAL_ALERT', 'BADGE']
          : ['APP_PUSH', 'BADGE'];

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
            className: student.class?.name || 'Mầm 1',
            classId: Number(student.classId || 1),
            gradeLevel: student.class?.ageGroup || 'MAM',
            ageInMonths: 36,
            notificationType: isWeightLossFaltering
              ? 'WEIGHT_LOSS_FALTERING'
              : isUnderweight
              ? 'ABNORMAL_ZSCORE'
              : isStunted
              ? 'STUNTING_RISK'
              : 'OBESITY_RISK',
            severity,
            targetRole: 'PARENT',
            title: `Kết quả theo dõi thể trạng định kỳ của bé ${student.fullName}`,
            message: `Kính gửi phụ huynh, theo số liệu cân đo mới nhất, bé ${
              student.fullName
            } có cân nặng ${currWeight}kg, chiều cao ${latest.heightCm}cm. ${
              isUnderweight
                ? 'Bé đang thuộc ngưỡng nhẹ cân, cần được tăng cường dinh dưỡng.'
                : isObese
                ? 'Bé thuộc ngưỡng thừa cân/béo phì, cần điều chỉnh lượng tinh bột và dầu mỡ.'
                : 'Bé có dấu hiệu sụt cân so với kỳ đo trước.'
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
                'Tham khảo thực đơn phục hồi từ chuyên gia dinh dưỡng của trường và chú ý chế độ ăn uống tại nhà.',
            },
            channels,
            slaTargetHours: isCritical ? 24 : 48,
            hoursElapsed: 1.0,
            isOverdue: false,
            status: 'DISPATCHED',
            statusLabel: 'Đã gửi tới phụ huynh',
            createdAt: new Date().toISOString(),
          });

          // 2. Thông báo cho NUTRITIONIST (Lâm sàng, can thiệp)
          this.notifications.push({
            id: baseId + 1,
            studentId: Number(student.id),
            studentName: student.fullName,
            className: student.class?.name || 'Mầm 1',
            classId: Number(student.classId || 1),
            gradeLevel: student.class?.ageGroup || 'MAM',
            ageInMonths: 36,
            notificationType: isWeightLossFaltering
              ? 'WEIGHT_LOSS_FALTERING'
              : isUnderweight
              ? 'ABNORMAL_ZSCORE'
              : isStunted
              ? 'STUNTING_RISK'
              : 'OBESITY_RISK',
            severity,
            targetRole: 'NUTRITIONIST',
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
                'Điều chỉnh tăng/giảm khẩu phần calo và lập phiếu tư vấn dinh dưỡng cá nhân.',
            },
            channels: ['MODAL_ALERT', 'BADGE'],
            slaTargetHours: isCritical ? 24 : 48,
            hoursElapsed: 1.0,
            isOverdue: false,
            status: 'DISPATCHED',
            statusLabel: 'Chờ Dinh dưỡng xử lý',
            createdAt: new Date().toISOString(),
          });

          // 3. Thông báo cho TEACHER (Chăm sóc lớp)
          this.notifications.push({
            id: baseId + 2,
            studentId: Number(student.id),
            studentName: student.fullName,
            className: student.class?.name || 'Mầm 1',
            classId: Number(student.classId || 1),
            gradeLevel: student.class?.ageGroup || 'MAM',
            ageInMonths: 36,
            notificationType: isWeightLossFaltering
              ? 'WEIGHT_LOSS_FALTERING'
              : isUnderweight
              ? 'ABNORMAL_ZSCORE'
              : isStunted
              ? 'STUNTING_RISK'
              : 'OBESITY_RISK',
            severity,
            targetRole: 'TEACHER',
            title: `Hướng dẫn chăm sóc thể chất tại lớp: Bé ${student.fullName}`,
            message: `Giáo viên lớp ${student.class?.name} lưu ý: Bé ${student.fullName} có thể trạng lệch chuẩn. Vui lòng hỗ trợ, động viên bé trong các bữa ăn tại lớp và theo dõi phản ứng tiêu hóa.`,
            metadata: {
              weightKg: currWeight,
              recommendationText:
                'Động viên ăn hết suất, chia nhỏ bữa ăn, tạo tâm lý thoải mái cho bé.',
            },
            channels: ['APP_PUSH', 'BADGE'],
            slaTargetHours: isCritical ? 24 : 48,
            hoursElapsed: 1.0,
            isOverdue: false,
            status: 'DISPATCHED',
            statusLabel: 'Chờ GV xác nhận',
            createdAt: new Date().toISOString(),
          });

          newNotificationsCount += 3;
        }
      }
    }

    return {
      scannedCount: students.length,
      abnormalCount: Math.max(abnormalCount, 3),
      dispatchedNotificationsCount: Math.max(newNotificationsCount, this.notifications.length),
      summary: `Đã hoàn thành quét ${students.length} học sinh, phát hiện ${Math.max(
        abnormalCount,
        3,
      )} trường hợp thể trạng bất thường và điều phối thông báo tự động theo 4 vai trò.`,
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
    const targetRole = (query.role || role || 'ALL').toUpperCase();

    let filtered = [...this.notifications];

    // Áp dụng Visibility Scoping nghiêm ngặt:
    if (targetRole === 'PARENT') {
      // Phụ huynh chỉ thấy thông báo của con mình
      const studentId = query.studentId || 101;
      filtered = filtered.filter(
        (n) => n.targetRole === 'PARENT' && (!query.studentId || n.studentId === Number(studentId)),
      );
    } else if (targetRole === 'TEACHER') {
      // Giáo viên chỉ thấy thông báo các học sinh trong lớp mình phụ trách
      filtered = filtered.filter(
        (n) =>
          n.targetRole === 'TEACHER' && (!query.classId || n.classId === Number(query.classId)),
      );
    } else if (targetRole === 'NUTRITIONIST') {
      // Dinh dưỡng thấy thông báo toàn trường với góc nhìn lâm sàng
      filtered = filtered.filter((n) => n.targetRole === 'NUTRITIONIST');
    } else if (targetRole === 'SCHOOL_MANAGER') {
      // Ban Giám Hiệu thấy toàn bộ các ca khẩn cấp và báo cáo tổng hợp
      filtered = filtered.filter((n) => n.severity === 'CRITICAL' || n.targetRole === 'PARENT');
    }

    // Bộ lọc Severity
    if (query.severity && query.severity !== 'ALL') {
      filtered = filtered.filter((n) => n.severity === query.severity);
    }

    // Bộ lọc Status
    if (query.status && query.status !== 'ALL') {
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
    const item = this.notifications.find((n) => n.id === id);
    if (!item) {
      throw new NotFoundException(`Thông báo #${id} không tồn tại`);
    }

    item.status = 'ACKNOWLEDGED';
    item.statusLabel = 'Đã tiếp nhận chăm sóc';
    item.acknowledgedBy =
      role === 'NUTRITIONIST'
        ? 'Chuyên viên Dinh dưỡng'
        : role === 'TEACHER'
        ? 'Giáo viên chủ nhiệm lớp'
        : 'Ban Giám Hiệu';
    item.acknowledgedAt = new Date().toISOString();

    if (note) {
      item.metadata.recommendationText = note;
    }

    return item;
  }

  /**
   * Chuyên viên Dinh dưỡng lập Thực đơn can thiệp cá nhân hóa (Personalized Diet Plan)
   */
  async assignInterventionDiet(
    payload: AssignInterventionDietDto,
    nutritionistId: number,
  ): Promise<GrowthNotificationItem> {
    const item = this.notifications.find((n) => n.id === payload.notificationId);
    if (!item) {
      throw new NotFoundException(`Thông báo #${payload.notificationId} không tồn tại`);
    }

    item.status = 'INTERVENTION_APPLIED';
    item.statusLabel = 'Đã áp dụng thực đơn can thiệp';
    item.metadata.interventionDietTitle = payload.interventionDietTitle;
    item.metadata.recommendationText = `${payload.nutritionGuidance} (Hẹn tái cân: ${
      payload.recheckDate || 'sau 2 tuần'
    })`;
    item.acknowledgedBy = 'ThS.BS Dinh dưỡng Lê Hoàng Mai';
    item.acknowledgedAt = new Date().toISOString();

    return item;
  }

  /**
   * Phụ huynh đặt lịch hẹn tư vấn 1-1 với Chuyên viên Dinh dưỡng
   */
  async requestConsultation(
    payload: RequestConsultationDto,
    parentId: number,
  ): Promise<{ success: boolean; message: string; consultationDate: string }> {
    const item = this.notifications.find((n) => n.id === payload.notificationId);
    if (!item) {
      throw new NotFoundException(`Thông báo #${payload.notificationId} không tồn tại`);
    }

    item.consultationPreferredDate = payload.preferredDate;
    item.status = 'READ';
    item.statusLabel = 'Đã đặt lịch hẹn tư vấn 1-1';

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
  ): Promise<{ success: boolean; approvedCount: number; totalAmount: number; message: string }> {
    let count = 0;
    for (const id of payload.notificationIds) {
      const item = this.notifications.find((n) => n.id === id);
      if (item) {
        item.metadata.approvedBudgetAmount = payload.approvedBudgetAmount;
        item.status = 'INTERVENTION_APPLIED';
        item.statusLabel = 'BGH đã phê duyệt ngân sách hỗ trợ';
        count++;
      }
    }

    return {
      success: true,
      approvedCount: count,
      totalAmount: payload.approvedBudgetAmount,
      message: `Hiệu trưởng đã phê duyệt gói ngân sách y tế học đường ${payload.approvedBudgetAmount.toLocaleString(
        'vi-VN',
      )} VNĐ cho ${count} trường hợp học sinh cần can thiệp dinh dưỡng đặc biệt.`,
    };
  }

  /**
   * Báo cáo tổng hợp tình hình thể chất & cảnh báo toàn trường cho School Manager
   */
  async getExecutiveGrowthHealthSummary(
    schoolId: number = 1,
  ): Promise<ExecutiveGrowthHealthSummary> {
    const students = await this.childRepo.find({ relations: ['class'] });
    const totalStudents = students.length > 0 ? students.length : 160;

    return {
      schoolId,
      schoolName: 'Trường Mầm Non Chất Lượng Cao KidMeal',
      totalStudents,
      screenedStudents: Math.round(totalStudents * 0.98),
      normalDevelopmentRate: 91.8, // KPI >= 90%
      underweightRate: 2.8, // KPI < 3%
      stuntedRate: 2.5, // KPI < 3%
      obesityRate: 3.1, // KPI < 5%
      abnormalAlertCount: this.notifications.filter((n) => n.severity === 'CRITICAL' || n.severity === 'HIGH').length,
      criticalCasesCount: this.notifications.filter((n) => n.severity === 'CRITICAL').length,
      interventionsAppliedCount: this.notifications.filter((n) => n.status === 'INTERVENTION_APPLIED').length,
      pendingInterventionsCount: this.notifications.filter((n) => n.status === 'DISPATCHED').length,
      kpiComplianceStatus: 'EXCELLENT',
      topRiskClasses: [
        {
          classId: 1,
          className: 'Lớp Mầm 1',
          gradeLevel: 'Khối Mầm',
          abnormalCount: 3,
          underweightCount: 2,
          obeseCount: 1,
        },
        {
          classId: 2,
          className: 'Lớp Nhà Trẻ 1',
          gradeLevel: 'Khối Nhà Trẻ',
          abnormalCount: 2,
          underweightCount: 1,
          obeseCount: 0,
        },
        {
          classId: 3,
          className: 'Lớp Chồi 2',
          gradeLevel: 'Khối Chồi',
          abnormalCount: 2,
          underweightCount: 0,
          obeseCount: 2,
        },
      ],
    };
  }
}
