import { Raw } from 'typeorm';

// Operational class lists use only the applied school year. Drafts and history
// remain available through the academic-year API.
export const activeAcademicYear = (schoolId = 1) =>
  Raw(alias => `${alias} IN (SELECT id FROM academic_year WHERE status='ACTIVE' AND school_id=:activeYearSchoolId)`, { activeYearSchoolId: schoolId });
