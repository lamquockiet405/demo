import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from "react";
import { X, Sparkles, Scale, AlertCircle, Check, Droplets } from "lucide-react";
import {
  NutritionRule,
  CreateNutritionRulePayload,
  UpdateNutritionRulePayload,
} from "../api/nutrition-rule-engine.api";

interface NutritionRuleDrawerProps {
  isOpen: boolean;
  rule: NutritionRule | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (
    payload: CreateNutritionRulePayload | UpdateNutritionRulePayload,
    id?: string,
  ) => Promise<void>;
}

const DEFAULT_FORM = {
  name: "",
  targetAgeGroup: "KINDERGARTEN_3_4Y",
  mealScope: "DAYBOARDING",
  minCaloriesKcal: "" as any,
  maxCaloriesKcal: "" as any,
  minProteinPercent: "" as any,
  maxProteinPercent: "" as any,
  minFatPercent: "" as any,
  maxFatPercent: "" as any,
  minCarbPercent: "" as any,
  maxCarbPercent: "" as any,
  waterMlMin: "" as any,
  waterMlMax: "" as any,
  minCalciumMg: "" as any,
  minIronMg: "" as any,
  minZincMg: "" as any,
  maxSodiumMg: "" as any,
  caPRatioMin: "" as any,
  caPRatioMax: "" as any,
  isStrict: true,
  isActive: true,
};

const MACRO_CONFIG = [
  {
    label: "Chất Đạm (Protein - P)",
    minKey: "minProteinPercent",
    maxKey: "maxProteinPercent",
    box: "bg-blue-50/60 border-blue-200/70",
    title: "text-blue-900",
    sub: "text-blue-700",
    input: "border-blue-200",
  },
  {
    label: "Chất Béo (Lipid - L)",
    minKey: "minFatPercent",
    maxKey: "maxFatPercent",
    box: "bg-amber-50/60 border-amber-200/70",
    title: "text-amber-900",
    sub: "text-amber-700",
    input: "border-amber-200",
  },
  {
    label: "Chất Bột Đường (Glucid - G)",
    minKey: "minCarbPercent",
    maxKey: "maxCarbPercent",
    box: "bg-emerald-50/60 border-emerald-200/70",
    title: "text-emerald-900",
    sub: "text-emerald-700",
    input: "border-emerald-200",
  },
] as const;

export const NutritionRuleDrawer: React.FC<NutritionRuleDrawerProps> = ({
  isOpen,
  rule,
  isLoading,
  onClose,
  onSubmit,
}) => {
  useLanguage();
  const isEditMode = Boolean(rule);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    if (rule) {
      setForm({
        name: rule.name || "",
        targetAgeGroup: rule.targetAgeGroup || "KINDERGARTEN_3_4Y",
        mealScope: rule.mealScope || "DAYBOARDING",
        minCaloriesKcal:
          rule.minCaloriesKcal == null ? "" : Number(rule.minCaloriesKcal),
        maxCaloriesKcal:
          rule.maxCaloriesKcal == null ? "" : Number(rule.maxCaloriesKcal),
        minProteinPercent:
          rule.minProteinPercent == null ? "" : Number(rule.minProteinPercent),
        maxProteinPercent:
          rule.maxProteinPercent == null ? "" : Number(rule.maxProteinPercent),
        minFatPercent:
          rule.minFatPercent == null ? "" : Number(rule.minFatPercent),
        maxFatPercent:
          rule.maxFatPercent == null ? "" : Number(rule.maxFatPercent),
        minCarbPercent:
          rule.minCarbPercent == null ? "" : Number(rule.minCarbPercent),
        maxCarbPercent:
          rule.maxCarbPercent == null ? "" : Number(rule.maxCarbPercent),
        waterMlMin:
          rule.waterMlMin == null ? "" : Number(rule.waterMlMin),
        waterMlMax:
          rule.waterMlMax == null ? "" : Number(rule.waterMlMax),
        minCalciumMg:
          rule.minCalciumMg == null ? "" : Number(rule.minCalciumMg),
        minIronMg: rule.minIronMg == null ? "" : Number(rule.minIronMg),
        minZincMg: rule.minZincMg == null ? "" : Number(rule.minZincMg),
        maxSodiumMg: rule.maxSodiumMg == null ? "" : Number(rule.maxSodiumMg),
        caPRatioMin: rule.caPRatioMin == null ? "" : Number(rule.caPRatioMin),
        caPRatioMax: rule.caPRatioMax == null ? "" : Number(rule.caPRatioMax),
        isStrict: rule.isStrict ?? true,
        isActive: rule.isActive ?? true,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [isOpen, rule]);

  const setNum = (key: keyof typeof DEFAULT_FORM, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val.trim() ? Number(val) : "" }));

  const applyPreset = (age: string, scope = form.mealScope) =>
    setForm((prev) => ({ ...prev, targetAgeGroup: age, mealScope: scope }));
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!form.name.trim())
      return setErrorMessage("Vui lòng nhập tên quy chuẩn dinh dưỡng.");
    if (form.maxCaloriesKcal < form.minCaloriesKcal)
      return setErrorMessage(
        "Năng lượng tối đa không thể nhỏ hơn năng lượng tối thiểu.",
      );
    if (form.maxProteinPercent < form.minProteinPercent)
      return setErrorMessage(
        "Tỷ lệ Protein tối đa không thể nhỏ hơn tối thiểu.",
      );
    if (form.maxFatPercent < form.minFatPercent)
      return setErrorMessage("Tỷ lệ Lipid tối đa không thể nhỏ hơn tối thiểu.");
    if (form.maxCarbPercent < form.minCarbPercent)
      return setErrorMessage(
        "Tỷ lệ Glucid tối đa không thể nhỏ hơn tối thiểu.",
      );
    if (
      form.waterMlMin !== "" &&
      form.waterMlMax !== "" &&
      Number(form.waterMlMax) < Number(form.waterMlMin)
    ) {
      return setErrorMessage(
        "Nhu cầu nước tối đa không thể nhỏ hơn nước tối thiểu.",
      );
    }

    try {
      const requiredKeys = [
        "minCaloriesKcal",
        "maxCaloriesKcal",
        "minProteinPercent",
        "maxProteinPercent",
        "minFatPercent",
        "maxFatPercent",
        "minCarbPercent",
        "maxCarbPercent",
      ];
      if (requiredKeys.some((key) => form[key] === "" || form[key] == null))
        return setErrorMessage(
          "Nhập đầy đủ năng lượng và tỷ lệ đạm, béo, bột đường.",
        );
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          value === "" && key !== "name" ? undefined : value,
        ]),
      );
      await onSubmit(
        { ...payload, name: form.name.trim() } as CreateNutritionRulePayload,
        rule?.id,
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Lỗi khi lưu quy chuẩn dinh dưỡng.";
      setErrorMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {translateText(isEditMode
                  ? "Chỉnh Sửa Tiêu Chuẩn Dinh Dưỡng"
                  : "Thêm Tiêu Chuẩn Dinh Dưỡng Mới")}
              </h2>
              <p className="text-xs text-slate-400 font-medium">{translateText("Cấu hình năng lượng Calo và tỷ lệ P-L-G chuẩn Thông tư 28")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          id="nutrition-rule-drawer-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs"
        >
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{translateText(errorMessage)}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">{translateText("Tên quy chuẩn dinh dưỡng ")}<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={translateText("Ví dụ: Quy chuẩn Mẫu giáo Cơ sở Sao Mai")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700">{translateText("Nhóm lứa tuổi học sinh ")}<span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-teal-600 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />{translateText(" Gợi ý chuẩn TT 28")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: "NHA_TRE",
                    title: translateText("Nhà trẻ (12 - 36 tháng)"),
                    desc: "600 - 651 Kcal (60-70%) • P:13-20% L:30-40% G:47-50%",
                    match: ["TODDLER_18_36M", "NHA_TRE"],
                  },
                  {
                    id: "MAU_GIAO",
                    title: translateText("Mẫu giáo (3 - 6 tuổi)"),
                    desc: "615 - 726 Kcal (50-55%) • P:13-20% L:25-35% G:52-60%",
                    match: [
                      "KINDERGARTEN_3_4Y",
                      "KINDERGARTEN_4_5Y",
                      "KINDERGARTEN_5_6Y",
                      "MAU_GIAO",
                    ],
                  },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={`py-2 px-3 rounded-xl border text-left font-semibold transition ${
                      p.match.includes(form.targetAgeGroup)
                        ? "border-teal-500 bg-teal-50 text-teal-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-bold">{translateText(p.title)}</p>
                    <p className="text-[10px] text-slate-500 font-normal">
                      {translateText(p.desc)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">{translateText("Phạm vi bữa ăn áp dụng (Theo Thông tư 28/51)")}</label>
              <select
                value={form.mealScope}
                onChange={(e) =>
                  applyPreset(form.targetAgeGroup, e.target.value)
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 bg-white"
              >
                <option value="DAYBOARDING">{translateText("Bán trú tại trường (Nhà trẻ: 2 chính + 1 phụ [60-70%] • Mẫu giáo: 1 chính + 1 phụ [50-55%])")}</option>
                <option value="FULL_DAY">{translateText("Cả ngày (100% nhu cầu khuyến nghị VN-RDA)")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold uppercase tracking-wider text-slate-400">{translateText("1. Nhu Cầu Năng Lượng (Kcal)")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{translateText("Calo tối thiểu (Kcal)")}</label>
                <input
                  type="number"
                  required
                  value={form.minCaloriesKcal}
                  onChange={(e) => setNum("minCaloriesKcal", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{translateText("Calo tối đa (Kcal)")}</label>
                <input
                  type="number"
                  required
                  value={form.maxCaloriesKcal}
                  onChange={(e) => setNum("maxCaloriesKcal", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold uppercase tracking-wider text-slate-400">{translateText("2. Cơ Cấu Tỷ Lệ Năng Lượng (P : L : G)")}</h3>
              <span className="text-[10px] text-slate-400 italic">{translateText("Tổng tỷ lệ = 100%")}</span>
            </div>
            {MACRO_CONFIG.map((m) => (
              <div
                key={m.label}
                className={`p-3 border rounded-2xl space-y-2 ${m.box}`}
              >
                <span className={`font-bold block ${m.title}`}>{translateText(m.label)}</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[11px] ${m.sub}`}>{translateText("Tối thiểu (%)")}</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form[m.minKey]}
                      onChange={(e) => setNum(m.minKey, e.target.value)}
                      className={`w-full px-3 py-1.5 bg-white rounded-lg border font-bold text-slate-800 ${m.input}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[11px] ${m.sub}`}>{translateText("Tối đa (%)")}</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form[m.maxKey]}
                      onChange={(e) => setNum(m.maxKey, e.target.value)}
                      className={`w-full px-3 py-1.5 bg-white rounded-lg border font-bold text-slate-800 ${m.input}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold uppercase tracking-wider text-slate-400">{translateText("3. Vi Chất & Tỷ Lệ Canxi / Photpho")}</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: "Canxi (mg)", key: "minCalciumMg" as const },
                { label: translateText("Sắt (mg)"), key: "minIronMg" as const },
                { label: translateText("Kẽm (mg)"), key: "minZincMg" as const },
              ].map((mi) => (
                <div key={mi.key}>
                  <label className="text-slate-600 font-semibold block mb-1">
                    {translateText(mi.label)}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={form[mi.key]}
                    onChange={(e) => setNum(mi.key, e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">{translateText("Tỷ lệ Ca:P Min")}</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.caPRatioMin}
                  onChange={(e) => setNum("caPRatioMin", e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold"
                />
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">{translateText("Tỷ lệ Ca:P Max")}</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.caPRatioMax}
                  onChange={(e) => setNum("caPRatioMax", e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-cyan-600" />
                {translateText("4. Nhu Cầu Nước Cần Thiết (ml)")}
              </h3>
              <span className="text-[10px] text-cyan-700 font-semibold bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                {translateText("Nước uống, sữa & canh")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-xs">
                  {translateText("Nước tối thiểu (ml)")}
                </label>
                <input
                  type="number"
                  step="10"
                  value={form.waterMlMin}
                  onChange={(e) => setNum("waterMlMin", e.target.value)}
                  placeholder="VD: 800"
                  className="w-full px-3 py-2 rounded-xl border border-cyan-200 text-sm font-bold text-slate-800 bg-cyan-50/20"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-xs">
                  {translateText("Nước tối đa (ml)")}
                </label>
                <input
                  type="number"
                  step="10"
                  value={form.waterMlMax}
                  onChange={(e) => setNum("waterMlMax", e.target.value)}
                  placeholder="VD: 1100"
                  className="w-full px-3 py-2 rounded-xl border border-cyan-200 text-sm font-bold text-slate-800 bg-cyan-50/20"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 italic">
              {translateText("Theo 01/VBHN-BGDĐT: Mẫu giáo bán trú 800–1.100 ml (cả ngày 1.600–2.000 ml); Nhà trẻ bán trú 500–700 ml (cả ngày 800–1.000 ml).")}
            </p>
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >{translateText("Hủy bỏ")}</button>
          <button
            type="submit"
            form="nutrition-rule-drawer-form"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>
              {translateText(isLoading
                ? "Đang lưu..."
                : isEditMode
                  ? "Lưu Thay Đổi"
                  : "Tạo Tiêu Chuẩn")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
