import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from "react";
import { X, Sparkles, Activity, AlertCircle, Check } from "lucide-react";
import { NutritionIntakeStandard } from "../api/nutrition-rule-engine.api";

interface IntakeStandardDrawerProps {
  isOpen: boolean;
  standard: NutritionIntakeStandard | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (
    payload: Partial<NutritionIntakeStandard>,
    id?: number,
  ) => Promise<void>;
}

const DEFAULT_FORM: Partial<NutritionIntakeStandard> = {
  standardName: "",
  ageGroup: "MAU_GIAO",
  gender: "ALL",
  mealScope: "DAYBOARDING",
  energyKcalMin: null,
  energyKcalMax: null,
  proteinRatioMin: null,
  proteinRatioMax: null,
  lipidRatioMin: null,
  lipidRatioMax: null,
  carbohydrateRatioMin: null,
  carbohydrateRatioMax: null,
  fiberGMin: null,
  fiberGMax: null,
  calciumMgMin: null,
  ironAbsorptionRate: null,
  ironMgMin: null,
  zincAbsorptionLevel: null,
  zincMgMin: null,
  vitaminARaeMcgMin: null,
  isActive: true,
  note: "",
};

export const IntakeStandardDrawer: React.FC<IntakeStandardDrawerProps> = ({
  isOpen,
  standard,
  isLoading,
  onClose,
  onSubmit,
}) => {
  useLanguage();
  const isEditMode = Boolean(standard);
  const [form, setForm] =
    useState<Partial<NutritionIntakeStandard>>(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    if (standard) {
      setForm({ ...standard });
    } else {
      setForm({ ...DEFAULT_FORM });
    }
  }, [isOpen, standard]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!form.standardName?.trim()) {
      setErrorMessage("Vui lòng nhập tên định mức dinh dưỡng");
      return;
    }
    if ((form.energyKcalMin ?? 0) > (form.energyKcalMax ?? 0)) {
      setErrorMessage(
        "Năng lượng tối thiểu không được lớn hơn năng lượng tối đa",
      );
      return;
    }

    try {
      await onSubmit(form, standard?.id);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          "Có lỗi xảy ra khi lưu định mức dinh dưỡng",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-purple-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {translateText(isEditMode
                  ? "Chỉnh sửa Định mức Dinh dưỡng & Vi chất"
                  : "Thêm mới Định mức Dinh dưỡng (Phụ lục 1-6)")}
              </h3>
              <p className="text-xs text-slate-500">{translateText("Nhu cầu Năng lượng (Kcal), Tỷ lệ P:L:G, Chất xơ, Sắt, Kẽm, Canxi, Vitamin A theo lứa tuổi")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          id="intake-standard-form"
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto flex-1 space-y-4"
        >
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{translateText(errorMessage)}</span>
            </div>
          )}

          {/* Tên định mức */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Tên định mức chuẩn ")}<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.standardName || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, standardName: e.target.value }))
              }
              placeholder={translateText("VD: Định mức chuẩn Mẫu giáo bán trú (3-6 tuổi)")}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* Lứa tuổi, Giới tính, Phạm vi */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Lứa tuổi")}</label>
              <select
                value={form.ageGroup}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ageGroup: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="MAU_GIAO">{translateText("Mẫu giáo (3 - 6T)")}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Giới tính")}</label>
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, gender: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="ALL">{translateText("Chung (Nam & Nữ)")}</option>
                <option value="MALE">{translateText("Học sinh Nam")}</option>
                <option value="FEMALE">{translateText("Học sinh Nữ")}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Phạm vi bữa ăn")}</label>
              <select
                value={form.mealScope}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, mealScope: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="DAYBOARDING">{translateText("Bán trú (50-55%)")}</option>
                <option value="ALL_DAY">{translateText("Cả ngày (100%)")}</option>
                <option value="LUNCH_ONLY">{translateText("Chỉ bữa trưa (35%)")}</option>
              </select>
            </div>
          </div>

          {/* Phụ lục 1: Năng lượng Kcal */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-amber-900 block">{translateText("⚡ Phụ lục 1: Nhu cầu Năng lượng (Kcal)")}</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-amber-800 font-medium">{translateText("Năng lượng tối thiểu")}</label>
                <input
                  type="number"
                  value={form.energyKcalMin ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      energyKcalMin: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-amber-800 font-medium">{translateText("Năng lượng tối đa")}</label>
                <input
                  type="number"
                  value={form.energyKcalMax ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      energyKcalMax: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Cân đối P:L:G (%) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-800 block">{translateText("🥗 Tỷ lệ năng lượng P : L : G (%) theo Thông tư 28")}</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-600 font-medium">{translateText("Đạm (Protein: 13-20%)")}</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    placeholder={translateText("Min")}
                    value={form.proteinRatioMin ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        proteinRatioMin: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-1/2 px-1.5 py-1 text-xs border rounded bg-white text-center"
                  />
                  <input
                    type="number"
                    placeholder={translateText("Max")}
                    value={form.proteinRatioMax ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        proteinRatioMax: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-1/2 px-1.5 py-1 text-xs border rounded bg-white text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-600 font-medium">{translateText("Béo (Lipid: 25-35%)")}</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    placeholder={translateText("Min")}
                    value={form.lipidRatioMin ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        lipidRatioMin: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-1/2 px-1.5 py-1 text-xs border rounded bg-white text-center"
                  />
                  <input
                    type="number"
                    placeholder={translateText("Max")}
                    value={form.lipidRatioMax ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        lipidRatioMax: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-1/2 px-1.5 py-1 text-xs border rounded bg-white text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-600 font-medium">{translateText("Đường (Glucid: 52-60%)")}</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    placeholder={translateText("Min")}
                    value={form.carbohydrateRatioMin ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        carbohydrateRatioMin: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-1/2 px-1.5 py-1 text-xs border rounded bg-white text-center"
                  />
                  <input
                    type="number"
                    placeholder={translateText("Max")}
                    value={form.carbohydrateRatioMax ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        carbohydrateRatioMax: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-1/2 px-1.5 py-1 text-xs border rounded bg-white text-center"
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">{translateText("Để trống chỉ tiêu chưa có nguồn định mức. Không tự điền số 0 hoặc dùng giá trị mặc định.")}</p>
          {/* Phụ lục 2 & 3: Chất xơ (g) & Canxi (mg) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-emerald-900 block">{translateText("🌾 Phụ lục 2: Chất xơ (g)")}</span>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  placeholder={translateText("Min")}
                  value={form.fiberGMin ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      fiberGMin:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="w-1/2 px-2 py-1 text-xs border border-emerald-300 rounded bg-white text-center"
                />
                <input
                  type="number"
                  placeholder={translateText("Max")}
                  value={form.fiberGMax ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      fiberGMax:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="w-1/2 px-2 py-1 text-xs border border-emerald-300 rounded bg-white text-center"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-blue-900 block">{translateText("🥛 Phụ lục 3: Canxi (mg)")}</span>
              <input
                type="number"
                placeholder={translateText("Canxi tối thiểu (mg)")}
                value={form.calciumMgMin ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    calciumMgMin:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="w-full px-2.5 py-1 text-xs border border-blue-300 rounded bg-white"
              />
            </div>
          </div>

          {/* Phụ lục 4 & 5: Sắt & Kẽm */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-rose-900 block">{translateText("🥩 Phụ lục 4: Sắt (mg)")}</span>
              <div className="flex gap-1.5 items-center">
                <select
                  value={form.ironAbsorptionRate ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ironAbsorptionRate: e.target.value || null,
                    }))
                  }
                  className="w-1/2 px-1.5 py-1 text-[11px] border border-rose-300 rounded bg-white"
                >
                  <option value="">{translateText("Chưa xác định")}</option>
                  <option value="10%">{translateText("Hấp thu 10%")}</option>
                  <option value="15%">{translateText("Hấp thu 15%")}</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={form.ironMgMin ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ironMgMin:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="w-1/2 px-2 py-1 text-xs border border-rose-300 rounded bg-white text-center"
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-indigo-900 block">{translateText("🛡️ Phụ lục 5: Kẽm (mg)")}</span>
              <div className="flex gap-1.5 items-center">
                <select
                  value={form.zincAbsorptionLevel ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      zincAbsorptionLevel: e.target.value || null,
                    }))
                  }
                  className="w-1/2 px-1.5 py-1 text-[11px] border border-indigo-300 rounded bg-white"
                >
                  <option value="">{translateText("Chưa xác định")}</option>
                  <option value="MEDIUM">{translateText("Vừa 30%")}</option>
                  <option value="GOOD">{translateText("Tốt 50%")}</option>
                  <option value="POOR">{translateText("Kém 15%")}</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={form.zincMgMin ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      zincMgMin:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="w-1/2 px-2 py-1 text-xs border border-indigo-300 rounded bg-white text-center"
                />
              </div>
            </div>
          </div>

          {/* Phụ lục 6: Vitamin A RAE (µg) */}
          <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-teal-900 block">{translateText("🥕 Phụ lục 6: Vitamin A RAE (µg)")}</span>
            <input
              type="number"
              value={form.vitaminARaeMcgMin ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  vitaminARaeMcgMin:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full px-2.5 py-1 text-xs border border-teal-300 rounded bg-white"
            />
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{translateText("Ghi chú")}</label>
            <textarea
              rows={1}
              value={form.note || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder={translateText("Quyết định dinh dưỡng học đường năm 2026...")}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >{translateText("Hủy bỏ")}</button>
          <button
            type="submit"
            form="intake-standard-form"
            disabled={isLoading}
            className="px-5 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isLoading ? (
              <Sparkles className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{translateText(isEditMode ? "Lưu thay đổi" : "Tạo định mức")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
