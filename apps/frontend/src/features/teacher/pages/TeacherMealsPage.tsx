import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../core/api/axios';
import { schoolDate } from '../../menus/utils/published-menus';
import { Feedback, Field, SchoolPage, State, useSchoolAction, useSchoolResource } from '../../school/components/SchoolUI';
import { TeacherStatsOverview } from '../components/TeacherStatsOverview';

const meals: Record<string, string> = { BREAKFAST: 'Bữa sáng', MORNING_SNACK: 'Phụ sáng', LUNCH: 'Bữa trưa', AFTERNOON_SNACK: 'Ăn phụ chiều' };
const levels: Record<string, string> = { FULL: 'Ăn hết', MOST: 'Ăn phần lớn', HALF: 'Ăn một nửa', LITTLE: 'Ăn ít', NONE: 'Không ăn' };
const get = async (path: string, params?: any) => (await apiClient.get('/teacher/' + path, { params })).data;
const initial = (row: any) => ({
  isAttended: row.isAttended,
  consumptionLevel: ({ ALL: 'FULL', PARTIAL: 'HALF', FEW: 'LITTLE' } as Record<string, string>)[row.consumptionLevel] || row.consumptionLevel || '',
  note: row.note || '',
});
const fingerprint = (rows: any[]) => JSON.stringify(rows.map(row => ({
  studentId: String(row.studentId), isAttended: row.isAttended, note: row.note?.trim() || '',
})).sort((a, b) => Number(a.studentId) - Number(b.studentId)));

export function TeacherMealsPage() {
  const classes = useSchoolResource<any[]>(() => get('classes'), []);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(schoolDate);
  const [meal, setMeal] = useState('LUNCH');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, any>>({});
  const resource = useSchoolResource<any[]>(() => get('meal-attendance', { classId, date, mealType: meal }), [classId, date, meal]);
  const submissions = useSchoolResource<any[]>(() => get('meal-submissions', { classId, date, mealType: meal }), [classId, date, meal]);
  const action = useSchoolAction();
  useEffect(() => setDraft({}), [classId, date, meal]);
  const rows = resource.error || resource.loading ? [] : resource.data || [];
  const current = (row: any) => draft[row.studentId] || initial(row);
  const clearDraft = (studentIds: string[]) => setDraft(previous => {
    const next = { ...previous };
    studentIds.forEach(id => delete next[id]);
    return next;
  });
  const reload = async () => { await Promise.all([resource.reload(), submissions.reload()]); };
  const save = (row: any) => void action.run(async () => {
    const value = current(row);
    if (typeof value.isAttended !== 'boolean') throw new Error('Chọn có mặt hoặc vắng mặt.');
    await apiClient.put('/teacher/meal-attendance/' + row.studentId, { date, mealType: meal, ...value });
    clearDraft([row.studentId]);
    await resource.reload();
  }, 'Đã lưu điểm danh và thông tin bữa ăn.');
  const send = (id: string, classRows: any[], wasSent: boolean) => void action.run(async () => {
    await apiClient.post('/teacher/meal-submissions', {
      classId: id, date, mealType: meal,
      items: classRows.map(row => ({ studentId: row.studentId, ...current(row) })),
    });
    clearDraft(classRows.map(row => row.studentId));
    await reload();
  }, wasSent ? 'Đã gửi cập nhật số suất xuống bếp.' : 'Đã chốt điểm danh và gửi số suất xuống bếp.');
  const groups = (classes.data || []).filter(c => !classId || String(c.id) === classId);
  const visible = rows.filter(row => `${row.fullName} ${row.studentCode}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));

  return <SchoolPage title="Điểm danh & tình trạng ăn"
    description="Điểm danh trước bữa ăn, gửi số suất theo từng lớp/ngày/bữa xuống bếp. Mức ăn của bé có thể ghi nhận sau bữa ăn."
    actions={<button className="kp-button" disabled={action.busy} onClick={() => void reload()}>Làm mới</button>}>
    <Feedback error={action.error || classes.error || submissions.error} message={action.message} />
    <TeacherStatsOverview classes={classes.data} />
    <div className="kp-filters">
      <Field label="Ngày"><input aria-label="Ngày giáo viên" type="date" disabled={action.busy} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></Field>
      <select aria-label="Lớp phụ trách" disabled={action.busy} value={classId} onChange={e => setClassId(e.target.value)}>
        <option value="">Tất cả lớp được phân công</option>
        {(classes.data || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label="Bữa ăn" disabled={action.busy} value={meal} onChange={e => setMeal(e.target.value)}>
        {Object.entries(meals).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      <input aria-label="Tìm học sinh giáo viên" placeholder="Tên hoặc mã học sinh..." value={search} onChange={e => setSearch(e.target.value)} />
    </div>
    <State resource={resource} empty={!rows.length} />
    {!resource.loading && !resource.error && groups.map(c => {
      const classRows = rows.filter(row => String(row.classId) === String(c.id));
      if (!classRows.length) return null;
      const present = classRows.filter(row => current(row).isAttended === true).length;
      const absent = classRows.filter(row => current(row).isAttended === false).length;
      const unmarked = classRows.length - present - absent;
      const sent = (submissions.data || []).find(item => String(item.classId) === String(c.id));
      const changed = !!sent && fingerprint(classRows.map(row => ({ studentId: row.studentId, ...current(row) }))) !== fingerprint(sent.snapshot || []);
      return <section key={c.id} className="bg-white border rounded-xl p-5 space-y-3" aria-label={`Gửi suất ăn ${c.name}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">{c.name} · {date} · {meals[meal]}</h2>
            <p className="text-sm mt-2">Có mặt: <b>{present}</b> · Vắng: <b>{absent}</b> · Chưa điểm danh: <b>{unmarked}</b></p>
            <p className="text-sm text-slate-500 mt-2">Số suất gửi bếp: <b>{present}</b> suất. Tính trên toàn bộ {classRows.length} học sinh của lớp.</p>
          </div>
          <button className="kp-button primary" disabled={action.busy || resource.loading || submissions.loading || !!submissions.error || unmarked > 0 || (!!sent && !changed)}
            onClick={() => send(String(c.id), classRows, !!sent)}>{sent ? 'Gửi cập nhật xuống bếp' : 'Chốt điểm danh & gửi bếp'}</button>
        </div>
        {sent ? <p className={`text-sm ${changed ? 'text-amber-700' : 'text-emerald-700'}`}>
          Đã gửi bếp {sent.quantity} suất lúc {new Date(sent.submittedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.
          {changed && ' Điểm danh hoặc ghi chú đã thay đổi; cần gửi cập nhật để bếp nhận số mới.'}
        </p> : <p className="text-sm text-amber-700">Chưa gửi bếp cho ngày và bữa này. Điểm danh đủ cả lớp để gửi.</p>}
      </section>;
    })}
    <div className="kp-table-wrap"><table className="kp-table"><thead><tr>
      {['Học sinh', 'Lớp', 'Có mặt', 'Mức ăn sau bữa (tùy chọn)', 'Ghi chú cho bếp', 'Lưu'].map(label => <th key={label}>{label}</th>)}
    </tr></thead><tbody>{visible.map(row => {
      const value = current(row);
      const change = (key: string, next: any) => setDraft(previous => ({ ...previous, [row.studentId]: { ...value, [key]: next } }));
      return <tr key={row.studentId}>
        <td>{row.fullName}<p className="text-xs text-slate-500">{row.studentCode}</p></td><td>{row.className}</td>
        <td><select aria-label={`Có mặt ${row.fullName}`} disabled={action.busy} value={value.isAttended == null ? '' : String(value.isAttended)} onChange={e => change('isAttended', e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">Chưa ghi nhận</option><option value="true">Có mặt</option><option value="false">Vắng</option>
        </select></td>
        <td><select aria-label={`Tình trạng ăn ${row.fullName}`} disabled={action.busy || value.isAttended !== true} value={value.consumptionLevel} onChange={e => change('consumptionLevel', e.target.value)}>
          <option value="">Chưa ghi nhận</option>{Object.entries(levels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select></td>
        <td><input aria-label={`Ghi chú ${row.fullName}`} disabled={action.busy} value={value.note} onChange={e => change('note', e.target.value)} /></td>
        <td><button className="kp-button" disabled={action.busy} onClick={() => save(row)}>Lưu {row.fullName}</button></td>
      </tr>;
    })}</tbody></table></div>
  </SchoolPage>;
}
