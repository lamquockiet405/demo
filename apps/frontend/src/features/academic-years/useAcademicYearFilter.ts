import { useEffect, useState } from 'react';
import { AcademicYear, academicYearsApi } from './academic-years.api';

export function useAcademicYearFilter(enabled = true) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    academicYearsApi.list().then((data) => {
      if (!alive) return;
      setYears(data);
      const activeYear = data.find(y => y.status === 'ACTIVE');
      setYearId(activeYear?.id || '');
      if (!activeYear) setError('Chưa có năm học đang áp dụng. Hãy áp dụng năm học trong Quản lý năm học.');
    }).catch(() => { if (alive) setError('Không tải được danh sách năm học.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled]);
  return { years, yearId, setYearId, error, loading };
}
