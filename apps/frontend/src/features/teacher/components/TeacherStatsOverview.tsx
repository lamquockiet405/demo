import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useMemo } from 'react';
import { apiClient } from '../../../core/api/axios';
import { useSchoolResource } from '../../school/components/SchoolUI';

export interface TeacherStatsOverviewProps {
  classes?: any[];
}

export function TeacherStatsOverview({ classes: propClasses }: TeacherStatsOverviewProps) {
  useLanguage();
  const resource = useSchoolResource<any[]>(
    async () => {
      if (propClasses && propClasses.length > 0) return propClasses;
      const res = await apiClient.get('/teacher/classes');
      const raw = res.data;
      return Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
    },
    [propClasses]
  );

  const classesList = propClasses || resource.data || [];

  const stats = useMemo(() => {
    const totalClasses = classesList.length;
    const totalStudents = classesList.reduce(
      (sum, c) => sum + (c.studentCount ?? c.enrolledCount ?? c.enrolled ?? 0),
      0
    );
    const allergicStudents = classesList.reduce(
      (sum, c) => sum + (c.allergicCount ?? (c.hasAllergyAlert ? 1 : 0)),
      0
    );
    const standardDietStudents = Math.max(0, totalStudents - allergicStudents);
    const safeRate = totalStudents > 0 ? Math.round((standardDietStudents / totalStudents) * 100) : 100;
    return {
      totalClasses,
      totalStudents,
      allergicStudents,
      standardDietStudents,
      safeRate,
    };
  }, [classesList]);

  return (
    <div className="kp-stats">
      {/* ─── Ô 1: Lớp phụ trách ─── */}
      <div className="kp-stat">
        <span>{translateText("Lớp phụ trách")}</span>
        <strong>{stats.totalClasses}</strong>
        <span className="mt-1 block text-[11px] text-[#75887a]">{translateText("Năm học 2025 - 2026")}</span>
      </div>

      {/* ─── Ô 2: Tổng sĩ số học sinh ─── */}
      <div className="kp-stat">
        <span>{translateText("Tổng sĩ số học sinh")}</span>
        <strong>{translateText(stats.totalStudents)}</strong>
        <span className="mt-1 block text-[11px] text-[#75887a]">{translateText("Học sinh theo học")}</span>
      </div>

      {/* ─── Ô 3: Cảnh báo dị ứng ─── */}
      <div className={`kp-stat ${stats.allergicStudents > 0 ? 'red' : ''}`}>
        <span>{translateText("Cảnh báo dị ứng")}</span>
        <strong>{translateText(stats.allergicStudents)}</strong>
        <span
          className={`mt-1 block text-[11px] ${
            stats.allergicStudents > 0 ? 'text-[#c33248]' : 'text-[#75887a]'
          }`}
        >
          {translateText(stats.allergicStudents > 0 ? 'Cần theo dõi chế độ ăn' : 'An toàn toàn bộ')}
        </span>
      </div>

      {/* ─── Ô 4: Chế độ ăn tiêu chuẩn ─── */}
      <div className="kp-stat">
        <span>{translateText("Chế độ ăn tiêu chuẩn")}</span>
        <strong>{stats.standardDietStudents}</strong>
        <span className="mt-1 block text-[11px] text-[#75887a]">{translateText("Tỷ lệ an toàn: ")}{stats.safeRate}%
        </span>
      </div>
    </div>
  );
}

