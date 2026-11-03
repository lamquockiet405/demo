import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Baby, CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardList, Edit2, Info, Loader2, Pause, Plus, RotateCcw, Search, ShieldAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { childrenApi, AllergenCatalogItem, ChildItem, ChildAllergyItem, DeclareAllergyDto } from '../api/children.api';
import { ParentPortalTopNav } from '../../parent-evaluations/components/ParentPortalTopNav';
import { useAuthStore } from '../../../core/stores/auth.store';
import { notifyAllergyChange } from '../../../core/events/allergies';

type Severity = DeclareAllergyDto['severity'];
const severityOptions: { value: Severity; label: string; className: string }[] = [
  { value: 'MILD', label: 'Nhẹ', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  { value: 'MODERATE', label: 'Trung bình', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  { value: 'SEVERE', label: 'Nặng', className: 'border-rose-200 bg-rose-50 text-rose-800' },
  { value: 'ANAPHYLACTIC', label: 'Tiền sử sốc phản vệ', className: 'border-purple-200 bg-purple-50 text-purple-800' },
];
const types = [
  { value: 'ALLERGY', label: 'Dị ứng thực phẩm' },
  { value: 'INTOLERANCE', label: 'Bất dung nạp' },
  { value: 'RELIGIOUS_RESTRICTION', label: 'Kiêng theo gia đình / tôn giáo' },
  { value: 'MEDICAL_RESTRICTION', label: 'Kiêng theo chỉ định y tế' },
];
const normalizeSeverity = (value: string): Severity => ({ LOW: 'MILD', MEDIUM: 'MODERATE', HIGH: 'SEVERE' }[value] as Severity) || value as Severity;
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa ghi nhận';
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50';

interface AllergyForm {
  mode: 'catalog' | 'custom';
  allergenId: string;
  customName: string;
  allergyType: string;
  severity: Severity | '';
  symptoms: string;
  reactionTreatment: string;
  diagnosedDate: string;
  note: string;
}
const emptyForm = (): AllergyForm => ({ mode: 'catalog', allergenId: '', customName: '', allergyType: 'ALLERGY', severity: '', symptoms: '', reactionTreatment: '', diagnosedDate: '', note: '' });

export const ParentAllergyDeclarationPage: React.FC = () => {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [catalogs, setCatalogs] = useState<AllergenCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [child, setChild] = useState<ChildItem | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [childLoading, setChildLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChildAllergyItem | null>(null);
  const [form, setForm] = useState<AllergyForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const requestVersion = useRef(0);

  const loadChildren = useCallback(async () => {
    setInitialLoading(true);
    setError('');
    try {
      const [list, items] = await Promise.all([childrenApi.getChildren({ limit: 200 }), childrenApi.getAllergenCatalogs()]);
      const rows = Array.isArray(list) ? list : list.items || [];
      setChildren(rows);
      setCatalogs(items);
      setSelectedId(current => rows.some(item => item.id === current) ? current : rows[0]?.id || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Chưa tải được hồ sơ. Vui lòng thử lại.');
    } finally { setInitialLoading(false); }
  }, []);

  const loadChild = useCallback(async (id: string) => {
    const version = ++requestVersion.current;
    setChildLoading(true);
    setError('');
    try {
      const result = await childrenApi.getChild(id);
      if (version === requestVersion.current) setChild(result);
    } catch (err: any) {
      if (version === requestVersion.current) { setChild(null); setError(err.response?.data?.message || 'Không tải được thông tin dị ứng của bé.'); }
    } finally { if (version === requestVersion.current) setChildLoading(false); }
  }, []);

  useEffect(() => { void loadChildren(); }, [loadChildren]);
  useEffect(() => {
    setChild(null);
    setSearch('');
    if (selectedId) void loadChild(selectedId);
    return () => { requestVersion.current++; };
  }, [selectedId, loadChild]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (modalOpen && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!modalOpen && dialog.current?.open) dialog.current.close();
  }, [modalOpen]);

  const allergies = child?.allergies || [];
  const active = allergies.filter(item => item.isActive !== false);
  const inactive = allergies.filter(item => item.isActive === false);
  const severeCount = active.filter(item => ['SEVERE', 'ANAPHYLACTIC'].includes(normalizeSeverity(item.severity))).length;
  const declaredDates = allergies.map(item => item.declaredAt).filter(Boolean).sort();
  const lastDeclared = declaredDates[declaredDates.length - 1];
  const shown = useMemo(() => (filter === 'active' ? active : inactive).filter(item =>
    `${item.allergen?.nameVi || ''} ${item.customAllergenName || ''} ${item.symptoms || ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  ), [allergies, filter, search]);

  const openForm = (item?: ChildAllergyItem) => {
    setEditing(item || null);
    setForm(item ? {
      mode: item.allergenId ? 'catalog' : 'custom', allergenId: item.allergenId || '', customName: item.customAllergenName || '',
      allergyType: item.allergyType || 'ALLERGY', severity: normalizeSeverity(item.severity), symptoms: item.symptoms || '',
      reactionTreatment: item.reactionTreatment || '', diagnosedDate: item.diagnosedDate || '', note: item.note || '',
    } : emptyForm());
    setFormError('');
    setModalOpen(true);
  };
  const updateForm = <K extends keyof AllergyForm>(key: K, value: AllergyForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const closeForm = () => { if (!submitting) setModalOpen(false); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!child || submitting) return;
    if (form.mode === 'catalog' ? !form.allergenId : !form.customName.trim()) { setFormError('Vui lòng chọn dị nguyên hoặc nhập tên thực phẩm cần tránh.'); return; }
    if (!form.severity) { setFormError('Vui lòng chọn mức độ theo thông tin của bé.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload: DeclareAllergyDto = {
        allergenId: form.mode === 'catalog' ? form.allergenId : null,
        customAllergenName: form.mode === 'custom' ? form.customName.trim() : '', allergyType: form.allergyType,
        severity: form.severity, symptoms: form.symptoms.trim(), reactionTreatment: form.reactionTreatment.trim(),
        diagnosedDate: form.diagnosedDate || undefined, note: form.note.trim(),
      };
      if (editing) await childrenApi.updateAllergy(editing.id, { ...payload, diagnosedDate: form.diagnosedDate || null });
      else await childrenApi.declareAllergy(child.id, payload);
      notifyAllergyChange();
      setModalOpen(false);
      setToast(editing ? 'Đã lưu thay đổi hồ sơ dị ứng.' : 'Đã thêm dị ứng vào hồ sơ của bé.');
      await loadChild(child.id);
    } catch (err: any) {
      const message = err.response?.data?.message;
      setFormError(Array.isArray(message) ? message.join('. ') : message || 'Chưa lưu được khai báo. Vui lòng thử lại.');
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (item: ChildAllergyItem) => {
    if (busyId || !child) return;
    if (item.isActive !== false && !window.confirm(`Ngưng áp dụng "${item.allergen?.nameVi || item.customAllergenName}"? Thông tin vẫn được giữ trong hồ sơ.`)) return;
    setBusyId(item.id);
    try {
      if (item.isActive === false) await childrenApi.updateAllergy(item.id, { isActive: true });
      else await childrenApi.deactivateAllergy(item.id);
      notifyAllergyChange();
      await loadChild(child.id);
      setToast(item.isActive === false ? 'Đã áp dụng lại thông tin dị ứng.' : 'Đã ngưng áp dụng. Hồ sơ vẫn được lưu lại.');
    } catch (err: any) { setError(err.response?.data?.message || 'Không cập nhật được trạng thái.'); }
    finally { setBusyId(''); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <ParentPortalTopNav child={child ? { name: child.fullName, className: child.className || child.class?.name } : undefined} activeTab="allergies" />
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
          <Link to="/child-menu-consumption" className="inline-flex items-center gap-1 hover:text-teal-700"><ArrowLeft className="h-3.5 w-3.5" /> Cổng phụ huynh</Link>
          <ChevronRight className="h-3 w-3" /><span>Dị ứng & kiêng cữ</span>
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dị ứng & kiêng cữ</h1><p className="mt-2 text-sm text-slate-500">Cập nhật thực phẩm cần tránh và thông tin của bé cho nhà trường.</p></div>
          <button type="button" onClick={() => openForm()} disabled={!child || initialLoading || childLoading} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Thêm dị ứng</button>
        </div>

        {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" className="shrink-0 font-semibold underline" onClick={() => selectedId ? loadChild(selectedId) : loadChildren()}>Thử lại</button></div>}

        <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Baby className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <label htmlFor="allergy-child" className="mb-1 block text-xs font-medium text-slate-500">Hồ sơ học sinh</label>
            <select id="allergy-child" aria-label="Chọn học sinh" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={initialLoading || !children.length} className="max-w-full bg-transparent pr-7 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-200">
              {!children.length && <option value="">{initialLoading ? 'Đang tải hồ sơ…' : 'Chưa có học sinh được liên kết'}</option>}
              {children.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.className ? ` · ${item.className}` : ''}</option>)}
            </select>
          </div>
          {child && <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600">Mã: <strong>{child.studentCode}</strong></span>{child.dateOfBirth && <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600">Ngày sinh: {dateLabel(child.dateOfBirth)}</span>}</div>}
        </section>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Đang áp dụng', value: `${active.length} thực phẩm`, icon: ShieldAlert, color: 'bg-teal-50 text-teal-700' },
            { label: 'Mức độ nặng / tiền sử sốc phản vệ', value: `${severeCount} ghi nhận`, icon: AlertCircle, color: 'bg-rose-50 text-rose-700' },
            { label: 'Khai báo gần nhất', value: dateLabel(lastDeclared), icon: CalendarDays, color: 'bg-slate-100 text-slate-600' },
          ].map(item => <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}><item.icon className="h-5 w-5" /></div><div><p className="text-xs text-slate-500">{item.label}</p><p className="mt-1 text-base font-bold text-slate-900">{initialLoading || childLoading ? '—' : item.value}</p></div></div>)}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Trạng thái hồ sơ">
                {[{ value: 'active', label: 'Đang áp dụng', count: active.length }, { value: 'inactive', label: 'Đã ngưng', count: inactive.length }].map(tab => <button key={tab.value} type="button" role="tab" aria-selected={filter === tab.value} onClick={() => setFilter(tab.value as typeof filter)} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${filter === tab.value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab.label} <span className="ml-1 opacity-60">{tab.count}</span></button>)}
              </div>
              <div className="relative min-w-0 flex-1 sm:max-w-60"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Tìm thực phẩm dị ứng" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm thực phẩm…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></div>
            </div>
            {initialLoading || childLoading ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /> Đang tải hồ sơ của bé…</div> : !child ? <div className="px-6 py-14 text-center"><Baby className="mx-auto mb-4 h-9 w-9 text-slate-300" /><h2 className="font-semibold text-slate-800">Chưa có hồ sơ học sinh</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Nhà trường cần liên kết tài khoản với hồ sơ học sinh trước khi khai báo dị ứng.</p></div> : !shown.length ? <div className="px-6 py-14 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50"><ClipboardList className="h-7 w-7 text-teal-600" /></div><h2 className="text-base font-semibold text-slate-900">{search ? 'Không tìm thấy thực phẩm phù hợp' : filter === 'inactive' ? 'Chưa có khai báo ngưng áp dụng' : 'Chưa có khai báo dị ứng'}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{search ? 'Thử tìm bằng tên thực phẩm hoặc triệu chứng khác.' : filter === 'inactive' ? 'Các khai báo ngưng áp dụng sẽ được giữ lại tại đây.' : 'Thêm thông tin thực phẩm bé cần tránh để nhà trường theo dõi trong hồ sơ.'}</p>{filter === 'active' && !search && <button type="button" onClick={() => openForm()} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-100"><Plus className="h-4 w-4" /> Khai báo đầu tiên</button>}</div> : <div className="divide-y divide-slate-100">
              {shown.map(item => {
                const severity = severityOptions.find(option => option.value === normalizeSeverity(item.severity));
                return <article key={item.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-xs text-slate-500">{types.find(type => type.value === item.allergyType)?.label || 'Dị ứng / kiêng cữ'}</p><h3 className="break-words text-lg font-bold text-slate-900">{item.allergen?.nameVi || item.customAllergenName || 'Thực phẩm cần tránh'}</h3></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severity?.className || 'border-slate-200 bg-slate-50 text-slate-700'}`}>{severity?.label || item.severity}</span></div>
                  <dl className="mt-4 space-y-2 text-sm">{item.symptoms && <div><dt className="mb-1 text-xs font-medium text-slate-500">Triệu chứng ghi nhận</dt><dd className="whitespace-pre-wrap break-words leading-6">{item.symptoms}</dd></div>}{item.reactionTreatment && <div><dt className="mb-1 text-xs font-medium text-slate-500">Hướng dẫn đã được cung cấp</dt><dd className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 leading-6">{item.reactionTreatment}</dd></div>}{item.note && item.note !== item.symptoms && <div><dt className="mb-1 text-xs font-medium text-slate-500">Ghi chú</dt><dd className="whitespace-pre-wrap break-words leading-6">{item.note}</dd></div>}</dl>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Khai báo: {dateLabel(item.declaredAt)}{item.diagnosedDate ? ` · Phát hiện: ${dateLabel(item.diagnosedDate)}` : ''}</p><div className="flex gap-3"><button type="button" disabled={!!busyId} onClick={() => openForm(item)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"><Edit2 className="h-3.5 w-3.5" /> Chỉnh sửa</button><button type="button" disabled={!!busyId} onClick={() => toggleActive(item)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50">{busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.isActive === false ? <RotateCcw className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{item.isActive === false ? 'Áp dụng lại' : 'Ngưng áp dụng'}</button></div></div>
                </article>;
              })}
            </div>}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="h-4 w-4 text-teal-600" /> Thông tin hồ sơ</h2><dl className="space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Học sinh</dt><dd className="mt-1 font-medium">{child?.fullName || 'Chưa chọn học sinh'}</dd></div><div><dt className="text-xs text-slate-500">Lớp</dt><dd className="mt-1">{child?.className || child?.class?.name || 'Chưa ghi nhận'}</dd></div><div className="border-t border-slate-100 pt-3"><dt className="text-xs text-slate-500">Tài khoản cập nhật</dt><dd className="mt-1 font-medium">{user?.fullName || 'Chưa có thông tin'}</dd></div>{user?.phone && <div><dt className="text-xs text-slate-500">Số điện thoại tài khoản</dt><dd className="mt-1">{user.phone}</dd></div>}</dl></section>
            <section className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-teal-900"><Info className="h-4 w-4" /> Khi cập nhật hồ sơ</h2><ul className="mt-3 space-y-3 text-sm leading-6 text-teal-900/80"><li>Chọn đúng bé và thực phẩm cần tránh.</li><li>Ghi lại triệu chứng thực tế và hướng dẫn của bác sĩ hoặc y tế trường nếu đã được cung cấp.</li><li>Cập nhật khi thông tin thay đổi. Các khai báo ngưng áp dụng vẫn được giữ trong hồ sơ.</li></ul></section>
          </aside>
        </div>
      </main>

      {toast && <div role="status" className="fixed bottom-20 left-1/2 z-40 flex w-[92vw] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm text-teal-900 shadow-lg"><CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" /><span className="flex-1">{toast}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setToast('')}><X className="h-4 w-4" /></button></div>}

      <dialog ref={dialog} aria-labelledby="allergy-dialog-title" onCancel={event => { event.preventDefault(); closeForm(); }} onClose={() => setModalOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeForm(); }} className="m-auto w-[94vw] max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm">
        <form onSubmit={save} className="flex max-h-[90dvh] flex-col">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-700">Hồ sơ dị ứng</p><h2 id="allergy-dialog-title" className="text-xl font-bold text-slate-900">{editing ? 'Chỉnh sửa khai báo' : 'Thêm dị ứng / kiêng cữ'}</h2><p className="mt-1 text-sm text-slate-500">{child?.fullName}{child?.className ? ` · ${child.className}` : ''}</p></div><button type="button" aria-label="Đóng biểu mẫu" disabled={submitting} onClick={closeForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></header>
          <div className="space-y-5 overflow-y-auto p-6">
            {formError && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{formError}</div>}
            <div><label htmlFor="allergy-type" className="mb-2 block text-sm font-semibold">Loại ghi nhận <span className="text-rose-500">*</span></label><select id="allergy-type" value={form.allergyType} onChange={event => updateForm('allergyType', event.target.value)} className={inputClass} disabled={submitting}>{types.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
            <fieldset><legend className="mb-2 text-sm font-semibold">Thực phẩm cần tránh <span className="text-rose-500">*</span></legend><div className="mb-3 inline-flex rounded-lg bg-slate-100 p-1">{[{ value: 'catalog', label: 'Chọn từ danh mục' }, { value: 'custom', label: 'Nhập thực phẩm khác' }].map(mode => <button key={mode.value} type="button" onClick={() => updateForm('mode', mode.value as AllergyForm['mode'])} disabled={submitting} className={`rounded-md px-3 py-2 text-xs font-semibold ${form.mode === mode.value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}>{mode.label}</button>)}</div>{form.mode === 'catalog' ? <select aria-label="Dị nguyên trong danh mục" value={form.allergenId} onChange={event => updateForm('allergenId', event.target.value)} required disabled={submitting} className={inputClass}><option value="">Chọn thực phẩm / nhóm dị nguyên</option>{catalogs.map(item => <option key={item.id} value={item.id}>{item.nameVi}</option>)}</select> : <input aria-label="Tên thực phẩm khác" value={form.customName} onChange={event => updateForm('customName', event.target.value)} required maxLength={150} disabled={submitting} className={inputClass} placeholder="Nhập tên thực phẩm bé cần tránh" />}</fieldset>
            <fieldset><legend className="mb-2 text-sm font-semibold">Mức độ ghi nhận <span className="text-rose-500">*</span></legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{severityOptions.map(option => <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${form.severity === option.value ? `${option.className} ring-1 ring-current` : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><input type="radio" name="severity" value={option.value} checked={form.severity === option.value} onChange={() => updateForm('severity', option.value)} required disabled={submitting} className="accent-teal-700" />{option.label}</label>)}</div></fieldset>
            <div><label htmlFor="allergy-symptoms" className="mb-2 block text-sm font-semibold">Triệu chứng đã ghi nhận <span className="font-normal text-slate-400">(không bắt buộc)</span></label><textarea id="allergy-symptoms" rows={2} value={form.symptoms} onChange={event => updateForm('symptoms', event.target.value)} disabled={submitting} className={inputClass} placeholder="Mô tả triệu chứng thực tế của bé" /></div>
            <div><label htmlFor="allergy-treatment" className="mb-2 block text-sm font-semibold">Hướng dẫn từ bác sĩ / y tế trường <span className="font-normal text-slate-400">(nếu có)</span></label><textarea id="allergy-treatment" rows={2} value={form.reactionTreatment} onChange={event => updateForm('reactionTreatment', event.target.value)} disabled={submitting} className={inputClass} placeholder="Nhập hướng dẫn đã được cung cấp cho bé" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="allergy-date" className="mb-2 block text-sm font-semibold">Ngày phát hiện / chẩn đoán</label><input id="allergy-date" type="date" value={form.diagnosedDate} onChange={event => updateForm('diagnosedDate', event.target.value)} disabled={submitting} className={inputClass} /></div><div><label htmlFor="allergy-note" className="mb-2 block text-sm font-semibold">Ghi chú thêm</label><input id="allergy-note" value={form.note} onChange={event => updateForm('note', event.target.value)} disabled={submitting} className={inputClass} placeholder="Thông tin khác cần lưu ý" /></div></div>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><p className="hidden text-xs text-slate-400 sm:block"><span className="text-rose-500">*</span> Thông tin bắt buộc</p><div className="ml-auto flex gap-2"><button type="button" disabled={submitting} onClick={closeForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Hủy</button><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu khai báo'}</button></div></footer>
        </form>
      </dialog>
    </div>
  );
};
