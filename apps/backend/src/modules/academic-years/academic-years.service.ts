import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AddYearEnrollmentDto, CreateAcademicYearDto, CreateYearStudentDto, UpdateAcademicYearDto, UpdateYearClassDto, UpdateYearEnrollmentDto } from './academic-years.dto';

const yearColumns = `y.id::text AS id, y.school_id AS "schoolId", y.name, y.start_date::text AS "startDate",
  y.end_date::text AS "endDate", y.status, y.source_year_id::text AS "sourceYearId", y.notes`;

@Injectable()
export class AcademicYearsService {
  constructor(private readonly db: DataSource) {}

  private async year(manager: EntityManager, id: number, schoolId: number) {
    const [year] = await manager.query(`SELECT ${yearColumns} FROM academic_year y WHERE y.id=$1 AND y.school_id=$2`, [id, schoolId]);
    if (!year) throw new NotFoundException('Không tìm thấy năm học của trường');
    return year;
  }

  private async lockSchool(manager: EntityManager, schoolId: number) {
    const schools = await manager.query('SELECT id FROM schools WHERE id=$1 FOR UPDATE', [schoolId]);
    if (!schools.length) throw new NotFoundException('Không tìm thấy trường');
  }

  private validateDates(start: string, end: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start >= end) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu năm học');
    }
  }

  async list(schoolId: number) {
    return this.db.query(`SELECT ${yearColumns}, source.name AS "sourceYearName",
      (SELECT count(*)::int FROM classes c WHERE c.academic_year_id=y.id) AS "classCount",
      (SELECT count(*)::int FROM student_academic_enrollments e WHERE e.academic_year_id=y.id AND e.status='ENROLLED') AS "studentCount"
      FROM academic_year y LEFT JOIN academic_year source ON source.id=y.source_year_id
      WHERE y.school_id=$1 ORDER BY y.start_date DESC, y.id DESC`, [schoolId]);
  }

  async detail(id: number, schoolId: number) {
    const year = await this.year(this.db.manager, id, schoolId);
    const classes = await this.db.query(`SELECT c.id::text AS id, c.name, c.age_group AS "ageGroup", c.status,
      c.homeroom_teacher_id::text AS "homeroomTeacherId", u.full_name AS "teacherName",
      (SELECT count(*)::int FROM student_academic_enrollments e WHERE e.class_id=c.id AND e.status='ENROLLED') AS "studentCount"
      FROM classes c LEFT JOIN users u ON u.id=c.homeroom_teacher_id WHERE c.academic_year_id=$1 ORDER BY c.id`, [id]);
    const enrollments = await this.db.query(`SELECT e.id::text AS id, e.student_id::text AS "studentId", e.class_id::text AS "classId",
      c.name AS "className", e.status, e.student_snapshot AS "studentSnapshot", e.parent_contacts AS "parentContacts", e.notes
      FROM student_academic_enrollments e JOIN classes c ON c.id=e.class_id
      WHERE e.academic_year_id=$1 ORDER BY e.student_snapshot->>'fullName', e.id`, [id]);
    return { ...year, classes, enrollments };
  }

  async availableStudents(id: number, schoolId: number) {
    await this.year(this.db.manager, id, schoolId);
    return this.db.query(`SELECT s.id::text AS id,s.full_name AS "fullName",s.student_code AS "studentCode"
      FROM students s LEFT JOIN classes c ON c.id=s.class_id
      WHERE (c.school_id=$2 OR EXISTS (SELECT 1 FROM student_academic_enrollments e
        JOIN academic_year y ON y.id=e.academic_year_id WHERE e.student_id=s.id AND y.school_id=$2))
      AND NOT EXISTS (SELECT 1 FROM student_academic_enrollments e WHERE e.student_id=s.id AND e.academic_year_id=$1)
      ORDER BY s.full_name,s.id`, [id, schoolId]);
  }

  async create(dto: CreateAcademicYearDto, schoolId: number) {
    this.validateDates(dto.startDate, dto.endDate);
    if (!dto.name.trim()) throw new BadRequestException('Tên năm học không được để trống');
    try {
      return await this.db.transaction(async manager => {
        await this.lockSchool(manager, schoolId);
        const source = dto.sourceYearId ? await this.year(manager, dto.sourceYearId, schoolId) : null;
        if (source && dto.startDate <= source.endDate) {
          throw new BadRequestException('Năm học mới phải bắt đầu sau khi năm nguồn kết thúc');
        }
        const [year] = await manager.query(`INSERT INTO academic_year(school_id,name,start_date,end_date,source_year_id,notes)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [schoolId, dto.name.trim(), dto.startDate, dto.endDate, source?.id || null, dto.notes ?? '']);
        // Thực đơn là dữ liệu theo năm học: bắt đầu năm mới với danh sách thực đơn trống.
        // Các bảng phiên bản/ngày/bữa/món liên quan sẽ được xóa theo khóa ngoại CASCADE.
        await manager.query('DELETE FROM menus');
        // Năm học mới luôn bắt đầu với dữ liệu lớp, học sinh và liên hệ theo năm trống.
        // Việc kế thừa chỉ lưu quan hệ năm nguồn; tài khoản học sinh, phụ huynh,
        // giáo viên và cấu hình cấp trường nằm ở các bảng dùng chung nên không bị nhân bản hay xóa.
        return { id: String(year.id) };
      });
    } catch (error) {
      if (error.code === '23505') throw new ConflictException('Tên năm học đã tồn tại trong trường');
      throw error;
    }
  }

  async update(id: number, dto: UpdateAcademicYearDto, schoolId: number) {
    if (dto.sourceYearId !== undefined) throw new BadRequestException('Chỉ chọn năm nguồn khi tạo năm học');
    try {
      return await this.db.transaction(async manager => {
        await this.lockSchool(manager, schoolId);
        const year = await this.year(manager, id, schoolId);
        const start = dto.startDate || year.startDate;
        const end = dto.endDate || year.endDate;
        this.validateDates(start, end);
        if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException('Tên năm học không được để trống');
        if (year.sourceYearId) {
          const source = await this.year(manager, year.sourceYearId, schoolId);
          if (start <= source.endDate) throw new BadRequestException('Năm học phải bắt đầu sau năm nguồn');
        }
        const children = await manager.query('SELECT start_date::text AS start_date FROM academic_year WHERE source_year_id=$1', [id]);
        if (children.some(child => child.start_date <= end)) {
          throw new BadRequestException('Ngày kết thúc không được lấn sang năm học kế thừa');
        }
        await manager.query(`UPDATE academic_year SET name=$1,start_date=$2,end_date=$3,notes=$4,updated_at=now() WHERE id=$5`,
          [dto.name?.trim() || year.name, start, end, dto.notes ?? year.notes, id]);
        await manager.query('UPDATE classes SET school_year=$1 WHERE academic_year_id=$2', [dto.name?.trim() || year.name, id]);
        return { success: true };
      });
    } catch (error) {
      if (error.code === '23505') throw new ConflictException('Tên năm học đã tồn tại trong trường');
      throw error;
    }
  }

  async delete(id: number, schoolId: number) {
    return this.db.transaction(async manager => {
      await this.lockSchool(manager, schoolId);
      const year = await this.year(manager, id, schoolId);
      if (year.status !== 'DRAFT') {
        throw new BadRequestException('Chỉ có thể xóa năm học đang ở trạng thái chuẩn bị (DRAFT)');
      }
      const descendants = await manager.query('SELECT id FROM academic_year WHERE source_year_id=$1', [id]);
      if (descendants.length) {
        throw new BadRequestException('Không thể xóa năm học vì đang có năm học khác kế thừa từ năm này');
      }
      await manager.query('DELETE FROM student_academic_enrollments WHERE academic_year_id=$1', [id]);
      await manager.query('DELETE FROM classes WHERE academic_year_id=$1', [id]);
      await manager.query('DELETE FROM academic_year WHERE id=$1', [id]);
      return { success: true };
    });
  }

  async activate(id: number, schoolId: number) {
    return this.db.transaction(async manager => {
      await this.lockSchool(manager, schoolId);
      const year = await this.year(manager, id, schoolId);
      if (year.status !== 'DRAFT') throw new BadRequestException('Chỉ áp dụng được năm học đang chuẩn bị');
      const active = await manager.query("SELECT id FROM academic_year WHERE school_id=$1 AND status='ACTIVE'", [schoolId]);
      if (active.length) throw new ConflictException('Hãy kết thúc năm học đang áp dụng trước khi mở năm mới');
      const [counts] = await manager.query('SELECT count(*)::int AS count FROM classes WHERE academic_year_id=$1', [id]);
      if (!counts.count) throw new BadRequestException('Cần có ít nhất một lớp trước khi áp dụng năm học');
      const inactive = await manager.query(`SELECT e.id FROM student_academic_enrollments e JOIN classes c ON c.id=e.class_id
        WHERE e.academic_year_id=$1 AND e.status='ENROLLED' AND c.status<>'ACTIVE' LIMIT 1`, [id]);
      if (inactive.length) throw new BadRequestException('Chuyển học sinh ra khỏi lớp ngừng hoạt động trước khi áp dụng');
      // Khi năm học chính thức được áp dụng, thực đơn của năm trước không còn hiển thị nữa.
      // Dữ liệu tài khoản học sinh/phụ huynh/giáo viên không nằm trong bảng menus nên không bị ảnh hưởng.
      await manager.query('DELETE FROM menus');
      await manager.query("UPDATE academic_year SET status='ACTIVE',updated_at=now() WHERE id=$1", [id]);
      await manager.query(`UPDATE students s SET class_id=NULL FROM classes c WHERE s.class_id=c.id AND c.school_id=$1
        AND NOT EXISTS (SELECT 1 FROM student_academic_enrollments e WHERE e.academic_year_id=$2 AND e.student_id=s.id AND e.status='ENROLLED')`, [schoolId, id]);
      await manager.query(`UPDATE students s SET class_id=e.class_id, full_name=e.student_snapshot->>'fullName',
        date_of_birth=(e.student_snapshot->>'dateOfBirth')::date, gender=e.student_snapshot->>'gender'
        FROM student_academic_enrollments e WHERE e.academic_year_id=$1 AND e.student_id=s.id AND e.status='ENROLLED'`, [id]);
      return { success: true };
    });
  }

  async complete(id: number, schoolId: number) {
    return this.db.transaction(async manager => {
      await this.lockSchool(manager, schoolId);
      const year = await this.year(manager, id, schoolId);
      if (year.status !== 'ACTIVE') throw new BadRequestException('Chỉ kết thúc năm học đang áp dụng');
      await manager.query("UPDATE academic_year SET status='COMPLETED',updated_at=now() WHERE id=$1", [id]);
      return { success: true };
    });
  }

  async saveClass(yearId: number, classId: number | null, dto: UpdateYearClassDto, schoolId: number) {
    return this.db.transaction(async manager => {
      await this.lockSchool(manager, schoolId);
      const year = await this.year(manager, yearId, schoolId);
      let cls: any = {};
      if (classId) {
        [cls] = await manager.query('SELECT * FROM classes WHERE id=$1 AND academic_year_id=$2', [classId, yearId]);
        if (!cls) throw new NotFoundException('Lớp không thuộc năm học đã chọn');
      }
      const name = dto.name?.trim() ?? cls.name;
      if (!name) throw new BadRequestException('Tên lớp không được để trống');
      const duplicate = await manager.query('SELECT id FROM classes WHERE academic_year_id=$1 AND lower(name)=lower($2) AND ($3::bigint IS NULL OR id<>$3)', [yearId, name, classId]);
      if (duplicate.length) throw new ConflictException('Tên lớp đã tồn tại trong năm học');
      const teacherId = dto.homeroomTeacherId !== undefined ? dto.homeroomTeacherId : cls.homeroom_teacher_id ?? null;
      if (teacherId) {
        const teacher = await manager.query(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
          WHERE u.id=$1 AND u.status='ACTIVE' AND r.code='TEACHER'`, [teacherId]);
        if (!teacher.length) throw new BadRequestException('Giáo viên chủ nhiệm không hợp lệ');
      }
      if (dto.status === 'INACTIVE') {
        const students = await manager.query("SELECT id FROM student_academic_enrollments WHERE class_id=$1 AND status='ENROLLED' LIMIT 1", [classId]);
        if (students.length) throw new BadRequestException('Chuyển học sinh trước khi ngừng hoạt động lớp');
      }
      if (classId) {
        await manager.query('UPDATE classes SET name=$1,age_group=$2,homeroom_teacher_id=$3,status=$4 WHERE id=$5',
          [name, dto.ageGroup ?? cls.age_group, teacherId, dto.status ?? cls.status, classId]);
        return { id: String(classId) };
      }
      const [created] = await manager.query(`INSERT INTO classes(school_id,name,age_group,school_year,academic_year_id,homeroom_teacher_id,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [schoolId, name, dto.ageGroup || 'MAU_GIAO', year.name, yearId, teacherId, dto.status || 'ACTIVE']);
      return { id: String(created.id) };
    });
  }

  async addEnrollment(yearId: number, dto: AddYearEnrollmentDto, schoolId: number) {
    try {
      return await this.db.transaction(async manager => {
        await this.lockSchool(manager, schoolId);
        const year = await this.year(manager, yearId, schoolId);
        await this.requireClass(manager, dto.classId, yearId);
        const [student] = await manager.query(`SELECT s.*,s.date_of_birth::text AS date_of_birth FROM students s LEFT JOIN classes c ON c.id=s.class_id
          WHERE s.id=$1 AND (c.school_id=$2 OR EXISTS (SELECT 1 FROM student_academic_enrollments e
          JOIN academic_year y ON y.id=e.academic_year_id WHERE e.student_id=s.id AND y.school_id=$2))`, [dto.studentId, schoolId]);
        if (!student) throw new NotFoundException('Không tìm thấy học sinh của trường');
        const [contacts] = await manager.query(`SELECT COALESCE(jsonb_agg(jsonb_build_object('parentId',u.id::text,'fullName',u.full_name,
          'phone',COALESCE(u.phone,''),'email',u.email,'relationship',sp.relationship,'isPrimary',sp.is_primary)), '[]'::jsonb) AS data
          FROM student_parents sp JOIN users u ON u.id=sp.parent_id WHERE sp.student_id=$1`, [dto.studentId]);
        const snapshot = { studentCode: student.student_code, fullName: student.full_name, dateOfBirth: student.date_of_birth, gender: student.gender };
        const [enrollment] = await manager.query(`INSERT INTO student_academic_enrollments(academic_year_id,class_id,student_id,student_snapshot,parent_contacts)
          VALUES ($1,$2,$3,$4::jsonb,$5::jsonb) RETURNING id`, [yearId, dto.classId, dto.studentId, JSON.stringify(snapshot), JSON.stringify(contacts.data)]);
        if (year.status === 'ACTIVE') await manager.query('UPDATE students SET class_id=$1 WHERE id=$2', [dto.classId, dto.studentId]);
        return { id: String(enrollment.id) };
      });
    } catch (error) {
      if (error.code === '23505') throw new ConflictException('Học sinh đã có hồ sơ trong năm học này');
      throw error;
    }
  }

  private async requireClass(manager: EntityManager, classId: number, yearId: number) {
    const [cls] = await manager.query('SELECT id,status FROM classes WHERE id=$1 AND academic_year_id=$2', [classId, yearId]);
    if (!cls) throw new BadRequestException('Lớp không thuộc năm học đã chọn');
    if (cls.status !== 'ACTIVE') throw new BadRequestException('Lớp đã ngừng hoạt động');
  }

  async createStudent(yearId: number, dto: CreateYearStudentDto, schoolId: number) {
    return this.db.transaction(async manager => {
      await this.lockSchool(manager, schoolId);
      const year = await this.year(manager, yearId, schoolId);
      await this.requireClass(manager, dto.classId, yearId);
      if (!dto.fullName.trim() || dto.dateOfBirth >= year.endDate) throw new BadRequestException('Thông tin học sinh không hợp lệ với năm học');
      if ((dto.parentContacts || []).filter(p => p.isPrimary).length > 1) throw new BadRequestException('Chỉ chọn một phụ huynh liên hệ chính');
      const code = dto.studentCode?.trim() || `HS-${randomUUID().slice(0, 8).toUpperCase()}`;
      const existing = await manager.query('SELECT id FROM students WHERE student_code=$1', [code]);
      if (existing.length) throw new ConflictException('Mã học sinh đã tồn tại. Hãy chọn học sinh đã có hồ sơ.');
      const [student] = await manager.query(`INSERT INTO students(student_code,full_name,date_of_birth,gender,class_id)
        VALUES ($1,$2,$3,$4,$5) RETURNING id`, [code, dto.fullName.trim(), dto.dateOfBirth, dto.gender, year.status === 'ACTIVE' ? dto.classId : null]);
      const snapshot = { studentCode: code, fullName: dto.fullName.trim(), dateOfBirth: dto.dateOfBirth, gender: dto.gender };
      const [enrollment] = await manager.query(`INSERT INTO student_academic_enrollments(academic_year_id,class_id,student_id,student_snapshot,parent_contacts)
        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb) ON CONFLICT (academic_year_id,student_id) DO UPDATE
        SET parent_contacts=EXCLUDED.parent_contacts RETURNING id`, [yearId, dto.classId, student.id, JSON.stringify(snapshot), JSON.stringify(dto.parentContacts || [])]);
      return { id: String(enrollment.id), studentId: String(student.id) };
    });
  }

  async updateEnrollment(yearId: number, enrollmentId: number, dto: UpdateYearEnrollmentDto, schoolId: number) {
    return this.db.transaction(async manager => {
      await this.lockSchool(manager, schoolId);
      const year = await this.year(manager, yearId, schoolId);
      const [enrollment] = await manager.query('SELECT * FROM student_academic_enrollments WHERE id=$1 AND academic_year_id=$2', [enrollmentId, yearId]);
      if (!enrollment) throw new NotFoundException('Không tìm thấy hồ sơ học sinh trong năm học');
      const classId = dto.classId ?? enrollment.class_id;
      const status = dto.status ?? enrollment.status;
      if (status === 'ENROLLED') await this.requireClass(manager, classId, yearId);
      const snapshot = { ...enrollment.student_snapshot };
      for (const key of ['fullName', 'dateOfBirth', 'gender']) if (dto[key] !== undefined) snapshot[key] = dto[key];
      if (!snapshot.fullName?.trim()) throw new BadRequestException('Họ tên học sinh không được để trống');
      if (snapshot.dateOfBirth >= year.endDate) throw new BadRequestException('Ngày sinh không hợp lệ với năm học');
      if ((dto.parentContacts || []).filter(p => p.isPrimary).length > 1) throw new BadRequestException('Chỉ chọn một phụ huynh liên hệ chính');
      await manager.query(`UPDATE student_academic_enrollments SET class_id=$1,status=$2,student_snapshot=$3::jsonb,
        parent_contacts=$4::jsonb,notes=$5 WHERE id=$6`,
      [classId, status, JSON.stringify(snapshot), JSON.stringify(dto.parentContacts ?? enrollment.parent_contacts), dto.notes ?? enrollment.notes, enrollmentId]);
      if (year.status === 'ACTIVE') {
        await manager.query('UPDATE students SET class_id=$1,full_name=$2,date_of_birth=$3,gender=$4 WHERE id=$5',
          [status === 'ENROLLED' ? classId : null, snapshot.fullName.trim(), snapshot.dateOfBirth, snapshot.gender, enrollment.student_id]);
      }
      return { success: true };
    });
  }
}
