import { normalizeSearch } from '../../../core/utils/search';
import { downloadExcel } from '../../../core/utils/excel-export';
import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../core/api/axios';
import { schoolDate } from '../../menus/utils/published-menus';
import { Feedback, Field, SchoolPage, State, useSchoolAction, useSchoolResource } from '../../school/components/SchoolUI';
import { TeacherStatsOverview } from '../components/TeacherStatsOverview';
import { FileSpreadsheet, CheckCheck, Save } from 'lucide-react';

const meals: Record<string, string> = {
  BREAKFAST: 'Buổi sáng',
  LUNCH: 'Bữa trưa chính',
  AFTERNOON_SNACK: 'Buổi phụ',
  LATE_SNACK: 'Buổi xế chiều',
};
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
  useLanguage();
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

  const handleExportExcel = async () => {
    if (!rows.length) return alert(translateText("Chưa có danh sách học sinh để xuất Excel."));
    await downloadExcel(
      `Diem_danh_${date}_${meals[meal] || meal}.xlsx`,
      [
        ["Mã học sinh", "Họ và tên", "Lớp", "Ngày", "Bữa ăn", "Điểm danh", "Lý do vắng / Ghi chú báo bếp"],
        ...rows.map(r => {
          const val = current(r);
          return [
            r.studentCode || "",
            r.fullName || "",
            r.className || "",
            date,
            meals[meal] || meal,
            val.isAttended === true ? "Có mặt" : val.isAttended === false ? "Vắng" : "Chưa điểm danh",
            val.note || "",
          ];
        }),
      ],
      `Điểm danh ${date}`
    );
  };

  const handleMarkAll = (classRows: any[], isAttended: boolean) => {
    setDraft(previous => {
      const next = { ...previous };
      classRows.forEach(r => {
        const val = next[r.studentId] || initial(r);
        next[r.studentId] = { ...val, isAttended };
      });
      return next;
    });
  };

  const handleSaveAll = (classRows: any[]) => void action.run(async () => {
    const toSave = classRows.filter(r => typeof current(r).isAttended === 'boolean');
    if (!toSave.length) throw new Error(translateText('Vui lòng điểm danh ít nhất một học sinh trước khi lưu.'));
    await Promise.all(
      toSave.map(r => apiClient.put('/teacher/meal-attendance/' + r.studentId, { date, mealType: meal, ...current(r) }))
    );
    clearDraft(classRows.map(r => r.studentId));
    await resource.reload();
  }, 'Đã lưu toàn bộ điểm danh của lớp.');

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
  const visible = rows.filter(row => normalizeSearch(`${row.fullName} ${row.studentCode}`).includes(normalizeSearch(search)));

  return <SchoolPage title={translateText("Điểm danh & tình trạng ăn")}
    description={translateText("Điểm danh trước bữa ăn, gửi số suất theo từng lớp/ngày/bữa xuống bếp. Ghi chú sau bữa ăn được cập nhật tại trang riêng.")}>
    <Feedback error={action.error || classes.error || submissions.error} message={action.message} />
    <TeacherStatsOverview classes={classes.data} />
    <div className="kp-filters flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Field label={translateText("Ngày")}><input aria-label={translateText("Ngày giáo viên")} type="date" disabled={action.busy} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></Field>
        <select aria-label={translateText("Lớp phụ trách")} disabled={action.busy} value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">{translateText("Tất cả lớp được phân công")}</option>
          {(classes.data || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label={translateText("Bữa ăn")} disabled={action.busy} value={meal} onChange={e => setMeal(e.target.value)}>
          {Object.entries(meals).map(([code, label]) => <option key={code} value={code}>{translateText(label)}</option>)}
        </select>
        <input aria-label={translateText("Tìm học sinh giáo viên")} placeholder={translateText("Tên hoặc mã học sinh...")} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="kp-button flex items-center gap-1.5" disabled={action.busy} onClick={() => void reload()}>
          {translateText("Làm mới")}
        </button>
        <button type="button" className="kp-button flex items-center gap-1.5" disabled={action.busy || !rows.length} onClick={() => void handleExportExcel()} title={translateText("Xuất danh sách điểm danh ra file Excel")}>
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>{translateText("Xuất Excel")}</span>
        </button>
      </div>
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
      return <section key={c.id} className="bg-white border rounded-xl p-5 space-y-4" aria-label={translateText(`Gửi suất ăn ${c.name}`)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-base text-slate-900">{c.name} · {translateText(date)} · {translateText(meals[meal])}</h2>
            <p className="text-sm mt-1">{translateText("Có mặt: ")}<b className="text-emerald-700">{present}</b>{translateText(" · Vắng: ")}<b className="text-rose-700">{absent}</b>{translateText(" · Chưa điểm danh: ")}<b className="text-amber-700">{unmarked}</b></p>
            <p className="text-sm text-slate-500 mt-1">{translateText("Số suất gửi bếp: ")}<b>{present}</b>{translateText(" suất. Tính trên toàn bộ ")}{classRows.length}{translateText(" học sinh của lớp.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="kp-button flex items-center gap-1 text-xs"
              disabled={action.busy}
              onClick={() => handleMarkAll(classRows, true)}
              title={translateText("Đánh dấu tất cả học sinh trong lớp là Có mặt")}
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{translateText("Điểm danh tất cả có mặt")}</span>
            </button>
            <button
              type="button"
              className="kp-button flex items-center gap-1 text-xs"
              disabled={action.busy}
              onClick={() => handleSaveAll(classRows)}
              title={translateText("Lưu toàn bộ điểm danh của lớp")}
            >
              <Save className="w-3.5 h-3.5 text-blue-600" />
              <span>{translateText("Lưu tất cả")}</span>
            </button>
            <button
              className="kp-button primary"
              disabled={action.busy || resource.loading || submissions.loading || !!submissions.error || unmarked > 0 || (!!sent && !changed)}
              onClick={() => send(String(c.id), classRows, !!sent)}
            >
              {translateText(sent ? 'Gửi cập nhật xuống bếp' : 'Chốt điểm danh & gửi bếp')}
            </button>
          </div>
        </div>
        {sent ? <p className={`text-sm ${changed ? 'text-amber-700' : 'text-emerald-700'}`}>{translateText("Đã gửi bếp ")}{translateText(sent.quantity)}{translateText(" suất lúc ")}{translateText(new Date(sent.submittedAt).toLocaleString(getLocale(), { timeZone: 'Asia/Ho_Chi_Minh' }))}.
          {translateText(changed && ' Điểm danh hoặc ghi chú đã thay đổi; cần gửi cập nhật để bếp nhận số mới.')}
        </p> : <p className="text-sm text-amber-700">{translateText("Chưa gửi bếp cho ngày và bữa này. Điểm danh đủ cả lớp để gửi.")}</p>}
      </section>;
    })}
    <div className="kp-table-wrap"><table className="kp-table"><thead><tr>
      {['Học sinh', 'Lớp', 'Điểm danh', 'Lý do vắng / Ghi chú báo bếp', 'Lưu'].map(label => <th key={label}>{translateText(label)}</th>)}
    </tr></thead><tbody>{visible.map(row => {
      const value = current(row);
      const change = (key: string, next: any) => setDraft(previous => ({ ...previous, [row.studentId]: { ...value, [key]: next } }));
      return <tr key={row.studentId}>
        <td>{row.fullName}<p className="text-xs text-slate-500">{row.studentCode}</p></td><td>{row.className}</td>
        <td>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 gap-1">
            <button
              type="button"
              disabled={action.busy}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${value.isAttended === true ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
              onClick={() => change('isAttended', true)}
            >
              {translateText("Có mặt")}
            </button>
            <button
              type="button"
              disabled={action.busy}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${value.isAttended === false ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
              onClick={() => change('isAttended', false)}
            >
              {translateText("Vắng")}
            </button>
          </div>
        </td>
        <td><input aria-label={translateText(`Ghi chú ${row.fullName}`)} placeholder={translateText("VD: Mẹ đón về, ốm sốt...")} disabled={action.busy} value={value.note} onChange={e => change('note', e.target.value)} /></td>
        <td>
          <button
            className="kp-button flex items-center gap-1 px-3 py-1.5"
            disabled={action.busy}
            onClick={() => save(row)}
            title={translateText(`Lưu thông tin cho ${row.fullName}`)}
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>{translateText("Lưu")}</span>
          </button>
        </td>
      </tr>;
    })}</tbody></table></div>
  </SchoolPage>;
}
