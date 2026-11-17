import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from "react";
import {
  X,
  Utensils,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Flame,
  Wheat,
  Droplet,
  Fish,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";

export interface DishDetailData {
  id: string;
  name: string;
  description?: string;
  dishType?: string;
  category?: {
    id: number | string;
    code: string;
    name: string;
  };
  portionSizeG?: number;
  standardServingSizeG?: number;
  nutrition?: {
    calories?: number;
    energyKcal?: number;
    proteinG?: number;
    fatG?: number;
    carbG?: number;
    fiberG?: number;
    calciumMg?: number;
    ironMg?: number;
    zincMg?: number;
    vitaminAUg?: number;
    portionSizeG?: number;
    isVerified?: boolean;
    verificationStatus?: string;
  };
  recipes?: Array<{
    id?: string | number;
    ingredientName?: string;
    ingredient?: {
      id: string | number;
      name: string;
      unit?: string;
      allergens?: string[];
    };
    netWeightG?: number;
    grossWeightG?: number;
    allergens?: string[];
    isAllergen?: boolean;
  }>;
  allergens?: Array<{
    id?: string | number;
    name?: string;
    code?: string;
  }>;
  dishAllergens?: Array<{
    id?: string | number;
    allergen?: {
      id: string | number;
      name: string;
      code?: string;
      nameVi?: string;
    };
  }>;
}

interface DishDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dishId?: string | number | null;
  dishName?: string;
  initialCalories?: number | null;
  initialPortionSizeG?: number | null;
}

export const DishDetailModal: React.FC<DishDetailModalProps> = ({
  isOpen,
  onClose,
  dishId,
  dishName,
  initialCalories,
  initialPortionSizeG,
}) => {
  useLanguage();
  const [loading, setLoading] = useState<boolean>(false);
  const [dish, setDish] = useState<DishDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDish(null);
      setError(null);
      return;
    }

    const loadDish = async () => {
      setLoading(true);
      setError(null);
      try {
        if (dishId) {
          const res = await apiClient.get<DishDetailData>(`/dishes/${dishId}`);
          setDish(res.data);
        } else if (dishName) {
          const searchRes = await apiClient.get<{ items: DishDetailData[] }>("/dishes", {
            params: { search: dishName.trim(), limit: 1 },
          });
          const match = searchRes.data?.items?.[0];
          if (match?.id) {
            const detailRes = await apiClient.get<DishDetailData>(`/dishes/${match.id}`);
            setDish(detailRes.data);
          } else {
            setError(`Không tìm thấy thông tin chi tiết của món "${dishName}".`);
          }
        }
      } catch (err: any) {
        console.error("Lỗi khi tải chi tiết món ăn:", err);
        setError(err.response?.data?.message || "Không thể tải thông tin món ăn.");
      } finally {
        setLoading(false);
      }
    };

    void loadDish();
  }, [isOpen, dishId, dishName]);

  if (!isOpen) return null;

  const nutrition = dish?.nutrition || {};
  const allergens = Array.from(
    new Set([
      ...(dish?.allergens || []).map((a) => a.name || ""),
      ...(dish?.dishAllergens || []).map((da) => da.allergen?.nameVi || da.allergen?.name || ""),
    ].filter(Boolean)),
  );

  const num = (v?: number | null) => (v !== undefined && v !== null ? Number(v).toFixed(1) : "—");

  const calories =
    nutrition.calories ??
    nutrition.energyKcal ??
    initialCalories ??
    (nutrition.proteinG || nutrition.fatG || nutrition.carbG
      ? Math.round(((nutrition.proteinG || 0) * 4 + (nutrition.fatG || 0) * 9 + (nutrition.carbG || 0) * 4) * 10) / 10
      : null);

  const portionSize =
    dish?.portionSizeG ??
    dish?.standardServingSizeG ??
    nutrition.portionSizeG ??
    initialPortionSizeG ??
    150;

  return (
    <div
      className="fixed !m-0 inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 via-emerald-50 to-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
                  {dish?.category?.name || translateText("Món ăn trường mầm non")}
                </span>
                {nutrition.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" />{translateText(" Đã kiểm định")}</span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                {dish?.name || dishName || translateText("Chi tiết món ăn")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            aria-label={translateText("Đóng")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-sm font-semibold">{translateText("Đang tải thông tin dinh dưỡng & công thức...")}</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-800">
              <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-rose-600" />
              <p className="font-semibold">{translateText(error)}</p>
            </div>
          )}

          {!loading && !error && dish && (
            <>
              {/* Mô tả món */}
              {dish.description && (
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {dish.description}
                </p>
              )}

              {/* Cảnh báo dị nguyên */}
              {allergens.length > 0 ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>{translateText("Cảnh báo dị nguyên có trong món:")}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {allergens.map((alg, i) => (
                      <span
                        key={i}
                        className="rounded-xl border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 shadow-xs"
                      >
                        {translateText(alg)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-amber-800">{translateText("* Phụ huynh có con dị ứng các thành phần trên cần lưu ý kiểm tra với giáo viên lớp.")}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{translateText("Không phát hiện dị nguyên phổ biến trong danh mục nguyên liệu của món.")}</span>
                </div>
              )}

              {/* Chỉ số dinh dưỡng chính */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">{translateText("Chỉ số dinh dưỡng ước tính (1 khẩu phần chuẩn)")}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-orange-700 text-xs font-bold">
                      <Flame className="h-3.5 w-3.5" />{translateText(" Năng lượng")}</div>
                    <div className="mt-1 text-xl font-black text-orange-950">
                      {translateText(num(calories))} <span className="text-xs font-normal">{translateText("kcal")}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-teal-700 text-xs font-bold">
                      <Fish className="h-3.5 w-3.5" />{translateText(" Chất đạm (P)")}</div>
                    <div className="mt-1 text-xl font-black text-teal-950">
                      {translateText(num(nutrition.proteinG))} <span className="text-xs font-normal">{translateText("g")}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-700 text-xs font-bold">
                      <Droplet className="h-3.5 w-3.5" />{translateText(" Chất béo (L)")}</div>
                    <div className="mt-1 text-xl font-black text-amber-950">
                      {translateText(num(nutrition.fatG))} <span className="text-xs font-normal">{translateText("g")}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-sky-700 text-xs font-bold">
                      <Wheat className="h-3.5 w-3.5" />{translateText(" Bột đường (G)")}</div>
                    <div className="mt-1 text-xl font-black text-sky-950">
                      {translateText(num(nutrition.carbG))} <span className="text-xs font-normal">{translateText("g")}</span>
                    </div>
                  </div>
                </div>

                {/* Vi chất bổ sung */}
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                    <span className="text-slate-500 block">{translateText("Khẩu phần")}</span>
                    <strong className="text-slate-800">{translateText(num(portionSize))}{translateText(" g")}</strong>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                    <span className="text-slate-500 block">{translateText("Canxi")}</span>
                    <strong className="text-slate-800">{translateText(num(nutrition.calciumMg))}{translateText(" mg")}</strong>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                    <span className="text-slate-500 block">{translateText("Sắt")}</span>
                    <strong className="text-slate-800">{translateText(num(nutrition.ironMg))}{translateText(" mg")}</strong>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                    <span className="text-slate-500 block">{translateText("Kẽm")}</span>
                    <strong className="text-slate-800">{translateText(num(nutrition.zincMg))}{translateText(" mg")}</strong>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                    <span className="text-slate-500 block">{translateText("Chất xơ")}</span>
                    <strong className="text-slate-800">{translateText(num(nutrition.fiberG))}{translateText(" g")}</strong>
                  </div>
                </div>
              </div>

              {/* Thành phần nguyên liệu */}
              {dish.recipes && dish.recipes.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">{translateText("Thành phần nguyên liệu chế biến (")}{dish.recipes.length}{translateText(" nguyên liệu)")}</h3>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-4">{translateText("Tên nguyên liệu")}</th>
                          <th className="py-2.5 px-4 text-center">{translateText("Dị ứng")}</th>
                          <th className="py-2.5 px-4 text-right">{translateText("Khối lượng tịnh (g)")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dish.recipes.map((rc, idx) => {
                          const rcAllergens = rc.allergens || rc.ingredient?.allergens || [];
                          return (
                            <tr key={idx} className={rcAllergens.length > 0 ? "bg-rose-50/60 hover:bg-rose-50" : "hover:bg-slate-50/50"}>
                              <td className="py-2 px-4 font-semibold text-slate-800">
                                {rc.ingredient?.name || rc.ingredientName || translateText("Nguyên liệu")}
                              </td>
                              <td className="py-2 px-4 text-center">
                                {rcAllergens.length > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                    ⚠ {rcAllergens.join(", ")}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    An toàn
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-right font-medium text-slate-600">
                                {translateText(rc.netWeightG !== undefined ? `${rc.netWeightG} g` : "Theo định mức")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >{translateText("Đóng")}</button>
        </div>
      </div>
    </div>
  );
};

