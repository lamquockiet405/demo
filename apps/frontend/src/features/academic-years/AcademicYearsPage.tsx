import { normalizeSearch } from '../../core/utils/search';
import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { CalendarRange, Copy, GraduationCap, Pencil, Plus, Save, Users, X } from 'lucide-react';
import { academicYearsApi as api, AcademicYear, ParentContact, YearClass, YearDetail, YearEnrollment } from './academic-years.api';
import { apiClient } from '../../core/api/axios';

const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-100';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';
const primary = `${button} bg-teal-700 text-white hover:bg-teal-800 border-teal-700`;
const labels: Record<string, string> = { DRAFT: 'Đang chuẩn bị', ACTIVE: 'Đang áp dụng', COMPLETED: 'Đã kết thúc', ENROLLED: 'Đang học', LEFT: 'Đã rút', GRADUATED: 'Đã hoàn thành' };
const relation: Record<string, string> = { FATHER: 'Bố', MOTHER: 'Mẹ', GUARDIAN: 'Người giám hộ' };
const errorText = (error: any) => {
  const message = error.response?.data?.message || error.message || 'Không thực hiện được thao tác';
  return Array.isArray(message) ? message.join('. ') : message;
};
const dateText = (date: string) => date?.split('-').reverse().join('/');

function Modal({ title, children, close, busy }: { title: string; children: React.ReactNode; close: () => void; busy: boolean }) {
  return <div className="fixed !m-0 inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape' && !busy) close(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between sticky top-0 bg-white border-b p-5 z-10">
        <h2 className="text-lg font-bold">{title}</h2><button type="button" aria-label="Đóng" disabled={busy} onClick={close}><X className="w-5 h-5" /></button>
      </div>{children}
    </section>
  </div>;
}

export const AcademicYearsPage = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const selectedId = params.get('year') || '';
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [detail, setDetail] = useState<YearDetail | null>(null);
  const [tab, setTab] = useState<'classes' | 'students' | 'parents'>(location.pathname === '/parents' ? 'parents' : 'classes');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalError, setModalError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [yearForm, setYearForm] = useState<null | { id?: string; name: string; startDate: string; endDate: string; sourceYearId: string; notes: string }>(null);
  const [classForm, setClassForm] = useState<null | { id?: string; name: string; ageGroup: string; status: string; homeroomTeacherId: string }>(null);
  const [teachers, setTeachers] = useState<Array<{id: string; fullName: string}>>([]);
  const [teachersError, setTeachersError] = useState('');
  const [studentForm, setStudentForm] = useState<YearEnrollment | null>(null);
  const [addForm, setAddForm] = useState<null | { studentId: string; classId: string }>(null);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  const [newStudent, setNewStudent] = useState({ studentCode: '', fullName: '', dateOfBirth: '', gender: 'MALE', parentName: '', parentPhone: '' });
  const [availableStudents, setAvailableStudents] = useState<Array<{ id: string; fullName: string; studentCode: string }>>([]);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'complete' | null>(null);
  useEffect(() => {
    if (!classForm) return;
    let alive = true;
    setTeachersError('');
    apiClient.get('/users/staff', { params: { roleCode: 'TEACHER', status: 'ACTIVE', limit: 200 } })
      .then(response => { if (alive) setTeachers(Array.isArray(response.data) ? response.data : response.data?.items || []); })
      .catch(err => { if (alive) setTeachersError(errorText(err)); });
    return () => { alive = false; };
  }, [classForm?.id, !!classForm]);
  useEffect(() => { if (location.pathname === '/parents') setTab('parents'); else if (location.pathname === '/classes') setTab('classes'); }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setDetail(null);
    api.list().then(async list => {
      if (!alive) return;
      setYears(list);
      const selected = list.find(y => String(y.id) === selectedId) || list.find(y => y.status === 'ACTIVE') || list[0];
      if (!selected) { setLoading(false); return; }
      if (String(selected.id) !== selectedId) { setParams({ year: String(selected.id) }, { replace: true }); return; }
      const data = await api.detail(String(selected.id));
      if (alive) { setDetail(data); setLoading(false); }
    }).catch(err => { if (alive) { setError(errorText(err)); setLoading(false); } });
    return () => { alive = false; };
  }, [selectedId, revision]);

  const mutate = async (work: () => Promise<unknown>, message: string, close: () => void) => {
    setSaving(true); setModalError(''); setNotice('');
    try { await work(); close(); setNotice(message); setRevision(value => value + 1); }
    catch (err) { setModalError(errorText(err)); }
    finally { setSaving(false); }
  };
  const closeModals = () => { setYearForm(null); setClassForm(null); setStudentForm(null); setAddForm(null); setConfirmAction(null); setModalError(''); };
  const createYear = (inheritFromId = '') => {
    const source = detail || years[0];
    const inheritanceSource = inheritFromId
      ? years.find(year => String(year.id) === String(inheritFromId)) || detail
      : null;
    const year = source ? Number(source.endDate.slice(0, 4)) : new Date().getFullYear();
    setModalError('');
    setYearForm({
      name: `${year}-${year + 1}`,
      startDate: `${year}-09-01`,
      endDate: `${year + 1}-08-31`,
      sourceYearId: inheritanceSource?.id || '',
      notes: '',
    });
  };
  const editStudent = (enrollment: YearEnrollment) => { setModalError(''); setStudentForm(JSON.parse(JSON.stringify(enrollment))); };
  const submitYear = (event: React.FormEvent) => {
    event.preventDefault();
    if (!yearForm) return;
    const payload = { name: yearForm.name, startDate: yearForm.startDate, endDate: yearForm.endDate, notes: yearForm.notes,
      ...(!yearForm.id && yearForm.sourceYearId ? { sourceYearId: Number(yearForm.sourceYearId) } : {}) };
    mutate(async () => {
      if (yearForm.id) await api.update(yearForm.id, payload);
      else { const created = await api.create(payload); setParams({ year: String(created.id) }); }
    }, yearForm.id ? 'Đã lưu cấu hình năm học.' : 'Đã tạo năm học. Bạn có thể chỉnh sửa lớp, học sinh và phụ huynh trước khi áp dụng.', closeModals);
  };
  const openAdd = async () => {
    setAddMode('existing');
    setNewStudent({ studentCode: '', fullName: '', dateOfBirth: '', gender: 'MALE', parentName: '', parentPhone: '' });
    setModalError(''); setAvailableStudents([]); setAddForm({ studentId: '', classId: detail?.classes.find(c => c.status === 'ACTIVE')?.id || '' });
    try {
      if (detail) setAvailableStudents(await api.availableStudents(detail.id));
    } catch (err) { setModalError(errorText(err)); }
  };
  const visibleEnrollments = (detail?.enrollments || []).filter(e => (!classFilter || String(e.classId) === classFilter) &&
    normalizeSearch(`${e.studentSnapshot.fullName} ${e.studentSnapshot.studentCode} ${e.parentContacts.map(p => p.fullName).join(' ')}`).includes(normalizeSearch(search)));
  const parents = visibleEnrollments.flatMap(enrollment => enrollment.parentContacts.map((parent, index) => ({ enrollment, parent, index })));
  const studentCount = detail?.enrollments.filter(e => e.status === 'ENROLLED').length || 0;
  const parentCount = new Set((detail?.enrollments || []).flatMap(e => e.parentContacts.map(p => p.parentId || `${p.fullName}:${p.phone}`))).size;
  const sourceName = years.find(y => String(y.id) === String(detail?.sourceYearId))?.name;
  const formError = modalError && <p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-800 text-sm">{modalError}</p>;

  return <div className="w-full space-y-5 pb-20">
    {notice && <p role="status" className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-teal-900 text-sm">{notice}</p>}
    {error && <div role="alert" className="bg-rose-50 rounded-xl p-4 text-rose-800">{error} <button className={button} onClick={() => setRevision(v => v + 1)}>Thử lại</button></div>}
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-end justify-between gap-4">
      <label className="text-sm font-semibold min-w-56">Năm học
        <select className={`${input} mt-2`} value={selectedId} disabled={saving} onChange={e => { setParams({ year: e.target.value }); setClassFilter(''); setSearch(''); setNotice(''); }}>
          {!years.length && <option value="">Chưa có năm học</option>}
          {years.map(year => <option key={year.id} value={year.id}>{year.name} · {labels[year.status]}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={primary} onClick={() => createYear()} disabled={loading || saving}><Plus className="w-4 h-4" /> Tạo năm học</button>
        {detail && <>
          <button className={button} onClick={() => { setModalError(''); setYearForm({ id: detail.id, name: detail.name, startDate: detail.startDate, endDate: detail.endDate, sourceYearId: detail.sourceYearId || '', notes: detail.notes }); }}><Pencil className="w-4 h-4" /> Cấu hình năm học</button>
          {detail.status === 'DRAFT' && <button className={primary} onClick={() => { setModalError(''); setConfirmAction('activate'); }}>Áp dụng năm học</button>}
          {detail.status === 'ACTIVE' && <button className={button} onClick={() => { setModalError(''); setConfirmAction('complete'); }}>Kết thúc năm học</button>}
          {detail.status === 'COMPLETED' && <button className={primary} onClick={() => createYear(detail.id)}><Copy className="w-4 h-4" /> Kế thừa sang năm mới</button>}
        </>}
      </div>
    </div>
    {loading && <p className="py-10 text-center text-slate-500" role="status">Đang tải dữ liệu năm học…</p>}
    {!loading && !years.length && !error && <div className="border border-dashed rounded-2xl bg-white p-10 text-center"><CalendarRange className="mx-auto w-10 h-10 text-teal-600" /><p className="mt-3">Chưa có năm học. Tạo năm học đầu tiên để sắp xếp lớp và học sinh.</p></div>}
    {detail && !loading && <>
      <div className="grid md:grid-cols-3 gap-4">
        {[['Lớp học', detail.classes.length, GraduationCap], ['Học sinh đang học', studentCount, Users], ['Phụ huynh liên hệ', parentCount, Users]].map(([label, value, Icon]: any) =>
          <div key={label} className="bg-white border rounded-2xl p-5 flex items-center gap-4"><Icon className="w-8 h-8 text-teal-600" /><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></div></div>)}
      </div>
      <div className="text-sm text-slate-600 bg-slate-100 p-4 rounded-xl space-y-1">
        <p><strong>{labels[detail.status]}</strong> · {dateText(detail.startDate)} – {dateText(detail.endDate)}{sourceName && ` · Kế thừa từ ${sourceName}`}</p>
        <p>Hồ sơ và liên hệ được lưu riêng theo năm học. Chỉnh sửa ở đây không thay đổi bản lưu của năm khác.</p>
        {detail.notes && <p className="whitespace-pre-wrap">{detail.notes}</p>}
      </div>
      <div className="border-b flex gap-1" role="tablist" aria-label="Dữ liệu năm học">
        {([['classes', 'Lớp học'], ['students', 'Học sinh'], ['parents', 'Phụ huynh']] as const).map(([id, name]) =>
          <button key={id} role="tab" aria-selected={tab === id} className={`px-5 py-3 text-sm font-bold border-b-2 ${tab === id ? 'text-teal-700 border-teal-700' : 'text-slate-500 border-transparent'}`} onClick={() => setTab(id)}>{name}</button>)}
      </div>
      {tab === 'classes' ? <>
        {!detail.classes.length && <p className="bg-white border rounded-xl p-6 text-center text-slate-500">Chưa có lớp trong năm học này.</p>}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{detail.classes.map(cls => <article key={cls.id} className="bg-white border rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-start"><h3 className="font-bold text-lg">{cls.name}</h3></div>
          <p className="text-sm text-slate-500">{cls.name.includes('Mầm') || cls.ageGroup === '3-4' ? '3 - 4 tuổi (Mầm)' : cls.name.includes('Chồi') || cls.ageGroup === '4-5' ? '4 - 5 tuổi (Chồi)' : cls.name.includes('Lá') || cls.ageGroup === '5-6' ? '5 - 6 tuổi (Lá)' : 'Mẫu giáo'} · {cls.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</p>
          <p className="text-sm">Giáo viên: {cls.teacherName || 'Chưa phân công'}</p>
          <button className="text-teal-700 text-sm font-bold" onClick={() => { setClassFilter(String(cls.id)); setTab('students'); }}>{cls.studentCount} học sinh · Xem danh sách →</button>
        </article>)}</div>
      </> : <>
        <div className="flex gap-3 flex-wrap items-center">
          <label className="flex-1 min-w-48"><span className="sr-only">Tìm học sinh hoặc phụ huynh</span><input className={input} placeholder="Tìm học sinh, mã học sinh hoặc phụ huynh…" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <select className={`${input} !w-auto`} aria-label="Lọc lớp" value={classFilter} onChange={e => setClassFilter(e.target.value)}><option value="">Tất cả lớp</option>{detail.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select>
          {tab === 'students' && <button className={button} onClick={openAdd}><Plus className="w-4 h-4" /> Thêm học sinh</button>}
        </div>
        <div className="bg-white border rounded-2xl overflow-x-auto">
          {tab === 'students' ? <table className="w-full text-sm text-left"><thead className="bg-teal-600 text-white font-bold"><tr>{['Học sinh', 'Lớp', 'Trạng thái', 'Liên hệ phụ huynh', ''].map((h, i) => <th key={i} className="px-4 py-3 text-white">{h}</th>)}</tr></thead>
            <tbody>{visibleEnrollments.map(enrollment => <tr key={enrollment.id} className="border-t">
              <td className="px-4 py-4"><p className="font-bold">{enrollment.studentSnapshot.fullName}</p><p className="text-xs text-slate-500 mt-1">{enrollment.studentSnapshot.studentCode} · {dateText(enrollment.studentSnapshot.dateOfBirth)}</p></td>
              <td className="px-4 py-4">{enrollment.className}</td><td className="px-4 py-4">{labels[enrollment.status]}</td>
              <td className="px-4 py-4">{enrollment.parentContacts.length ? enrollment.parentContacts.map((parent, i) => <p key={i}>{parent.fullName} · {parent.phone || 'Chưa có số điện thoại'}{parent.isPrimary ? ' (chính)' : ''}</p>) : <span className="text-slate-400">Chưa có liên hệ</span>}</td>
              <td className="px-4 py-4"><div className="flex items-center gap-2"><Link to={`/children?search=${encodeURIComponent(enrollment.studentSnapshot.studentCode)}`} className="text-teal-700 font-semibold hover:underline">Hồ sơ học sinh</Link><span className="text-slate-300">·</span><button className="text-slate-500 hover:text-slate-700 font-semibold" onClick={() => editStudent(enrollment)}>Chỉnh sửa</button></div></td>
            </tr>)}{!visibleEnrollments.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có học sinh phù hợp.</td></tr>}</tbody></table>
          : <table className="w-full text-sm text-left"><thead className="bg-teal-600 text-white font-bold"><tr>{['Phụ huynh', 'Liên hệ', 'Học sinh / Lớp', ''].map((h, i) => <th key={i} className="px-4 py-3 text-white">{h}</th>)}</tr></thead><tbody>
            {parents.map(({ enrollment, parent, index }) => <tr key={`${enrollment.id}-${index}`} className="border-t"><td className="px-4 py-4"><p className="font-bold">{parent.fullName}</p><p className="text-xs text-slate-500">{relation[parent.relationship]}{parent.isPrimary ? ' · Liên hệ chính' : ''}</p></td>
              <td className="px-4 py-4">{parent.phone || 'Chưa có số điện thoại'}{parent.email && <p className="text-xs text-slate-500">{parent.email}</p>}</td>
              <td className="px-4 py-4">{enrollment.studentSnapshot.fullName}<p className="text-xs text-slate-500">{enrollment.className}</p></td><td className="px-4 py-4"><button className="text-teal-700 font-semibold" onClick={() => editStudent(enrollment)}>Chỉnh sửa</button></td></tr>)}
            {!parents.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Chưa có thông tin liên hệ phụ huynh.</td></tr>}
          </tbody></table>}
        </div>
      </>}
    </>}

    {yearForm && <Modal title={yearForm.id ? 'Cấu hình năm học' : 'Tạo năm học mới'} close={closeModals} busy={saving}>
      <form onSubmit={submitYear} className="p-5 space-y-4">{formError}
        <label className="block text-sm font-semibold">Tên năm học<input autoFocus required maxLength={20} className={`${input} mt-1`} value={yearForm.name} onChange={e => setYearForm({ ...yearForm, name: e.target.value })} placeholder="2027-2028" /></label>
        <div className="grid grid-cols-2 gap-4"><label className="text-sm font-semibold">Ngày bắt đầu<input type="date" required className={`${input} mt-1`} value={yearForm.startDate} onChange={e => setYearForm({ ...yearForm, startDate: e.target.value })} /></label>
          <label className="text-sm font-semibold">Ngày kết thúc<input type="date" required min={yearForm.startDate} className={`${input} mt-1`} value={yearForm.endDate} onChange={e => setYearForm({ ...yearForm, endDate: e.target.value })} /></label></div>
        {!yearForm.id && <label className="block text-sm font-semibold">Kế thừa dữ liệu từ năm học<select className={`${input} mt-1`} value={yearForm.sourceYearId} onChange={e => {
          const source = years.find(y => String(y.id) === e.target.value);
          const nextYear = source ? Number(source.endDate.slice(0, 4)) : null;
          setYearForm({ ...yearForm, sourceYearId: e.target.value, notes: source?.notes || '', ...(nextYear ? { name: `${nextYear}-${nextYear + 1}`, startDate: `${nextYear}-09-01`, endDate: `${nextYear + 1}-08-31` } : {}) });
        }}><option value="">Không kế thừa · Tạo danh sách trống</option>{years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select><span className="block text-xs text-slate-500 font-normal mt-2">Năm mới luôn tạo danh sách lớp và học sinh trống. Kế thừa chỉ giữ liên kết năm nguồn; tài khoản học sinh, phụ huynh và giáo viên cấp trường vẫn dùng chung.</span></label>}
        <label className="block text-sm font-semibold">Ghi chú cấu hình<textarea className={`${input} mt-1`} rows={3} maxLength={4000} value={yearForm.notes} onChange={e => setYearForm({ ...yearForm, notes: e.target.value })} /></label>
        <div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={closeModals}>Hủy</button><button className={primary} disabled={saving}><Save className="w-4 h-4" />{saving ? 'Đang lưu…' : 'Lưu năm học'}</button></div>
      </form>
    </Modal>}
    {classForm && detail && <Modal title={classForm.id ? 'Chỉnh sửa lớp học' : 'Thêm lớp học'} close={closeModals} busy={saving}>
      <form className="p-5 space-y-4" onSubmit={e => { e.preventDefault(); mutate(() => api.saveClass(detail.id, classForm.id || null, { name: classForm.name, ageGroup: classForm.ageGroup, status: classForm.status, homeroomTeacherId: classForm.homeroomTeacherId ? Number(classForm.homeroomTeacherId) : null }), 'Đã lưu lớp học.', closeModals); }}>{formError}
        <p className="text-sm text-slate-500">Năm học {detail.name}</p>
        <label className="block text-sm font-semibold">Tên lớp<input autoFocus required maxLength={50} className={`${input} mt-1`} value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} /></label>
        <label className="block text-sm font-semibold">Khối tuổi<select className={`${input} mt-1`} value={classForm.ageGroup} onChange={e => setClassForm({ ...classForm, ageGroup: e.target.value })}><option value="3-4">3 - 4 tuổi (Lớp Mầm)</option><option value="4-5">4 - 5 tuổi (Lớp Chồi)</option><option value="5-6">5 - 6 tuổi (Lớp Lá)</option></select></label>
        {teachersError && <p role="alert" className="text-sm text-rose-700">Không tải được giáo viên: {teachersError}</p>}
        <label className="block text-sm font-semibold">Giáo viên chủ nhiệm<select className={`${input} mt-1`} value={classForm.homeroomTeacherId} onChange={e => setClassForm({ ...classForm, homeroomTeacherId: e.target.value })}><option value="">Chưa phân công</option>{classForm.homeroomTeacherId && !teachers.some(t => String(t.id) === classForm.homeroomTeacherId) && <option value={classForm.homeroomTeacherId}>Giáo viên đang phân công</option>}{teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
        <label className="block text-sm font-semibold">Trạng thái<select className={`${input} mt-1`} value={classForm.status} onChange={e => setClassForm({ ...classForm, status: e.target.value })}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>
        <div className="flex justify-end"><button disabled={saving} className={primary}>{saving ? 'Đang lưu…' : 'Lưu lớp học'}</button></div>
      </form>
    </Modal>}
    {studentForm && detail && <Modal title="Hồ sơ học sinh & phụ huynh theo năm học" close={closeModals} busy={saving}>
      <form className="p-5 space-y-4" onSubmit={e => { e.preventDefault(); mutate(() => api.updateEnrollment(detail.id, studentForm.id, {
        classId: Number(studentForm.classId), status: studentForm.status, ...studentForm.studentSnapshot, parentContacts: studentForm.parentContacts, notes: studentForm.notes,
      }), 'Đã cập nhật hồ sơ của năm học đã chọn.', closeModals); }}>{formError}
        <p className="text-sm text-teal-800">{detail.name} · {studentForm.studentSnapshot.studentCode}</p>
        <label className="block text-sm font-semibold">Họ tên học sinh<input autoFocus required maxLength={150} className={`${input} mt-1`} value={studentForm.studentSnapshot.fullName} onChange={e => setStudentForm({ ...studentForm, studentSnapshot: { ...studentForm.studentSnapshot, fullName: e.target.value } })} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Ngày sinh<input type="date" required className={`${input} mt-1`} value={studentForm.studentSnapshot.dateOfBirth} onChange={e => setStudentForm({ ...studentForm, studentSnapshot: { ...studentForm.studentSnapshot, dateOfBirth: e.target.value } })} /></label>
          <label className="text-sm font-semibold">Giới tính<select className={`${input} mt-1`} value={studentForm.studentSnapshot.gender} onChange={e => setStudentForm({ ...studentForm, studentSnapshot: { ...studentForm.studentSnapshot, gender: e.target.value } })}><option value="MALE">Nam</option><option value="FEMALE">Nữ</option></select></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Lớp học<select className={`${input} mt-1`} value={studentForm.classId} onChange={e => setStudentForm({ ...studentForm, classId: e.target.value })}>{detail.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Trạng thái học sinh<select className={`${input} mt-1`} value={studentForm.status} onChange={e => setStudentForm({ ...studentForm, status: e.target.value })}>{['ENROLLED', 'LEFT', 'GRADUATED'].map(status => <option key={status} value={status}>{labels[status]}</option>)}</select></label></div>
        <div className="flex items-center justify-between"><h3 className="font-bold text-sm">Liên hệ phụ huynh của năm học</h3><button type="button" className="text-teal-700 text-sm font-semibold" disabled={studentForm.parentContacts.length >= 10} onClick={() => setStudentForm({ ...studentForm, parentContacts: [...studentForm.parentContacts, { fullName: '', phone: '', email: '', relationship: 'GUARDIAN', isPrimary: !studentForm.parentContacts.length }] })}>+ Thêm liên hệ</button></div>
        {studentForm.parentContacts.map((parent, i) => <fieldset key={i} className="border rounded-xl p-3 space-y-3"><legend className="text-sm font-semibold px-1">Phụ huynh {i + 1}</legend>
          <label className="block text-xs">Họ tên<input required maxLength={150} className={`${input} mt-1`} value={parent.fullName} onChange={e => setStudentForm({ ...studentForm, parentContacts: studentForm.parentContacts.map((p, j) => j === i ? { ...p, fullName: e.target.value } : p) })} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs">Điện thoại<input type="tel" maxLength={20} className={`${input} mt-1`} value={parent.phone} onChange={e => setStudentForm({ ...studentForm, parentContacts: studentForm.parentContacts.map((p, j) => j === i ? { ...p, phone: e.target.value } : p) })} /></label>
            <label className="text-xs">Quan hệ<select className={`${input} mt-1`} value={parent.relationship} onChange={e => setStudentForm({ ...studentForm, parentContacts: studentForm.parentContacts.map((p, j) => j === i ? { ...p, relationship: e.target.value } : p) })}>{Object.entries(relation).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
          <label className="block text-xs">Email<input type="email" maxLength={255} className={`${input} mt-1`} value={parent.email || ''} onChange={e => setStudentForm({ ...studentForm, parentContacts: studentForm.parentContacts.map((p, j) => j === i ? { ...p, email: e.target.value } : p) })} /></label>
          <div className="flex justify-between"><label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={parent.isPrimary} onChange={e => setStudentForm({ ...studentForm, parentContacts: studentForm.parentContacts.map((p, j) => ({ ...p, isPrimary: j === i ? e.target.checked : false })) })} />Liên hệ chính</label>
            <button type="button" className="text-rose-700 text-xs" onClick={() => setStudentForm({ ...studentForm, parentContacts: studentForm.parentContacts.filter((_, j) => j !== i) })}>Xóa liên hệ khỏi năm học</button></div>
        </fieldset>)}
        <label className="block text-sm font-semibold">Ghi chú<textarea className={`${input} mt-1`} maxLength={4000} value={studentForm.notes} onChange={e => setStudentForm({ ...studentForm, notes: e.target.value })} /></label>
        <div className="flex justify-end"><button disabled={saving} className={primary}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div>
      </form>
    </Modal>}
    {addForm && detail && <Modal title="Thêm học sinh vào năm học" close={closeModals} busy={saving}>
      <form className="p-5 space-y-4" onSubmit={e => { e.preventDefault(); mutate(() => addMode === 'existing'
        ? api.addEnrollment(detail.id, { studentId: Number(addForm.studentId), classId: Number(addForm.classId) })
        : api.createStudent(detail.id, { classId: Number(addForm.classId), studentCode: newStudent.studentCode || undefined,
          fullName: newStudent.fullName, dateOfBirth: newStudent.dateOfBirth, gender: newStudent.gender,
          parentContacts: [] }),
        'Đã thêm học sinh vào năm học.', closeModals); }}>{formError}
        <div className="flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="add-mode" checked={addMode === 'existing'} onChange={() => setAddMode('existing')} />Đã có hồ sơ</label>
          <label className="flex items-center gap-2"><input type="radio" name="add-mode" checked={addMode === 'new'} onChange={() => setAddMode('new')} />Học sinh mới</label></div>
        {addMode === 'existing' ? <label className="block text-sm font-semibold">Học sinh đã có hồ sơ<select required className={`${input} mt-1`} value={addForm.studentId} onChange={e => setAddForm({ ...addForm, studentId: e.target.value })}><option value="">Chọn học sinh</option>{availableStudents.map(s => <option key={s.id} value={s.id}>{s.fullName} · {s.studentCode}</option>)}</select></label>
        : <>
          <label className="block text-sm font-semibold">Họ tên học sinh<input required maxLength={150} className={`${input} mt-1`} value={newStudent.fullName} onChange={e => setNewStudent({ ...newStudent, fullName: e.target.value })} /></label>
          <label className="block text-sm font-semibold">Mã học sinh (để trống để tạo tự động)<input maxLength={50} className={`${input} mt-1`} value={newStudent.studentCode} onChange={e => setNewStudent({ ...newStudent, studentCode: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Ngày sinh<input type="date" required className={`${input} mt-1`} value={newStudent.dateOfBirth} onChange={e => setNewStudent({ ...newStudent, dateOfBirth: e.target.value })} /></label>
            <label className="text-sm font-semibold">Giới tính<select className={`${input} mt-1`} value={newStudent.gender} onChange={e => setNewStudent({ ...newStudent, gender: e.target.value })}><option value="MALE">Nam</option><option value="FEMALE">Nữ</option></select></label></div>
        </>}
        <label className="block text-sm font-semibold">Lớp học<select required className={`${input} mt-1`} value={addForm.classId} onChange={e => setAddForm({ ...addForm, classId: e.target.value })}><option value="">Chọn lớp</option>{detail.classes.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="flex justify-end"><button disabled={saving || (addMode === 'existing' && !availableStudents.length)} className={primary}>{saving ? 'Đang lưu…' : 'Thêm học sinh'}</button></div>
      </form>
    </Modal>}
    {confirmAction && detail && <Modal title={confirmAction === 'activate' ? 'Áp dụng năm học' : 'Kết thúc năm học'} close={closeModals} busy={saving}>
      <div className="p-5 space-y-4">{formError}<p className="text-sm">{confirmAction === 'activate'
        ? `Áp dụng ${detail.name} với ${detail.classes.length} lớp và ${studentCount} học sinh? Danh sách lớp hiện tại sẽ chuyển sang năm học này.`
        : `Kết thúc ${detail.name}? Dữ liệu được giữ lại để tra cứu, chỉnh sửa cấu hình và kế thừa sang năm mới.`}</p>
        <div className="flex justify-end gap-2"><button className={button} disabled={saving} onClick={closeModals}>Hủy</button><button className={primary} disabled={saving} onClick={() => mutate(() => confirmAction === 'activate' ? api.activate(detail.id) : api.complete(detail.id), confirmAction === 'activate' ? 'Đã áp dụng năm học.' : 'Đã kết thúc năm học. Bạn có thể kế thừa dữ liệu sang năm mới.', closeModals)}>{saving ? 'Đang xử lý…' : 'Xác nhận'}</button></div>
      </div>
    </Modal>}
  </div>;
};
