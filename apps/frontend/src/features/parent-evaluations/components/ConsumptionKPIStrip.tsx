import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { Utensils, ShieldCheck, Flame } from 'lucide-react';
import { ChildMenuConsumptionData } from '../types';

interface ConsumptionKPIStripProps {
  metrics: ChildMenuConsumptionData['metrics'];
  totalMenuCalories?: number;
  totalEatenCalories?: number;
}

export const ConsumptionKPIStrip: React.FC<ConsumptionKPIStripProps> = ({
  metrics,
  totalMenuCalories = 0,
  totalEatenCalories = 0,
}) => {
  useLanguage();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
      {/* KPI 1: Tỷ lệ ăn hết suất */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700">{translateText("Sức ăn hôm nay")}</span>
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
            <Utensils className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{metrics.consumptionRate}%</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {translateText(metrics.consumptionStatusLabel)}
          </p>
        </div>
        {/* Progress mini bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
          <div
            className="bg-teal-600 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, metrics.consumptionRate)}%` }}
          ></div>
        </div>
      </div>

      {/* KPI 2: Năng lượng (Calo) bé ăn hôm nay */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700">{translateText("Calo bé ăn hôm nay")}</span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">
              {Math.round(totalEatenCalories).toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {totalMenuCalories > 0
                ? `/ ${Math.round(totalMenuCalories).toLocaleString('vi-VN')} kcal`
                : 'kcal'}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {totalMenuCalories > 0
              ? translateText(`Đạt ${Math.round((totalEatenCalories / totalMenuCalories) * 100)}% năng lượng thực đơn`)
              : translateText("Chưa có dữ liệu định lượng calo thực đơn")}
          </p>
        </div>
      </div>

      {/* KPI 3: An toàn dị ứng */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700">{translateText("An toàn dị ứng")}</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
            {translateText(metrics.allergyStatusText)}
          </p>
        </div>
      </div>
    </div>
  );
};
