import { normalizeSearch } from '../../kitchen/utils/kds-data';

const searchText = (value: unknown) => normalizeSearch(String(value ?? '')).replace(/\s+/g, ' ');

export function filterNutritionStudents<T extends { fullName?: string; studentCode?: string; allergies?: { isActive?: boolean }[] }>(
  students: T[],
  search: string,
  allergyFilter: 'ALL' | 'ALLERGIC' | 'SAFE',
): T[] {
  const query = searchText(search);
  return students.filter(student => {
    if (query && !searchText(student.fullName).includes(query) && !searchText(student.studentCode).includes(query)) return false;
    const allergic = Boolean(student.allergies?.some(allergy => allergy.isActive !== false));
    return allergyFilter === 'ALL' || (allergyFilter === 'ALLERGIC' ? allergic : !allergic);
  });
}
