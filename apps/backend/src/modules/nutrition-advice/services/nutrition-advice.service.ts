import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickyEatingAdvice } from '../entities/picky-eating-advice.entity';
import { Child } from '../../children/entities/child.entity';
import { SendHomeSupplementAdviceDto } from '../dto/send-advice.dto';
import { ConfirmAdviceDto } from '../dto/confirm-advice.dto';

@Injectable()
export class NutritionAdviceService {
  constructor(
    @InjectRepository(PickyEatingAdvice)
    private readonly adviceRepo: Repository<PickyEatingAdvice>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  /**
   * Phát hiện trẻ biếng ăn / kén ăn dựa trên dữ liệu tiêu thụ thực tế từ PostgreSQL
   */
  async detectPickyEating(classId?: string, search?: string) {
    // 1. Lấy danh sách học sinh đang hoạt động kèm lớp và độ tuổi
    let studentQuery = `
      SELECT 
        s.id, s.student_code, s.full_name, s.date_of_birth, s.gender, s.class_id,
        c.name as class_name, c.age_group
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      WHERE s.status = 'ACTIVE'
    `;
    const params: any[] = [];
    if (classId && classId !== 'ALL') {
      params.push(Number(classId));
      studentQuery += ` AND s.class_id = $${params.length}`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      studentQuery += ` AND (LOWER(s.full_name) LIKE $${params.length} OR LOWER(s.student_code) LIKE $${params.length})`;
    }
    studentQuery += ` ORDER BY s.class_id ASC, s.full_name ASC;`;

    const students = await this.childRepo.query(studentQuery, params);

    // 2. Lấy dị ứng của học sinh từ PostgreSQL
    const allergyRows = await this.childRepo.query(`
      SELECT sa.student_id, a.name as allergen_name, a.code as allergen_code, sa.severity, sa.note
      FROM student_allergies sa
      JOIN allergens a ON a.id = sa.allergen_id
      WHERE sa.is_active = TRUE;
    `);
    const allergyMap = new Map<number, any[]>();
    allergyRows.forEach((a: any) => {
      const sId = Number(a.student_id);
      if (!allergyMap.has(sId)) allergyMap.set(sId, []);
      allergyMap.get(sId)!.push(a);
    });

    // 3. Lấy thông tin phụ huynh thực tế
    const parentRows = await this.childRepo.query(`
      SELECT sp.student_id, sp.relationship, u.full_name as parent_name, u.phone as parent_phone
      FROM student_parents sp
      JOIN users u ON u.id = sp.parent_id;
    `);
    const parentMap = new Map<number, { name: string; phone: string; relationship: string }>();
    parentRows.forEach((p: any) => {
      const sId = Number(p.student_id);
      if (!parentMap.has(sId)) {
        parentMap.set(sId, {
          name: p.parent_name || 'Phụ huynh bé',
          phone: p.parent_phone || '',
          relationship: p.relationship === 'FATHER' ? 'Bố bé' : 'Mẹ bé',
        });
      }
    });

    // 4. Lấy lịch sử tiêu thụ thức ăn thực tế trong 14 ngày gần nhất từ meal_attendances
    const attendanceRows = await this.childRepo.query(`
      SELECT 
        student_id, date, meal_type, is_attended, consumption_level, note
      FROM meal_attendances
      WHERE date >= CURRENT_DATE - INTERVAL '14 days'
      ORDER BY date DESC, id DESC;
    `);
    const attMap = new Map<number, any[]>();
    attendanceRows.forEach((att: any) => {
      const sId = Number(att.student_id);
      if (!attMap.has(sId)) attMap.set(sId, []);
      attMap.get(sId)!.push(att);
    });

    // 5. Lấy danh sách các tư vấn gần nhất đã gửi từ bảng picky_eating_advices
    const existingAdvices = await this.adviceRepo.find({
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
    const adviceMap = new Map<number, PickyEatingAdvice>();
    existingAdvices.forEach((adv) => {
      const sId = Number(adv.studentId);
      if (!adviceMap.has(sId)) adviceMap.set(sId, adv);
    });

    // 6. Phân tích phát hiện trẻ kén ăn cho từng học sinh
    const detectedChildren: any[] = [];

    students.forEach((s: any) => {
      const kidId = Number(s.id);
      const records = attMap.get(kidId) || [];
      const allergies = allergyMap.get(kidId) || [];
      const parent = parentMap.get(kidId) || { name: 'Phụ huynh bé', phone: '', relationship: 'Phụ huynh' };
      const latestAdvice = adviceMap.get(kidId);

      // Phân tích các bữa ăn
      const totalMeals = records.length;
      let littleCount = 0;
      let partialCount = 0;
      let fullCount = 0;
      let absentCount = 0;
      const pickySymptoms: string[] = [];
      const teacherObservationNotes: string[] = [];

      records.forEach((r) => {
        if (!r.is_attended) {
          absentCount++;
          return;
        }
        const lvl = (r.consumption_level || '').toUpperCase();
        if (lvl === 'LITTLE' || lvl === 'FEW' || lvl === 'REFUSED' || lvl === 'NONE') {
          littleCount++;
          if (r.note && !teacherObservationNotes.includes(r.note)) {
            teacherObservationNotes.push(r.note);
          }
        } else if (lvl === 'PARTIAL' || lvl === 'HALF') {
          partialCount++;
          if (r.note && !teacherObservationNotes.includes(r.note)) {
            teacherObservationNotes.push(r.note);
          }
        } else {
          fullCount++;
        }
      });

      const lowIntakeCount = littleCount + partialCount;
      const lowRate = totalMeals > 0 ? Math.round((lowIntakeCount / totalMeals) * 100) : 0;

      // Xác định triệu chứng kén ăn từ dữ liệu thực tế
      if (littleCount > 0) {
        pickySymptoms.push(`Ăn rất ít hoặc bỏ bữa (${littleCount} bữa ăn dưới 25% khẩu phần)`);
      }
      if (partialCount > 0) {
        pickySymptoms.push(`Ăn chậm, để lại một nửa phần cơm & canh (${partialCount} bữa)`);
      }
      if (allergies.length > 0) {
        pickySymptoms.push(`Kiêng cữ do dị ứng: ${allergies.map(a => a.allergen_name).join(', ')}`);
      }
      if (teacherObservationNotes.length > 0) {
        pickySymptoms.push(`Lời dặn cô giáo: ${teacherObservationNotes.slice(0, 2).join('; ')}`);
      }

      // Xác định mức độ (Severity)
      let severityLevel: 'SEVERE' | 'MODERATE' | 'MILD' | 'NORMAL' = 'NORMAL';
      if (littleCount >= 1 || lowRate >= 40) {
        severityLevel = 'SEVERE';
      } else if (partialCount >= 1 || lowRate >= 20 || allergies.length > 0) {
        severityLevel = 'MODERATE';
      } else if (records.some(r => r.note && (r.note.includes('chậm') || r.note.includes('hỗ trợ')))) {
        severityLevel = 'MILD';
      }

      // Xây dựng Tiêu đề & Nội dung phác đồ tư vấn cá nhân hóa theo từng trẻ
      const hasAllergy = allergies.length > 0;
      const allergyNames = allergies.map(a => a.allergen_name).join(', ');
      const isMilkAllergic = allergies.some(a => (a.allergen_code || '').toUpperCase() === 'MILK' || a.allergen_name.toLowerCase().includes('sữa'));
      const isPeanutAllergic = allergies.some(a => (a.allergen_code || '').toUpperCase() === 'PEANUT' || a.allergen_name.toLowerCase().includes('đậu phộng') || a.allergen_name.toLowerCase().includes('lạc'));
      const isSeafoodAllergic = allergies.some(a => (a.allergen_code || '').toUpperCase() === 'SEAFOOD' || a.allergen_name.toLowerCase().includes('hải sản') || a.allergen_name.toLowerCase().includes('tôm') || a.allergen_name.toLowerCase().includes('cua'));

      let suggestedAdviceTitle = '';
      if (hasAllergy) {
        suggestedAdviceTitle = `Phác đồ dinh dưỡng tại nhà cho bé ${s.full_name} (Lưu ý dị ứng: ${allergyNames})`;
      } else if (severityLevel === 'SEVERE') {
        suggestedAdviceTitle = `Phác đồ phục hồi dinh dưỡng & kích thích ăn ngon cho bé ${s.full_name}`;
      } else if (severityLevel === 'MODERATE') {
        suggestedAdviceTitle = `Hướng dẫn cải thiện sức ăn & tăng cường vi chất cho bé ${s.full_name}`;
      } else {
        suggestedAdviceTitle = `Tư vấn chế độ dinh dưỡng bổ sung tại nhà cho bé ${s.full_name}`;
      }

      // Xây dựng phác đồ tư vấn theo triệu chứng & dị ứng thực tế
      const adviceLines: string[] = [];
      adviceLines.push(`Kính gửi Phụ huynh bé ${s.full_name},`);
      
      // Đoạn 1: Tình trạng thực tế tại lớp
      if (littleCount > 0) {
        adviceLines.push(`• Tình trạng tại trường: Nhật ký bán trú ghi nhận bé có ${littleCount} bữa ăn rất ít (dưới 25% khẩu phần). ${teacherObservationNotes.length > 0 ? `Lời dặn cô giáo: "${teacherObservationNotes[0]}".` : ''}`);
      } else if (partialCount > 0) {
        adviceLines.push(`• Tình trạng tại trường: Bé thường ăn chậm và để thừa khoảng một nửa khẩu phần cơm canh. ${teacherObservationNotes.length > 0 ? `Ghi nhận từ cô giáo: "${teacherObservationNotes[0]}".` : ''}`);
      } else {
        adviceLines.push(`• Tình trạng tại trường: Sức ăn của bé cần được theo dõi thêm để kích thích sự thèm ăn tự nhiên.`);
      }

      // Đoạn 2: Cảnh báo dị ứng cá nhân hóa (nếu có)
      if (isMilkAllergic) {
        adviceLines.push(`• CẢNH BÁO DỊ ỨNG ĐẶC BIỆT: Bé dị ứng đạm Sữa bò. Gia đình tuyệt đối không dùng sữa bột bò, váng sữa hay phô mai bơ động vật. Thay thế bằng sữa hạt ấm (hạt sen, yến mạch, óc chó) giàu năng lượng và bổ sung Canxi thực vật.`);
      } else if (isPeanutAllergic) {
        adviceLines.push(`• CẢNH BÁO DỊ ỨNG: Bé dị ứng Đậu phộng/Lạc. Cần kiểm tra kỹ nhãn thực phẩm bánh ăn dặm, bơ đậu phộng và dầu ăn chế biến tại gia đình.`);
      } else if (hasAllergy) {
        adviceLines.push(`• LƯU Ý DỊ ỨNG: Bé có tiền sử dị ứng với ${allergyNames}. Gia đình loại trừ triệt để trong thực đơn bữa tối tại nhà.`);
      }

      // Đoạn 3: Phác đồ can thiệp dinh dưỡng tại nhà
      adviceLines.push(`• Phác đồ bổ sung tại nhà đề xuất:`);
      if (severityLevel === 'SEVERE') {
        adviceLines.push(`1. Chia nhỏ bữa tối: Không ép bé ăn nhiều một lúc. Cữ 18h15 cho bé ăn 1 chén cháo/súp mềm giàu đạm; cữ 20h15 uống 1 ly sinh tố hoặc sữa ấm dễ tiêu.`);
        adviceLines.push(`2. Bổ sung vi chất Kẽm & Men tiêu hóa: Tăng cường thực phẩm giàu kẽm tự nhiên (thịt bò nạc, lòng đỏ trứng, hạt bí) để tái tạo gai vị giác, kích thích cảm giác thèm ăn.`);
        adviceLines.push(`3. Tạo không khí vui vẻ: Tuyệt đối không cho bé xem điện thoại/tivi khi ăn, khen ngợi động viên khi bé tự xúc được vài thìa đầu tiên.`);
      } else if (severityLevel === 'MODERATE') {
        adviceLines.push(`1. Điều chỉnh cấu trúc món ăn: Thức ăn nên thái nhỏ, nấu mềm vừa phải với nước dùng hầm rau củ ngọt thanh giúp bé dễ nhai nuốt, không bị ngậm.`);
        adviceLines.push(`2. Tăng cường chất xơ hòa tan: Khuyến khích bé ăn bí đỏ, cà rốt hấp, súp lơ xanh để hỗ trợ nhu động ruột, giảm cảm giác đầy bụng khó tiêu.`);
        adviceLines.push(`3. Thời gian bữa ăn: Giới hạn tối đa 30-35 phút/bữa để rèn phản xạ ăn tập trung.`);
      } else {
        adviceLines.push(`1. Duy trì chế độ ăn đa dạng đủ 4 nhóm thực phẩm (tinh bột, đạm, béo, vitamin & khoáng chất).`);
        adviceLines.push(`2. Khuyến khích bé uống đủ nước ấm và vận động nhẹ nhàng trước bữa tối.`);
      }

      const suggestedHomeAdvice = adviceLines.join('\n');

      // Gợi ý vi chất cần bổ sung dựa trên triệu chứng
      const micronutrientsFocus: string[] = [];
      if (severityLevel === 'SEVERE' || severityLevel === 'MODERATE') {
        micronutrientsFocus.push('Kẽm sinh học (Kích thích vị giác, giúp bé thèm ăn tự nhiên)');
        micronutrientsFocus.push('Sắt & Axit Folic (Ngăn ngừa thiếu máu, tăng năng lượng hoạt động)');
        micronutrientsFocus.push('Chất xơ hòa tan & Men vi sinh (Kích thích tiêu hóa, giảm đầy bụng)');
      }
      if (isMilkAllergic) {
        micronutrientsFocus.push('Canxi hữu cơ & Vitamin D3 thực vật (Bù đắp canxi do kiêng sữa bò)');
      }

      // Gợi ý món ăn bổ sung tại nhà phù hợp dị ứng
      const recommendedDishes: string[] = [];
      if (isMilkAllergic) {
        recommendedDishes.push('Súp bí đỏ thịt bằm hạt sen (Giàu kẽm & vitamin A, không sữa bò)');
        recommendedDishes.push('Cháo gà hầm hạt sen bí ngô (Dễ tiêu hóa, kích thích vị giác)');
        recommendedDishes.push('Sinh tố bơ chuối sữa yến mạch hạt lanh (Giàu năng lượng thực vật)');
        recommendedDishes.push('Canh sườn non hầm cà rốt bắp ngọt (Thanh mát, giàu khoáng chất)');
      } else if (isPeanutAllergic) {
        recommendedDishes.push('Cháo thịt bò cà rốt phô mai (Giàu kẽm & canxi, an toàn không đậu phộng)');
        recommendedDishes.push('Súp gà ngô non nấm hương (Ấm bụng, thơm ngọt tự nhiên)');
        recommendedDishes.push('Sinh tố xoài chuối sữa chua (Hỗ trợ tiêu hóa)');
      } else if (isSeafoodAllergic) {
        recommendedDishes.push('Cháo lườn gà hạt sen nấm rơm (Dễ ăn, lành tính không hải sản)');
        recommendedDishes.push('Súp thịt bò bằm khoai tây bí đỏ (Giàu sắt & năng lượng)');
        recommendedDishes.push('Canh bí xanh sườn non (Giải nhiệt, thanh đạm)');
      } else {
        recommendedDishes.push('Súp bí đỏ thịt bằm hạt sen (Giàu kẽm & vitamin A)');
        recommendedDishes.push('Cháo cá hồi bông cải xanh (Giàu Omega-3 & đạm dễ tiêu)');
        recommendedDishes.push('Sinh tố bơ chuối sữa hạt sen (Năng lượng lành mạnh)');
        recommendedDishes.push('Canh sườn hầm cà rốt bắp ngọt (Kích thích vị giác)');
      }

      // Đưa vào danh sách phát hiện kén ăn nếu có dấu hiệu
      if (severityLevel !== 'NORMAL') {
        const dob = new Date(s.date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        const ageLabel = age > 0 ? `${age} tuổi` : (s.age_group === 'NHA_TRE' ? 'Nhà trẻ (1-3T)' : 'Mẫu giáo (3-6T)');

        detectedChildren.push({
          studentId: kidId,
          studentCode: s.student_code || `HS-${String(kidId).padStart(4, '0')}`,
          fullName: s.full_name,
          className: s.class_name || 'Lớp Mầm 1',
          classId: String(s.class_id || 1),
          ageLabel,
          gender: s.gender === 'MALE' ? 'Nam' : 'Nữ',
          totalMealsTracked: totalMeals,
          lowIntakeMealsCount: lowIntakeCount,
          averageConsumptionRate: totalMeals > 0 ? Math.round(((fullCount * 100 + partialCount * 50 + littleCount * 25) / totalMeals)) : 0,
          severityLevel,
          severityLabel:
            severityLevel === 'SEVERE'
              ? 'Nguy cơ cao (Cần can thiệp)'
              : severityLevel === 'MODERATE'
              ? 'Mức độ vừa (Kén ăn, ăn chậm)'
              : 'Mức độ nhẹ (Cần theo dõi)',
          pickySymptoms: pickySymptoms.length > 0 ? pickySymptoms : ['Lượng ăn thực tế giảm sút so với thực đơn tiêu chuẩn'],
          allergies: allergies.map(a => a.allergen_name),
          teacherNotes: teacherObservationNotes,
          parentName: parent.name,
          parentPhone: parent.phone,
          parentRelationship: parent.relationship,
          suggestedAdviceTitle,
          suggestedHomeAdvice,
          micronutrientsFocus,
          recommendedDishes,
          adviceStatus: latestAdvice ? latestAdvice.status : 'NOT_SENT',
          adviceStatusLabel:
            latestAdvice?.status === 'PARENT_CONFIRMED'
              ? 'Phụ huynh đã xác nhận'
              : latestAdvice?.status === 'SENT'
              ? 'Đã gửi tư vấn tại nhà'
              : 'Chưa gửi tư vấn',
          latestAdvice: latestAdvice
            ? {
                id: String(latestAdvice.id),
                adviceTitle: latestAdvice.adviceTitle,
                adviceDate: latestAdvice.adviceDate,
                homeSupplementAdvice: latestAdvice.homeSupplementAdvice,
                status: latestAdvice.status,
                parentFeedback: latestAdvice.parentFeedback,
                parentConfirmedAt: latestAdvice.parentConfirmedAt,
                creatorName: latestAdvice.creator?.fullName || 'Chuyên gia Dinh dưỡng',
              }
            : null,
        });
      }
    });

    // Sắp xếp học sinh nguy cơ cao lên đầu
    detectedChildren.sort((a, b) => {
      const order: Record<string, number> = { SEVERE: 0, MODERATE: 1, MILD: 2, NORMAL: 3 };
      return (order[a.severityLevel] ?? 99) - (order[b.severityLevel] ?? 99);
    });

    const summary = {
      totalDetected: detectedChildren.length,
      severeCount: detectedChildren.filter(c => c.severityLevel === 'SEVERE').length,
      moderateCount: detectedChildren.filter(c => c.severityLevel === 'MODERATE').length,
      mildCount: detectedChildren.filter(c => c.severityLevel === 'MILD').length,
      advisedCount: detectedChildren.filter(c => c.adviceStatus !== 'NOT_SENT').length,
      confirmedCount: detectedChildren.filter(c => c.adviceStatus === 'PARENT_CONFIRMED').length,
    };

    const classRows = await this.childRepo.query(`
      SELECT id, name, age_group FROM classes WHERE status = 'ACTIVE' ORDER BY id ASC;
    `);

    return {
      success: true,
      summary,
      classes: classRows.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        ageGroup: c.age_group,
      })),
      items: detectedChildren,
    };
  }

  /**
   * Chuyên gia dinh dưỡng / Giáo viên gửi tư vấn bổ sung tại nhà về cho Phụ huynh
   */
  async sendAdvice(dto: SendHomeSupplementAdviceDto, userId: number) {
    const student = await this.childRepo.findOne({
      where: { id: dto.studentId },
      relations: ['class'],
    });

    if (!student) {
      throw new NotFoundException(`Học sinh #${dto.studentId} không tồn tại`);
    }

    // 1. Lưu bản ghi tư vấn vào bảng picky_eating_advices
    const advice = this.adviceRepo.create({
      studentId: dto.studentId,
      createdBy: userId,
      adviceDate: new Date().toISOString().split('T')[0],
      severityLevel: dto.severityLevel || 'MODERATE',
      pickySymptoms: dto.pickySymptoms || ['Bé ăn chậm, kén ăn'],
      adviceTitle: dto.adviceTitle,
      homeSupplementAdvice: dto.homeSupplementAdvice,
      recommendedDishes: dto.recommendedDishes || [],
      micronutrientsFocus: dto.micronutrientsFocus || [],
      status: 'SENT',
    });

    const saved = await this.adviceRepo.save(advice);

    // 2. Tìm phụ huynh của học sinh từ bảng student_parents
    const parentRows = await this.childRepo.query(`
      SELECT parent_id FROM student_parents WHERE student_id = $1 LIMIT 1;
    `, [dto.studentId]);

    if (parentRows.length > 0) {
      const parentId = Number(parentRows[0].parent_id);
      // 3. Gửi thông báo đến tài khoản Phụ huynh trong bảng notifications
      await this.childRepo.query(`
        INSERT INTO notifications (user_id, title, content, type, is_read, created_at)
        VALUES ($1, $2, $3, 'PICKY_EATING_ADVICE', false, CURRENT_TIMESTAMP);
      `, [
        parentId,
        `Tư vấn dinh dưỡng tại nhà: ${student.fullName}`,
        `Chuyên gia dinh dưỡng đã gửi phác đồ bổ sung dinh dưỡng và thực đơn hỗ trợ tại nhà cho bé ${student.fullName}. Kính mời phụ huynh xem chi tiết!`,
      ]);
    }

    return {
      success: true,
      message: `Đã gửi tư vấn dinh dưỡng bổ sung tại nhà cho bé ${student.fullName} thành công!`,
      data: saved,
    };
  }

  /**
   * Phụ huynh xem danh sách tư vấn dinh dưỡng của con tại Cổng Phụ Huynh
   */
  async getChildAdvice(childId?: string, userId?: number) {
    let sId = childId ? Number(childId) : null;
    if (!sId && userId) {
      const parentRel = await this.childRepo.query(`
        SELECT student_id FROM student_parents WHERE parent_id = $1 LIMIT 1;
      `, [userId]);
      if (parentRel.length > 0) {
        sId = Number(parentRel[0].student_id);
      }
    }
    if (!sId) {
      const firstStudent = await this.childRepo.query(`SELECT id FROM students WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1;`);
      sId = firstStudent.length > 0 ? Number(firstStudent[0].id) : 1;
    }

    const student = await this.childRepo.findOne({
      where: { id: sId },
      relations: ['class', 'allergies', 'allergies.allergen'],
    });

    const advices = await this.adviceRepo.find({
      where: { studentId: sId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });

    // Lấy thông tin phụ huynh thực tế
    let parentName = 'Phụ huynh bé';
    let parentRole = 'Phụ huynh';
    const parentRows = await this.childRepo.query(`
      SELECT sp.relationship, u.full_name as parent_name
      FROM student_parents sp
      JOIN users u ON u.id = sp.parent_id
      WHERE sp.student_id = $1 LIMIT 1;
    `, [sId]);
    if (parentRows.length > 0) {
      parentName = parentRows[0].parent_name;
      parentRole = parentRows[0].relationship === 'FATHER' ? 'Bố bé' : 'Mẹ bé';
    }

    return {
      success: true,
      child: {
        id: String(sId),
        name: student?.fullName || 'Học sinh',
        className: student?.class?.name || 'Lớp Mầm 1',
        parentName,
        parentRole,
        allergies: (student?.allergies || []).map(a => a.allergen?.name || 'Dị ứng'),
      },
      advices: advices.map(a => ({
        id: String(a.id),
        adviceTitle: a.adviceTitle,
        adviceDate: a.adviceDate,
        severityLevel: a.severityLevel,
        pickySymptoms: a.pickySymptoms,
        homeSupplementAdvice: a.homeSupplementAdvice,
        recommendedDishes: a.recommendedDishes,
        micronutrientsFocus: a.micronutrientsFocus,
        status: a.status,
        parentFeedback: a.parentFeedback,
        parentConfirmedAt: a.parentConfirmedAt,
        creatorName: a.creator?.fullName || 'Chuyên gia Dinh dưỡng trường',
        createdAt: a.createdAt,
      })),
    };
  }

  /**
   * Phụ huynh bấm "Xác nhận đã đọc & phản hồi"
   */
  async confirmAdvice(adviceId: number, dto: ConfirmAdviceDto, userId?: number) {
    const advice = await this.adviceRepo.findOne({
      where: { id: adviceId },
    });

    if (!advice) {
      throw new NotFoundException(`Bản tư vấn dinh dưỡng #${adviceId} không tồn tại`);
    }

    advice.status = 'PARENT_CONFIRMED';
    advice.parentConfirmedAt = new Date();
    if (dto.parentFeedback && dto.parentFeedback.trim()) {
      advice.parentFeedback = dto.parentFeedback.trim();
    } else {
      advice.parentFeedback = 'Phụ huynh đã đọc và đồng thuận áp dụng thực đơn bổ sung tại nhà.';
    }

    const saved = await this.adviceRepo.save(advice);

    return {
      success: true,
      message: 'Cảm ơn phụ huynh đã xác nhận phối hợp cùng nhà trường chăm sóc dinh dưỡng cho bé!',
      data: saved,
    };
  }

  /**
   * Lấy lịch sử tư vấn dinh dưỡng
   */
  async getAdviceHistory(studentId?: number) {
    const qb = this.adviceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.student', 's')
      .leftJoinAndSelect('s.class', 'c')
      .leftJoinAndSelect('a.creator', 'u')
      .orderBy('a.createdAt', 'DESC');

    if (studentId) {
      qb.andWhere('a.studentId = :studentId', { studentId });
    }

    const items = await qb.getMany();

    return {
      success: true,
      total: items.length,
      items: items.map(a => ({
        id: String(a.id),
        studentId: String(a.studentId),
        studentName: a.student?.fullName || 'Học sinh',
        className: a.student?.class?.name || 'Lớp học',
        adviceTitle: a.adviceTitle,
        adviceDate: a.adviceDate,
        severityLevel: a.severityLevel,
        pickySymptoms: a.pickySymptoms,
        homeSupplementAdvice: a.homeSupplementAdvice,
        recommendedDishes: a.recommendedDishes,
        micronutrientsFocus: a.micronutrientsFocus,
        status: a.status,
        parentFeedback: a.parentFeedback,
        parentConfirmedAt: a.parentConfirmedAt,
        creatorName: a.creator?.fullName || 'Chuyên gia Dinh dưỡng',
        createdAt: a.createdAt,
      })),
    };
  }
}
