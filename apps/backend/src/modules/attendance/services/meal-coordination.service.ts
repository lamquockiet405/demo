import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const COORDINATION_MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Bữa sáng',
  MORNING_SNACK: 'Phụ sáng',
  LUNCH: 'Bữa trưa chính',
  AFTERNOON_SNACK: 'Bữa xế chiều',
};
const NOTE_TYPE_LABELS: Record<string, string> = {
  ALLERGY_WARNING: 'Cảnh báo dị ứng khẩn cấp',
  SPECIAL_DIET: 'Chế độ ăn riêng',
  PORTION_ADJUSTMENT: 'Điều chỉnh suất ăn',
};

@Injectable()
export class MealCoordinationService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Lấy danh sách ghi chú điều phối kèm tóm tắt và danh sách lớp/học sinh thực tế từ Postgres
   */
  async findAll(params?: {
    date?: string;
    classId?: string;
    mealSession?: string;
    status?: string;
    priority?: string;
    noteType?: string;
    search?: string;
  }) {
    const filterDate = params?.date || new Date().toISOString().split('T')[0];
    const targetClassId = params?.classId && params.classId !== 'ALL' ? params.classId : '1';

    // 1. Lấy danh sách lớp học thực tế từ PostgreSQL
    const classRows = await this.dataSource.query(`
      SELECT c.id, c.name, c.age_group as "gradeLevel", COUNT(s.id)::int as "totalStudents"
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id
      GROUP BY c.id, c.name, c.age_group
      ORDER BY c.id ASC;
    `);

    const availableClasses = classRows.map((c: any) => {
      const nameLower = (c.name || '').toLowerCase();
      const gradeName = nameLower.includes('mầm') || nameLower.includes('mam')
        ? 'Khối Mầm (3-4 tuổi)'
        : nameLower.includes('chồi') || nameLower.includes('choi')
        ? 'Khối Chồi (4-5 tuổi)'
        : nameLower.includes('lá') || nameLower.includes('la')
        ? 'Khối Lá (5-6 tuổi)'
        : 'Khối Mẫu Giáo';

      return {
        id: String(c.id),
        name: c.name,
        gradeLevel: gradeName,
        totalStudents: c.totalStudents || 0,
      };
    });

    const selectedClass = availableClasses.find((c: any) => c.id === targetClassId) || availableClasses[0] || {
      id: '1',
      name: 'Lớp học',
      gradeLevel: 'Khối Mầm',
      totalStudents: 0,
    };

    // 2. Lấy danh sách học sinh thực tế của lớp
    const studentRows = await this.dataSource.query(`
      SELECT s.id, s.full_name as "fullName", s.student_code as "studentCode", alg.name as "allergy"
      FROM students s
      LEFT JOIN student_allergies sa ON sa.student_id = s.id
      LEFT JOIN allergens alg ON sa.allergen_id = alg.id
      WHERE s.class_id = $1
      ORDER BY s.id ASC;
    `, [Number(selectedClass.id) || 1]);

    const availableChildren = studentRows.map((s: any) => ({
      id: String(s.id),
      fullName: s.fullName,
      studentCode: s.studentCode || `HS-${String(s.id).padStart(4, '0')}`,
      allergy: s.allergy ? `Dị ứng: ${s.allergy}` : undefined,
    }));

    // 3. Xây dựng bộ lọc ghi chú
    const whereClauses: string[] = ['m.meal_date = $1'];
    const queryParams: any[] = [filterDate];
    let pIdx = 2;

    if (params?.classId && params.classId !== 'ALL') {
      whereClauses.push(`m.class_id = $${pIdx}`);
      queryParams.push(params.classId);
      pIdx++;
    }

    if (params?.mealSession && params.mealSession !== 'ALL') {
      whereClauses.push(`m.meal_session = $${pIdx}`);
      queryParams.push(params.mealSession);
      pIdx++;
    }

    if (params?.status && params.status !== 'ALL') {
      whereClauses.push(`m.status = $${pIdx}`);
      queryParams.push(params.status);
      pIdx++;
    }

    if (params?.priority && params.priority !== 'ALL') {
      whereClauses.push(`m.priority = $${pIdx}`);
      queryParams.push(params.priority);
      pIdx++;
    }

    if (params?.noteType && params.noteType !== 'ALL') {
      whereClauses.push(`m.note_type = $${pIdx}`);
      queryParams.push(params.noteType);
      pIdx++;
    }

    if (params?.search && params.search.trim()) {
      whereClauses.push(`(LOWER(m.title) LIKE $${pIdx} OR LOWER(m.content) LIKE $${pIdx} OR LOWER(m.teacher_name) LIKE $${pIdx})`);
      queryParams.push(`%${params.search.trim().toLowerCase()}%`);
      pIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const notesRows = await this.dataSource.query(`
      SELECT m.*, to_char(m.meal_date, 'YYYY-MM-DD') AS meal_date,
        s.full_name as student_name, s.student_code as student_code,
        (SELECT string_agg(DISTINCT alg.name, ', ')
         FROM student_allergies sa JOIN allergens alg ON alg.id = sa.allergen_id
         WHERE sa.student_id = s.id) as allergen_name, c.name as class_name
      FROM meal_coordination_notes m
      LEFT JOIN classes c ON c.id::text = m.class_id::text
      LEFT JOIN students s ON s.id::text = m.child_id::text
      ${whereSql}
      ORDER BY 
        CASE m.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END,
        m.created_at DESC;
    `, queryParams);

    const notes = notesRows.map((n: any) => {
      const childName = n.student_name || 'Học sinh';
      const initials = childName.trim().split(' ').slice(-1)[0]?.[0]?.toUpperCase() || 'H';

      return {
        id: String(n.id),
        classId: String(n.class_id || selectedClass.id),
        className: n.class_name || selectedClass.name,
        child: n.child_id ? {
          id: String(n.child_id),
          fullName: childName,
          studentCode: n.student_code || `HS-${String(n.child_id).padStart(4, '0')}`,
          avatarLetter: initials,
          allergyWarning: n.allergen_name ? `Dị ứng: ${n.allergen_name}` : undefined,
        } : null,
        mealDate: n.meal_date || filterDate,
        mealSession: n.meal_session || 'LUNCH',
        mealSessionLabel: n.meal_session_label || COORDINATION_MEAL_LABELS[n.meal_session] || COORDINATION_MEAL_LABELS.LUNCH,
        noteType: n.note_type || 'OTHER',
        noteTypeLabel: n.note_type_label || 'Ghi chú điều phối',
        priority: (n.priority || 'NORMAL') as 'URGENT' | 'HIGH' | 'NORMAL',
        priorityLabel: n.priority === 'URGENT' ? 'Khẩn cấp' : n.priority === 'HIGH' ? 'Ưu tiên cao' : 'Bình thường',
        status: (n.status || 'PENDING') as 'PENDING' | 'ACKNOWLEDGED' | 'PROCESSING' | 'RESOLVED' | 'CANCELLED',
        statusLabel: n.status === 'RESOLVED' ? 'Đã xử lý' : n.status === 'ACKNOWLEDGED' ? 'Bếp đã tiếp nhận' : 'Đang chờ xử lý',
        title: n.title,
        content: n.content,
        teacherName: n.teacher_name || 'Giáo viên Chủ nhiệm',
        targetRole: n.target_role || 'KITCHEN',
        targetRoleLabel: n.target_role_label || 'Bếp Bán Trú & Dinh Dưỡng',
        kitchenAcknowledged: Boolean(n.kitchen_acknowledged),
        kitchenAcknowledgedBy: n.kitchen_acknowledged_by || undefined,
        kitchenAcknowledgedAt: n.kitchen_acknowledged_at ? new Date(n.kitchen_acknowledged_at).toISOString() : undefined,
        kitchenResponse: n.kitchen_response || undefined,
        photos: Array.isArray(n.photos) ? n.photos : [],
        createdAt: n.created_at ? new Date(n.created_at).toISOString() : new Date().toISOString(),
        resolvedAt: n.resolved_at ? new Date(n.resolved_at).toISOString() : undefined,
      };
    });

    // 4. Tính toán summary thống kê
    const summary = {
      totalNotes: notes.length,
      urgentCount: notes.filter((n: any) => n.priority === 'URGENT').length,
      highCount: notes.filter((n: any) => n.priority === 'HIGH').length,
      pendingCount: notes.filter((n: any) => n.status === 'PENDING').length,
      acknowledgedCount: notes.filter((n: any) => n.status === 'ACKNOWLEDGED' || n.status === 'PROCESSING').length,
      resolvedCount: notes.filter((n: any) => n.status === 'RESOLVED').length,
    };

    return {
      selectedClass,
      availableClasses,
      availableChildren,
      summary,
      filterDate,
      notes,
    };
  }

  /**
   * Tạo mới ghi chú điều phối
   */
  async create(data: {
    classId: string;
    childId?: string;
    mealDate: string;
    mealSession: string;
    noteType: string;
    priority: string;
    title: string;
    content: string;
    targetRole?: string;
    teacherName?: string;
    photos?: string[];
  }, userId?: number) {
    const mealSessionLabel = COORDINATION_MEAL_LABELS[data.mealSession] || COORDINATION_MEAL_LABELS.LUNCH;
    const noteTypeLabel = NOTE_TYPE_LABELS[data.noteType] || 'Ghi chú điều phối';

    const targetRoleLabel = data.targetRole === 'NUTRITIONIST' ? 'Chuyên viên Dinh Dưỡng' : 'Bếp Bán Trú & Dinh Dưỡng';

    // Lấy thông tin GVCN thực tế từ lớp học nếu chưa có
    let teacherName = data.teacherName;
    if (!teacherName) {
      const teacherRow = await this.dataSource.query(`
        SELECT u.full_name, c.name as class_name
        FROM classes c
        LEFT JOIN users u ON u.id = c.homeroom_teacher_id
        WHERE c.id = $1
      `, [Number(data.classId) || 1]);
      if (teacherRow.length > 0 && teacherRow[0].full_name) {
        teacherName = `Cô ${teacherRow[0].full_name} (GVCN ${teacherRow[0].class_name || ''})`.trim();
      } else {
        teacherName = 'Giáo viên Chủ nhiệm';
      }
    }

    const insertRes = await this.dataSource.query(`
      INSERT INTO meal_coordination_notes (
        class_id, child_id, meal_date, meal_session, meal_session_label,
        note_type, note_type_label, priority, status, title, content,
        teacher_name, target_role, target_role_label, photos, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10, $11, $12, $13, $14, NOW(), NOW()
      ) RETURNING id;
    `, [
      data.classId || '1',
      data.childId || null,
      data.mealDate || new Date().toISOString().split('T')[0],
      data.mealSession || 'LUNCH',
      mealSessionLabel,
      data.noteType || 'OTHER',
      noteTypeLabel,
      data.priority || 'NORMAL',
      data.title,
      data.content,
      teacherName,
      data.targetRole || 'KITCHEN',
      targetRoleLabel,
      JSON.stringify(data.photos || []),
    ]);

    return {
      success: true,
      id: insertRes[0]?.id,
      message: 'Đã tạo và gửi ghi chú điều phối tới Bếp trung tâm thành công',
    };
  }

  /**
   * Cập nhật ghi chú điều phối
   */
  async update(id: string, data: {
    title?: string;
    content?: string;
    priority?: string;
    noteType?: string;
    mealSession?: string;
    status?: string;
    kitchenResponse?: string;
    photos?: string[];
  }) {
    const check = await this.dataSource.query('SELECT id FROM meal_coordination_notes WHERE id::text = $1', [id]);
    if (check.length === 0) {
      throw new NotFoundException('Không tìm thấy ghi chú điều phối');
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let idx = 2;

    if (data.title !== undefined) {
      setClauses.push(`title = $${idx}`);
      params.push(data.title);
      idx++;
    }
    if (data.content !== undefined) {
      setClauses.push(`content = $${idx}`);
      params.push(data.content);
      idx++;
    }
    if (data.priority !== undefined) {
      setClauses.push(`priority = $${idx}`);
      params.push(data.priority);
      idx++;
    }
    if (data.mealSession !== undefined) {
      setClauses.push(`meal_session = $${idx++}`, `meal_session_label = $${idx++}`);
      params.push(data.mealSession, COORDINATION_MEAL_LABELS[data.mealSession] || COORDINATION_MEAL_LABELS.LUNCH);
    }
    if (data.noteType !== undefined) {
      setClauses.push(`note_type = $${idx++}`, `note_type_label = $${idx++}`);
      params.push(data.noteType, NOTE_TYPE_LABELS[data.noteType] || 'Ghi chú điều phối');
    }
    if (data.photos !== undefined) {
      setClauses.push(`photos = $${idx++}::jsonb`);
      params.push(JSON.stringify(data.photos));
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${idx}`);
      params.push(data.status);
      idx++;
    }
    if (data.kitchenResponse !== undefined) {
      setClauses.push(`kitchen_response = $${idx}`);
      params.push(data.kitchenResponse);
      idx++;
    }

    await this.dataSource.query(
      `UPDATE meal_coordination_notes SET ${setClauses.join(', ')} WHERE id::text = $1`,
      params,
    );

    return { success: true, message: 'Đã cập nhật ghi chú điều phối' };
  }

  /**
   * Bếp hoặc GV xác nhận tiếp nhận ghi chú
   */
  async acknowledge(id: string, data?: { acknowledgedBy?: string; kitchenResponse?: string }) {
    let ackBy = data?.acknowledgedBy;
    if (!ackBy) {
      const kitchenStaff = await this.dataSource.query(`
        SELECT u.full_name
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name ILIKE '%bếp%' OR r.name ILIKE '%kitchen%'
        ORDER BY u.id ASC
        LIMIT 1;
      `);
      ackBy = kitchenStaff.length > 0 ? `Bếp ${kitchenStaff[0].full_name}` : 'Bếp Bán Trú';
    }
    const resp = data?.kitchenResponse || 'Bếp đã tiếp nhận thông tin và sẽ điều chỉnh đúng theo yêu cầu của lớp.';

    await this.dataSource.query(`
      UPDATE meal_coordination_notes 
      SET 
        status = 'ACKNOWLEDGED',
        kitchen_acknowledged = true,
        kitchen_acknowledged_by = $2,
        kitchen_acknowledged_at = NOW(),
        kitchen_response = $3,
        updated_at = NOW()
      WHERE id::text = $1;
    `, [id, ackBy, resp]);

    return { success: true, message: 'Đã xác nhận tiếp nhận ghi chú điều phối' };
  }

  /**
   * Đánh dấu hoàn thành / đã xử lý suất ăn
   */
  async resolve(id: string, data?: { resolutionNote?: string }) {
    await this.dataSource.query(`
      UPDATE meal_coordination_notes 
      SET 
        status = 'RESOLVED',
        resolved_at = NOW(),
        kitchen_response = COALESCE($2, kitchen_response),
        updated_at = NOW()
      WHERE id::text = $1;
    `, [id, data?.resolutionNote || null]);

    return { success: true, message: 'Đã đánh dấu xử lý xong suất ăn điều phối' };
  }

  /**
   * Xóa ghi chú điều phối
   */
  async delete(id: string) {
    await this.dataSource.query('DELETE FROM meal_coordination_notes WHERE id::text = $1', [id]);
    return { success: true, message: 'Đã xóa ghi chú điều phối' };
  }
}
