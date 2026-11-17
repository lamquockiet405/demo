import { BadRequestException } from '@nestjs/common';

// undefined: explicitly requested history; null: no applied school year.
export async function resolveListYear(
  db: { query: (sql: string, params: any[]) => Promise<any[]> },
  schoolId: number,
  query: { academicYearId?: number; allAcademicYears?: boolean },
): Promise<number | null | undefined> {
  if (query.allAcademicYears && !query.academicYearId) return undefined;
  const [year] = await db.query(
    `SELECT id FROM academic_year WHERE school_id=$1 AND ${query.academicYearId ? 'id=$2' : "status='ACTIVE'"} ORDER BY start_date DESC,id DESC LIMIT 1`,
    query.academicYearId ? [schoolId, query.academicYearId] : [schoolId],
  );
  if (!year && query.academicYearId) throw new BadRequestException('Năm học không thuộc trường đang đăng nhập.');
  return year ? Number(year.id) : null;
}
