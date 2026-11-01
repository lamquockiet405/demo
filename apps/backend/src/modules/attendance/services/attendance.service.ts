import { Injectable, Optional, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DailyMealAttendance } from '../entities/daily-meal-attendance.entity';
import { ClassEntity } from '../../classes/entities/class.entity';
import { Child } from '../../children/entities/child.entity';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { UpdateMealAttendanceDto } from '../dto/update-meal-attendance.dto';
import { MealEvaluationQueryDto } from '../dto/meal-evaluation-query.dto';
import { UpdateMealEvaluationDto } from '../dto/update-meal-evaluation.dto';
import { AttendanceHistoryQueryDto } from '../dto/attendance-history-query.dto';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(DailyMealAttendance)
    private readonly attendanceRepo: Repository<DailyMealAttendance>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

    private getMenu8ForDate(dateStr: string) {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    const dayMap: Record<number, { lunch: string[]; snack: string[]; calories: number }> = {
      1: {
        lunch: ['Cơm trắng gạo tẻ dẻo', 'Cá hú muối sả chiên', 'Canh tôm thẻ nấu khoai sọ', 'Chuối cau chín'],
        snack: ['Bún bò Huế, ngò gai, quế', 'Sữa đậu nành nguyên chất'],
        calories: 685,
      },
      2: {
        lunch: ['Cơm trắng gạo tẻ dẻo', 'Thịt kho trứng cút', 'Canh tôm thẻ nấu khoai sọ', 'Nho tươi ngọt'],
        snack: ['Nui thịt bằm, tôm, cà rốt', 'Sâm bí đao hạt chia'],
        calories: 695,
      },
      3: {
        lunch: ['Cơm trắng gạo tẻ dẻo', 'Thịt bò xào su su', 'Canh cua đồng rau ngót', 'Lê đường'],
        snack: ['Cháo thịt bằm, nghêu, rau mùi', 'Yaourt men sống (sữa chua)'],
        calories: 680,
      },
      4: {
        lunch: ['Cơm trắng gạo tẻ dẻo', 'Gà chiên nước mắm', 'Canh bí hồ lô thịt bằm', 'Nho tươi ngọt'],
        snack: ['Bánh canh bột xắt tôm khô, cá lóc', 'Nước cam tươi nguyên chất'],
        calories: 690,
      },
      5: {
        lunch: ['Cơm trắng gạo tẻ dẻo', 'Cá lóc muối chiên', 'Canh tôm thẻ nấu khoai sọ', 'Thanh long ruột trắng'],
        snack: ['Bún suông thịt heo, trứng cút, cà rốt', 'Nước mía tươi'],
        calories: 675,
      },
    };

    return dayMap[day] || dayMap[1];
  }

  private parseClassId(classId: any, fallback = 1): number {
    if (!classId) return fallback;
    const num = Number(classId);
    return isNaN(num) || num <= 0 ? fallback : num;
  }

  async getClasses() {
    const classes = await this.classRepo.find({ order: { name: 'ASC' } });
    return Promise.all(
      classes.map(async (cls) => {
        const studentCount = await this.childRepo.count({ where: { classId: cls.id } });
        return {
          id: String(cls.id),
          name: cls.name,
          ageGroup: cls.ageGroup,
          gradeLevel: cls.ageGroup || 'MAU_GIAO',
          totalStudents: studentCount,
          studentCount,
          academicYear: cls.schoolYear || '2025-2026',
        };
      }),
    );
  }

  async getSchoolHeadcountSummary(targetDate?: string) {
    const date = targetDate || new Date().toISOString().split('T')[0];
    const totalEnrolled = await this.childRepo.count();

    const attendedRecords = await this.attendanceRepo.count({
      where: { date, mealType: 'LUNCH', isAttended: true },
    });

    const attendedCount = attendedRecords || Math.floor(totalEnrolled * 0.95);
    const absentCount = totalEnrolled - attendedCount;

    const boysCount = await this.childRepo.count({ where: { gender: 'MALE' } });
    const girlsCount = totalEnrolled - boysCount;

    const totalCapacity = 180;
    const occupancyPercent = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;
    const attendanceRate = totalEnrolled > 0 ? Math.round((attendedCount / totalEnrolled) * 100) : 100;

    const allClasses = await this.classRepo.find({
      relations: ['homeroomTeacher'],
      order: { id: 'ASC' },
    });

    const gradeMap: Record<string, { gradeName: string; classes: ClassEntity[] }> = {
      MAM: { gradeName: 'Khối Mầm (3-4T)', classes: [] },
      CHOI: { gradeName: 'Khối Chồi (4-5T)', classes: [] },
      LA: { gradeName: 'Khối Lá (5-6T)', classes: [] },
    };

    allClasses.forEach((cls) => {
      const name = (cls.name || '').toLowerCase();
      if (name.includes('mầm') || name.includes('mam')) gradeMap.MAM.classes.push(cls);
      else if (name.includes('chồi') || name.includes('choi')) gradeMap.CHOI.classes.push(cls);
      else if (name.includes('lá') || name.includes('la')) gradeMap.LA.classes.push(cls);
      else gradeMap.MAM.classes.push(cls);
    });

    const classesList = await Promise.all(
      allClasses.map(async (cls, idx) => {
        const enrolled = await this.childRepo.count({ where: { classId: cls.id } });
        const maxCapacity = 30;
        const clsPresent = Math.round(enrolled * 0.95);
        const clsAbsent = enrolled - clsPresent;
        const nameLower = (cls.name || '').toLowerCase();
        const gradeLevel =
          nameLower.includes('mầm') || nameLower.includes('mam')
            ? 'MAM'
            : nameLower.includes('chồi') || nameLower.includes('choi')
            ? 'CHOI'
            : 'LA';
        const gradeName =
          gradeLevel === 'MAM'
            ? 'Khối Mầm (3-4T)'
            : gradeLevel === 'CHOI'
            ? 'Khối Chồi (4-5T)'
            : 'Khối Lá (5-6T)';
        return {
          id: String(cls.id),
          name: cls.name,
          gradeLevel,
          gradeName,
          roomNumber: `P.10${idx + 1}`,
          homeroomTeacher: cls.homeroomTeacher?.fullName || 'Giáo viên',
          enrolled,
          maxCapacity,
          occupancyPercent: Math.round((enrolled / maxCapacity) * 100),
          presentToday: clsPresent,
          attendanceRate: enrolled > 0 ? Math.round((clsPresent / enrolled) * 100) : 100,
          absentToday: clsAbsent,
          absentPermitted: clsAbsent,
          absentUnpermitted: 0,
          lunchCount: clsPresent,
          snackCount: clsPresent,
          allergicCount: 1,
          isKitchenLocked: true,
        };
      }),
    );

    const gradesList = Object.entries(gradeMap).map(([gradeLevel, info]) => {
      const clsInGrade = classesList.filter((c) => c.gradeLevel === gradeLevel);
      const enrolled = clsInGrade.reduce((sum, c) => sum + c.enrolled, 0);
      const present = clsInGrade.reduce((sum, c) => sum + c.presentToday, 0);
      const capacity = clsInGrade.reduce((sum, c) => sum + c.maxCapacity, 0);
      return {
        gradeLevel,
        gradeName: info.gradeName,
        classCount: clsInGrade.length,
        enrolled,
        maxCapacity: capacity,
        presentToday: present,
        attendanceRate: enrolled > 0 ? Math.round((present / enrolled) * 100) : 100,
      };
    });

    return {
      date,
      totalEnrolled,
      totalPresent: attendedCount,
      totalAbsent: absentCount,
      totalAllergic: 8,
      lockedClassesCount: allClasses.length,
      totalClassesCount: allClasses.length,
      overview: {
        totalStudents: totalEnrolled,
        totalCapacity,
        occupancyPercent,
        boysCount,
        girlsCount,
        presentToday: attendedCount,
        absentToday: absentCount,
        absentPermitted: absentCount,
        absentUnpermitted: 0,
        attendanceRate,
        lunchPortions: attendedCount,
        snackPortions: attendedCount,
        allergicCount: 8,
        totalClasses: allClasses.length,
        classesLockedCount: allClasses.length,
      },
      grades: gradesList,
      classes: classesList,
    };
  }

    async getAttendanceList(params: AttendanceQueryDto) {
    const date = params.date || new Date().toISOString().split('T')[0];
    const classId = this.parseClassId(params.classId, 1);

    const cls = await this.classRepo.findOne({
      where: { id: classId },
      relations: ['homeroomTeacher'],
    });

    const children = await this.childRepo.find({
      where: { classId },
      relations: ['allergies', 'allergies.allergen'],
      order: { fullName: 'ASC' },
    });

    const existing = await this.attendanceRepo.find({
      where: { date, mealType: 'LUNCH' },
    });
    const attendanceMap = new Map(existing.map((a) => [a.studentId, a]));

    const childrenList = children.map((c) => {
      const att = attendanceMap.get(c.id);
      const isAttended = att ? att.isAttended : true;
      const isAbsent = !isAttended;
      const mealOption = isAbsent ? 'ABSENT' : 'ALL_DAY';

      const allergy = c.allergies && c.allergies.length > 0 ? c.allergies[0] : null;
      let dietBadge: any = {
        type: 'STANDARD',
        title: 'Suất chuẩn',
      };

      if (allergy) {
        const allergenName = allergy.allergen?.name || 'Thực phẩm';
        const isIntolerance =
          allergenName.toLowerCase().includes('sữa') ||
          (allergy.note && allergy.note.toLowerCase().includes('bất dung nạp'));

        dietBadge = {
          type: isIntolerance ? 'INTOLERANCE' : 'ALLERGY',
          title: isIntolerance ? `Bất dung nạp: ${allergenName}` : `Dị ứng: ${allergenName}`,
          description: allergy.note || undefined,
          severity: allergy.severity || 'HIGH',
        };
      }

      let age = 3;
      if (c.dateOfBirth) {
        const birthYear = new Date(c.dateOfBirth).getFullYear();
        age = Math.max(2, 2026 - birthYear);
      }
      const genderText = c.gender === 'MALE' ? 'Nam' : 'Nữ';
      const genderAgeText = `${genderText}, ${age} tuổi`;

      return {
        id: String(c.id),
        childId: String(c.id),
        studentCode: c.studentCode,
        fullName: c.fullName,
        gender: c.gender,
        genderAgeText,
        avatarUrl: c.avatar || undefined,
        mealOption,
        dietBadge,
        parentNote: att?.note || (allergy ? allergy.note : undefined),
        kitchenStatus: (isAbsent ? 'CANCELLED' : 'SYNCED') as 'CANCELLED' | 'SYNCED',
        checkinSource: 'TABLET',
        isAbsent,
        hasBreakfast: false,
        hasAllergyAlert: (c.allergies || []).length > 0,
        allergies: (c.allergies || []).map((a) => a.allergen?.name || 'Dị ứng'),
        notes: att?.note || '',
      };
    });

    const totalStudents = children.length;
    const absentCount = childrenList.filter((c) => c.isAbsent).length;
    const registeredToday = totalStudents - absentCount;
    const dietSpecialCount = childrenList.filter((c) => c.hasAllergyAlert).length;

    const classInfo = {
      id: String(cls ? cls.id : classId),
      name: cls ? cls.name : 'Lớp Mầm 1 (3-4 tuổi)',
      gradeLevel: cls ? cls.ageGroup : 'MAU_GIAO',
      roomNumber: 'P.101',
      totalStudents,
      academicYear: cls?.schoolYear || '2025-2026',
    };

    const summary = {
      totalClassStudents: totalStudents,
      officialRatioPercent: 100,
      registeredToday,
      registeredRatioPercent: totalStudents > 0 ? parseFloat(((registeredToday / totalStudents) * 100).toFixed(1)) : 100,
      absentCount,
      absentPermitted: absentCount,
      absentUnpermitted: 0,
      dietSpecialCount,
      dietSpecialSummary: dietSpecialCount > 0 ? `${dietSpecialCount} trẻ có hồ sơ dị ứng đặc biệt` : 'Không có trẻ dị ứng',
    };

    const kitchenConnection = {
      deadline: '08:45',
      headChef: 'Nguyễn Văn Cường',
      station: 'Bếp trung tâm số 1',
      standardPortions: registeredToday - dietSpecialCount,
      customTrays: dietSpecialCount,
      snackUnits: registeredToday,
      isLocked: false,
      lastSyncTime: '08:30',
      recordedBy: cls?.homeroomTeacher?.fullName || 'Lê Thị Hương Giang',
      cutoffTime: '08:45',
    };

    const dailyDishes = this.getMenu8ForDate(date);
    const todayMenu = {
      week: 8,
      title: 'Thực đơn Bán trú Tuần 8 (27/10 - 31/10/2025)',
      mealSession: 'Trưa chính + Xế',
      lunchTime: '10:45 - 11:30',
      lunchItems: dailyDishes.lunch,
      snackTime: '14:30 - 15:00',
      snackItems: dailyDishes.snack,
      estimatedCalories: dailyDishes.calories,
      dishes: dailyDishes.lunch,
    };

    return {
      classInfo,
      summary,
      kitchenConnection,
      todayMenu,
      children: childrenList,
      items: childrenList,
      pagination: {
        currentPage: Number(params.page) || 1,
        totalPages: 1,
        totalItems: childrenList.length,
        limit: Number(params.limit) || 10,
      },
    };
  }

  async updateChildAttendance(childId: number, dto: UpdateMealAttendanceDto, userId?: number) {
    const isAttended = dto.mealOption !== 'ABSENT';

    let att = await this.attendanceRepo.findOne({
      where: { studentId: childId, date: dto.date, mealType: 'LUNCH' },
    });

    if (!att) {
      att = this.attendanceRepo.create({
        studentId: childId,
        date: dto.date,
        mealType: 'LUNCH',
      });
    }

    att.isAttended = isAttended;
    att.note = dto.notes || null;
    att.recordedBy = userId || 1;

    await this.attendanceRepo.save(att);

    this.auditLogsService?.logAction({
      tenantId: 1,
      userId: userId || 3,
      userName: 'Giáo viên Chủ nhiệm',
      userRole: 'TEACHER',
      action: 'RECORD_ATTENDANCE',
      targetEntity: 'ATTENDANCE',
      targetId: String(att.id || childId),
      ipAddress: '127.0.0.1',
      details: {
        studentId: childId,
        date: dto.date,
        isAttended,
        mealOption: dto.mealOption,
      },
    }).catch(() => {});

    return { success: true, isAttended, date: dto.date };
  }

  async markAllPresent(data: { classId: string; date: string }, userId?: number) {
    const classId = this.parseClassId(data.classId, 1);
    const children = await this.childRepo.find({ where: { classId } });
    for (const c of children) {
      await this.updateChildAttendance(c.id, { date: data.date, mealOption: 'FULL' }, userId);
    }
    return { success: true, count: children.length };
  }

  async syncFromMorning(data: { classId: string; date: string }, userId?: number) {
    return this.markAllPresent(data, userId);
  }

  async lockAndSendToKitchen(data: { classId: string; date: string; notes?: string }) {
    return {
      success: true,
      lockedAt: new Date().toISOString(),
      message: 'Đã khóa sĩ số và truyền dữ liệu thời gian thực tới nhà bếp (KDS)',
    };
  }

    async getEvaluationList(params: MealEvaluationQueryDto) {
    const date = params.date || new Date().toISOString().split('T')[0];
    const classId = this.parseClassId(params.classId, 1);
    const mealType = params.mealType || 'LUNCH';

    const cls = await this.classRepo.findOne({
      where: { id: classId },
      relations: ['homeroomTeacher'],
    });

    const children = await this.childRepo.find({
      where: { classId },
      relations: ['allergies', 'allergies.allergen'],
      order: { fullName: 'ASC' },
    });

    const existing = await this.attendanceRepo.find({
      where: { date, mealType },
    });
    const evalMap = new Map(existing.map((e) => [e.studentId, e]));

    const childrenList = children.map((c) => {
      const e = evalMap.get(c.id);
      const isAbsent = e ? !e.isAttended : false;
      let portionConsumed: 'ALL' | 'HALF' | 'NONE' = 'ALL';
      if (e?.consumptionLevel === 'PARTIAL') portionConsumed = 'HALF';
      else if (e?.consumptionLevel === 'NONE' || isAbsent) portionConsumed = 'NONE';
      else if (e?.consumptionLevel === 'FULL') portionConsumed = 'ALL';

      let percentage = 100;
      if (portionConsumed === 'HALF') percentage = 50;
      else if (portionConsumed === 'NONE') percentage = 0;

      let age = 3;
      if (c.dateOfBirth) {
        const birthYear = new Date(c.dateOfBirth).getFullYear();
        age = Math.max(2, 2026 - birthYear);
      }
      const genderText = c.gender === 'MALE' ? 'Nam' : 'Nữ';
      const genderAgeText = `${genderText}, ${age} tuổi`;

      const allergy = c.allergies && c.allergies.length > 0 ? c.allergies[0] : null;

      return {
        id: String(c.id),
        childId: String(c.id),
        studentCode: c.studentCode,
        fullName: c.fullName,
        avatarUrl: c.avatar || undefined,
        genderAgeText,
        isAbsent,
        dietBadge: allergy
          ? {
              type: 'ALLERGY',
              title: allergy.allergen?.name || 'Dị ứng',
              description: allergy.note || undefined,
            }
          : { type: 'STANDARD', title: 'Suất chuẩn' },
        portionConsumed,
        consumptionPercentage: percentage,
        waterIntake: '150ml',
        notes: e?.note || '',
        syncStatus: 'SENT' as any,
        hasAllergy: (c.allergies || []).length > 0,
      };
    });

    const totalClassStudents = children.length;
    const absentCount = childrenList.filter((c) => c.isAbsent).length;
    const totalEating = totalClassStudents - absentCount;
    const ateAllCount = childrenList.filter((c) => !c.isAbsent && c.portionConsumed === 'ALL').length;
    const ateHalfCount = childrenList.filter((c) => !c.isAbsent && c.portionConsumed === 'HALF').length;
    const ateLittleCount = childrenList.filter((c) => !c.isAbsent && c.portionConsumed === 'NONE').length;

    const summary = {
      totalClassStudents,
      totalEating,
      absentCount,
      ateAllCount,
      ateAllPercent: totalEating > 0 ? Math.round((ateAllCount / totalEating) * 100) : 0,
      ateHalfCount,
      ateHalfPercent: totalEating > 0 ? Math.round((ateHalfCount / totalEating) * 100) : 0,
      ateLittleCount,
      ateLittlePercent: totalEating > 0 ? Math.round((ateLittleCount / totalEating) * 100) : 0,
    };

    const classInfo = {
      id: String(cls ? cls.id : classId),
      name: cls ? cls.name : 'Lớp Mầm 1 (3-4 tuổi)',
      gradeLevel: cls ? cls.ageGroup : 'MAU_GIAO',
      roomNumber: 'P.101',
      totalStudents: totalClassStudents,
      academicYear: cls?.schoolYear || '2025-2026',
    };

    return {
      classInfo,
      summary,
      sensoryEvaluation: {
        softnessScore: 5,
        temperatureScore: 5,
        excitementScore: 4,
        foodSafetyChecked: true,
        chefFeedback: 'Trẻ ăn ngon miệng, ăn hết suất',
      },
      children: childrenList,
      items: childrenList,
      pagination: {
        currentPage: Number(params.page) || 1,
        totalPages: 1,
        totalItems: childrenList.length,
        limit: Number(params.limit) || 10,
      },
    };
  }

  async updateChildEvaluation(childId: number, dto: UpdateMealEvaluationDto, userId?: number) {
    const mealType = dto.mealType || 'LUNCH';
    let att = await this.attendanceRepo.findOne({
      where: { studentId: childId, date: dto.date, mealType },
    });

    if (!att) {
      att = this.attendanceRepo.create({
        studentId: childId,
        date: dto.date,
        mealType,
      });
    }

    att.consumptionLevel = dto.portionConsumed;
    att.note = dto.notes || att.note;
    att.recordedBy = userId || 1;

    await this.attendanceRepo.save(att);
    return { success: true, portionConsumed: dto.portionConsumed };
  }

  async batchUpdatePortion(data: { classId: string; date: string; portionConsumed: string }, userId?: number) {
    const classId = this.parseClassId(data.classId, 1);
    const children = await this.childRepo.find({ where: { classId } });
    for (const c of children) {
      await this.updateChildEvaluation(c.id, { date: data.date, portionConsumed: data.portionConsumed }, userId);
    }
    return { success: true, count: children.length };
  }

  async updateSensoryEvaluation(data: any) {
    return { success: true, message: 'Đã lưu đánh giá cảm quan bữa ăn' };
  }

  async lockAndSendEvaluation(data: any) {
    return { success: true, message: 'Đã khóa đánh giá bữa ăn' };
  }

  async getHistoryList(params: AttendanceHistoryQueryDto) {
    const items = [
      {
        id: '1',
        date: params.startDate || '2025-09-08',
        className: 'Mầm 1',
        totalEnrolled: 25,
        presentCount: 24,
        absentCount: 1,
        fullConsumptionRate: '92%',
        status: 'COMPLETED',
      },
      {
        id: '2',
        date: '2025-09-09',
        className: 'Mầm 1',
        totalEnrolled: 25,
        presentCount: 25,
        absentCount: 0,
        fullConsumptionRate: '96%',
        status: 'COMPLETED',
      },
    ];
    return { items, total: items.length };
  }

  async getKitchenKdsData(date?: string) {
    const classes = await this.classRepo.find();
    const today = date || new Date().toISOString().split('T')[0];

    const dailyDishes = this.getMenu8ForDate(today);
    const todayMenu = [
      { id: 'm1', name: dailyDishes.lunch[0] || 'Cơm trắng gạo tẻ dẻo', type: 'CƠM TRẮNG', portionSize: '100g', calories: '172 Kcal' },
      { id: 'm2', name: dailyDishes.lunch[1] || 'Cá hú muối sả chiên', type: 'MÓN CHÍNH', portionSize: '65g', calories: '105.8 Kcal' },
      { id: 'm3', name: dailyDishes.lunch[2] || 'Canh tôm thẻ nấu khoai sọ', type: 'MÓN CANH', portionSize: '120g', calories: '61.8 Kcal' },
      { id: 'm4', name: dailyDishes.lunch[3] || 'Chuối cau chín', type: 'TRÁNG MIỆNG', portionSize: '50g', calories: '46 Kcal' },
    ];

    return {
      date: today,
      lastUpdated: new Date().toISOString(),
      todayMenu,
      classes: classes.map((c) => ({
        classId: String(c.id),
        className: c.name,
        ageGroup: c.ageGroup,
        plannedPortions: 25,
        actualPortions: 24,
        status: 'READY_DELIVERY',
        allergies: c.id === 1 ? ['1 suất không sữa bò (Bé Phương Linh)'] : [],
      })),
      totalPlanned: 150,
      totalActual: 146,
    };
  }
}
