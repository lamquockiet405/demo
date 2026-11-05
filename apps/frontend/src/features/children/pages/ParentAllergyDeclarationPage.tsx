import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Baby,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Edit2,
  Heart,
  Info,
  Loader2,
  Pause,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  childrenApi,
  AllergenCatalogItem,
  ChildItem,
  ChildAllergyItem,
  DeclareAllergyDto,
  NutritionProfileDto,
} from '../api/children.api';
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
const normalizeSeverity = (value: string): Severity =>
  ({ LOW: 'MILD', MEDIUM: 'MODERATE', HIGH: 'SEVERE' }[value] as Severity) || (value as Severity);
const dateLabel = (value?: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa ghi nhận');
const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50';

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
const emptyForm = (): AllergyForm => ({
  mode: 'catalog',
  allergenId: '',
  customName: '',
  allergyType: 'ALLERGY',
  severity: '',
  symptoms: '',
  reactionTreatment: '',
  diagnosedDate: '',
  note: '',
});

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

  // Page Subtab: 'allergies' vs 'nutrition' (STT 29)
  const [pageTab, setPageTab] = useState<'allergies' | 'nutrition'>('allergies');

  // STT 29: Child Nutrition Profile State
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfileDto>({
    dietaryRegime: 'TIÊU CHUẨN',
    dietaryNotes: '',
    eatingHabits: '',
    nutritionGoals: '',
    targetEnergyKcal: 1200,
  });
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionSaving, setNutritionSaving] = useState(false);

  // Allergies sub-filters
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
      const [list, items] = await Promise.all([
        childrenApi.getChildren({ limit: 200 }),
        childrenApi.getAllergenCatalogs(),
      ]);
      const rows = Array.isArray(list) ? list : list.items || [];
      setChildren(rows);
      setCatalogs(items);
      setSelectedId((current) => (rows.some((item) => item.id === current) ? current : rows[0]?.id || ''));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Chưa tải được hồ sơ. Vui lòng thử lại.');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const loadNutrition = useCallback(async (id: string) => {
    setNutritionLoading(true);
    try {
      const res = await childrenApi.getNutritionProfile(id);
      if (res?.profile) {
        setNutritionProfile({
          dietaryRegime: res.profile.dietaryRegime || 'TIÊU CHUẨN',
          dietaryNotes: res.profile.dietaryNotes || '',
          eatingHabits: res.profile.eatingHabits || '',
          nutritionGoals: res.profile.nutritionGoals || '',
          targetEnergyKcal: res.profile.targetEnergyKcal ?? 1200,
          updatedAt: res.profile.updatedAt,
        });
      } else {
        setNutritionProfile({
          dietaryRegime: 'TIÊU CHUẨN',
          dietaryNotes: '',
          eatingHabits: '',
          nutritionGoals: '',
          targetEnergyKcal: 1200,
        });
      }
    } catch (err) {
      console.warn('Could not load nutrition profile', err);
    } finally {
      setNutritionLoading(false);
    }
  }, []);

  const loadChild = useCallback(
    async (id: string) => {
      const version = ++requestVersion.current;
      setChildLoading(true);
      setError('');
      try {
        const [result] = await Promise.all([childrenApi.getChild(id), loadNutrition(id)]);
        if (version === requestVersion.current) setChild(result);
      } catch (err: any) {
        if (version === requestVersion.current) {
          setChild(null);
          setError(err.response?.data?.message || 'Không tải được thông tin dị ứng của bé.');
        }
      } finally {
        if (version === requestVersion.current) setChildLoading(false);
      }
    },
    [loadNutrition],
  );

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    setChild(null);
    setSearch('');
    if (selectedId) void loadChild(selectedId);
    return () => {
      requestVersion.current++;
    };
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
  const active = allergies.filter((item) => item.isActive !== false);
  const inactive = allergies.filter((item) => item.isActive === false);
  const severeCount = active.filter((item) =>
    ['SEVERE', 'ANAPHYLACTIC'].includes(normalizeSeverity(item.severity)),
  ).length;
  const declaredDates = allergies
    .map((item) => item.declaredAt)
    .filter(Boolean)
    .sort();
  const lastDeclared = declaredDates[declaredDates.length - 1];
  const shown = useMemo(
    () =>
      (filter === 'active' ? active : inactive).filter((item) =>
        `${item.allergen?.nameVi || ''} ${item.customAllergenName || ''} ${item.symptoms || ''}`
          .toLocaleLowerCase('vi')
          .includes(search.trim().toLocaleLowerCase('vi')),
      ),
    [allergies, filter, search],
  );

  const openForm = (item?: ChildAllergyItem) => {
    setEditing(item || null);
    setForm(
      item
        ? {
            mode: item.allergenId ? 'catalog' : 'custom',
            allergenId: item.allergenId || '',
            customName: item.customAllergenName || '',
            allergyType: item.allergyType || 'ALLERGY',
            severity: normalizeSeverity(item.severity),
            symptoms: item.symptoms || '',
            reactionTreatment: item.reactionTreatment || '',
            diagnosedDate: item.diagnosedDate || '',
            note: item.note || '',
          }
        : emptyForm(),
    );
    setFormError('');
    setModalOpen(true);
  };

  const updateForm = <K extends keyof AllergyForm>(key: K, value: AllergyForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const closeForm = () => {
    if (!submitting) setModalOpen(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!child || submitting) return;
    if (form.mode === 'catalog' ? !form.allergenId : !form.customName.trim()) {
      setFormError('Vui lòng chọn dị nguyên hoặc nhập tên thực phẩm cần tránh.');
      return;
    }
    if (!form.severity) {
      setFormError('Vui lòng chọn mức độ theo thông tin của bé.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const payload: DeclareAllergyDto = {
        allergenId: form.mode === 'catalog' ? form.allergenId : null,
        customAllergenName: form.mode === 'custom' ? form.customName.trim() : '',
        allergyType: form.allergyType,
        severity: form.severity,
        symptoms: form.symptoms.trim(),
        reactionTreatment: form.reactionTreatment.trim(),
        diagnosedDate: form.diagnosedDate || undefined,
        note: form.note.trim(),
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
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (item: ChildAllergyItem) => {
    if (busyId || !child) return;
    if (
      item.isActive !== false &&
      !window.confirm(
        `Ngưng áp dụng "${item.allergen?.nameVi || item.customAllergenName}"? Thông tin vẫn được giữ trong hồ sơ.`,
      )
    )
      return;
    setBusyId(item.id);
    try {
      if (item.isActive === false) await childrenApi.updateAllergy(item.id, { isActive: true });
      else await childrenApi.deactivateAllergy(item.id);
      notifyAllergyChange();
      await loadChild(child.id);
      setToast(item.isActive === false ? 'Đã áp dụng lại thông tin dị ứng.' : 'Đã ngưng áp dụng. Hồ sơ vẫn được lưu lại.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không cập nhật được trạng thái.');
    } finally {
      setBusyId('');
    }
  };

  const handleSaveNutrition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!child || nutritionSaving) return;
    setNutritionSaving(true);
    try {
      const res = await childrenApi.updateNutritionProfile(child.id, nutritionProfile);
      if (res?.profile) {
        setNutritionProfile(res.profile);
      }
      setToast('Đã lưu hồ sơ dinh dưỡng & thói quen của bé thành công!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ dinh dưỡng. Vui lòng thử lại.');
    } finally {
      setNutritionSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <ParentPortalTopNav
        child={child ? { name: child.fullName, className: child.className || child.class?.name } : undefined}
        activeTab="allergies"
      />
      <main className="w-full px-4 pb-28 pt-7 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
          <Link to="/child-menu-consumption" className="inline-flex items-center gap-1 hover:text-teal-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Cổng phụ huynh
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>Dị ứng & Dinh dưỡng của bé</span>
        </div>

        {/* Child Selector Strip */}
        <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Baby className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="allergy-child" className="mb-1 block text-xs font-medium text-slate-500">
              Chọn hồ sơ học sinh
            </label>
            <select
              id="allergy-child"
              aria-label="Chọn học sinh"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={initialLoading || !children.length}
              className="max-w-full bg-transparent pr-7 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-200"
            >
              {!children.length && (
                <option value="">{initialLoading ? 'Đang tải hồ sơ…' : 'Chưa có học sinh được liên kết'}</option>
              )}
              {children.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                  {item.className ? ` · ${item.className}` : ''}
                </option>
              ))}
            </select>
          </div>
          {child && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600">
                Mã: <strong>{child.studentCode}</strong>
              </span>
              {child.dateOfBirth && (
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600">
                  Ngày sinh: {dateLabel(child.dateOfBirth)}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Tab Switcher: Allergies (Dị ứng & Kiêng cữ) vs Nutrition Profile (STT 29) */}
        <div className="mb-6 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setPageTab('allergies')}
            className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-bold transition-all ${
              pageTab === 'allergies'
                ? 'border-teal-600 text-teal-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            1. Dị ứng & Thực phẩm cần tránh
            {active.length > 0 && (
              <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                {active.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPageTab('nutrition')}
            className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-bold transition-all ${
              pageTab === 'nutrition'
                ? 'border-teal-600 text-teal-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Utensils className="h-4 w-4" />
            2. Hồ sơ Dinh dưỡng & Thói quen ăn uống (STT 29)
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              className="shrink-0 font-semibold underline"
              onClick={() => (selectedId ? loadChild(selectedId) : loadChildren())}
            >
              Thử lại
            </button>
          </div>
        )}

        {/* ─── TAB 1: DỊ ỨNG & THỰC PHẨM CẦN TRÁNH ─── */}
        {pageTab === 'allergies' && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dị ứng & Kiêng cữ thực phẩm</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Cập nhật danh sách thực phẩm dị ứng hoặc kiêng theo tôn giáo/y tế để nhà trường tự động thay thế món
                  an toàn cho bé.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openForm()}
                disabled={!child || initialLoading || childLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Thêm dị ứng
              </button>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Đang áp dụng', value: `${active.length} thực phẩm`, icon: ShieldAlert, color: 'bg-teal-50 text-teal-700' },
                {
                  label: 'Mức độ nặng / tiền sử sốc phản vệ',
                  value: `${severeCount} ghi nhận`,
                  icon: AlertCircle,
                  color: 'bg-rose-50 text-rose-700',
                },
                { label: 'Khai báo gần nhất', value: dateLabel(lastDeclared), icon: CalendarDays, color: 'bg-slate-100 text-slate-600' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {initialLoading || childLoading ? '—' : item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
                  <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Trạng thái hồ sơ">
                    {[
                      { value: 'active', label: 'Đang áp dụng', count: active.length },
                      { value: 'inactive', label: 'Đã ngưng', count: inactive.length },
                    ].map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={filter === tab.value}
                        onClick={() => setFilter(tab.value as typeof filter)}
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                          filter === tab.value
                            ? 'bg-white text-teal-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab.label} <span className="ml-1 opacity-60">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative min-w-0 flex-1 sm:max-w-60">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      aria-label="Tìm thực phẩm dị ứng"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tìm thực phẩm…"
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>
                </div>
                {initialLoading || childLoading ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-teal-600" /> Đang tải hồ sơ của bé…
                  </div>
                ) : !child ? (
                  <div className="px-6 py-14 text-center">
                    <Baby className="mx-auto mb-4 h-9 w-9 text-slate-300" />
                    <h2 className="font-semibold text-slate-800">Chưa có hồ sơ học sinh</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Nhà trường cần liên kết tài khoản với hồ sơ học sinh trước khi khai báo dị ứng.
                    </p>
                  </div>
                ) : !shown.length ? (
                  <div className="px-6 py-14 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50">
                      <ClipboardList className="h-7 w-7 text-teal-600" />
                    </div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {search
                        ? 'Không tìm thấy thực phẩm phù hợp'
                        : filter === 'inactive'
                        ? 'Chưa có khai báo ngưng áp dụng'
                        : 'Chưa có khai báo dị ứng'}
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      {search
                        ? 'Thử tìm bằng tên thực phẩm hoặc triệu chứng khác.'
                        : filter === 'inactive'
                        ? 'Các khai báo ngưng áp dụng sẽ được giữ lại tại đây.'
                        : 'Thêm thông tin thực phẩm bé cần tránh để nhà trường theo dõi trong hồ sơ.'}
                    </p>
                    {filter === 'active' && !search && (
                      <button
                        type="button"
                        onClick={() => openForm()}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                      >
                        <Plus className="h-4 w-4" /> Khai báo đầu tiên
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {shown.map((item) => {
                      const severity = severityOptions.find(
                        (option) => option.value === normalizeSeverity(item.severity),
                      );
                      return (
                        <article key={item.id} className="p-5 sm:p-6">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="mb-1 text-xs text-slate-500">
                                {types.find((type) => type.value === item.allergyType)?.label || 'Dị ứng / kiêng cữ'}
                              </p>
                              <h3 className="break-words text-lg font-bold text-slate-900">
                                {item.allergen?.nameVi || item.customAllergenName || 'Thực phẩm cần tránh'}
                              </h3>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                severity?.className || 'border-slate-200 bg-slate-50 text-slate-700'
                              }`}
                            >
                              {severity?.label || item.severity}
                            </span>
                          </div>
                          <dl className="mt-4 space-y-2 text-sm">
                            {item.symptoms && (
                              <div>
                                <dt className="mb-1 text-xs font-medium text-slate-500">Triệu chứng ghi nhận</dt>
                                <dd className="whitespace-pre-wrap break-words leading-6">{item.symptoms}</dd>
                              </div>
                            )}
                            {item.reactionTreatment && (
                              <div>
                                <dt className="mb-1 text-xs font-medium text-slate-500">Hướng dẫn đã được cung cấp</dt>
                                <dd className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 leading-6">
                                  {item.reactionTreatment}
                                </dd>
                              </div>
                            )}
                            {item.note && item.note !== item.symptoms && (
                              <div>
                                <dt className="mb-1 text-xs font-medium text-slate-500">Ghi chú</dt>
                                <dd className="whitespace-pre-wrap break-words leading-6">{item.note}</dd>
                              </div>
                            )}
                          </dl>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <p className="text-xs text-slate-400">
                              Khai báo: {dateLabel(item.declaredAt)}
                              {item.diagnosedDate ? ` · Phát hiện: ${dateLabel(item.diagnosedDate)}` : ''}
                            </p>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                disabled={!!busyId}
                                onClick={() => openForm(item)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"
                              >
                                <Edit2 className="h-3.5 w-3.5" /> Chỉnh sửa
                              </button>
                              <button
                                type="button"
                                disabled={!!busyId}
                                onClick={() => toggleActive(item)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
                              >
                                {busyId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : item.isActive === false ? (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                ) : (
                                  <Pause className="h-3.5 w-3.5" />
                                )}
                                {item.isActive === false ? 'Áp dụng lại' : 'Ngưng áp dụng'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ClipboardList className="h-4 w-4 text-teal-600" /> Thông tin hồ sơ
                  </h2>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Học sinh</dt>
                      <dd className="mt-1 font-medium">{child?.fullName || 'Chưa chọn học sinh'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Lớp</dt>
                      <dd className="mt-1">{child?.className || child?.class?.name || 'Chưa ghi nhận'}</dd>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <dt className="text-xs text-slate-500">Tài khoản cập nhật</dt>
                      <dd className="mt-1 font-medium">{user?.fullName || 'Chưa có thông tin'}</dd>
                    </div>
                    {user?.phone && (
                      <div>
                        <dt className="text-xs text-slate-500">Số điện thoại tài khoản</dt>
                        <dd className="mt-1">{user.phone}</dd>
                      </div>
                    )}
                  </dl>
                </section>
                <section className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-teal-900">
                    <Info className="h-4 w-4" /> Khi cập nhật hồ sơ
                  </h2>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-teal-900/80">
                    <li>Chọn đúng bé và thực phẩm cần tránh.</li>
                    <li>
                      Ghi lại triệu chứng thực tế và hướng dẫn của bác sĩ hoặc y tế trường nếu đã được cung cấp.
                    </li>
                    <li>Cập nhật khi thông tin thay đổi. Các khai báo ngưng áp dụng vẫn được giữ trong hồ sơ.</li>
                  </ul>
                </section>
              </aside>
            </div>
          </>
        )}

        {/* ─── TAB 2: HỒ SƠ DINH DƯỠNG & THÓI QUEN ĂN UỐNG (STT 29) ─── */}
        {pageTab === 'nutrition' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Utensils className="h-6 w-6 text-teal-600" />
                  Quản lý Hồ sơ Dinh dưỡng của bé (STT 29)
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Cung cấp thông tin thói quen ăn uống, chế độ dinh dưỡng và mục tiêu phát triển để nhà trường và bếp
                  chuẩn bị suất ăn phù hợp nhất cho bé.
                </p>
              </div>
            </div>

            {nutritionLoading ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600">Đang tải hồ sơ dinh dưỡng của bé...</p>
              </div>
            ) : !child ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
                <Baby className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600">Vui lòng chọn học sinh để cập nhật hồ sơ dinh dưỡng.</p>
              </div>
            ) : (
              <form onSubmit={handleSaveNutrition} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
                  {/* Chế độ ăn */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Chế độ dinh dưỡng chính của bé <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={nutritionProfile.dietaryRegime || 'TIÊU CHUẨN'}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, dietaryRegime: e.target.value }))
                      }
                      className={inputClass}
                    >
                      <option value="TIÊU CHUẨN">Chế độ tiêu chuẩn theo lứa tuổi mầm non</option>
                      <option value="ĂN CHAY">Chế độ ăn thuần chay / Bán chay</option>
                      <option value="THANH ĐẠM / ÍT GIA VỊ">Thanh đạm, hạn chế gia vị cay & mặn</option>
                      <option value="HỖ TRỢ TĂNG CÂN">Nhu cầu năng lượng cao (hỗ trợ bé nhẹ cân)</option>
                      <option value="KIỂM SOÁT CÂN NẶNG">Kiểm soát calo & chất béo (cho trẻ thừa cân/béo phì)</option>
                      <option value="KHÁC">Chế độ dinh dưỡng đặc biệt khác</option>
                    </select>
                  </div>

                  {/* Năng lượng mục tiêu Kcal/ngày */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                      Nhu cầu năng lượng ước tính (Kcal / ngày)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="800"
                        max="2500"
                        step="50"
                        value={nutritionProfile.targetEnergyKcal ?? 1200}
                        onChange={(e) =>
                          setNutritionProfile((prev) => ({
                            ...prev,
                            targetEnergyKcal: Number(e.target.value) || null,
                          }))
                        }
                        className="w-40 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      />
                      <span className="text-sm text-slate-500 font-medium">Kcal / ngày (Khuyến nghị mầm non: 1,100 ~ 1,400 Kcal)</span>
                    </div>
                  </div>

                  {/* Thói quen ăn uống */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">
                      Thói quen & Hành vi ăn uống tại nhà (Eating Habits)
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      Ví dụ: Bé nhai chậm, thích ăn cơm mềm chan canh, kén ăn rau màu xanh đậm, cần cô động viên khi ăn cá...
                    </p>
                    <textarea
                      rows={3}
                      value={nutritionProfile.eatingHabits || ''}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, eatingHabits: e.target.value }))
                      }
                      placeholder="Ghi nhận cụ thể thói quen của bé để cô giáo mầm non hỗ trợ chăm sóc..."
                      className={inputClass}
                    />
                  </div>

                  {/* Mục tiêu dinh dưỡng */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">
                      Mục tiêu dinh dưỡng của gia đình (Nutrition Goals)
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      Ví dụ: Bổ sung thực phẩm giàu canxi & vitamin D tăng chiều cao; tập cho bé làm quen thêm đạm từ cá và đậu hũ...
                    </p>
                    <textarea
                      rows={2}
                      value={nutritionProfile.nutritionGoals || ''}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, nutritionGoals: e.target.value }))
                      }
                      placeholder="Mục tiêu gia đình mong muốn đồng hành cùng nhà trường..."
                      className={inputClass}
                    />
                  </div>

                  {/* Ghi chú đặc biệt cho trường & bếp */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">
                      Ghi chú dặn dò cấp dưỡng & giáo viên phụ trách (Dietary Notes)
                    </label>
                    <textarea
                      rows={2}
                      value={nutritionProfile.dietaryNotes || ''}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, dietaryNotes: e.target.value }))
                      }
                      placeholder="Lưu ý khi chia phần ăn cho bé (cắt nhỏ thịt, không để thức ăn quá nóng...)"
                      className={inputClass}
                    />
                  </div>

                  {/* Submit Action */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs text-slate-400">
                      {nutritionProfile.updatedAt
                        ? `Cập nhật lần cuối: ${dateLabel(nutritionProfile.updatedAt)}`
                        : 'Hồ sơ dinh dưỡng sẵn sàng lưu'}
                    </div>
                    <button
                      type="submit"
                      disabled={nutritionSaving}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
                    >
                      {nutritionSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {nutritionSaving ? 'Đang lưu…' : 'Lưu hồ sơ dinh dưỡng của bé'}
                    </button>
                  </div>
                </div>

                {/* Right Guidance Sidebar */}
                <aside className="space-y-4">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-6 space-y-3 shadow-md">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-300" />
                      <h3 className="font-bold text-base">Lợi ích của Hồ sơ Dinh dưỡng</h3>
                    </div>
                    <p className="text-xs text-emerald-100 leading-relaxed">
                      Thông tin này được đồng bộ tức thời với <strong>Chuyên gia Dinh dưỡng</strong> và{' '}
                      <strong>Giáo viên chủ nhiệm</strong> để lập kế hoạch khẩu phần cá nhân hóa và theo dõi phát hiện
                      trẻ kén ăn (STT 71).
                    </p>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-rose-500" />
                      Khuyến nghị từ Bộ Y tế
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                      <li>• Trẻ mầm non 3-5 tuổi cần cân bằng 4 nhóm chất: Đạm, Tinh bột, Béo, Vitamin & Khoáng.</li>
                      <li>• Uống tối thiểu 1.2 - 1.5 lít nước/ngày (bao gồm sữa và súp canh).</li>
                      <li>• Hạn chế đường tinh luyện và đồ chiên rán nhiều dầu mỡ.</li>
                    </ul>
                  </div>
                </aside>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-40 flex w-[92vw] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm text-teal-900 shadow-lg"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" />
          <span className="flex-1 font-medium">{toast}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setToast('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modal Add/Edit Allergy */}
      <dialog
        ref={dialog}
        aria-labelledby="allergy-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          closeForm();
        }}
        onClose={() => setModalOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}
        className="m-auto w-[94vw] max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={save} className="flex max-h-[90dvh] flex-col">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-700">Hồ sơ dị ứng</p>
              <h2 id="allergy-dialog-title" className="text-xl font-bold text-slate-900">
                {editing ? 'Chỉnh sửa khai báo' : 'Thêm dị ứng / kiêng cữ'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {child?.fullName}
                {child?.className ? ` · ${child.className}` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label="Đóng biểu mẫu"
              disabled={submitting}
              onClick={closeForm}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="space-y-5 overflow-y-auto p-6">
            {formError && (
              <div
                role="alert"
                className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="allergy-type" className="mb-2 block text-sm font-semibold">
                Loại ghi nhận <span className="text-rose-500">*</span>
              </label>
              <select
                id="allergy-type"
                value={form.allergyType}
                onChange={(event) => updateForm('allergyType', event.target.value)}
                className={inputClass}
                disabled={submitting}
              >
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">
                Thực phẩm cần tránh <span className="text-rose-500">*</span>
              </legend>
              <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-1">
                {[
                  { value: 'catalog', label: 'Chọn từ danh mục' },
                  { value: 'custom', label: 'Nhập thực phẩm khác' },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => updateForm('mode', mode.value as AllergyForm['mode'])}
                    disabled={submitting}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      form.mode === mode.value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              {form.mode === 'catalog' ? (
                <select
                  aria-label="Dị nguyên trong danh mục"
                  value={form.allergenId}
                  onChange={(event) => updateForm('allergenId', event.target.value)}
                  required
                  disabled={submitting}
                  className={inputClass}
                >
                  <option value="">Chọn thực phẩm / nhóm dị nguyên</option>
                  {catalogs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nameVi}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label="Tên thực phẩm khác"
                  value={form.customName}
                  onChange={(event) => updateForm('customName', event.target.value)}
                  required
                  maxLength={150}
                  disabled={submitting}
                  className={inputClass}
                  placeholder="Nhập tên thực phẩm bé cần tránh"
                />
              )}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">
                Mức độ ghi nhận <span className="text-rose-500">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {severityOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      form.severity === option.value
                        ? `${option.className} ring-1 ring-current`
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={option.value}
                      checked={form.severity === option.value}
                      onChange={() => updateForm('severity', option.value)}
                      required
                      disabled={submitting}
                      className="accent-teal-700"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="allergy-symptoms" className="mb-2 block text-sm font-semibold">
                Triệu chứng đã ghi nhận <span className="font-normal text-slate-400">(không bắt buộc)</span>
              </label>
              <textarea
                id="allergy-symptoms"
                rows={2}
                value={form.symptoms}
                onChange={(event) => updateForm('symptoms', event.target.value)}
                disabled={submitting}
                className={inputClass}
                placeholder="Mô tả triệu chứng thực tế của bé"
              />
            </div>
            <div>
              <label htmlFor="allergy-treatment" className="mb-2 block text-sm font-semibold">
                Hướng dẫn từ bác sĩ / y tế trường <span className="font-normal text-slate-400">(nếu có)</span>
              </label>
              <textarea
                id="allergy-treatment"
                rows={2}
                value={form.reactionTreatment}
                onChange={(event) => updateForm('reactionTreatment', event.target.value)}
                disabled={submitting}
                className={inputClass}
                placeholder="Nhập hướng dẫn đã được cung cấp cho bé"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="allergy-date" className="mb-2 block text-sm font-semibold">
                  Ngày phát hiện / chẩn đoán
                </label>
                <input
                  id="allergy-date"
                  type="date"
                  value={form.diagnosedDate}
                  onChange={(event) => updateForm('diagnosedDate', event.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="allergy-note" className="mb-2 block text-sm font-semibold">
                  Ghi chú thêm
                </label>
                <input
                  id="allergy-note"
                  value={form.note}
                  onChange={(event) => updateForm('note', event.target.value)}
                  disabled={submitting}
                  className={inputClass}
                  placeholder="Thông tin khác cần lưu ý"
                />
              </div>
            </div>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <p className="hidden text-xs text-slate-400 sm:block">
              <span className="text-rose-500">*</span> Thông tin bắt buộc
            </p>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={closeForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu khai báo'}
              </button>
            </div>
          </footer>
        </form>
      </dialog>
    </div>
  );
};
