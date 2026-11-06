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

  /**
   * Truy vấn thực đơn món ăn thực tế theo ngày và bữa ăn từ database (menu_dishes, menu_meals, dishes, dish_nutrition)
   */
  private async getMenuForDate(dateStr: string, mealType = 'LUNCH') {
    const d = new Date(dateStr);
    const jsDay = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    const dayOfWeek = jsDay === 0 ? 2 : jsDay === 6 ? 6 : jsDay + 1;

    const dishes = await this.attendanceRepo.query(
      `SELECT 
        d.id::text,
        d.name,
        COALESCE(dc.name, 'MÓN ĂN') as type,
        COALESCE(md.portion_size_g, d.standard_serving_size_g, 100)::text || 'g' as "portionSize",
        COALESCE(dn.energy_kcal, 100)::text || ' Kcal' as calories
      FROM menu_dishes md
      JOIN menu_meals mm ON md.menu_meal_id = mm.id
      JOIN menu_days mday ON mm.menu_day_id = mday.id
      JOIN dishes d ON md.dish_id = d.id
      LEFT JOIN dish_categories dc ON d.category_id = dc.id
      LEFT JOIN dish_nutrition dn ON d.id = dn.dish_id
      WHERE mm.id = (
        SELECT mm2.id 
        FROM menu_meals mm2
        JOIN menu_days md2 ON mm2.menu_day_id = md2.id
        WHERE (md2.date = $1 OR md2.day_of_week = $2)
          AND mm2.meal_type = $3
        ORDER BY mm2.id ASC
        LIMIT 1
      )
      ORDER BY md.display_order ASC;`,
      [dateStr, dayOfWeek, mealType],
    );

    if (dishes.length > 0) return dishes;

    // Dự phòng: lấy món ăn đang hoạt động từ bảng dishes
    return this.attendanceRepo.query(
      `SELECT 
        d.id::text,
        d.name,
        COALESCE(dc.name, 'MÓN ĂN') as type,
        COALESCE(d.standard_serving_size_g, 100)::text || 'g' as "portionSize",
        COALESCE(dn.energy_kcal, 100)::text || ' Kcal' as calories
      FROM dishes d
      LEFT JOIN dish_categories dc ON d.category_id = dc.id
      LEFT JOIN dish_nutrition dn ON d.id = dn.dish_id
      WHERE d.status = 'ACTIVE'
      LIMIT 4;`,
    );
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

    const rows = await this.attendanceRepo.query(
      `SELECT 
        c.id, c.name, c.age_group, u.full_name as teacher_name,
        COUNT(DISTINCT s.id)::int as enrolled,
        COUNT(DISTINCT CASE WHEN ma_lunch.is_attended THEN s.id END)::int as lunch_count,
        COUNT(DISTINCT CASE WHEN ma_snack.is_attended THEN s.id END)::int as snack_count,
        COUNT(DISTINCT sa.student_id)::int as allergic_count,
        EXISTS(
          SELECT 1 FROM meal_evaluation_locks mel 
          WHERE mel.class_id = c.id AND mel.date = $1 AND mel.meal_type = 'PORTIONS_PLAN'
        ) as is_locked
      FROM classes c
      LEFT JOIN users u ON c.homeroom_teacher_id = u.id
      LEFT JOIN students s ON s.class_id = c.id AND s.status = 'ACTIVE'
      LEFT JOIN meal_attendances ma_lunch ON ma_lunch.student_id = s.id AND ma_lunch.date = $1 AND ma_lunch.meal_type = 'LUNCH'
      LEFT JOIN meal_attendances ma_snack ON ma_snack.student_id = s.id AND ma_snack.date = $1 AND ma_snack.meal_type = 'AFTERNOON_SNACK'
      LEFT JOIN student_allergies sa ON sa.student_id = s.id
      GROUP BY c.id, c.name, c.age_group, u.full_name
      ORDER BY c.id ASC;`,
      [date],
    );

    const totalEnrolled = rows.reduce((sum: number, r: any) => sum + Number(r.enrolled || 0), 0);
    const totalLunch = rows.reduce((sum: number, r: any) => sum + Number(r.lunch_count || 0), 0);
    const totalSnack = rows.reduce((sum: number, r: any) => sum + Number(r.snack_count || 0), 0);
    const totalAllergic = rows.reduce((sum: number, r: any) => sum + Number(r.allergic_count || 0), 0);
    const totalAbsent = Math.max(0, totalEnrolled - totalLunch);
    const lockedClassesCount = rows.filter((r: any) => r.is_locked).length;
    const totalClassesCount = rows.length;

    const classesList = rows.map((r: any, idx: number) => {
      const enrolled = Number(r.enrolled) || 0;
      const lunchCount = Number(r.lunch_count) || 0;
      const snackCount = Number(r.snack_count) || 0;
      const allergicCount = Number(r.allergic_count) || 0;
      const standardPortions = Math.max(0, lunchCount - allergicCount);
      const absentCount = Math.max(0, enrolled - lunchCount);

      const nameLower = (r.name || '').toLowerCase();
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
        id: String(r.id),
        name: r.name,
        gradeLevel,
        gradeName,
        roomNumber: `P.10${idx + 1}`,
        homeroomTeacher: r.teacher_name || 'Giáo viên phụ trách',
        enrolled,
        maxCapacity: 30,
        occupancyPercent: Math.round((enrolled / 30) * 100),
        presentToday: lunchCount,
        attendanceRate: enrolled > 0 ? Math.round((lunchCount / enrolled) * 100) : 100,
        absentToday: absentCount,
        absentPermitted: absentCount,
        absentUnpermitted: 0,
        lunchCount,
        standardPortions,
        snackCount,
        allergicCount,
        isKitchenLocked: Boolean(r.is_locked),
      };
    });

    return {
      date,
      totalEnrolled,
      totalPresent: totalLunch,
      totalAbsent,
      totalLunch,
      totalSnack,
      totalAllergic,
      standardPortions: Math.max(0, totalLunch - totalAllergic),
      lockedClassesCount,
      totalClassesCount,
      completionPercentage: totalClassesCount > 0 ? Math.round((lockedClassesCount / totalClassesCount) * 100) : 0,
      overview: {
        totalStudents: totalEnrolled,
        totalCapacity: totalClassesCount * 30,
        occupancyPercent: Math.round((totalEnrolled / (totalClassesCount * 30)) * 100),
        boysCount: Math.floor(totalEnrolled / 2),
        girlsCount: Math.ceil(totalEnrolled / 2),
        presentToday: totalLunch,
        absentToday: totalAbsent,
        absentPermitted: totalAbsent,
        absentUnpermitted: 0,
        attendanceRate: totalEnrolled > 0 ? Math.round((totalLunch / totalEnrolled) * 100) : 100,
        lunchPortions: totalLunch,
        snackPortions: totalSnack,
        standardPortions: Math.max(0, totalLunch - totalAllergic),
        allergicCount: totalAllergic,
        totalClasses: totalClassesCount,
        classesLockedCount: lockedClassesCount,
      },
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

    // 1. Lấy danh sách điểm danh cả trưa và xế từ PostgreSQL
    const existing = await this.attendanceRepo.find({
      where: { date },
    });
    const lunchMap = new Map<number, DailyMealAttendance>();
    const snackMap = new Map<number, DailyMealAttendance>();
    existing.forEach((a) => {
      const sId = Number(a.studentId);
      if (a.mealType === 'LUNCH') lunchMap.set(sId, a);
      else if (a.mealType === 'AFTERNOON_SNACK') snackMap.set(sId, a);
    });

    // 2. Kiểm tra trạng thái khóa sổ kế hoạch suất ăn từ bảng meal_evaluation_locks
    const planLockRows = await this.attendanceRepo.query(
      `SELECT * FROM meal_evaluation_locks WHERE class_id = $1 AND date = $2 AND meal_type = 'PORTIONS_PLAN' LIMIT 1;`,
      [classId, date],
    );
    const planLock = planLockRows && planLockRows.length > 0 ? planLockRows[0] : null;
    const isLocked = Boolean(planLock?.is_locked);

    const childrenList = children.map((c) => {
      const cId = Number(c.id);
      const lunchAtt = lunchMap.get(cId);
      const snackAtt = snackMap.get(cId);

      // Xác định mealOption từ 2 bữa
      let mealOption: 'ALL_DAY' | 'LUNCH_ONLY' | 'SNACK_ONLY' | 'ABSENT' = 'ALL_DAY';
      if (lunchAtt && snackAtt) {
        if (!lunchAtt.isAttended && !snackAtt.isAttended) mealOption = 'ABSENT';
        else if (lunchAtt.isAttended && !snackAtt.isAttended) mealOption = 'LUNCH_ONLY';
        else if (!lunchAtt.isAttended && snackAtt.isAttended) mealOption = 'SNACK_ONLY';
        else mealOption = 'ALL_DAY';
      } else if (lunchAtt) {
        mealOption = lunchAtt.isAttended ? 'ALL_DAY' : 'ABSENT';
      }

      const isAbsent = mealOption === 'ABSENT';
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
        parentNote: lunchAtt?.note || snackAtt?.note || (allergy ? allergy.note : undefined),
        kitchenStatus: (isAbsent ? 'CANCELLED' : isLocked ? 'SYNCED' : 'PENDING') as 'CANCELLED' | 'SYNCED' | 'PENDING',
        checkinSource: 'TABLET',
        isAbsent,
        hasBreakfast: false,
        hasAllergyAlert: (c.allergies || []).length > 0,
        allergies: (c.allergies || []).map((a) => a.allergen?.name || 'Dị ứng'),
        notes: lunchAtt?.note || snackAtt?.note || '',
      };
    });

    const totalStudents = children.length;
    const absentCount = childrenList.filter((c) => c.isAbsent).length;
    const registeredToday = totalStudents - absentCount;
    const dietSpecialCount = childrenList.filter((c) => !c.isAbsent && c.hasAllergyAlert).length;
    const standardPortions = childrenList.filter((c) => (c.mealOption === 'ALL_DAY' || c.mealOption === 'LUNCH_ONLY') && !c.hasAllergyAlert).length;
    const customTrays = childrenList.filter((c) => (c.mealOption === 'ALL_DAY' || c.mealOption === 'LUNCH_ONLY') && c.hasAllergyAlert).length;
    const snackUnits = childrenList.filter((c) => c.mealOption === 'ALL_DAY' || c.mealOption === 'SNACK_ONLY').length;

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
      standardPortions,
      customTrays,
      snackUnits,
      isLocked,
      lockedAt: planLock?.locked_at ? new Date(planLock.locked_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : undefined,
      lastSyncTime: isLocked ? 'Đã khóa sổ gửi Bếp' : 'Chờ giáo viên chốt sổ',
      recordedBy: cls?.homeroomTeacher?.fullName || 'Lê Thị Hương Giang',
      cutoffTime: '08:45',
    };

    const lunchDishes = await this.getMenuForDate(date, 'LUNCH');
    const snackDishes = await this.getMenuForDate(date, 'AFTERNOON_SNACK');
    const lunchItems = lunchDishes.map((d: any) => d.name);
    const snackItems = snackDishes.map((d: any) => d.name);

    const todayMenu = {
      title: 'Thực đơn Dinh dưỡng Bán trú',
      mealSession: 'Trưa chính + Xế',
      lunchTime: '10:45 - 11:30',
      lunchItems,
      snackTime: '14:30 - 15:00',
      snackItems,
      estimatedCalories: 680,
      dishes: lunchItems,
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
    const option = (dto.mealOption || 'ALL_DAY').toUpperCase();
    const isLunchAttended = option === 'ALL_DAY' || option === 'FULL' || option === 'LUNCH_ONLY';
    const isSnackAttended = option === 'ALL_DAY' || option === 'FULL' || option === 'SNACK_ONLY';

    // 1. Cập nhật bữa Trưa
    let lunchAtt = await this.attendanceRepo.findOne({
      where: { studentId: childId, date: dto.date, mealType: 'LUNCH' },
    });
    if (!lunchAtt) {
      lunchAtt = this.attendanceRepo.create({
        studentId: childId,
        date: dto.date,
        mealType: 'LUNCH',
      });
    }
    lunchAtt.isAttended = isLunchAttended;
    lunchAtt.consumptionLevel = isLunchAttended ? (lunchAtt.consumptionLevel === 'ABSENT' ? null : lunchAtt.consumptionLevel) : 'ABSENT';
    lunchAtt.note = dto.notes !== undefined ? dto.notes : lunchAtt.note;
    lunchAtt.recordedBy = userId || 1;
    await this.attendanceRepo.save(lunchAtt);

    // 2. Cập nhật bữa Xế chiều
    let snackAtt = await this.attendanceRepo.findOne({
      where: { studentId: childId, date: dto.date, mealType: 'AFTERNOON_SNACK' },
    });
    if (!snackAtt) {
      snackAtt = this.attendanceRepo.create({
        studentId: childId,
        date: dto.date,
        mealType: 'AFTERNOON_SNACK',
      });
    }
    snackAtt.isAttended = isSnackAttended;
    snackAtt.consumptionLevel = isSnackAttended ? (snackAtt.consumptionLevel === 'ABSENT' ? null : snackAtt.consumptionLevel) : 'ABSENT';
    snackAtt.note = dto.notes !== undefined ? dto.notes : snackAtt.note;
    snackAtt.recordedBy = userId || 1;
    await this.attendanceRepo.save(snackAtt);

    this.auditLogsService?.logAction({
      tenantId: 1,
      userId: userId || 3,
      userName: 'Giáo viên Chủ nhiệm',
      userRole: 'TEACHER',
      action: 'RECORD_ATTENDANCE',
      targetEntity: 'ATTENDANCE',
      targetId: String(childId),
      ipAddress: '127.0.0.1',
      details: {
        studentId: childId,
        date: dto.date,
        mealOption: option,
        isLunchAttended,
        isSnackAttended,
      },
    }).catch(() => {});

    return { success: true, isAttended: isLunchAttended || isSnackAttended, mealOption: option, date: dto.date };
  }

  async markAllPresent(data: { classId: string; date: string }, userId?: number) {
    const classId = this.parseClassId(data.classId, 1);
    const children = await this.childRepo.find({ where: { classId } });
    for (const c of children) {
      await this.updateChildAttendance(c.id, { date: data.date, mealOption: 'ALL_DAY' }, userId);
    }
    return { success: true, count: children.length };
  }

  async syncFromMorning(data: { classId: string; date: string }, userId?: number) {
    return this.markAllPresent(data, userId);
  }

  async lockAndSendToKitchen(data: { classId: string; date: string; notes?: string; isLocked?: boolean }) {
    const classId = this.parseClassId(data.classId, 1);
    const date = data.date || new Date().toISOString().split('T')[0];
    const isLocked = data.isLocked !== undefined ? Boolean(data.isLocked) : true;

    await this.attendanceRepo.query(
      `INSERT INTO meal_evaluation_locks (class_id, date, meal_type, is_locked, locked_at, chef_feedback)
       VALUES ($1, $2, 'PORTIONS_PLAN', $3, CASE WHEN $3 THEN NOW() ELSE NULL END, $4)
       ON CONFLICT (class_id, date, meal_type)
       DO UPDATE SET 
         is_locked = $3, 
         locked_at = CASE WHEN $3 THEN NOW() ELSE NULL END, 
         chef_feedback = COALESCE($4, meal_evaluation_locks.chef_feedback);`,
      [classId, date, isLocked, data.notes || null],
    );

    return {
      success: true,
      isLocked,
      lockedAt: isLocked ? new Date().toISOString() : null,
      message: isLocked
        ? 'Đã khóa sổ và truyền dữ liệu kế hoạch suất ăn thời gian thực tới nhà bếp (KDS)'
        : 'Đã mở khóa kế hoạch suất ăn để giáo viên điều chỉnh',
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

    const lockRows = await this.attendanceRepo.query(
      `SELECT * FROM meal_evaluation_locks WHERE class_id = $1 AND date = $2 AND meal_type = $3 LIMIT 1;`,
      [classId, date, mealType],
    );
    const lockRecord = lockRows && lockRows.length > 0 ? lockRows[0] : null;
    const isLocked = Boolean(lockRecord?.is_locked);

    const existing = await this.attendanceRepo.find({
      where: { date, mealType },
    });
    const evalMap = new Map(existing.map((e) => [e.studentId, e]));

    const dishRows = await this.attendanceRepo.query(
      `SELECT d.name 
       FROM menu_dishes md
       JOIN menu_meals mm ON md.menu_meal_id = mm.id
       JOIN dishes d ON md.dish_id = d.id
       WHERE mm.meal_type = $1
       ORDER BY md.display_order ASC;`,
      [mealType],
    );
    const dishNames = dishRows.map((d: any) => d.name);
    const menuDetail = dishNames.length > 0
      ? dishNames.join(', ')
      : 'Cơm trắng gạo tẻ dẻo, Cá lóc muối chiên, Canh tôm thẻ nấu khoai sọ';

    const chefRows = await this.attendanceRepo.query(
      `SELECT u.full_name 
       FROM users u 
       JOIN user_roles ur ON u.id = ur.user_id 
       JOIN roles r ON ur.role_id = r.id 
       WHERE r.name ILIKE '%bếp%' OR r.name ILIKE '%kitchen%'
       LIMIT 1;`,
    );
    const headChefName = chefRows[0]?.full_name || 'Nguyễn Văn Cường';

    const childrenList = children.map((c) => {
      const e = evalMap.get(c.id);
      const isAbsent = e ? !e.isAttended : false;
      let portionConsumed: any = 'ALL';
      if (e?.consumptionLevel === 'MOST') portionConsumed = 'MOST';
      else if (e?.consumptionLevel === 'HALF' || e?.consumptionLevel === 'PARTIAL') portionConsumed = 'HALF';
      else if (e?.consumptionLevel === 'LITTLE' || e?.consumptionLevel === 'FEW') portionConsumed = 'LITTLE';
      else if (e?.consumptionLevel === 'NONE' || isAbsent) portionConsumed = 'NONE';
      else portionConsumed = 'ALL';

      let percentage = 100;
      if (portionConsumed === 'MOST') percentage = 75;
      else if (portionConsumed === 'HALF') percentage = 50;
      else if (portionConsumed === 'LITTLE') percentage = 25;
      else if (portionConsumed === 'NONE') percentage = 0;

      let age = 3;
      if (c.dateOfBirth) {
        const birthYear = new Date(c.dateOfBirth).getFullYear();
        age = Math.max(2, 2026 - birthYear);
      }
      const genderText = c.gender === 'MALE' ? 'Nam' : 'Nữ';
      const genderAgeText = `${genderText}, ${age} tuổi`;

      const allergy = c.allergies && c.allergies.length > 0 ? c.allergies[0] : null;

      const avatarLetter = c.fullName ? c.fullName.trim().split(' ').slice(-1)[0][0].toUpperCase() : 'B';
      const menuBadge = allergy
        ? { label: `Dị ứng: ${allergy.allergen?.name || 'Hải sản'}`, type: 'allergy' as const }
        : isAbsent
        ? { label: 'Nghỉ học', type: 'absent' as const }
        : { label: 'Suất chuẩn', type: 'standard' as const };

      let sendState: { status: 'SENT' | 'PENDING' | 'NOT_EVALUATED' | 'ABSENT'; label: string };
      if (isAbsent) {
        sendState = {
          status: 'ABSENT',
          label: 'Nghỉ học',
        };
      } else if (isLocked) {
        sendState = {
          status: 'SENT',
          label: 'Đã gửi Bếp',
        };
      } else {
        sendState = {
          status: 'PENDING',
          label: 'Chờ gửi Bếp',
        };
      }

      return {
        id: String(c.id),
        childId: String(c.id),
        studentCode: c.studentCode || `M1-${String(c.id).padStart(3, '0')}`,
        fullName: c.fullName,
        firstName: c.fullName ? c.fullName.trim().split(' ').slice(-1)[0] : 'Bé',
        avatarLetter,
        avatarUrl: c.avatar || undefined,
        genderAgeText,
        isAbsent,
        menuBadge,
        menuDetail,
        dietBadge: allergy
          ? {
              type: 'ALLERGY',
              title: allergy.allergen?.name || 'Dị ứng',
              description: allergy.note || undefined,
            }
          : { type: 'STANDARD', title: 'Suất chuẩn' },
        portionConsumed,
        consumptionPercentage: percentage,
        waterIntake: isAbsent ? '0ml' : '200ml Nước ấm',
        teacherNote: e?.note || (isAbsent ? 'Nghỉ học có phép' : ''),
        notes: e?.note || '',
        sendState,
        syncStatus: (isLocked ? 'SENT' : 'PENDING') as any,
        hasAllergy: Boolean(allergy),
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
        softnessScore: lockRecord?.softness_score ?? 5,
        temperatureScore: lockRecord?.temperature_score ?? 5,
        excitementScore: lockRecord?.excitement_score ?? 4,
        foodSafetyChecked: lockRecord?.food_safety_checked ?? true,
        chefFeedback: lockRecord?.chef_feedback || 'Trẻ ăn ngon miệng, ăn hết suất',
        headChefName,
        isLocked,
        lockedAt: lockRecord?.locked_at || undefined,
        status: isLocked ? 'LOCKED' : 'IN_PROGRESS',
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
    const classId = this.parseClassId(data.classId, 1);
    const date = data.date || new Date().toISOString().split('T')[0];
    const mealType = data.mealType || 'LUNCH';
    const softnessScore = data.softnessScore ?? 5;
    const temperatureScore = data.temperatureScore ?? 5;
    const excitementScore = data.excitementScore ?? 4;
    const chefFeedback = data.chefFeedback ?? '';

    await this.attendanceRepo.query(
      `INSERT INTO meal_evaluation_locks (class_id, date, meal_type, softness_score, temperature_score, excitement_score, chef_feedback, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (class_id, date, meal_type)
       DO UPDATE SET
         softness_score = COALESCE($4, meal_evaluation_locks.softness_score),
         temperature_score = COALESCE($5, meal_evaluation_locks.temperature_score),
         excitement_score = COALESCE($6, meal_evaluation_locks.excitement_score),
         chef_feedback = COALESCE($7, meal_evaluation_locks.chef_feedback),
         updated_at = NOW();`,
      [classId, date, mealType, softnessScore, temperatureScore, excitementScore, chefFeedback],
    );

    return { success: true, message: 'Đã lưu đánh giá cảm quan chất lượng món ăn' };
  }

  async lockAndSendEvaluation(data: any) {
    const classId = this.parseClassId(data.classId, 1);
    const date = data.date || new Date().toISOString().split('T')[0];
    const mealType = data.mealType || 'LUNCH';
    const chefFeedback = data.chefFeedback || 'Trẻ ăn ngon miệng, ăn hết suất';

    const existing = await this.attendanceRepo.query(
      `SELECT is_locked FROM meal_evaluation_locks WHERE class_id = $1 AND date = $2 AND meal_type = $3 LIMIT 1;`,
      [classId, date, mealType],
    );
    const currentLocked = existing && existing.length > 0 && existing[0].is_locked;
    const targetLocked = data.unlock ? false : !currentLocked ? true : true;

    await this.attendanceRepo.query(
      `INSERT INTO meal_evaluation_locks (class_id, date, meal_type, is_locked, locked_at, chef_feedback, updated_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 = true THEN NOW() ELSE NULL END, $5, NOW())
       ON CONFLICT (class_id, date, meal_type)
       DO UPDATE SET
         is_locked = EXCLUDED.is_locked,
         locked_at = CASE WHEN EXCLUDED.is_locked = true THEN NOW() ELSE meal_evaluation_locks.locked_at END,
         chef_feedback = COALESCE(EXCLUDED.chef_feedback, meal_evaluation_locks.chef_feedback),
         updated_at = NOW();`,
      [classId, date, mealType, targetLocked, chefFeedback],
    );

    return {
      success: true,
      isLocked: targetLocked,
      message: targetLocked
        ? 'Đã hoàn thành và chuyển trạng thái: Đã gửi dữ liệu bữa ăn sang Bếp thành công!'
        : 'Đã mở khóa đánh giá để giáo viên tiếp tục chỉnh sửa.',
    };
  }

  

  async updateKitchenStatus(data: { classId: string; status: string; date?: string; actorName?: string }) {
    const classId = this.parseClassId(data.classId, 1);
    const date = data.date || new Date().toISOString().split('T')[0];
    const status = data.status || 'PREPARING';

    await this.attendanceRepo.query(
      `INSERT INTO meal_evaluation_locks (class_id, date, meal_type, is_locked, chef_feedback)
       VALUES ($1, $2, 'KITCHEN_STATUS', true, $3)
       ON CONFLICT (class_id, date, meal_type)
       DO UPDATE SET chef_feedback = $3;`,
      [classId, date, status],
    );

    return {
      success: true,
      classId: String(classId),
      status,
      message: `Đã cập nhật trạng thái lớp sang ${status}`,
    };
  }

  async getKitchenKdsData(date?: string, tenantId = 1) {
    const classes = await this.classRepo.find({ where: { schoolId: tenantId }, order: { id: 'ASC' } });
    const today = date || new Date().toISOString().split('T')[0];

    const todayMenu = await this.getMenuForDate(today, 'LUNCH');
    const submissions = await this.attendanceRepo.query(`SELECT class_id,meal_type,planned_quantity,attendance_snapshot
      FROM daily_meal_portions WHERE date=$1 AND attendance_submitted_at IS NOT NULL`, [today]);

    const statusLocks = await this.attendanceRepo.query(
      `SELECT class_id, chef_feedback FROM meal_evaluation_locks WHERE date = $1 AND meal_type = 'KITCHEN_STATUS'`,
      [today],
    );
    const statusMap = new Map(statusLocks.map((l: any) => [Number(l.class_id), l.chef_feedback]));

    const classKdsList = await Promise.all(
      classes.map(async (c) => {
        const planned = await this.childRepo.count({ where: { classId: c.id } });
        const lunch = submissions.find((p: any) => Number(p.class_id) === Number(c.id) && p.meal_type === 'LUNCH');
        const snack = submissions.find((p: any) => Number(p.class_id) === Number(c.id) && p.meal_type === 'AFTERNOON_SNACK');
        const actual = Number(lunch?.planned_quantity ?? 0);
        const savedStatus = statusMap.get(Number(c.id));

        const allergyKids = await this.childRepo.manager.query(
          `SELECT s.full_name, a.name as allergen_name
           FROM student_allergies sa
           JOIN students s ON sa.student_id = s.id
           JOIN allergens a ON sa.allergen_id = a.id
           WHERE s.class_id = $1;`,
          [c.id],
        );
        const allergies = allergyKids.map(
          (k: any) => `1 suất không ${k.allergen_name} (Bé ${k.full_name})`,
        );

        const finalStatus = savedStatus || (lunch || snack ? 'SYNCED' : 'WAITING');

        return {
          classId: String(c.id),
          className: c.name,
          ageGroup: c.ageGroup,
          plannedPortions: planned,
          actualPortions: actual,
          lunchCount: actual,
          snackCount: Number(snack?.planned_quantity ?? 0),
          absentCount: lunch?.attendance_snapshot?.filter((s: any) => !s.isAttended).length ?? 0,
          status: finalStatus,
          kitchenStatus: finalStatus,
          isLocked: Boolean(lunch?.attendance_submitted_at || snack?.attendance_submitted_at),
          allergies,
        };
      }),
    );

    const totalPlanned = classKdsList.reduce((sum, c) => sum + c.plannedPortions, 0);
    const totalActual = classKdsList.reduce((sum, c) => sum + c.actualPortions, 0);

    return {
      date: today,
      lastUpdated: new Date().toISOString(),
      todayMenu,
      classes: classKdsList,
      totalPlanned,
      totalActual,
      summary: {
        totalLunchPortions: totalActual,
        totalSnackPortions: classKdsList.reduce((total, c) => total + c.snackCount, 0),
        absentCount: classKdsList.reduce((total, c) => total + c.absentCount, 0),
      },
    };
  }
}
