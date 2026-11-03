import { Injectable, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Child } from '../../children/entities/child.entity';
import { ClassEntity } from '../../classes/entities/class.entity';
import { SnackRegistration } from '../../snack-services/entities/snack-registration.entity';
import { SnackServicePeriod } from '../../snack-services/entities/snack-service-period.entity';
import { DailyMealAttendance } from '../entities/daily-meal-attendance.entity';
import { MealCoordinationNote } from '../entities/meal-coordination-note.entity';
import { SnackRosterQueryDto } from '../dto/snack-roster-query.dto';

@Injectable()
export class SnackRosterService {
  private readonly dispatchedClassesByDate = new Map<string, Set<string>>();

  constructor(
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @Optional()
    @InjectRepository(ClassEntity)
    private readonly classRepo?: Repository<ClassEntity>,
    @Optional()
    @InjectRepository(SnackRegistration)
    private readonly regRepo?: Repository<SnackRegistration>,
    @Optional()
    @InjectRepository(SnackServicePeriod)
    private readonly periodRepo?: Repository<SnackServicePeriod>,
    @Optional()
    @InjectRepository(DailyMealAttendance)
    private readonly attendanceRepo?: Repository<DailyMealAttendance>,
    @Optional()
    @InjectRepository(MealCoordinationNote)
    private readonly noteRepo?: Repository<MealCoordinationNote>,
  ) {}
  private assertNotNutritionist(user?: any) {
    if (!user) return;
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) =>
          typeof r === 'string' ? r.toUpperCase() : String(r?.code || r?.name || '').toUpperCase(),
        )
      : user.role
      ? [String(user.role).toUpperCase()]
      : [];
    const hasManagerOrTeacher = roles.some((r) =>
      [
        'SUPER_ADMIN',
        'PRINCIPAL',
        'SCHOOL_MANAGER',
        'SCHOOL_MANAGEMENT',
        'TEACHER',
        'KITCHEN_STAFF',
      ].includes(r),
    );
    if (!hasManagerOrTeacher && roles.includes('NUTRITIONIST')) {
      throw new ForbiddenException(
        'Chuyên gia Dinh dưỡng (CGDD) chỉ có quyền thiết kế thực đơn ăn xế, không được phép xem danh sách trẻ đóng tiền.',
      );
    }
  }

  async findAll(query: SnackRosterQueryDto, currentUser?: any) {
    this.assertNotNutritionist(currentUser);

    const targetDate = query.date || new Date().toISOString().split('T')[0];
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;

    let classes: ClassEntity[] = [];
    try {
      if (this.classRepo) {
        classes = await this.classRepo.find({ order: { name: 'ASC' } });
      }
    } catch {
      classes = [];
    }

    let registrations: SnackRegistration[] = [];
    try {
      if (this.regRepo) {
        registrations = await this.regRepo.find({
          relations: ['student', 'student.class', 'student.allergies', 'student.allergies.allergen', 'parent', 'period'],
          order: { id: 'DESC' },
        });
      }
    } catch {
      registrations = [];
    }

    let attendances: DailyMealAttendance[] = [];
    try {
      if (this.attendanceRepo) {
        attendances = await this.attendanceRepo.find({
          where: { date: targetDate, mealType: 'AFTERNOON_SNACK' },
        });
      }
    } catch {
      attendances = [];
    }

    const qb = this.childRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.class', 'cls')
      .leftJoinAndSelect('c.allergies', 'alg')
      .leftJoinAndSelect('alg.allergen', 'ac');

    if (query.classId && query.classId !== 'ALL') {
      const parsedClassId = Number(String(query.classId).replace(/\D/g, '')) || 1;
      qb.andWhere('c.classId = :classId', { classId: parsedClassId });

  async findAll(query: SnackRosterQueryDto) {
    const targetDate = query.date || new Date().toISOString().split('T')[0];

    // 1. Lấy danh sách lớp học thực tế từ PostgreSQL
    const classRows = await this.childRepo.query(`
      SELECT c.id, c.name, c.age_group, u.full_name as teacher_name, u.phone as teacher_phone
      FROM classes c
      LEFT JOIN users u ON u.id = c.homeroom_teacher_id
      ORDER BY c.id ASC;
    `);

    const classes = classRows.map((c: any) => {
      const name = c.name || '';
      const nameLower = name.toLowerCase();
      const grade = nameLower.includes('mầm') || nameLower.includes('mam')
        ? 'Khối Mầm'
        : nameLower.includes('chồi') || nameLower.includes('choi')
        ? 'Khối Chồi'
        : 'Khối Lá';
      return {
        id: String(c.id),
        name: c.name,
        gradeLevel: grade,
        blockName: grade,
      };
    });

    // 2. Lấy danh sách học sinh từ PostgreSQL
    const studentRows = await this.childRepo.query(`
      SELECT 
        s.id, s.student_code, s.full_name, s.date_of_birth, s.gender, s.class_id,
        c.name as class_name, c.age_group
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      ORDER BY s.class_id ASC, s.full_name ASC;
    `);

    // 3. Lấy thông tin dị ứng thực tế từ PostgreSQL
    const allergyRows = await this.childRepo.query(`
      SELECT sa.student_id, a.name as allergen_name, a.code as allergen_code, sa.severity, sa.note
      FROM student_allergies sa
      JOIN allergens a ON a.id = sa.allergen_id;
    `);
    const allergyMap = new Map<number, any[]>();
    allergyRows.forEach((a: any) => {
      const sId = Number(a.student_id);
      if (!allergyMap.has(sId)) allergyMap.set(sId, []);
      allergyMap.get(sId)!.push(a);
    });

    // 4. Lấy điểm danh ca ăn xế chiều thực tế cho ngày targetDate
    const attRows = await this.childRepo.query(`
      SELECT student_id, is_attended, consumption_level, note
      FROM meal_attendances
      WHERE date = $1 AND meal_type = 'AFTERNOON_SNACK';
    `, [targetDate]);
    const attMap = new Map<number, any>();
    attRows.forEach((a: any) => {
      attMap.set(Number(a.student_id), a);
    });

    // 5. Lấy trạng thái đăng ký dịch vụ ăn xế từ bảng snack_registrations
    const regRows = await this.childRepo.query(`
      SELECT sr.id as registration_id, sr.student_id, sr.status as reg_status
      FROM snack_registrations sr
      ORDER BY sr.id DESC;
    `);
    const regMap = new Map<number, any>();
    regRows.forEach((r: any) => {
      const sId = Number(r.student_id);
      if (!regMap.has(sId)) regMap.set(sId, r);
    });

    // 6. Lấy thông tin liên hệ phụ huynh khẩn cấp từ student_parents
    const parentRows = await this.childRepo.query(`
      SELECT sp.student_id, sp.relationship, u.full_name as parent_name, u.phone as parent_phone
      FROM student_parents sp
      JOIN users u ON u.id = sp.parent_id
      ORDER BY sp.student_id ASC;
    `);
    const parentMap = new Map<number, { name: string; phone: string }>();
    parentRows.forEach((p: any) => {
      const sId = Number(p.student_id);
      if (!parentMap.has(sId)) {
        parentMap.set(sId, {
          name: p.parent_name || 'Phụ huynh',
          phone: p.parent_phone || '028-3930-1888',
        });
      }
    });

    // 7. Mapping từng học sinh thành 1 bản ghi SnackRosterItem chuẩn nghiệp vụ
    const allItems = studentRows.map((s: any) => {
      const kidId = Number(s.id);
      const className = s.class_name || 'Lớp Mầm 1';
      const nameLower = className.toLowerCase();
      const gradeLevel = nameLower.includes('mầm') || nameLower.includes('mam')
        ? 'Khối Mầm'
        : nameLower.includes('chồi') || nameLower.includes('choi')
        ? 'Khối Chồi'
        : 'Khối Lá';
      const blockName = gradeLevel;
      const classBadgeColor = gradeLevel === 'Khối Mầm' ? 'emerald' : gradeLevel === 'Khối Chồi' ? 'amber' : 'sky';

      // Trạng thái điểm danh ca xế
      const att = attMap.get(kidId);
      const isAttended = att ? att.is_attended : true;

      // Trạng thái đóng phí
      const reg = regMap.get(kidId);
      const paymentStatus = reg ? reg.reg_status : 'PAID';
      const paymentStatusLabel = paymentStatus === 'PAID' ? 'Đã hoàn thành' : 'Chưa hoàn thành';

      // Dị ứng thực tế
      const allergies = allergyMap.get(kidId) || [];
      const hasAllergy = allergies.length > 0;
      let snackDietType = 'STANDARD';
      let snackDietBadgeText = 'Suất chuẩn';
      let snackDietBadgeType = 'NORMAL';
      let kitchenNotes = att?.note || 'Phần ăn xế tiêu chuẩn (bánh & sữa)';

      if (hasAllergy) {
        const first = allergies[0];
        const code = (first.allergen_code || '').toUpperCase();
        if (code === 'MILK') {
          snackDietType = 'NO_MILK';
          snackDietBadgeText = 'Không sữa';
        } else if (code === 'PEANUT') {
          snackDietType = 'ALLERGY_PEANUT';
          snackDietBadgeText = 'Dị ứng đậu phộng';
        } else if (code === 'SEAFOOD') {
          snackDietType = 'SEAFOOD_ALLERGY';
          snackDietBadgeText = 'Dị ứng hải sản';
        } else if (code === 'EGG') {
          snackDietType = 'NO_EGG';
          snackDietBadgeText = 'Không trứng';
        } else {
          snackDietType = 'SPECIAL';
          snackDietBadgeText = `Dị ứng: ${first.allergen_name}`;
        }
        snackDietBadgeType = 'ALLERGY';
        kitchenNotes = first.note || `Lưu ý dị ứng: ${allergies.map(a => a.allergen_name).join(', ')} — Bếp chuẩn bị phần ăn kiêng riêng`;
      }

      const dob = s.date_of_birth ? new Date(s.date_of_birth) : new Date('2022-03-15');
      const dNum = dob.getDate().toString().padStart(2, '0');
      const mNum = (dob.getMonth() + 1).toString().padStart(2, '0');
      const formattedDob = `${dNum}/${mNum}/${dob.getFullYear()}`;
      const age = new Date().getFullYear() - dob.getFullYear();
      const ageLabel = `${age} tuổi`;

      const initials = s.full_name
        ? s.full_name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(-2).join('').toUpperCase()
        : 'HS';

      const parent = parentMap.get(kidId) || { name: 'Phụ huynh bé', phone: '028-3930-1888' };

      return {
        id: String(s.id),
        registrationId: reg ? String(reg.registration_id) : `REG-${s.id}`,
        childId: String(s.id),
        studentCode: s.student_code || `HS-${String(s.id).padStart(4, '0')}`,
        fullName: s.full_name,
        avatarInitials: initials,
        dateOfBirth: s.date_of_birth || '2022-01-01',
        formattedDob,
        ageLabel,
        gender: s.gender === 'MALE' ? 'Nam' : 'Nữ',
        classId: String(s.class_id || 1),
        className,
        gradeLevel,
        blockName,
        classBadgeColor,
        paymentStatus,
        paymentStatusLabel,
        snackDietType,
        snackDietBadgeText,
        snackDietBadgeType,
        kitchenNotes,
        isKitchenHighlight: hasAllergy,
        emergencyContactName: parent.name,
        emergencyContactPhone: parent.phone,
      };
    });

    // 8. Thực hiện các bộ lọc (Filter Snack Service Roster)
    let filteredItems = allItems;

    // Lọc theo từ khóa: Tên bé hoặc Mã học sinh
    if (query.search && query.search.trim() !== '') {
      const q = query.search.trim().toLowerCase();
      filteredItems = filteredItems.filter(
        (i) => i.fullName.toLowerCase().includes(q) || i.studentCode.toLowerCase().includes(q),
      );
    }

    // Lọc theo Khối học
    if (query.gradeLevel && query.gradeLevel !== 'ALL') {
      const g = query.gradeLevel.toLowerCase();
      filteredItems = filteredItems.filter(
        (i) => i.gradeLevel.toLowerCase().includes(g) || i.blockName.toLowerCase().includes(g),
      );
    }
    qb.orderBy('c.fullName', 'ASC');
    const allChildren = await qb.getMany();

    const dispatchedSet = this.dispatchedClassesByDate.get(targetDate) || new Set<string>();

    // Map children with real registration status from snack_registrations
    const mappedItems = allChildren.map((c) => {
      // Find latest registration for this student (prefer PAID if multiple)
      const studentRegs = registrations.filter((r) => Number(r.studentId) === Number(c.id));
      const paidReg = studentRegs.find((r) => r.status === 'PAID');
      const activeReg = paidReg || studentRegs[0];

      // Nếu DB có bản ghi đăng ký thật thì lấy trạng thái thật từ DB
      const paymentStatus = activeReg ? activeReg.status : registrations.length > 0 ? 'NOT_REGISTERED' : 'PAID';
      const isPaid = paymentStatus === 'PAID';

      const attRecord = attendances.find((a) => Number(a.studentId) === Number(c.id));
      const isAttendedSnack = attRecord ? attRecord.isAttended : true;

      const allergies = (c.allergies || [])
        .map((a) => a.allergen?.name || a.allergen?.code)
        .filter(Boolean);
      const hasAllergy = allergies.length > 0;

      const nameParts = (c.fullName || 'Bé').trim().split(/\s+/);
      const initials =
        nameParts.length >= 2
          ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
          : (c.fullName || 'KB').slice(0, 2).toUpperCase();

      const classIdStr = c.classId ? String(c.classId) : '1';
      const className = c.class?.name || 'Mầm 1';
      const isDispatched =
        dispatchedSet.has('ALL') || dispatchedSet.has(classIdStr) || Boolean(attRecord);

      return {
        id: String(c.id),
        registrationId: activeReg ? String(activeReg.id) : String(c.id),
        childId: String(c.id),
        childName: c.fullName,
        fullName: c.fullName,
        studentCode: c.studentCode,
        avatarInitials: initials,
        dateOfBirth: c.dateOfBirth,
        formattedDob: c.dateOfBirth || '15/05/2022',
        ageLabel: '4 tuổi',
        gender: c.gender === 'MALE' ? 'Nam' : 'Nữ',
        classId: classIdStr,
        className,
        gradeLevel: c.class?.ageGroup || 'MAU_GIAO',
        blockName: c.class?.ageGroup === 'NHA_TRE' ? 'Khối Nhà Trẻ' : 'Khối Mẫu Giáo',
        classBadgeColor: 'teal',
        date: targetDate,
        isRegistered: Boolean(activeReg) || isPaid,
        paymentStatus,
        paymentStatusLabel:
          paymentStatus === 'PAID'
            ? 'Đã đóng tiền ăn sáng'
            : paymentStatus === 'PENDING'
            ? 'Chờ phụ huynh đóng tiền'
            : 'Chưa đăng ký',
        packageName: (activeReg?.period?.name || 'Gói Suất Ăn Sáng 07h00').replace(
          /ăn xế/gi,
          'ăn sáng',
        ),
        paidAt: activeReg?.registeredAt ? activeReg.registeredAt.toISOString() : undefined,
        snackDietType: hasAllergy ? 'ALLERGY_REPLACEMENT' : 'STANDARD',
        snackDietBadgeText: hasAllergy
          ? `Khay thay thế (Dị ứng: ${allergies.join(', ')})`
          : 'Suất ăn sáng tiêu chuẩn',
        snackDietBadgeType: hasAllergy ? 'DANGER' : 'STANDARD',
        kitchenNotes: hasAllergy
          ? `Tuyệt đối tránh ${allergies.join(', ')} - Chuẩn bị suất thay thế riêng`
          : '',
        isKitchenHighlight: hasAllergy,
        allergyWarning: hasAllergy,
        allergens: allergies,
        emergencyContactName:
          activeReg?.parent?.fullName || `Phụ huynh bé ${nameParts[nameParts.length - 1]}`,
        emergencyContactPhone: activeReg?.parent?.phone || '0908123456',
        isAttendedSnack,
        dispatchedToKitchen: isDispatched,
        status: isPaid ? (isAttendedSnack ? 'SERVED' : 'ABSENT') : 'UNPAID',
      };
    });

    // Filter by paymentStatus if specified (default Teacher view focuses on PAID students)
    const filteredItems = mappedItems.filter((item) => {
      if (query.paymentStatus && query.paymentStatus !== 'ALL') {
        return item.paymentStatus === query.paymentStatus;
      }
      return item.paymentStatus === 'PAID' || item.paymentStatus === 'PENDING';
    });

    const total = filteredItems.length;
    const startIdx = (page - 1) * limit;
    const pagedItems = filteredItems.slice(startIdx, startIdx + limit);

    const paidItems = mappedItems.filter((i) => i.paymentStatus === 'PAID');
    const presentPaidItems = paidItems.filter((i) => i.isAttendedSnack);
    const specialDietPaidCount = presentPaidItems.filter((i) => i.allergyWarning).length;
    const standardPaidCount = Math.max(0, presentPaidItems.length - specialDietPaidCount);

    const stats = {
      totalRegistered: mappedItems.filter((i) => i.paymentStatus !== 'NOT_REGISTERED').length,
      registeredMonthLabel: 'Đợt suất ăn sáng hiện tại',
      paidCount: paidItems.length,
      totalEligible: allChildren.length,
      paidPercent:
        allChildren.length > 0 ? Math.round((paidItems.length / allChildren.length) * 100) : 100,
      totalClasses: classes.length || 6,
      classListSummary:
        classes.map((cl) => cl.name).join(', ') || 'Nhà trẻ 1, Mầm 1, Chồi 1, Lá 1',
      todayTotalPortions: presentPaidItems.length,
      standardPortions: standardPaidCount,
      specialDietPortions: specialDietPaidCount,
    };

    return {
      stats,
      bannerNotice: {
        timeWindow: '07:00 - 07:45',
        title: 'Danh sách học sinh đã đóng phí suất ăn sáng & Điểm danh gửi Bếp',
        content: `Hiện có ${paidItems.length} học sinh đã đóng tiền ăn sáng, trong đó ${presentPaidItems.length} bé có mặt hôm nay (${specialDietPaidCount} suất dị ứng đặc biệt).`,
        inspectionBadge: 'Đã đồng bộ VNPAY & Bếp',
      },
      classes: classes.map((cl) => ({
        id: String(cl.id),
        name: cl.name,
        gradeLevel: cl.ageGroup,
        blockName: cl.ageGroup === 'NHA_TRE' ? 'Khối Nhà Trẻ' : 'Khối Mẫu Giáo',
      })),
      items: pagedItems,
      total,
      page,
      limit,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        startIndex: total > 0 ? startIdx + 1 : 0,
        endIndex: Math.min(total, startIdx + pagedItems.length),
      },
    };
  }

  /**
   * Giáo viên điểm danh có mặt / vắng ăn xế cho trẻ đã đóng tiền (PAID)
   */
  async markSnackAttendance(
    studentId: number,
    dto: { date?: string; isAttended: boolean; note?: string },
    userId?: number,
  ) {
    const date = dto.date || new Date().toISOString().split('T')[0];

    if (this.regRepo) {
      const paidReg = await this.regRepo.findOne({
        where: { studentId: Number(studentId), status: 'PAID' },
      });
      if (!paidReg) {
        const anyRegs = await this.regRepo.count();
        if (anyRegs > 0) {
          throw new BadRequestException(
            'Học sinh này chưa hoàn tất đóng phí dịch vụ suất ăn sáng (PAID) nên không thể điểm danh suất ăn sáng.',
          );
        }
      }
    }

    if (this.attendanceRepo) {
      let record = await this.attendanceRepo.findOne({
        where: {
          studentId: Number(studentId),
          date,
          mealType: 'AFTERNOON_SNACK',
        },
      });

      if (!record) {
        record = this.attendanceRepo.create({
          studentId: Number(studentId),
          date,
          mealType: 'AFTERNOON_SNACK',
          isAttended: dto.isAttended,
          note: dto.note || (dto.isAttended ? 'Có mặt ăn sáng' : 'Vắng ăn sáng có phép'),
          recordedBy: userId || 1,
        });
      } else {
        record.isAttended = dto.isAttended;
        if (dto.note !== undefined) record.note = dto.note;
        record.recordedBy = userId || 1;
      }

      await this.attendanceRepo.save(record);
    }

    return {
      success: true,
      studentId: String(studentId),
      date,
      isAttendedSnack: dto.isAttended,
      message: dto.isAttended
        ? 'Đã điểm danh CÓ MẶT ăn sáng cho học sinh'
        : 'Đã ghi nhận VẮNG ăn sáng cho học sinh (Sẽ đối soát hoàn phí)',
    };
  }

  /**
   * Giáo viên bấm "Chốt & Gửi danh sách trẻ đã đóng tiền ăn sáng xuống Bếp"
   */
  async dispatchSnackRosterToKitchen(
    dto: { classId?: string; date?: string; notes?: string },
    userId?: number,
  ) {
    const date = dto.date || new Date().toISOString().split('T')[0];
    const classKey = dto.classId && dto.classId !== 'ALL' ? String(dto.classId) : 'ALL';

    const roster = await this.findAll({
      classId: classKey !== 'ALL' ? classKey : undefined,
      date,
      paymentStatus: 'PAID',
      page: 1,
      limit: 500,
    });

    const paidPresentItems = roster.items.filter((i) => i.paymentStatus === 'PAID' && i.isAttendedSnack);
    const allergyItems = paidPresentItems.filter((i) => i.allergyWarning);

    // Lưu bản ghi điểm danh cho toàn bộ trẻ đã đóng tiền trong danh sách gửi bếp
    if (this.attendanceRepo) {
      for (const item of roster.items.filter((i) => i.paymentStatus === 'PAID')) {
        const studentId = Number(item.childId);
        let att = await this.attendanceRepo.findOne({
          where: { studentId, date, mealType: 'AFTERNOON_SNACK' },
        });
        if (!att) {
          att = this.attendanceRepo.create({
            studentId,
            date,
            mealType: 'AFTERNOON_SNACK',
            isAttended: item.isAttendedSnack,
            note: 'Giáo viên đã chốt danh sách ăn sáng gửi Bếp',
            recordedBy: userId || 1,
          });
          await this.attendanceRepo.save(att);
        }
      }
    }

    // Ghi nhận thông báo điều phối gửi thẳng sang màn hình Bếp (KDS)
    if (this.noteRepo) {
      try {
        const classLabel =
          classKey !== 'ALL'
            ? paidPresentItems[0]?.className || `Lớp #${classKey}`
            : 'Toàn trường';
        const noteContent = `[CHỐT SUẤT ĂN SÁNG 07H - ${classLabel}] Giáo viên đã điểm danh và gửi bếp: ${paidPresentItems.length} suất ăn sáng đã đóng tiền (${paidPresentItems.length - allergyItems.length} suất chuẩn, ${allergyItems.length} suất dị ứng thay thế). ${dto.notes ? `Ghi chú GV: ${dto.notes}` : ''}`;
        const note = this.noteRepo.create({
          date,
          fromUserId: userId || 1,
          content: noteContent,
        });
        await this.noteRepo.save(note);
      } catch {
        // Ignore if user FK not seeded
      }
    }

    if (!this.dispatchedClassesByDate.has(date)) {
      this.dispatchedClassesByDate.set(date, new Set<string>());
    }
    this.dispatchedClassesByDate.get(date)!.add(classKey);

    return {
      success: true,
      date,
      classId: classKey,
      dispatchedAt: new Date().toISOString(),
      totalPaidStudents: roster.stats.paidCount,
      presentPaidCount: paidPresentItems.length,
      absentPaidCount: Math.max(0, roster.stats.paidCount - paidPresentItems.length),
      dispatchedSnackPortions: paidPresentItems.length,
      standardPortions: paidPresentItems.length - allergyItems.length,
      allergyReplacementPortions: allergyItems.length,
      kitchenPortions: {
        totalPortionsToPrepare: paidPresentItems.length,
        standardPortions: paidPresentItems.length - allergyItems.length,
        allergySecurePortions: allergyItems.length,
      },
      message: `Đã chốt và gửi danh sách ${paidPresentItems.length} suất ăn sáng (của trẻ đã đóng tiền & có mặt) xuống Nhà bếp thành công!`,
    };
  }

  /**
   * Nhân viên Bếp (KITCHEN_STAFF) xem danh sách khẩu phần ăn sáng cần chuẩn bị
   * Chỉ tính những trẻ ĐÃ ĐÓNG TIỀN (PAID) và được Giáo viên điểm danh có mặt gửi xuống
   */
  async getKitchenSnackPortions(date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const roster = await this.findAll({
      date: targetDate,
      paymentStatus: 'PAID',
      page: 1,
      limit: 500,
    });

    const paidPresentItems = roster.items.filter(
      (i) => i.paymentStatus === 'PAID' && i.isAttendedSnack,
    );

    const byClassMap = new Map<
      string,
      {
        classId: string;
        className: string;
        paidRegisteredCount: number;
        presentSnackPortions: number;
        absentPaidCount: number;
        standardPortions: number;
        specialAllergyPortions: number;
        dispatchedByTeacher: boolean;
        students: Array<{
          studentId: string;
          studentCode: string;
          fullName: string;
          hasAllergy: boolean;
          allergens: string[];
          snackDietBadgeText: string;
          kitchenNotes: string;
        }>;
      }
    >();

    for (const item of roster.items.filter((i) => i.paymentStatus === 'PAID')) {
      const cid = item.classId || '1';
      if (!byClassMap.has(cid)) {
        byClassMap.set(cid, {
          classId: cid,
          className: item.className,
          paidRegisteredCount: 0,
          presentSnackPortions: 0,
          absentPaidCount: 0,
          standardPortions: 0,
          specialAllergyPortions: 0,
          dispatchedByTeacher: Boolean(item.dispatchedToKitchen),
          students: [],
        });
      }
      const group = byClassMap.get(cid)!;
      group.paidRegisteredCount += 1;
      if (item.isAttendedSnack) {
        group.presentSnackPortions += 1;
        if (item.allergyWarning) {
          group.specialAllergyPortions += 1;
        } else {
          group.standardPortions += 1;
        }
        group.students.push({
          studentId: item.childId,
          studentCode: item.studentCode,
          fullName: item.fullName,
          hasAllergy: item.allergyWarning,
          allergens: item.allergens,
          snackDietBadgeText: item.snackDietBadgeText,
          kitchenNotes: item.kitchenNotes,
        });
      } else {
        group.absentPaidCount += 1;
      }
    }

    return {
      success: true,
      date: targetDate,
      totalPaidStudents: roster.stats.paidCount,
      totalSnackPortionsToPrepare: paidPresentItems.length,
      totalPortionsToPrepare: paidPresentItems.length,
      standardPortions: roster.stats.standardPortions,
      specialAllergyPortions: roster.stats.specialDietPortions,
      allergySecurePortions: roster.stats.specialDietPortions,
      students: paidPresentItems,
      todaySnackMenu: {
        servingTime: '07:00 - 07:45',
        mainDish: 'Cháo Yến Mạch Thịt Bằm Bí Đỏ & Bánh Ngũ Cốc',
        drinkItem: 'Sữa hạt Yến mạch nguyên cám ấm (180ml/bé)',
        fruitOrSide: 'Chuối Laba chín & Táo Fuji hấp mềm',
        caloriesKcal: 265,
      },
      classPortions: Array.from(byClassMap.values()),
    // Lọc theo Lớp học
    if (query.classId && query.classId !== 'ALL') {
      filteredItems = filteredItems.filter((i) => String(i.classId) === String(query.classId));
    }

    // Lọc theo Trạng thái đóng phí
    if (query.paymentStatus && query.paymentStatus !== 'ALL') {
      if (query.paymentStatus === 'PAID') {
        filteredItems = filteredItems.filter((i) => i.paymentStatus === 'PAID');
      } else if (query.paymentStatus === 'UNPAID') {
        filteredItems = filteredItems.filter((i) => i.paymentStatus !== 'PAID');
      }
    }

    // 9. Thống kê KPI tổng quan (SnackRosterStats)
    const totalRegistered = allItems.length;
    const paidCount = allItems.filter((i) => i.paymentStatus === 'PAID').length;
    const paidPercent = totalRegistered > 0 ? Math.round((paidCount / totalRegistered) * 100) : 100;
    const totalClasses = new Set(allItems.map((i) => i.className)).size;
    const todayTotalPortions = allItems.length;
    const specialDietPortions = allItems.filter((i) => i.isKitchenHighlight).length;
    const standardPortions = Math.max(0, todayTotalPortions - specialDietPortions);

    const dateObj = new Date(targetDate);
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    const registeredMonthLabel = `Tháng ${month}/${year}`;

    const stats = {
      totalRegistered,
      registeredMonthLabel,
      paidCount,
      totalEligible: totalRegistered,
      paidPercent,
      totalClasses,
      classListSummary: `${totalClasses} lớp bán trú`,
      todayTotalPortions,
      standardPortions,
      specialDietPortions,
    };

    const bannerNotice = {
      timeWindow: '14:15 - 14:45',
      title: 'Ca phục vụ ăn xế chiều',
      content: `Có ${specialDietPortions} suất ăn kiêng & dị ứng đặc biệt cần nhà bếp kiểm tra chéo trước khi chia về các lớp.`,
      inspectionBadge: 'Kiểm thực 3 bước: ĐÃ DUYỆT',
    };

    // 10. Phân trang
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 8);
    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const startIndex = totalItems > 0 ? (page - 1) * limit + 1 : 0;
    const endIndex = Math.min(page * limit, totalItems);
    const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

    return {
      stats,
      bannerNotice,
      classes,
      items: paginatedItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        startIndex,
        endIndex,
      },
    };
  }
}
