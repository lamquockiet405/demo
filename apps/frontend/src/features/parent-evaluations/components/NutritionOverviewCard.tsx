import React from "react";
import { Activity } from "lucide-react";

type Nutrition = Partial<
  Record<
    "calories" | "proteinG" | "fatG" | "carbG" | "calciumMg" | "fiberG",
    number | null
  >
>;
export const NutritionOverviewCard: React.FC<{ nutrition?: Nutrition }> = ({
  nutrition,
}) => {
  const value = (amount: number | null | undefined) =>
    amount == null
      ? "—"
      : amount.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  const fields: [keyof Nutrition, string, string, string][] = [
    ["calories", "Năng lượng", "kcal", "bg-amber-50 border-amber-200"],
    ["proteinG", "Chất đạm", "g", "bg-red-50 border-red-200"],
    ["fatG", "Chất béo", "g", "bg-yellow-50 border-yellow-200"],
    ["carbG", "Tinh bột", "g", "bg-teal-50 border-teal-200"],
    ["calciumMg", "Canxi", "mg", "bg-sky-50 border-sky-200"],
    ["fiberG", "Chất xơ", "g", "bg-emerald-50 border-emerald-200"],
  ];
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center">
          <Activity size={21} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Dinh dưỡng theo thực đơn đã công bố
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Tổng theo định lượng món trong ngày đang xem. “—” là chưa có đủ số
            liệu.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {fields.map(([key, label, unit, color]) => (
          <div
            className={`border p-3 rounded-xl text-center ${color}`}
            key={key}
          >
            <span className="text-[11px] font-semibold text-slate-700 block">
              {label}
            </span>
            <strong className="text-lg text-slate-900 block mt-1">
              {value(nutrition?.[key])}
            </strong>
            <small className="text-slate-500">{unit}</small>
          </div>
        ))}
      </div>
    </section>
  );
};
