import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Droplets, PieChart, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import {
  nutritionEngineApi,
  MealDistributionOverview,
  MealNutrientTarget,
  NutrientRange,
} from '../api/nutrition-rule-engine.api';

const AGE_GROUPS = [
  { id: 'MAU_GIAO', label: 'Mẫu giáo (3 - 6 tuổi)' },
  { id: 'NHA_TRE', label: 'Nhà trẻ (12 - 36 tháng)' },
] as const;

const MEAL_COLORS: Record<string, { bar: string; dot: string }> = {
  BREAKFAST: { bar: 'bg-amber-400', dot: 'bg-amber-400' },
  MORNING_SNACK: { bar: 'bg-yellow-400', dot: 'bg-yellow-400' },
  LUNCH: { bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  AFTERNOON_SNACK: { bar: 'bg-purple-500', dot: 'bg-purple-500' },
  LATE_SNACK: { bar: 'bg-orange-500', dot: 'bg-orange-500' },
};

const fmtRange = (r: NutrientRange, digits = 1) =>
  r.min === r.max ? r.min.toFixed(digits) : `${r.min.toFixed(digits)} – ${r.max.toFixed(digits)}`;

const NutrientCells: React.FC<{ target: MealNutrientTarget; strong?: boolean }> = ({ target, strong }) => (
  <>
    <td className={`py-3 px-3 text-right ${strong ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>{fmtRange(target.energyKcal, 0)}</td>
    <td className={`py-3 px-3 text-right font-bold ${strong ? 'text-cyan-950 font-black' : 'text-cyan-700'}`}>
      {target.waterMl ? `${fmtRange(target.waterMl, 0)} ml` : '—'}
    </td>
    <td className="py-3 px-3 text-right text-blue-800">{fmtRange(target.proteinG)}</td>
    <td className="py-3 px-3 text-right text-amber-800">{fmtRange(target.lipidG)}</td>
    <td className="py-3 px-3 text-right text-emerald-800">{fmtRange(target.carbohydrateG)}</td>
  </>
);

/**
 * Bảng phân bổ năng lượng & dinh dưỡng theo bữa trong ngày:
 * mỗi bữa chiếm bao nhiêu % năng lượng cả ngày và lượng Kcal / P / L / G mục tiêu tương ứng.
 */
export const MealDistributionPanel: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  useLanguage();
  const [ageGroup, setAgeGroup] = useState<string>('MAU_GIAO');
  const [overview, setOverview] = useState<MealDistributionOverview | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { min: string; max: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await nutritionEngineApi.getMealDistributionOverview(ageGroup);
      setOverview(data);
      setDrafts(Object.fromEntries(data.meals.map(m => [m.id, { min: String(m.energyPct.min), max: String(m.energyPct.max) }])));
    } catch (err: any) {
      setOverview(null);
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Không tải được bảng phân bổ theo bữa.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ageGroup]);

  const changedIds = useMemo(() => (overview?.meals || [])
    .filter(m => drafts[m.id] && (Number(drafts[m.id].min) !== m.energyPct.min || Number(drafts[m.id].max) !== m.energyPct.max))
    .map(m => m.id), [overview, drafts]);

  const draftError = useMemo(() => {
    for (const id of changedIds) {
      const d = drafts[id];
      const min = Number(d.min), max = Number(d.max);
      if (d.min === '' || d.max === '' || !Number.isFinite(min) || !Number.isFinite(max)) return 'Vui lòng nhập số % hợp lệ.';
      if (min < 0 || max > 100) return '% năng lượng phải nằm trong khoảng 0 – 100.';
      if (min > max) return '% tối thiểu không được lớn hơn % tối đa.';
    }
    return '';
  }, [changedIds, drafts]);

  const handleSave = async () => {
    if (draftError || changedIds.length === 0) return;
    setSaving(true);
    try {
      for (const id of changedIds) {
        await nutritionEngineApi.updateMealDistribution(id, {
          energyPctMin: Number(drafts[id].min),
          energyPctMax: Number(drafts[id].max),
        });
      }
      setMessage({ type: 'success', text: 'Đã lưu phân bổ năng lượng theo bữa.' });
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Không lưu được phân bổ.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(translateText('Khôi phục phân bổ mặc định theo 01/VBHN-BGDĐT cho nhóm tuổi này?'))) return;
    setSaving(true);
    try {
      await nutritionEngineApi.resetMealDistributions(ageGroup);
      setMessage({ type: 'success', text: 'Đã khôi phục phân bổ mặc định.' });
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Không khôi phục được phân bổ mặc định.' });
    } finally {
      setSaving(false);
    }
  };

  const daily = overview?.dailyStandard;
  const atSchool = overview?.totals.atSchool;
  const atHome = overview?.totals.atHome;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center"><PieChart className="w-5 h-5" /></div>
          <div>
            <h3 className="text-sm font-black text-slate-900">{translateText('Bảng phân bổ năng lượng & dinh dưỡng theo bữa trong ngày')}</h3>
            <p className="text-[11px] text-slate-500">{translateText('Mỗi bữa chiếm bao nhiêu % nhu cầu năng lượng cả ngày; lượng Protein / Lipid / Glucid tính theo tỷ lệ P:L:G chuẩn.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {AGE_GROUPS.map(g => (
            <button
              key={g.id}
              onClick={() => setAgeGroup(g.id)}
              className={`px-3 py-2 rounded-2xl text-xs font-bold transition ${ageGroup === g.id ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {translateText(g.label)}
            </button>
          ))}
          <button onClick={load} title={translateText('Làm mới')} className="p-2 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{translateText(message.text)}</span>
          <button className="ml-auto text-[11px] underline" onClick={() => setMessage(null)}>{translateText('Đóng')}</button>
        </div>
      )}

      {overview && daily && atSchool && atHome && (
        <>
          {/* Thanh phân bổ trực quan */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {translateText('Nhu cầu cả ngày:')}{' '}
                  <strong className="text-slate-800">{fmtRange(daily.energy, 0)} {translateText('Kcal')}</strong>
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
                  <Droplets className="w-3 h-3 text-cyan-600" />
                  {translateText('Nước:')} {daily.water ? fmtRange(daily.water, 0) : (ageGroup === 'NHA_TRE' ? '800 – 1.000' : '1.600 – 2.000')} ml
                </span>
                <span>
                  {'• P '}{fmtRange(daily.protein, 0)}% {' • L '}{fmtRange(daily.lipid, 0)}% {' • G '}{fmtRange(daily.carbohydrate, 0)}%
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded-full font-bold ${daily.source === 'SCHOOL_CONFIG' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                {translateText(daily.source === 'SCHOOL_CONFIG' ? `Theo định mức trường: ${daily.standardName}` : daily.standardName)}
              </span>
            </div>
            <div className="flex h-7 w-full rounded-xl overflow-hidden border border-slate-200">
              {overview.meals.map(m => {
                const mid = (m.energyPct.min + m.energyPct.max) / 2;
                return (
                  <div key={m.id} className={`${MEAL_COLORS[m.mealType]?.bar || 'bg-sky-500'} text-white text-[10px] font-bold flex items-center justify-center truncate`} style={{ width: `${mid}%` }} title={`${m.mealLabel}: ${fmtRange(m.energyPct, 0)}%`}>
                    {mid >= 6 ? `${translateText(m.mealLabel)} ${fmtRange(m.energyPct, 0)}%` : ''}
                  </div>
                );
              })}
              <div className="flex-1 bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center truncate" title={translateText('Ăn ở nhà')}>
                {translateText('Ở nhà')} {fmtRange(atHome.energyPct, 0)}%
              </div>
            </div>
            {overview.warnings.map(w => (
              <div key={w} className="flex items-center gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5" /> {translateText(w)}
              </div>
            ))}
          </div>

          {/* Bảng chi tiết */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">{translateText('Bữa ăn')}</th>
                    <th className="py-3.5 px-3">{translateText('Giờ')}</th>
                    <th className="py-3.5 px-3">{translateText('% NL cả ngày')}</th>
                    <th className="py-3.5 px-3 text-right">{translateText('Năng lượng (Kcal)')}</th>
                    <th className="py-3.5 px-3 text-right text-cyan-800 font-extrabold">{translateText('Nước (ml)')}</th>
                    <th className="py-3.5 px-3 text-right">{translateText('Protein (g)')}</th>
                    <th className="py-3.5 px-3 text-right">{translateText('Lipid (g)')}</th>
                    <th className="py-3.5 px-3 text-right">{translateText('Glucid (g)')}</th>
                    <th className="py-3.5 px-5">{translateText('Ghi chú')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.meals.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-5 font-bold text-slate-900">
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${MEAL_COLORS[m.mealType]?.dot || 'bg-sky-500'}`} />
                          {translateText(m.mealLabel)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{m.mealTime || '—'}</td>
                      <td className="py-3 px-3">
                        {canEdit && drafts[m.id] ? (
                          <div className="flex items-center gap-1">
                            {(['min', 'max'] as const).map((key, i) => (
                              <React.Fragment key={key}>
                                {i === 1 && <span className="text-slate-400">–</span>}
                                <input
                                  type="number" min={0} max={100} step={0.5}
                                  value={drafts[m.id][key]}
                                  onChange={e => setDrafts(prev => ({ ...prev, [m.id]: { ...prev[m.id], [key]: e.target.value } }))}
                                  className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-right focus:ring-2 focus:ring-sky-500"
                                />
                              </React.Fragment>
                            ))}
                            <span className="text-slate-400">%</span>
                          </div>
                        ) : (
                          <span className="font-bold">{fmtRange(m.energyPct, 0)}%</span>
                        )}
                      </td>
                      <NutrientCells target={m} />
                      <td className="py-3 px-5 text-[11px] text-slate-500 max-w-xs">{translateText(m.note || '')}</td>
                    </tr>
                  ))}
                  <tr className="bg-sky-50/60 border-t-2 border-sky-100">
                    <td className="py-3 px-5 font-black text-sky-900" colSpan={2}>{translateText('Tổng ăn tại trường')}</td>
                    <td className="py-3 px-3 font-black text-sky-900">
                      {fmtRange(atSchool.energyPct, 0)}%
                      <span className="block text-[10px] font-semibold text-sky-700">{translateText('Khuyến nghị')} {fmtRange(overview.totals.recommendedAtSchoolPct, 0)}%</span>
                    </td>
                    <NutrientCells target={atSchool} strong />
                    <td className="py-3 px-5 text-[11px] text-sky-800">{translateText('Cộng các bữa tại trường')}</td>
                  </tr>
                  <tr className="bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-700" colSpan={2}>{translateText('Ăn ở nhà (sáng sớm & tối)')}</td>
                    <td className="py-3 px-3 font-bold text-slate-700">{fmtRange(atHome.energyPct, 0)}%</td>
                    <NutrientCells target={atHome} />
                    <td className="py-3 px-5 text-[11px] text-slate-500">{translateText('Phần còn lại phụ huynh cần bổ sung')}</td>
                  </tr>
                  <tr className="bg-slate-100/70">
                    <td className="py-3 px-5 font-black text-slate-900" colSpan={2}>{translateText('Cả ngày')}</td>
                    <td className="py-3 px-3 font-black text-slate-900">100%</td>
                    <NutrientCells target={{
                      energyPct: { min: 100, max: 100 },
                      energyKcal: daily.energy,
                      waterMl: daily.water || (ageGroup === 'NHA_TRE' ? { min: 800, max: 1000 } : { min: 1600, max: 2000 }),
                      proteinG: { min: Math.round(daily.energy.min * daily.protein.min / 400 * 10) / 10, max: Math.round(daily.energy.max * daily.protein.max / 400 * 10) / 10 },
                      lipidG: { min: Math.round(daily.energy.min * daily.lipid.min / 900 * 10) / 10, max: Math.round(daily.energy.max * daily.lipid.max / 900 * 10) / 10 },
                      carbohydrateG: { min: Math.round(daily.energy.min * daily.carbohydrate.min / 400 * 10) / 10, max: Math.round(daily.energy.max * daily.carbohydrate.max / 400 * 10) / 10 },
                    }} strong />
                    <td className="py-3 px-5 text-[11px] text-slate-500">{translateText('Nhu cầu khuyến nghị cả ngày')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {draftError && <span className="text-[11px] font-semibold text-red-600 mr-auto">{translateText(draftError)}</span>}
              <button onClick={handleReset} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <RotateCcw className="w-4 h-4" /> {translateText('Khôi phục mặc định')}
              </button>
              <button onClick={handleSave} disabled={saving || !!draftError || changedIds.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/25 disabled:opacity-50">
                <Save className="w-4 h-4" /> {translateText(saving ? 'Đang lưu...' : `Lưu thay đổi${changedIds.length ? ` (${changedIds.length})` : ''}`)}
              </button>
            </div>
          )}
        </>
      )}

      {!overview && !loading && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center text-xs text-slate-400">{translateText('Chưa có dữ liệu phân bổ theo bữa.')}</div>
      )}
    </div>
  );
};

