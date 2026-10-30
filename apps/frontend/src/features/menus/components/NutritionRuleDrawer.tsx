import React, { useState, useEffect } from 'react';
import { X, Sparkles, Scale, AlertCircle, Check } from 'lucide-react';
import {
  NutritionRule,
  CreateNutritionRulePayload,
  UpdateNutritionRulePayload,
} from '../api/nutrition-rule-engine.api';

interface NutritionRuleDrawerProps {
  isOpen: boolean;
  rule: NutritionRule | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateNutritionRulePayload | UpdateNutritionRulePayload, id?: string) => Promise<void>;
}

const DEFAULT_FORM = {
  name: '',
  targetAgeGroup: 'KINDERGARTEN_3_4Y',
  mealScope: 'DAYBOARDING',
  minCaloriesKcal: 615,
  maxCaloriesKcal: 726,
  minProteinPercent: 13,
  maxProteinPercent: 20,
  minFatPercent: 25,
  maxFatPercent: 35,
  minCarbPercent: 52,
  maxCarbPercent: 60,
  minCalciumMg: 350,
  minIronMg: 5,
  minZincMg: 3,
  maxSodiumMg: 1500,
  caPRatioMin: 1.0,
  caPRatioMax: 1.5,
  isStrict: true,
  isActive: true,
};

const MACRO_CONFIG = [
  { label: 'Chất Đạm (Protein - P)', minKey: 'minProteinPercent', maxKey: 'maxProteinPercent', box: 'bg-blue-50/60 border-blue-200/70', title: 'text-blue-900', sub: 'text-blue-700', input: 'border-blue-200' },
  { label: 'Chất Béo (Lipid - L)', minKey: 'minFatPercent', maxKey: 'maxFatPercent', box: 'bg-amber-50/60 border-amber-200/70', title: 'text-amber-900', sub: 'text-amber-700', input: 'border-amber-200' },
  { label: 'Chất Bột Đường (Glucid - G)', minKey: 'minCarbPercent', maxKey: 'maxCarbPercent', box: 'bg-emerald-50/60 border-emerald-200/70', title: 'text-emerald-900', sub: 'text-emerald-700', input: 'border-emerald-200' },
] as const;

export const NutritionRuleDrawer: React.FC<NutritionRuleDrawerProps> = ({
  isOpen,
  rule,
  isLoading,
  onClose,
  onSubmit,
}) => {
  const isEditMode = Boolean(rule);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    if (rule) {
      setForm({
        name: rule.name || '',
        targetAgeGroup: rule.targetAgeGroup || 'KINDERGARTEN_3_4Y',
        mealScope: rule.mealScope || 'DAYBOARDING',
        minCaloriesKcal: Number(rule.minCaloriesKcal ?? 615),
        maxCaloriesKcal: Number(rule.maxCaloriesKcal ?? 726),
        minProteinPercent: Number(rule.minProteinPercent ?? 13),
        maxProteinPercent: Number(rule.maxProteinPercent ?? 20),
        minFatPercent: Number(rule.minFatPercent ?? 25),
        maxFatPercent: Number(rule.maxFatPercent ?? 35),
        minCarbPercent: Number(rule.minCarbPercent ?? 52),
        maxCarbPercent: Number(rule.maxCarbPercent ?? 60),
        minCalciumMg: Number(rule.minCalciumMg ?? 350),
        minIronMg: Number(rule.minIronMg ?? 5),
        minZincMg: Number(rule.minZincMg ?? 3),
        maxSodiumMg: Number(rule.maxSodiumMg ?? 1500),
        caPRatioMin: Number(rule.caPRatioMin ?? 1.0),
        caPRatioMax: Number(rule.caPRatioMax ?? 1.5),
        isStrict: rule.isStrict ?? true,
        isActive: rule.isActive ?? true,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [isOpen, rule]);

  const setNum = (key: keyof typeof DEFAULT_FORM, val: string) =>
    setForm((prev) => ({ ...prev, [key]: Number(val) }));

  const applyPreset = (age: string, scope = form.mealScope) => {
    const isToddler = age === 'TODDLER_18_36M' || age === 'NHA_TRE';
    const isFullDay = scope === 'FULL_DAY' || scope === 'FULL_DAY_SCHOOL';
    setForm((prev) => ({
      ...prev,
      targetAgeGroup: age,
      mealScope: scope,
      minCaloriesKcal: isToddler ? (isFullDay ? 930 : 600) : (isFullDay ? 1230 : 615),
      maxCaloriesKcal: isToddler ? (isFullDay ? 1000 : 651) : (isFullDay ? 1320 : 726),
      minProteinPercent: 13,
      maxProteinPercent: 20,
      minFatPercent: isToddler ? 30 : 25,
      maxFatPercent: isToddler ? 40 : 35,
      minCarbPercent: isToddler ? 47 : 52,
      maxCarbPercent: isToddler ? 50 : 60,
      minCalciumMg: isToddler ? (isFullDay ? 300 : 150) : (isFullDay ? 350 : 180),
      minIronMg: isToddler ? (isFullDay ? 4 : 2.2) : (isFullDay ? 4.5 : 2.5),
      minZincMg: isToddler ? (isFullDay ? 3 : 1.5) : (isFullDay ? 3.5 : 1.8),
      name: !prev.name || prev.name.includes('Chuẩn Dinh dưỡng')
        ? `Chuẩn Dinh dưỡng ${isToddler ? 'Nhà trẻ (12 - 36 tháng)' : 'Mẫu giáo (3 - 6 tuổi)'} - ${isFullDay ? 'Cả ngày' : 'Bán trú'}`
        : prev.name,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!form.name.trim()) return setErrorMessage('Vui lòng nhập tên quy chuẩn dinh dưỡng.');
    if (form.maxCaloriesKcal < form.minCaloriesKcal) return setErrorMessage('Năng lượng tối đa không thể nhỏ hơn năng lượng tối thiểu.');
    if (form.maxProteinPercent < form.minProteinPercent) return setErrorMessage('Tỷ lệ Protein tối đa không thể nhỏ hơn tối thiểu.');
    if (form.maxFatPercent < form.minFatPercent) return setErrorMessage('Tỷ lệ Lipid tối đa không thể nhỏ hơn tối thiểu.');
    if (form.maxCarbPercent < form.minCarbPercent) return setErrorMessage('Tỷ lệ Glucid tối đa không thể nhỏ hơn tối thiểu.');

    try {
      await onSubmit({ ...form, name: form.name.trim() }, rule?.id);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi lưu quy chuẩn dinh dưỡng.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isEditMode ? 'Chỉnh Sửa Tiêu Chuẩn Dinh Dưỡng' : 'Thêm Tiêu Chuẩn Dinh Dưỡng Mới'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">Cấu hình năng lượng Calo và tỷ lệ P-L-G chuẩn Thông tư 28</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="nutrition-rule-drawer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Tên quy chuẩn dinh dưỡng <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Quy chuẩn Mẫu giáo Cơ sở Sao Mai"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700">Nhóm lứa tuổi học sinh <span className="text-red-500">*</span></label>
                <span className="text-[11px] text-teal-600 font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" /> Gợi ý chuẩn TT 28</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'NHA_TRE', title: 'Nhà trẻ (12 - 36 tháng)', desc: '600 - 651 Kcal (60-70%) • P:13-20% L:30-40% G:47-50%', match: ['TODDLER_18_36M', 'NHA_TRE'] },
                  { id: 'MAU_GIAO', title: 'Mẫu giáo (3 - 6 tuổi)', desc: '615 - 726 Kcal (50-55%) • P:13-20% L:25-35% G:52-60%', match: ['KINDERGARTEN_3_4Y', 'KINDERGARTEN_4_5Y', 'KINDERGARTEN_5_6Y', 'MAU_GIAO'] },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={`py-2 px-3 rounded-xl border text-left font-semibold transition ${
                      p.match.includes(form.targetAgeGroup) ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-bold">{p.title}</p>
                    <p className="text-[10px] text-slate-500 font-normal">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Phạm vi bữa ăn áp dụng (Theo Thông tư 28/51)</label>
              <select
                value={form.mealScope}
                onChange={(e) => applyPreset(form.targetAgeGroup, e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 bg-white"
              >
                <option value="DAYBOARDING">Bán trú tại trường (Nhà trẻ: 2 chính + 1 phụ [60-70%] • Mẫu giáo: 1 chính + 1 phụ [50-55%])</option>
                <option value="FULL_DAY">Cả ngày (100% nhu cầu khuyến nghị VN-RDA)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold uppercase tracking-wider text-slate-400">1. Nhu Cầu Năng Lượng (Kcal)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Calo tối thiểu (Kcal)</label>
                <input type="number" required value={form.minCaloriesKcal} onChange={(e) => setNum('minCaloriesKcal', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800" />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Calo tối đa (Kcal)</label>
                <input type="number" required value={form.maxCaloriesKcal} onChange={(e) => setNum('maxCaloriesKcal', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800" />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold uppercase tracking-wider text-slate-400">2. Cơ Cấu Tỷ Lệ Năng Lượng (P : L : G)</h3>
              <span className="text-[10px] text-slate-400 italic">Tổng tỷ lệ = 100%</span>
            </div>
            {MACRO_CONFIG.map((m) => (
              <div key={m.label} className={`p-3 border rounded-2xl space-y-2 ${m.box}`}>
                <span className={`font-bold block ${m.title}`}>{m.label}</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[11px] ${m.sub}`}>Tối thiểu (%)</label>
                    <input type="number" step="0.5" value={form[m.minKey]} onChange={(e) => setNum(m.minKey, e.target.value)} className={`w-full px-3 py-1.5 bg-white rounded-lg border font-bold text-slate-800 ${m.input}`} />
                  </div>
                  <div>
                    <label className={`text-[11px] ${m.sub}`}>Tối đa (%)</label>
                    <input type="number" step="0.5" value={form[m.maxKey]} onChange={(e) => setNum(m.maxKey, e.target.value)} className={`w-full px-3 py-1.5 bg-white rounded-lg border font-bold text-slate-800 ${m.input}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold uppercase tracking-wider text-slate-400">3. Vi Chất & Tỷ Lệ Canxi / Photpho</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Canxi (mg)', key: 'minCalciumMg' as const },
                { label: 'Sắt (mg)', key: 'minIronMg' as const },
                { label: 'Kẽm (mg)', key: 'minZincMg' as const },
              ].map((mi) => (
                <div key={mi.key}>
                  <label className="text-slate-600 font-semibold block mb-1">{mi.label}</label>
                  <input type="number" step="0.5" value={form[mi.key]} onChange={(e) => setNum(mi.key, e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Tỷ lệ Ca:P Min</label>
                <input type="number" step="0.1" value={form.caPRatioMin} onChange={(e) => setNum('caPRatioMin', e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold" />
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Tỷ lệ Ca:P Max</label>
                <input type="number" step="0.1" value={form.caPRatioMax} onChange={(e) => setNum('caPRatioMax', e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold" />
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
            Hủy bỏ
          </button>
          <button type="submit" form="nutrition-rule-drawer-form" disabled={isLoading} className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{isLoading ? 'Đang lưu...' : isEditMode ? 'Lưu Thay Đổi' : 'Tạo Tiêu Chuẩn'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
