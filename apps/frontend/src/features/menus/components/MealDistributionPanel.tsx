import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  PieChart,
  RefreshCw,
  RotateCcw,
  Save,
} from 'lucide-react';
import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import {
  nutritionEngineApi,
  MealDistributionOverview,
  MealNutrientTarget,
  NutrientRange,
} from '../api/nutrition-rule-engine.api';

const MEAL_COLORS: Record<string, { bar: string; dot: string }> = {
  BREAKFAST: { bar: 'bg-amber-400', dot: 'bg-amber-400' },
  MORNING_SNACK: { bar: 'bg-yellow-400', dot: 'bg-yellow-400' },
  LUNCH: { bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  AFTERNOON_SNACK: { bar: 'bg-purple-500', dot: 'bg-purple-500' },
  LATE_SNACK: { bar: 'bg-orange-500', dot: 'bg-orange-500' },
};

const fmtRange = (r: NutrientRange, digits = 1) =>
  r.min === r.max ? r.min.toFixed(digits) : `${r.min.toFixed(digits)} – ${r.max.toFixed(digits)}`;

const repairMojibake = (value: string) => {
  if (!value) return '';
  return value
    .replace(/Buá»•i sÃ¡ng/g, 'Buổi sáng')
    .replace(/Bá»¯a trÆ°a chÃ[\u0080-\u00ff]?nh/g, 'Bữa trưa chính')
    .replace(/Buá»•i xáº¿/g, 'Buổi phụ')
    .replace(/Buổi xế/g, 'Buổi phụ')
    .replace(/Buá»•i chiá»[\u0080-\u00ff]?u phá»¥/g, 'Buổi chiều xế')
    .replace(/Buổi chiều phụ/g, 'Buổi chiều xế')
    .replace(/Bá»¯a phá»¥ buá»•i sÃ¡ng/g, 'Bữa phụ buổi sáng')
    .replace(/Bá»¯a chÃ[\u0080-\u00ff]?nh trÆ°a/g, 'Bữa chính trưa')
    .replace(/Bá»¯a trÆ°a cung cáº¥p/g, 'Bữa trưa cung cấp')
    .replace(/gá»“m bÃ¡t canh/g, 'gồm bát canh')
    .replace(/Ä‘áº§y/g, 'đầy')
    .replace(/nÆ°á»›c trÃ¡ng miá»‡ng/g, 'nước tráng miệng')
    .replace(/nÆ°á»›c uá»‘ng/g, 'nước uống')
    .replace(/trÃ¡i cÃ¢y/g, 'trái cây')
    .replace(/sá»¯a/g, 'sữa')
    .replace(/lÃºc 14h30/g, 'lúc 14h30')
    .replace(/lÃºc 17h/g, 'lúc 17h')
    .replace(/mÃ³n Äƒn/g, 'món ăn')
    .replace(/chÃ¡o/g, 'cháo')
    .replace(/bÃºn/g, 'bún')
    .replace(/bÃ¡nh máº·n/g, 'bánh mặn')
    .replace(/nÄƒng lÆ°á»£ng/g, 'năng lượng')
    .replace(/cáº£ ngÃ y/g, 'cả ngày')
    .replace(/táº¡i trÆ°á»[\u0080-\u00ff]?ng/g, 'tại trường')
    .replace(/â€“/g, '–');
};

const stripParentheses = (value: string) =>
  value
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+\./g, '.')
    .trim();

const displayText = (value: string) => translateText(stripParentheses(repairMojibake(value)));

const NutrientCells: React.FC<{ target: MealNutrientTarget; strong?: boolean }> = ({
  target,
  strong,
}) => (
  <>
    <td
      className={`py-3 px-4 text-right ${
        strong ? 'font-black text-slate-900' : 'font-bold text-slate-800'
      }`}
    >
      {fmtRange(target.energyKcal, 0)} kcal
    </td>
    <td
      className={`py-3 px-4 text-right font-bold ${
        strong ? 'text-cyan-950 font-black' : 'text-cyan-700'
      }`}
    >
      {target.waterMl ? `${fmtRange(target.waterMl, 0)} ml` : '—'}
    </td>
    <td className="py-3 px-4 text-right text-blue-800 font-semibold">
      {fmtRange(target.proteinG)} g
    </td>
    <td className="py-3 px-4 text-right text-amber-800 font-semibold">
      {fmtRange(target.lipidG)} g
    </td>
    <td className="py-3 px-4 text-right text-emerald-800 font-semibold">
      {fmtRange(target.carbohydrateG)} g
    </td>
  </>
);

export const MealDistributionPanel: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  useLanguage();
  const [ageGroup] = useState<string>('MAU_GIAO');
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
      setDrafts(
        Object.fromEntries(
          data.meals.map((m) => [
            m.id,
            { min: String(m.energyPct.min), max: String(m.energyPct.max) },
          ]),
        ),
      );
    } catch (err: any) {
      setOverview(null);
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Không tải được bảng phân bổ theo bữa.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [ageGroup]);

  const changedIds = useMemo(
    () =>
      (overview?.meals || [])
        .filter(
          (m) =>
            drafts[m.id] &&
            (Number(drafts[m.id].min) !== m.energyPct.min ||
              Number(drafts[m.id].max) !== m.energyPct.max),
        )
        .map((m) => m.id),
    [overview, drafts],
  );

  const draftError = useMemo(() => {
    for (const id of changedIds) {
      const d = drafts[id];
      const min = Number(d.min),
        max = Number(d.max);
      if (d.min === '' || d.max === '' || !Number.isFinite(min) || !Number.isFinite(max))
        return 'Vui lòng nhập số % hợp lệ.';
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
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Không lưu được phân bổ.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(translateText('Khôi phục phân bổ năng lượng mặc định cho khối Mẫu giáo?')))
      return;
    setSaving(true);
    try {
      await nutritionEngineApi.resetMealDistributions(ageGroup);
      setMessage({ type: 'success', text: 'Đã khôi phục phân bổ mặc định.' });
      await load();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Không khôi phục được phân bổ mặc định.',
      });
    } finally {
      setSaving(false);
    }
  };

  const daily = overview?.dailyStandard;
  const atSchool = overview?.totals.atSchool;
  const atHome = overview?.totals.atHome;

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>{translateText(message.text)}</span>
          <button
            type="button"
            className="ml-auto text-[11px] underline cursor-pointer"
            onClick={() => setMessage(null)}
          >
            {translateText('Đóng')}
          </button>
        </div>
      )}

      {overview && daily && atSchool && atHome && (
        <>
          {/* Thanh phân bổ trực quan & nút thao tác */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                  <PieChart className="w-4 h-4 text-teal-600" />
                  <span>{translateText('Nhu cầu cả ngày:')}</span>
                  <strong className="text-teal-700">
                    {fmtRange(daily.energy, 0)} {translateText('Kcal')}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-lg">
                  <Droplets className="w-3 h-3 text-cyan-600" />
                  {translateText('Nước:')}{' '}
                  {daily.water ? fmtRange(daily.water, 0) : '1.600 – 2.000'} ml
                </span>
                <span className="font-semibold text-slate-600">
                  · Đạm {fmtRange(daily.protein, 0)}% · Béo {fmtRange(daily.lipid, 0)}% · Bột đường{' '}
                  {fmtRange(daily.carbohydrate, 0)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/80">
                  {displayText(
                    daily.source === 'SCHOOL_CONFIG'
                      ? `Định mức trường · ${daily.standardName}`
                      : daily.standardName,
                  )}
                </span>
                <button
                  type="button"
                  onClick={load}
                  title={translateText('Làm mới')}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex h-7 w-full rounded-xl overflow-hidden border border-slate-200">
              {overview.meals.map((m) => {
                const mid = (m.energyPct.min + m.energyPct.max) / 2;
                return (
                  <div
                    key={m.id}
                    className={`${
                      MEAL_COLORS[m.mealType]?.bar || 'bg-teal-500'
                    } text-white text-[11px] font-bold flex items-center justify-center truncate px-1`}
                    style={{ width: `${mid}%` }}
                    title={`${displayText(m.mealLabel)}: ${fmtRange(m.energyPct, 0)}%`}
                  >
                    {mid >= 6 ? `${displayText(m.mealLabel)} ${fmtRange(m.energyPct, 0)}%` : ''}
                  </div>
                );
              })}
              <div
                className="flex-1 bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center truncate px-1"
                title={translateText('Ăn tại gia đình')}
              >
                {translateText('Tại gia đình')} {fmtRange(atHome.energyPct, 0)}%
              </div>
            </div>

            {overview.warnings.map((w) => (
              <div
                key={w}
                className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{displayText(w)}</span>
              </div>
            ))}
          </div>

          {/* Banner Phân bổ Năng Lượng theo 2 Cấu hình */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 text-xs">
              <span className="font-bold text-teal-900 block mb-1">
                {translateText("Cấu hình 1 (3 bữa cơ bản: Sáng, Trưa, Phụ 14:30)")}
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {translateText("Tổng năng lượng bán trú tiêu chuẩn đạt 50–55% (~615 – 726 Kcal). Áp dụng cho toàn bộ trẻ chưa đăng ký gói ăn xế.")}
              </p>
            </div>
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs">
              <span className="font-bold text-amber-900 block mb-1">
                {translateText("Cấu hình 2 (Bổ sung Buổi chiều xế 17:00 khi đóng tiền)")}
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {translateText("Món ăn Buổi chiều xế (+5–10% kcal, ~150–200 Kcal) sẽ tự động được tính vào Cấu hình thứ 2 khi phụ huynh đóng tiền, đưa tổng năng lượng đạt 60–70% (~765 – 926 Kcal).")}
              </p>
            </div>
          </div>

          {/* Bảng chi tiết */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-teal-700 bg-teal-600 text-[11px] font-bold text-white uppercase tracking-wider">
                    <th className="py-3 px-4">{translateText('Bữa ăn')}</th>
                    <th className="py-3 px-3">{translateText('Giờ ăn')}</th>
                    <th className="py-3 px-3">{translateText('Tỷ lệ năng lượng')}</th>
                    <th className="py-3 px-4 text-right">{translateText('Năng lượng')}</th>
                    <th className="py-3 px-4 text-right text-cyan-800">
                      {translateText('Lượng nước')}
                    </th>
                    <th className="py-3 px-4 text-right">{translateText('Chất đạm')}</th>
                    <th className="py-3 px-4 text-right">{translateText('Chất béo')}</th>
                    <th className="py-3 px-4 text-right">{translateText('Bột đường')}</th>
                    <th className="py-3 px-4">{translateText('Mô tả bữa ăn')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.meals.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              MEAL_COLORS[m.mealType]?.dot || 'bg-teal-500'
                            }`}
                          />
                          {displayText(m.mealLabel)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-semibold whitespace-nowrap">
                        {m.mealTime || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {canEdit && drafts[m.id] ? (
                          <div className="flex items-center gap-1">
                            {(['min', 'max'] as const).map((key, i) => (
                              <React.Fragment key={key}>
                                {i === 1 && <span className="text-slate-400">–</span>}
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={drafts[m.id][key]}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [m.id]: { ...prev[m.id], [key]: e.target.value },
                                    }))
                                  }
                                  className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </React.Fragment>
                            ))}
                            <span className="text-slate-500 font-semibold">%</span>
                          </div>
                        ) : (
                          <span className="font-bold">{fmtRange(m.energyPct, 0)}%</span>
                        )}
                      </td>
                      <NutrientCells target={m} />
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                        {displayText(m.note || '')}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-teal-50/50 border-t-2 border-teal-100">
                    <td className="py-3 px-4 font-black text-teal-900" colSpan={2}>
                      {translateText('Tổng ăn tại trường')}
                    </td>
                    <td className="py-3 px-3 font-black text-teal-900">
                      {fmtRange(atSchool.energyPct, 0)}%
                      <span className="block text-[10px] font-semibold text-teal-700">
                        {translateText('Chuẩn khuyến nghị')}{' '}
                        {fmtRange(overview.totals.recommendedAtSchoolPct, 0)}%
                      </span>
                    </td>
                    <NutrientCells target={atSchool} strong />
                    <td className="py-3 px-4 text-xs font-semibold text-teal-800">
                      {translateText('Tổng cộng các bữa ăn tại trường')}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-700" colSpan={2}>
                      {translateText('Ăn tại gia đình')}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-700">
                      {fmtRange(atHome.energyPct, 0)}%
                    </td>
                    <NutrientCells target={atHome} />
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {translateText('Phần năng lượng bổ sung tại nhà')}
                    </td>
                  </tr>
                  <tr className="bg-slate-100/80">
                    <td className="py-3 px-4 font-black text-slate-900" colSpan={2}>
                      {translateText('Tổng nhu cầu cả ngày')}
                    </td>
                    <td className="py-3 px-3 font-black text-slate-900">100%</td>
                    <NutrientCells
                      target={{
                        energyPct: { min: 100, max: 100 },
                        energyKcal: daily.energy,
                        waterMl: daily.water || { min: 1600, max: 2000 },
                        proteinG: {
                          min: Math.round(((daily.energy.min * daily.protein.min) / 400) * 10) / 10,
                          max: Math.round(((daily.energy.max * daily.protein.max) / 400) * 10) / 10,
                        },
                        lipidG: {
                          min: Math.round(((daily.energy.min * daily.lipid.min) / 900) * 10) / 10,
                          max: Math.round(((daily.energy.max * daily.lipid.max) / 900) * 10) / 10,
                        },
                        carbohydrateG: {
                          min:
                            Math.round(((daily.energy.min * daily.carbohydrate.min) / 400) * 10) /
                            10,
                          max:
                            Math.round(((daily.energy.max * daily.carbohydrate.max) / 400) * 10) /
                            10,
                        },
                      }}
                      strong
                    />
                    <td className="py-3 px-4 text-xs font-semibold text-slate-600">
                      {translateText('Tổng định mức khuyến nghị 24 giờ')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {draftError && (
                <span className="text-xs font-semibold text-rose-600 mr-auto">
                  {translateText(draftError)}
                </span>
              )}
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{translateText('Khôi phục mặc định')}</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !!draftError || changedIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{translateText(saving ? 'Đang lưu...' : 'Lưu thay đổi')}</span>
              </button>
            </div>
          )}
        </>
      )}

      {!overview && !loading && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-xs text-slate-400">
          {translateText('Chưa có dữ liệu phân bổ theo bữa.')}
        </div>
      )}
    </div>
  );
};
