import { Raw } from 'typeorm';

function schoolNumber(schoolId = 1) {
  if (!Number.isSafeInteger(schoolId) || schoolId < 1) throw new Error('Invalid school context');
  return schoolId;
}

export const currentStudentIdsSql = (schoolId = 1) => `SELECT enrollment.student_id
  FROM student_academic_enrollments enrollment
  JOIN academic_year year ON year.id=enrollment.academic_year_id
  JOIN classes enrolled_class ON enrolled_class.id=enrollment.class_id AND enrolled_class.status='ACTIVE'
  WHERE year.status='ACTIVE' AND year.school_id=${schoolNumber(schoolId)} AND enrollment.status='ENROLLED'`;

export const currentStudent = (schoolId = 1) => Raw(alias => `${alias} IN (${currentStudentIdsSql(schoolId)})`);

export const currentYearDateSql = (dateColumn: string, schoolId = 1) => `EXISTS (
  SELECT 1 FROM academic_year scope_year WHERE scope_year.status='ACTIVE'
  AND scope_year.school_id=${schoolNumber(schoolId)} AND ${dateColumn} BETWEEN scope_year.start_date AND scope_year.end_date)`;

export const currentYearDate = (schoolId = 1) => Raw(alias => currentYearDateSql(alias, schoolId));
