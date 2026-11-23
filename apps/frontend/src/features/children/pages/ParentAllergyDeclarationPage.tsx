import { normalizeSearch } from '../../../core/utils/search';
import { downloadExcel } from '../../../core/utils/excel-export';
import { getLocale, t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
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
  FileSpreadsheet,
  Heart,
  Info,
  Loader2,
  Pause,
  Plus,
  RefreshCw,
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
import { schoolDate } from '../../menus/utils/published-menus';

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
const dateLabel = (value?: string | null) => (value ? new Date(value).toLocaleDateString(getLocale()) : 'Chưa ghi nhận');
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

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
  useLanguage();
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
        normalizeSearch(`${item.allergen?.nameVi || ''} ${item.customAllergenName || ''} ${item.symptoms || ''}`)
          .includes(normalizeSearch(search.trim())),
      ),
    [allergies, filter, search],
  );

  const openForm = (item?: ChildAllergyItem) => {
    setEditing(item || null);
    setForm(
      item
        ? {
            mode: 'catalog',
            allergenId: item.allergenId || '',
            customName: '',
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
    if (!form.allergenId) {
      setFormError('Vui lòng chọn thực phẩm / nhóm dị nguyên cần tránh từ danh mục.');
      return;
    }
    if (!form.severity) {
      setFormError('Vui lòng chọn mức độ theo thông tin của bé.');
      return;
    }
    if (form.diagnosedDate && form.diagnosedDate > schoolDate()) {
      setFormError('Ngày phát hiện / chẩn đoán phải trước hoặc bằng ngày hiện tại.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const payload: DeclareAllergyDto = {
        allergenId: form.allergenId,
        customAllergenName: '',
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
        translateText(`Ngưng áp dụng "${item.allergen?.nameVi || item.customAllergenName}"? Thông tin vẫn được giữ trong hồ sơ.`),
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

  const handleExportExcel = async () => {
    if (!shown.length) return;
    await downloadExcel(
      `Ho_so_di_ung_${(child?.fullName || 'hoc_sinh').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.xlsx`,
      [
        ['Thực phẩm cần tránh', 'Phân loại', 'Mức độ', 'Triệu chứng', 'Hướng dẫn xử trí / Thay thế', 'Ghi chú', 'Ngày khai báo', 'Trạng thái'],
        ...shown.map((item) => {
          const sev = severityOptions.find((o) => o.value === normalizeSeverity(item.severity));
          const typeLabel = types.find((t) => t.value === item.allergyType)?.label || 'Dị ứng / kiêng cữ';
          return [
            item.allergen?.nameVi || item.customAllergenName || 'Thực phẩm cần tránh',
            typeLabel,
            sev?.label || item.severity,
            item.symptoms || '',
            item.reactionTreatment || '',
            item.note || '',
            dateLabel(item.declaredAt),
            item.isActive === false ? 'Đã ngưng' : 'Đang áp dụng',
          ];
        }),
      ],
      'Hồ sơ dị ứng',
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800">
      <ParentPortalTopNav
        child={child ? { id: String(child.id), name: child.fullName, className: child.className || child.class?.name } : undefined}
        activeTab="allergies"
      />
      <main className="w-full px-4 pb-28 pt-6 sm:px-6 lg:px-8 space-y-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{translateText(error)}</span>
            <button
              type="button"
              className="shrink-0 font-semibold underline"
              onClick={() => (selectedId ? loadChild(selectedId) : loadChildren())}
            >
              {translateText("Thử lại")}
            </button>
          </div>
        )}

        {/* ─── TAB 1: DỊ ỨNG & THỰC PHẨM CẦN TRÁNH ─── */}
        {pageTab === 'allergies' && (
          <>
            {/* KPI Metric Strip */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: translateText('Thực phẩm đang cần tránh'),
                  value: `${active.length} ${translateText('thực phẩm')}`,
                  icon: ShieldAlert,
                  color: 'bg-rose-50 text-rose-600 border border-rose-100',
                },
                {
                  label: translateText('Mức độ nặng / tiền sử sốc phản vệ'),
                  value: `${severeCount} ${translateText('ghi nhận')}`,
                  icon: AlertCircle,
                  color: 'bg-amber-50 text-amber-700 border border-amber-100',
                },
                {
                  label: translateText('Khai báo gần nhất'),
                  value: dateLabel(lastDeclared),
                  icon: CalendarDays,
                  color: 'bg-slate-100 text-slate-600 border border-slate-200/70',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">{item.label}</span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      {translateText(initialLoading || childLoading ? '—' : item.value)}
                    </span>
                  </div>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                </div>
              ))}
            </div>

            {/* Unified Action Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label={translateText("Trạng thái hồ sơ")}>
                  {[
                    { value: 'active', label: translateText('Đang áp dụng'), count: active.length },
                    { value: 'inactive', label: translateText('Đã ngưng'), count: inactive.length },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={filter === tab.value}
                      onClick={() => setFilter(tab.value as typeof filter)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        filter === tab.value
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label} <span className={`ml-1 ${filter === tab.value ? 'text-white/90' : 'text-slate-400'}`}>{tab.count}</span>
                    </button>
                  ))}
                </div>

                {children.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <Baby className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <select
                      aria-label={translateText("Chọn học sinh")}
                      value={selectedId}
                      onChange={(event) => setSelectedId(event.target.value)}
                      disabled={initialLoading}
                      className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                    >
                      {children.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.fullName} {item.className ? `· ${item.className}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                <div className="relative flex-1 sm:flex-initial sm:w-56">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    aria-label={translateText("Tìm thực phẩm dị ứng")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={translateText("Tìm thực phẩm…")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => { if (selectedId) void loadChild(selectedId); }}
                  disabled={initialLoading || childLoading}
                  className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${childLoading ? 'animate-spin' : ''}`} />
                  <span>{translateText("Làm mới")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleExportExcel()}
                  disabled={!shown.length}
                  className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title={translateText("Xuất danh sách dị ứng ra Excel")}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{translateText("Xuất Excel")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openForm()}
                  disabled={!child || initialLoading || childLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>{translateText("Thêm dị ứng")}</span>
                </button>
              </div>
            </div>

            {/* Clean Full-Width Data Table */}
            <section className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
              {initialLoading || childLoading ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <span>{translateText("Đang tải hồ sơ của bé…")}</span>
                </div>
              ) : !child ? (
                <div className="px-6 py-14 text-center">
                  <Baby className="mx-auto mb-4 h-9 w-9 text-slate-300" />
                  <h2 className="font-semibold text-slate-800">{translateText("Chưa có hồ sơ học sinh")}</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {translateText("Nhà trường cần liên kết tài khoản với hồ sơ học sinh trước khi khai báo dị ứng.")}
                  </p>
                </div>
              ) : !shown.length ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                    <ClipboardList className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {translateText(
                      search
                        ? 'Không tìm thấy thực phẩm phù hợp'
                        : filter === 'inactive'
                        ? 'Chưa có khai báo ngưng áp dụng'
                        : 'Chưa có khai báo dị ứng',
                    )}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-slate-500">
                    {translateText(
                      search
                        ? 'Thử tìm bằng tên thực phẩm hoặc triệu chứng khác.'
                        : filter === 'inactive'
                        ? 'Các khai báo ngưng áp dụng sẽ được giữ lại tại đây.'
                        : 'Thêm thông tin thực phẩm bé cần tránh để nhà trường theo dõi trong hồ sơ.',
                    )}
                  </p>
                  {filter === 'active' && !search && (
                    <button
                      type="button"
                      onClick={() => openForm()}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{translateText("Khai báo đầu tiên")}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3.5">{translateText("Thực phẩm cần tránh")}</th>
                        <th className="px-4 py-3.5">{translateText("Mức độ")}</th>
                        <th className="px-4 py-3.5">{translateText("Triệu chứng & Ghi chú")}</th>
                        <th className="px-4 py-3.5">{translateText("Hướng dẫn xử trí / Thay thế")}</th>
                        <th className="px-4 py-3.5">{translateText("Ngày khai báo")}</th>
                        <th className="px-4 py-3.5 text-right">{translateText("Thao tác")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {shown.map((item) => {
                        const severity = severityOptions.find(
                          (option) => option.value === normalizeSeverity(item.severity),
                        );
                        const typeLabel = types.find((type) => type.value === item.allergyType)?.label || 'Dị ứng / kiêng cữ';
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition align-top">
                            <td className="px-4 py-4 min-w-[180px]">
                              <strong className="block text-sm font-bold text-slate-900">
                                {translateText(item.allergen?.nameVi || item.customAllergenName || 'Thực phẩm cần tránh')}
                              </strong>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                                {translateText(typeLabel)}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                  severity?.className || 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                {translateText(severity?.label || item.severity)}
                              </span>
                            </td>
                            <td className="px-4 py-4 max-w-xs">
                              {item.symptoms ? (
                                <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                                  {translateText(item.symptoms)}
                                </p>
                              ) : (
                                <span className="text-xs text-slate-400 italic">{translateText("Chưa ghi triệu chứng")}</span>
                              )}
                              {item.note && item.note !== item.symptoms && (
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.note}</p>
                              )}
                            </td>
                            <td className="px-4 py-4 max-w-xs">
                              {item.reactionTreatment ? (
                                <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 px-3 py-2 text-xs font-medium text-amber-950 leading-relaxed">
                                  {item.reactionTreatment}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">{translateText("Chưa có hướng dẫn")}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                              <span className="block font-semibold text-slate-700">{translateText(dateLabel(item.declaredAt))}</span>
                              {item.diagnosedDate && (
                                <span className="block text-[11px] text-slate-400 mt-0.5">
                                  {translateText("Phát hiện: ")}{translateText(dateLabel(item.diagnosedDate))}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!!busyId}
                                  onClick={() => openForm(item)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 text-xs font-semibold text-slate-700 hover:text-emerald-700 transition inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  <span>{translateText("Sửa")}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={!!busyId}
                                  onClick={() => toggleActive(item)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-600 transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {busyId === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : item.isActive === false ? (
                                    <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Pause className="h-3.5 w-3.5 text-slate-500" />
                                  )}
                                  <span>{translateText(item.isActive === false ? 'Áp dụng lại' : 'Ngưng')}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* ─── TAB 2: HỒ SƠ DINH DƯỠNG & THÓI QUEN ĂN UỐNG ─── */}
        {pageTab === 'nutrition' && (
          <div className="space-y-6">

            {nutritionLoading ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600">{translateText("Đang tải hồ sơ dinh dưỡng của bé...")}</p>
              </div>
            ) : !child ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
                <Baby className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600">{translateText("Vui lòng chọn học sinh để cập nhật hồ sơ dinh dưỡng.")}</p>
              </div>
            ) : (
              <form onSubmit={handleSaveNutrition} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
                  {/* Chế độ ăn */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">{translateText("Chế độ dinh dưỡng chính của bé ")}<span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={nutritionProfile.dietaryRegime || 'TIÊU CHUẨN'}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, dietaryRegime: e.target.value }))
                      }
                      className={inputClass}
                    >
                      <option value="TIÊU CHUẨN">{translateText("Chế độ tiêu chuẩn theo lứa tuổi mầm non")}</option>
                      <option value="ĂN CHAY">{translateText("Chế độ ăn thuần chay / Bán chay")}</option>
                      <option value="THANH ĐẠM / ÍT GIA VỊ">{translateText("Thanh đạm, hạn chế gia vị cay & mặn")}</option>
                      <option value="HỖ TRỢ TĂNG CÂN">{translateText("Nhu cầu năng lượng cao (hỗ trợ bé nhẹ cân)")}</option>
                      <option value="KIỂM SOÁT CÂN NẶNG">{translateText("Kiểm soát calo & chất béo (cho trẻ thừa cân/béo phì)")}</option>
                      <option value="KHÁC">{translateText("Chế độ dinh dưỡng đặc biệt khác")}</option>
                    </select>
                  </div>

                  {/* Năng lượng mục tiêu Kcal/ngày */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">{translateText("Nhu cầu năng lượng ước tính (Kcal / ngày)")}</label>
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
                      <span className="text-sm text-slate-500 font-medium">{translateText("Kcal / ngày (Khuyến nghị mầm non: 1,100 ~ 1,400 Kcal)")}</span>
                    </div>
                  </div>

                  {/* Thói quen ăn uống */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">{translateText("Thói quen & Hành vi ăn uống tại nhà (Eating Habits)")}</label>
                    <p className="text-xs text-slate-500 mb-2">{translateText("Ví dụ: Bé nhai chậm, thích ăn cơm mềm chan canh, kén ăn rau màu xanh đậm, cần cô động viên khi ăn cá...")}</p>
                    <textarea
                      rows={3}
                      value={nutritionProfile.eatingHabits || ''}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, eatingHabits: e.target.value }))
                      }
                      placeholder={translateText("Ghi nhận cụ thể thói quen của bé để cô giáo mầm non hỗ trợ chăm sóc...")}
                      className={inputClass}
                    />
                  </div>

                  {/* Mục tiêu dinh dưỡng */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">{translateText("Mục tiêu dinh dưỡng của gia đình (Nutrition Goals)")}</label>
                    <p className="text-xs text-slate-500 mb-2">{translateText("Ví dụ: Bổ sung thực phẩm giàu canxi & vitamin D tăng chiều cao; tập cho bé làm quen thêm đạm từ cá và đậu hũ...")}</p>
                    <textarea
                      rows={2}
                      value={nutritionProfile.nutritionGoals || ''}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, nutritionGoals: e.target.value }))
                      }
                      placeholder={translateText("Mục tiêu gia đình mong muốn đồng hành cùng nhà trường...")}
                      className={inputClass}
                    />
                  </div>

                  {/* Ghi chú đặc biệt cho trường & bếp */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">{translateText("Ghi chú dặn dò cấp dưỡng & giáo viên phụ trách (Dietary Notes)")}</label>
                    <textarea
                      rows={2}
                      value={nutritionProfile.dietaryNotes || ''}
                      onChange={(e) =>
                        setNutritionProfile((prev) => ({ ...prev, dietaryNotes: e.target.value }))
                      }
                      placeholder={translateText("Lưu ý khi chia phần ăn cho bé (cắt nhỏ thịt, không để thức ăn quá nóng...)")}
                      className={inputClass}
                    />
                  </div>

                  {/* Submit Action */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs text-slate-400">
                      {translateText(nutritionProfile.updatedAt
                        ? `Cập nhật lần cuối: ${dateLabel(nutritionProfile.updatedAt)}`
                        : 'Hồ sơ dinh dưỡng sẵn sàng lưu')}
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
                      {translateText(nutritionSaving ? 'Đang lưu…' : 'Lưu hồ sơ dinh dưỡng của bé')}
                    </button>
                  </div>
                </div>

                {/* Right Guidance Sidebar */}
                <aside className="space-y-4">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-6 space-y-3 shadow-md">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-300" />
                      <h3 className="font-bold text-base">{translateText("Lợi ích của Hồ sơ Dinh dưỡng")}</h3>
                    </div>
                    <p className="text-xs text-emerald-100 leading-relaxed">{translateText("Thông tin này được đồng bộ tức thời với ")}<strong>{translateText("Chuyên gia Dinh dưỡng")}</strong>{translateText(" và")}{' '}
                      <strong>{translateText("Giáo viên chủ nhiệm")}</strong>{translateText(" để lập kế hoạch khẩu phần cá nhân hóa và theo dõi phát hiện trẻ kén ăn (STT 71).")}</p>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-rose-500" />{translateText("Khuyến nghị từ Bộ Y tế")}</h4>
                    <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                      <li>{translateText("• Trẻ mầm non 3-5 tuổi cần cân bằng 4 nhóm chất: Đạm, Tinh bột, Béo, Vitamin & Khoáng.")}</li>
                      <li>{translateText("• Uống tối thiểu 1.2 - 1.5 lít nước/ngày (bao gồm sữa và súp canh).")}</li>
                      <li>{translateText("• Hạn chế đường tinh luyện và đồ chiên rán nhiều dầu mỡ.")}</li>
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
          <span className="flex-1 font-medium">{translateText(toast)}</span>
          <button type="button" aria-label={translateText("Đóng thông báo")} onClick={() => setToast('')}>
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-700">{translateText("Hồ sơ dị ứng")}</p>
              <h2 id="allergy-dialog-title" className="text-xl font-bold text-slate-900">
                {translateText(editing ? 'Chỉnh sửa khai báo' : 'Thêm dị ứng / kiêng cữ')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {child?.fullName}
                {child?.className ? ` · ${child.className}` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label={translateText("Đóng biểu mẫu")}
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
                {translateText(formError)}
              </div>
            )}
            <div>
              <label htmlFor="allergy-type" className="mb-2 block text-sm font-semibold">{translateText("Loại ghi nhận ")}<span className="text-rose-500">*</span>
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
                    {translateText(type.label)}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{translateText("Thực phẩm cần tránh ")}<span className="text-rose-500">*</span>
              </legend>
              <select
                aria-label={translateText("Dị nguyên trong danh mục")}
                value={form.allergenId}
                onChange={(event) => updateForm('allergenId', event.target.value)}
                required
                disabled={submitting}
                className={inputClass}
              >
                <option value="">{translateText("Chọn thực phẩm / nhóm dị nguyên")}</option>
                {catalogs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {translateText(item.nameVi)}
                  </option>
                ))}
              </select>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{translateText("Mức độ ghi nhận ")}<span className="text-rose-500">*</span>
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
                    {translateText(option.label)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="allergy-symptoms" className="mb-2 block text-sm font-semibold">{translateText("Triệu chứng đã ghi nhận ")}<span className="font-normal text-slate-400">{translateText("(không bắt buộc)")}</span>
              </label>
              <textarea
                id="allergy-symptoms"
                rows={2}
                value={form.symptoms}
                onChange={(event) => updateForm('symptoms', event.target.value)}
                disabled={submitting}
                className={inputClass}
                placeholder={translateText("Mô tả triệu chứng thực tế của bé")}
              />
            </div>
            <div>
              <label htmlFor="allergy-treatment" className="mb-2 block text-sm font-semibold">{translateText("Hướng dẫn từ bác sĩ / y tế trường ")}<span className="font-normal text-slate-400">{translateText("(nếu có)")}</span>
              </label>
              <textarea
                id="allergy-treatment"
                rows={2}
                value={form.reactionTreatment}
                onChange={(event) => updateForm('reactionTreatment', event.target.value)}
                disabled={submitting}
                className={inputClass}
                placeholder={translateText("Nhập hướng dẫn đã được cung cấp cho bé")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="allergy-date" className="mb-2 block text-sm font-semibold">{translateText("Ngày phát hiện / chẩn đoán")}</label>
                <input
                  id="allergy-date"
                  type="date"
                  max={schoolDate()}
                  value={form.diagnosedDate}
                  onChange={(event) => updateForm('diagnosedDate', event.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="allergy-note" className="mb-2 block text-sm font-semibold">{translateText("Ghi chú thêm")}</label>
                <input
                  id="allergy-note"
                  value={form.note}
                  onChange={(event) => updateForm('note', event.target.value)}
                  disabled={submitting}
                  className={inputClass}
                  placeholder={translateText("Thông tin khác cần lưu ý")}
                />
              </div>
            </div>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <p className="hidden text-xs text-slate-400 sm:block">
              <span className="text-rose-500">*</span>{translateText(" Thông tin bắt buộc")}</p>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={closeForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >{translateText("Hủy")}</button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {translateText(submitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu khai báo')}
              </button>
            </div>
          </footer>
        </form>
      </dialog>
    </div>
  );
};
