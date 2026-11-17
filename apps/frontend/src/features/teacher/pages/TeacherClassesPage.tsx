import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useMemo } from 'react';
import { apiClient } from '../../../core/api/axios';
import {
  GraduationCap,
  Users,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Search,
  Eye,
  Edit3,
  X,
  School,
  PieChart as PieIcon,
  BarChart3,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  PageTitle,
  ReloadButton,
  Notice,
  Modal,
  useKitchenAction,
  useKitchenResource,
} from '../../kitchen/components/KitchenUI';
import { TeacherStatsOverview } from '../components/TeacherStatsOverview';

export const formatAgeGroup = (group?: string) => {
  if (!group) return '—';
  const map: Record<string, string> = {
    MAU_GIAO: 'Mẫu giáo (3 - 6 tuổi)',
    NHA_TRE: 'Nhà trẻ (6 - 36 tháng)',
    MAM: 'Lớp Mầm (3 - 4 tuổi)',
    CHOI: 'Lớp Chồi (4 - 5 tuổi)',
    LA: 'Lớp Lá (5 - 6 tuổi)',
  };
  return map[group] || group;
};

export function TeacherClassesPage() {
  useLanguage();
  const [search, setSearch] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState('');
  const [allergyFilter, setAllergyFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState<any>(null);

  const resource = useKitchenResource<any[]>(async () => {
    const res = await apiClient.get('/teacher/classes', {
      params: { search: search || undefined },
    });
    const raw = res.data;
    return Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
  }, [search]);

  const action = useKitchenAction();
  const classesList: any[] = resource.data || [];

  // Filter theo điều kiện lọc
  const filteredClasses = useMemo(() => {
    return classesList.filter((c) => {
      if (ageGroupFilter && c.ageGroup !== ageGroupFilter) return false;
      if (allergyFilter === 'HAS_ALLERGY' && !(c.allergicCount > 0 || c.hasAllergyAlert)) return false;
      if (allergyFilter === 'SAFE' && (c.allergicCount > 0 || c.hasAllergyAlert)) return false;
      return true;
    });
  }, [classesList, ageGroupFilter, allergyFilter]);

  // Thống kê số liệu tổng quan
  const stats = useMemo(() => {
    const totalClasses = classesList.length;
    const totalStudents = classesList.reduce(
      (sum, c) => sum + (c.studentCount ?? c.enrolledCount ?? c.enrolled ?? 0),
      0
    );
    const totalAllergic = classesList.reduce(
      (sum, c) => sum + (c.allergicCount ?? (c.hasAllergyAlert ? 1 : 0)),
      0
    );
    const totalSafe = Math.max(0, totalStudents - totalAllergic);
    const safeRate = totalStudents > 0 ? Math.round((totalSafe / totalStudents) * 100) : 100;
    return { totalClasses, totalStudents, totalAllergic, totalSafe, safeRate };
  }, [classesList]);

  // Biểu đồ tròn: Tỷ lệ dị ứng vs an toàn
  const pieData = useMemo(() => {
    if (stats.totalStudents === 0) {
      return [{ name: 'Chưa có học sinh', value: 1, color: '#E2E8F0' }];
    }
    const data = [];
    if (stats.totalSafe > 0) {
      data.push({ name: 'An toàn / Chuẩn', value: stats.totalSafe, color: '#157454' });
    }
    if (stats.totalAllergic > 0) {
      data.push({ name: 'Có dị ứng thực phẩm', value: stats.totalAllergic, color: '#C33248' });
    }
    return data;
  }, [stats]);

  // Biểu đồ cột: Quy mô lớp học & số trẻ dị ứng
  const barData = useMemo(() => {
    return classesList.map((c) => {
      const students = c.studentCount ?? c.enrolledCount ?? c.enrolled ?? 0;
      const allergic = c.allergicCount ?? (c.hasAllergyAlert ? 1 : 0);
      const safe = Math.max(0, students - allergic);
      return {
        name: c.name || `Lớp ${c.id}`,
        'An toàn': safe,
        'Dị ứng': allergic,
        total: students,
      };
    });
  }, [classesList]);

  const handleOpenDetail = async (classId: number) => {
    setDetailLoading(true);
    try {
      const res = await apiClient.get(`/teacher/classes/${classId}`);
      const raw = res.data;
      setDetail(raw?.data || raw);
    } catch (err: any) {
      alert(translateText(err?.response?.data?.message || 'Không thể tải chi tiết lớp học.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      await apiClient.patch(`/teacher/classes/${form.id}`, {
        name: form.name,
        ageGroup: form.ageGroup,
        schoolYear: form.schoolYear,
      });
      setForm(null);
      await resource.reload();
    }, 'Đã cập nhật thông tin lớp học thành công.');
  };

  const handleResetFilters = () => {
    setSearch('');
    setAgeGroupFilter('');
    setAllergyFilter('');
  };

  const hasFiltersApplied = Boolean(search || ageGroupFilter || allergyFilter);

  return (
    <div className="teacher-classes-page w-full space-y-6">
      {/* ─── 1. Page Title matching Kitchen UI ─── */}
      <PageTitle
        eyebrow={translateText("GIÁO VIÊN MẦM NON (3-6 TUỔI)")}
        title={translateText("Lớp phụ trách")}
        description={translateText("Xem, tìm kiếm và cập nhật lớp được phân công. Theo dõi sĩ số học sinh và kiểm soát nguy cơ dị ứng bữa ăn.")}
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
      </PageTitle>

      <Notice error={action.error} message={action.message} />
      {resource.error && <Notice error={resource.error} />}

      {/* ─── 2. 4 Stats Cards matching Executive Dashboard ─── */}
      <TeacherStatsOverview classes={classesList} />

      {/* ─── 3. Recharts Visual Analytics Section matching Kitchen Panels ─── */}
      <div className="kp-card-grid mb-5">
        {/* Panel 1: Tỷ lệ dị ứng vs an toàn */}
        <div className="kp-panel">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2>{translateText("Tỷ lệ Dị Ứng & Sức Khỏe Học Sinh")}</h2>
              <p>{translateText("Phân loại nguy cơ dinh dưỡng học sinh trong các lớp phụ trách")}</p>
            </div>
            <span className="kp-tag gray">{translateText("Tổng ")}{translateText(stats.totalStudents)}{translateText(" trẻ")}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
            <div className="w-48 h-48 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [translateText(`${val} học sinh`), translateText(name)]}
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#FFF',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-800">{translateText(stats.totalStudents)}</span>
                <span className="text-[10px] uppercase font-semibold text-slate-400">{translateText("Trẻ")}</span>
              </div>
            </div>

            <div className="space-y-2.5 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                  <span className="text-xs font-semibold text-emerald-950">{translateText("An toàn / Chuẩn:")}</span>
                </div>
                <span className="text-xs font-bold text-emerald-800">
                  {stats.totalSafe}{translateText(" trẻ (")}{stats.safeRate}%)
                </span>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-4 p-2.5 rounded-lg bg-rose-50 border border-rose-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  <span className="text-xs font-semibold text-rose-950">{translateText("Có dị ứng:")}</span>
                </div>
                <span className="text-xs font-bold text-rose-700">
                  {translateText(stats.totalAllergic)}{translateText(" trẻ (")}{100 - stats.safeRate}%)
                </span>
              </div>

              <p className="text-[11px] text-slate-400 italic">{translateText("* Dữ liệu trích xuất từ hồ sơ dinh dưỡng của học sinh.")}</p>
            </div>
          </div>
        </div>

        {/* Panel 2: Phân bổ quy mô sĩ số theo từng lớp */}
        <div className="kp-panel">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2>{translateText("Phân Bổ Quy Mô & Sĩ Số Lớp Học")}</h2>
              <p>{translateText("Tương quan sĩ số an toàn và học sinh cần theo dõi theo lớp")}</p>
            </div>
            <span className="kp-tag">{classesList.length}{translateText(" lớp")}</span>
          </div>

          <div className="pt-2 h-48">
            {classesList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">{translateText("Chưa có dữ liệu lớp học")}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2EF" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#DFE7ED' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#DFE7ED' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#FFF',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Legend formatter={value => translateText(String(value))}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    iconType="circle"
                  />
                  <Bar name={translateText("An toàn")}
                    dataKey="An toàn"
                    fill="#157454"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  <Bar name={translateText("Dị ứng")}
                    dataKey="Dị ứng"
                    fill="#C33248"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4. Filters Bar matching Kitchen UI (.kp-filters) ─── */}
      <div className="kp-filters">
        <input
          type="search"
          aria-label={translateText("Tìm lớp phụ trách")}
          placeholder={translateText("Tên lớp, năm học...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          aria-label={translateText("Lọc nhóm tuổi")}
          value={ageGroupFilter}
          onChange={(e) => setAgeGroupFilter(e.target.value)}
        >
          <option value="">{translateText("Tất cả độ tuổi")}</option>
          <option value="MAU_GIAO">{translateText("Mẫu giáo (3 - 6 tuổi)")}</option>
          <option value="NHA_TRE">{translateText("Nhà trẻ (6 - 36 tháng)")}</option>
          <option value="MAM">{translateText("Lớp Mầm (3 - 4 tuổi)")}</option>
          <option value="CHOI">{translateText("Lớp Chồi (4 - 5 tuổi)")}</option>
          <option value="LA">{translateText("Lớp Lá (5 - 6 tuổi)")}</option>
        </select>

        <select
          aria-label={translateText("Lọc trạng thái dị ứng")}
          value={allergyFilter}
          onChange={(e) => setAllergyFilter(e.target.value)}
        >
          <option value="">{translateText("Tất cả trạng thái dị ứng")}</option>
          <option value="HAS_ALLERGY">{translateText("Có cảnh báo dị ứng")}</option>
          <option value="SAFE">{translateText("100% An toàn")}</option>
        </select>

        {hasFiltersApplied && (
          <button
            className="kp-button"
            onClick={handleResetFilters}
            title={translateText("Đặt lại bộ lọc")}
          >
            <X size={14} />{translateText("Đặt lại")}</button>
        )}
      </div>

      {/* ─── 5. Modern Data Table matching Kitchen UI (.kp-table-wrap & .kp-table) ─── */}
      <div className="kp-table-wrap">
        {resource.loading && classesList.length === 0 ? (
          <p className="kp-empty">{translateText("Đang tải danh sách lớp học…")}</p>
        ) : filteredClasses.length === 0 ? (
          <p className="kp-empty">
            {translateText(hasFiltersApplied
              ? 'Không tìm thấy lớp học nào phù hợp với bộ lọc.'
              : 'Chưa có lớp học nào được phân công cho bạn.')}
          </p>
        ) : (
          <table className="kp-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>{translateText("STT")}</th>
                <th>{translateText("Tên lớp học")}</th>
                <th>{translateText("Nhóm tuổi")}</th>
                <th>{translateText("Năm học")}</th>
                <th style={{ textAlign: 'center' }}>{translateText("Sĩ số")}</th>
                <th>{translateText("Cảnh báo dị ứng")}</th>
                <th>{translateText("Giáo viên phụ trách")}</th>
                <th style={{ textAlign: 'center' }}>{translateText("Thao tác")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((c, index) => {
                const studentCount =
                  c.studentCount ?? c.enrolledCount ?? c.enrolled ?? 0;
                const allergicCount =
                  c.allergicCount ?? (c.hasAllergyAlert ? 1 : 0);
                const hasAllergy = allergicCount > 0;
                const teacherName =
                  c.homeroomTeacher?.fullName ||
                  c.homeroomTeacherName ||
                  translateText('Lê Thị Hương Giang');

                return (
                  <tr key={c.id}>
                    <td style={{ textAlign: 'center', color: '#88998C', fontWeight: 600 }}>
                      {index + 1}
                    </td>

                    <td>
                      <strong>{c.name}</strong>
                      <small>{translateText("Mã lớp: CLS-")}{translateText(c.id)}</small>
                    </td>

                    <td>
                      <span className="kp-tag amber">
                        {translateText(formatAgeGroup(c.ageGroup))}
                      </span>
                    </td>

                    <td>
                      <span className="kp-tag gray">
                        {translateText(c.schoolYear || '2025-2026')}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="kp-tag">
                        {translateText(studentCount)}{translateText(" học sinh")}</span>
                    </td>

                    <td>
                      {hasAllergy ? (
                        <span className="kp-tag red">
                          {translateText(allergicCount)}{translateText(" trẻ có dị ứng")}</span>
                      ) : (
                        <span className="kp-tag">{translateText("✓ An toàn")}</span>
                      )}
                    </td>

                    <td>
                      <strong>{translateText(teacherName)}</strong>
                      <small>{translateText("Chủ nhiệm lớp")}</small>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          className="kp-button"
                          onClick={() => handleOpenDetail(c.id)}
                          disabled={detailLoading}
                          title={translateText("Xem chi tiết danh sách học sinh")}
                        >
                          <Eye size={14} />{translateText("Chi tiết lớp")}</button>
                        <button
                          className="kp-button"
                          onClick={() => setForm({ ...c })}
                          title={translateText("Chỉnh sửa thông tin lớp")}
                        >
                          <Edit3 size={14} />{translateText("Sửa lớp")}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── 6. Modal Chi tiết lớp học matching Kitchen UI (.kp-modal) ─── */}
      {detail && (
        <Modal
          title={translateText(`Hồ Sơ Lớp: ${detail.name}`)}
          onClose={() => setDetail(null)}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-800">{detail.name}</p>
                <p className="text-slate-500 mt-0.5">{translateText("Năm học: ")}{translateText(detail.schoolYear || '2025-2026')} · {translateText(formatAgeGroup(detail.ageGroup))}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">{translateText("Chủ nhiệm")}</span>
                <span className="font-semibold text-slate-700">
                  {detail.homeroomTeacher?.fullName || detail.homeroomTeacherName || translateText('Lê Thị Hương Giang')}
                </span>
              </div>
            </div>

            {(() => {
              const students = detail.students || detail.children || [];
              const allergicStudents = students.filter((s: any) =>
                (s.allergies || []).some((a: any) => a?.isActive !== false)
              );
              return (
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block font-semibold">{translateText("Sĩ số")}</span>
                    <strong className="text-base font-bold text-slate-800">{translateText(students.length)}</strong>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 text-center">
                    <span className="text-[10px] text-rose-500 block font-semibold">{translateText("Có dị ứng")}</span>
                    <strong className="text-base font-bold text-rose-600">{translateText(allergicStudents.length)}</strong>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                    <span className="text-[10px] text-emerald-600 block font-semibold">{translateText("An toàn")}</span>
                    <strong className="text-base font-bold text-emerald-700">
                      {students.length - allergicStudents.length}
                    </strong>
                  </div>
                </div>
              );
            })()}

            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">{translateText("Danh sách học sinh (")}{translateText((detail.students || detail.children || []).length)}{translateText(" bé)")}</h4>

              {(detail.students || detail.children || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 text-center">{translateText("Lớp học hiện chưa có hồ sơ học sinh.")}</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {(detail.students || detail.children || []).map(
                    (s: any, idx: number) => {
                      const activeAllergies = (s.allergies || []).filter(
                        (a: any) => a?.isActive !== false
                      );
                      const hasAllergy = activeAllergies.length > 0;
                      return (
                        <div
                          key={s.id || idx}
                          className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{s.fullName}</p>
                            <p className="text-[10px] text-slate-400">{translateText("Mã: ")}{s.studentCode || `HS-${s.id}`} ·{' '}
                              {translateText(s.gender === 'MALE'
                                ? 'Nam'
                                : s.gender === 'FEMALE'
                                ? 'Nữ'
                                : s.gender || '—')}
                            </p>
                          </div>

                          <div>
                            {hasAllergy ? (
                              <span className="kp-tag red">
                                {activeAllergies
                                  .map(
                                    (a: any) =>
                                      a.allergenName ||
                                      a.customAllergenName ||
                                      a.allergen?.name
                                  )
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            ) : (
                              <span className="kp-tag">{translateText("Bình thường")}</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                className="kp-button"
                onClick={() => setDetail(null)}
              >{translateText("Đóng")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── 7. Modal Sửa lớp matching Kitchen UI (.kp-modal) ─── */}
      {form && (
        <Modal
          title={translateText(`Cập nhật lớp: ${form.name}`)}
          onClose={() => !action.busy && setForm(null)}
          busy={action.busy}
        >
          <form onSubmit={handleSaveClass} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Tên lớp học")}</label>
              <input
                className="kp-input w-full"
                aria-label={translateText("Tên lớp")}
                required
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={translateText("VD: Lớp Mầm 1 (3-4 tuổi)")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Nhóm tuổi")}</label>
              <select
                className="kp-input w-full"
                aria-label={translateText("Nhóm tuổi")}
                required
                value={form.ageGroup || ''}
                onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
              >
                <option value="MAU_GIAO">{translateText("Mẫu giáo (3 - 6 tuổi)")}</option>
                <option value="NHA_TRE">{translateText("Nhà trẻ (6 - 36 tháng)")}</option>
                <option value="MAM">{translateText("Lớp Mầm (3 - 4 tuổi)")}</option>
                <option value="CHOI">{translateText("Lớp Chồi (4 - 5 tuổi)")}</option>
                <option value="LA">{translateText("Lớp Lá (5 - 6 tuổi)")}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Năm học")}</label>
              <input
                className="kp-input w-full"
                aria-label={translateText("Năm học")}
                required
                value={form.schoolYear || ''}
                onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}
                placeholder={translateText("VD: 2025-2026")}
              />
            </div>

            <p className="text-[11px] text-slate-500 italic">{translateText("* Phân công giáo viên chủ nhiệm do Ban Giám Hiệu quản lý tập trung.")}</p>

            <Notice error={action.error} />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="kp-button"
                disabled={action.busy}
                onClick={() => setForm(null)}
              >{translateText("Hủy bỏ")}</button>
              <button
                type="submit"
                className="kp-button primary"
                disabled={action.busy}
              >
                {translateText(action.busy ? 'Đang lưu…' : 'Lưu lớp')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
