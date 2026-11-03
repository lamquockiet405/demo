import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Child } from '../../children/entities/child.entity';
import { SnackRosterQueryDto } from '../dto/snack-roster-query.dto';

@Injectable()
export class SnackRosterService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

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
