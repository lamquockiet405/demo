import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Call in the same transaction as a student/class change; never copy an old year. */
export async function syncCurrentEnrollment(manager: EntityManager, studentId: number) {
  const [student] = await manager.query('SELECT id,class_id,status FROM students WHERE id=$1', [studentId]);
  if (!student) return;
  if (!student.class_id || student.status !== 'ACTIVE') {
    await manager.query(`UPDATE student_academic_enrollments e SET status='LEFT'
      FROM academic_year y WHERE y.id=e.academic_year_id AND y.status='ACTIVE'
      AND e.student_id=$1 AND e.status='ENROLLED'`, [studentId]);
    return;
  }
  const [cls] = await manager.query(`SELECT c.academic_year_id FROM classes c
    JOIN academic_year y ON y.id=c.academic_year_id
    WHERE c.id=$1 AND c.status='ACTIVE' AND y.status='ACTIVE'`, [student.class_id]);
  if (!cls) throw new BadRequestException('Chọn lớp thuộc năm học đang áp dụng. Hồ sơ năm khác được quản lý tại Quản lý năm học.');
  await manager.query(`INSERT INTO student_academic_enrollments
      (academic_year_id,class_id,student_id,student_snapshot,parent_contacts,status)
    SELECT $1,s.class_id,s.id,jsonb_build_object('studentCode',s.student_code,'fullName',s.full_name,
      'dateOfBirth',s.date_of_birth::text,'gender',s.gender),
      COALESCE((SELECT jsonb_agg(jsonb_build_object('parentId',u.id::text,'fullName',u.full_name,
        'phone',COALESCE(u.phone,''),'email',u.email,'relationship',sp.relationship,'isPrimary',sp.is_primary))
        FROM student_parents sp JOIN users u ON u.id=sp.parent_id WHERE sp.student_id=s.id),'[]'::jsonb), 'ENROLLED'
    FROM students s WHERE s.id=$2
    ON CONFLICT (academic_year_id,student_id) DO UPDATE SET class_id=EXCLUDED.class_id,
      student_snapshot=EXCLUDED.student_snapshot,parent_contacts=EXCLUDED.parent_contacts,status='ENROLLED'`,
    [cls.academic_year_id, studentId]);
}
