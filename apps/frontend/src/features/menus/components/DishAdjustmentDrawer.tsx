import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from "react";
import {
  X,
  Utensils,
  Flame,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Check,
  ShieldAlert,
  Scale,
  Baby,
  ChefHat,
  Users,
  Search,
} from "lucide-react";
import {
  DishItem,
  MenuDishItem,
  AdjustDishPayload,
} from "../api/weekly-menus.api";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";

interface DishAdjustmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AdjustDishPayload) => Promise<void>;
  dishes: DishItem[];
  initialSlot?: {
    dayOfWeek: number;
    mealTime: string;
    existingDish?: MenuDishItem | null;
  } | null;
}

// Phân loại nhóm món ăn chuẩn dinh dưỡng
const detectCategory = (
  name: string,
  dishType?: string,
): "SOUP" | "MAIN" | "STAPLE" | "DRINK" | "SNACK_MEAL" => {
  const n = (name || "").toLowerCase();
  const dt = (dishType || "").toUpperCase();
  if (dt === "SOUP" || n.startsWith("canh")) return "SOUP";
  if (
    n.startsWith("cháo") ||
    n.includes("súp") ||
    n.includes("bún") ||
    n.includes("phở") ||
    n.includes("miến") ||
    n.includes("hủ tiếu") ||
    n.includes("bánh canh") ||
    n.includes("nui") ||
    n.includes("bánh bao")
  )
    return "SNACK_MEAL";
  if (n.startsWith("cơm") || n.includes("xôi") || n.includes("bánh mì"))
    return "STAPLE";
  if (
    dt === "DRINK" ||
    n.includes("sữa") ||
    n.includes("yaourt") ||
    n.includes("sữa chua") ||
    n.includes("nước") ||
    n.includes("chè") ||
    n.includes("sâm") ||
    n.includes("nha đam") ||
    n.includes("chuối") ||
    n.includes("dưa") ||
    n.includes("hồng")
  )
    return "DRINK";
  return "MAIN";
};

export const DishAdjustmentDrawer: React.FC<DishAdjustmentDrawerProps> = ({
  isOpen,
  onClose,
  onSubmit,
  dishes,
  initialSlot,
}) => {
  useLanguage();
  const schoolBranding = useSchoolBranding();
  const configuredMealTimes = schoolBranding.operationalSettings?.mealTimes || [
    "BREAKFAST",
    "LUNCH",
    "AFTERNOON_SNACK",
  ];
  const hasBreakfast = configuredMealTimes.includes("BREAKFAST");
  const hasLunch = configuredMealTimes.includes("LUNCH");
  const hasAfternoonSnack = configuredMealTimes.includes("AFTERNOON_SNACK");

  const firstAvailableMeal = hasLunch
    ? "LUNCH"
    : hasAfternoonSnack
      ? "AFTERNOON_SNACK"
      : hasBreakfast
        ? "BREAKFAST"
        : "LUNCH";

  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [mealTime, setMealTime] = useState<string>(firstAvailableMeal);
  const [selectedDishId, setSelectedDishId] = useState<string>("");
  const [portionSizeG, setPortionSizeG] = useState<number>(100);
  const [substituteDishId, setSubstituteDishId] = useState<string>("");
  const [specialDietNotes, setSpecialDietNotes] = useState<string>("");
  const [targetChildType, setTargetChildType] = useState<
    "STANDARD" | "ALLERGIES" | "OBESE" | "STUNTED" | "COMMON"
  >("STANDARD");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [dishSearch, setDishSearch] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayNames: Record<number, string> = {
    1: "Thứ Hai",
    2: "Thứ Ba",
    3: "Thứ Tư",
    4: "Thứ Năm",
    5: "Thứ Sáu",
    6: "Thứ Bảy",
    7: "Chủ Nhật",
  };

  const mealTimeNames: Record<string, string> = {
    BREAKFAST: "Buổi sáng (09h00)",
    MORNING_SNACK: "Buổi sáng (09h00)",
    LUNCH: "Bữa trưa chính (11h00)",
    AFTERNOON_SNACK: "Phụ chiều / Xế (14h30)",
    LATE_SNACK: "Ăn xế 17h (Dịch vụ muộn)",
  };

  useEffect(() => {
    if (initialSlot) {
      setDayOfWeek(initialSlot.dayOfWeek);
      let chosenMeal = initialSlot.mealTime === 'MORNING_SNACK' ? 'BREAKFAST' : initialSlot.mealTime;
      if (!initialSlot.existingDish) {
        if ((chosenMeal === 'BREAKFAST' || chosenMeal === 'MORNING_SNACK') && !hasBreakfast) {
          chosenMeal = firstAvailableMeal;
        } else if (chosenMeal === 'LUNCH' && !hasLunch) {
          chosenMeal = firstAvailableMeal;
        } else if (chosenMeal === 'AFTERNOON_SNACK' && !hasAfternoonSnack) {
          chosenMeal = firstAvailableMeal;
        }
      }
      setMealTime(chosenMeal);
      if (initialSlot.existingDish) {
        setSelectedDishId(initialSlot.existingDish.dishId);
        setPortionSizeG(Number(initialSlot.existingDish.portionSizeG) || 100);
        setSubstituteDishId(initialSlot.existingDish.substituteDishId || "");
        const note = initialSlot.existingDish.specialDietNotes || "";
        setSpecialDietNotes(note);
        const noteUp = note.toUpperCase();
        if (noteUp.includes("LOẠI 3") || noteUp.includes("DỊ ỨNG"))
          setTargetChildType("ALLERGIES");
        else if (
          noteUp.includes("LOẠI 2") ||
          noteUp.includes("BÉO PHÌ") ||
          noteUp.includes("THỪA CÂN")
        )
          setTargetChildType("OBESE");
        else if (
          noteUp.includes("LOẠI 1") ||
          noteUp.includes("SDD") ||
          noteUp.includes("CÒI XƯƠNG")
        )
          setTargetChildType("STUNTED");
        else if (noteUp.includes("CHUNG")) setTargetChildType("COMMON");
        else setTargetChildType("STANDARD");
      } else {
        setSelectedDishId(dishes[0]?.id || "");
        setPortionSizeG(100);
        setSubstituteDishId("");
        setSpecialDietNotes("");
      }
    }
    setError(null);
  }, [initialSlot, dishes, isOpen]);

  // Món ăn được chọn
  const currentDish = dishes.find((d) => d.id === selectedDishId);
  const substituteDish = dishes.find((d) => d.id === substituteDishId);

  // Tính calo dự kiến dựa trên định lượng gram
  const calculatedCalories = currentDish
    ? Math.round(
        Number(currentDish.totalCalories) *
          (portionSizeG / Number(currentDish.standardServingSizeG || 100)),
      )
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDishId) {
      setError("Vui lòng chọn một món ăn.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      let finalNotes = specialDietNotes.trim();
      if (targetChildType === "ALLERGIES" && !finalNotes.includes("Loại 3")) {
        finalNotes = `[Loại 3: Dị ứng] ${finalNotes || "Món thay thế suất riêng cho trẻ dị ứng"}`;
      } else if (
        targetChildType === "OBESE" &&
        !finalNotes.includes("Loại 2")
      ) {
        finalNotes = `[Loại 2: Béo phì] ${finalNotes || "Món thay thế giảm béo Chuẩn Dinh Dưỡng"}`;
      } else if (
        targetChildType === "STUNTED" &&
        !finalNotes.includes("Loại 1")
      ) {
        finalNotes = `[Loại 1: SDD] ${finalNotes || "Món thay thế tăng đạm sinh học QĐ 1246"}`;
      } else if (
        targetChildType === "COMMON" &&
        !finalNotes.includes("Món Chung")
      ) {
        finalNotes = `[Món Chung] ${finalNotes || "Món thay thế phù hợp chung các nhóm"}`;
      }

      await onSubmit({
        menuDishId: initialSlot?.existingDish
          ? Number(initialSlot.existingDish.id)
          : undefined,
        oldDishId: initialSlot?.existingDish
          ? Number(initialSlot.existingDish.dishId)
          : undefined,
        dayOfWeek,
        mealTime,
        dishId: selectedDishId,
        portionSizeG: Number(portionSizeG),
        substituteDishId: substituteDishId || undefined,
        specialDietNotes: finalNotes || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Có lỗi khi tinh chỉnh món ăn.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed !m-0 inset-0 z-50 overflow-hidden">
      {/* Nền mờ Backdrop Blur */}
      <div
        className="fixed !m-0 inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 flex items-center justify-center font-bold shadow-inner">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {translateText(initialSlot?.existingDish
                    ? "Tinh chỉnh món ăn"
                    : "Thêm món vào bữa ăn")}
                </h2>
                <p className="text-xs text-slate-500">
                  {translateText(dayNames[dayOfWeek])} • {translateText(mealTimeNames[mealTime])}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Form */}
          <form
            id="dish-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-6 space-y-5"
          >
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{translateText(error)}</span>
              </div>
            )}

            {/* Chọn Ngày & Bữa ăn */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Ngày trong tuần")}</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition bg-white"
                >
                  <option value={1}>{translateText("Thứ Hai")}</option>
                  <option value={2}>{translateText("Thứ Ba")}</option>
                  <option value={3}>{translateText("Thứ Tư")}</option>
                  <option value={4}>{translateText("Thứ Năm")}</option>
                  <option value={5}>{translateText("Thứ Sáu")}</option>
                  <option value={6}>{translateText("Thứ Bảy")}</option>
                  <option value={7}>{translateText("Chủ Nhật")}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Bữa ăn")}</label>
                <select
                  value={mealTime === 'MORNING_SNACK' ? 'BREAKFAST' : mealTime}
                  onChange={(e) => setMealTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition bg-white"
                >
                  {hasBreakfast ? (
                    <option value="BREAKFAST">{translateText("Buổi sáng (09h00)")}</option>
                  ) : (
                    <option value="BREAKFAST" disabled>{translateText("Buổi sáng (09h00) - Trường không cấu hình")}</option>
                  )}
                  {hasLunch ? (
                    <option value="LUNCH">{translateText("Bữa trưa chính (11h00)")}</option>
                  ) : (
                    <option value="LUNCH" disabled>{translateText("Bữa trưa chính (11h00) - Trường không cấu hình")}</option>
                  )}
                  {hasAfternoonSnack ? (
                    <option value="AFTERNOON_SNACK">{translateText("Phụ chiều / Xế (14h30)")}</option>
                  ) : (
                    <option value="AFTERNOON_SNACK" disabled>{translateText("Phụ chiều / Xế (14h30) - Trường không cấu hình")}</option>
                  )}
                  <option value="LATE_SNACK">{translateText("Ăn xế 17h (Dịch vụ)")}</option>
                </select>
              </div>
            </div>

            {/* 1. MỤC ĐÍCH MÓN ĂN / THAY THẾ CHO LOẠI BÉ NÀO */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">{translateText("Mục đích món ăn & Đối tượng trẻ áp dụng:")}</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTargetChildType("STANDARD")}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                    targetChildType === "STANDARD"
                      ? "bg-white border-slate-700 ring-2 ring-slate-700 shadow-2xs font-bold text-slate-900"
                      : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">{translateText("🌟 Cả lớp dùng chung")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetChildType("ALLERGIES")}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                    targetChildType === "ALLERGIES"
                      ? "bg-rose-50 border-rose-600 ring-2 ring-rose-600 shadow-2xs font-bold text-rose-950"
                      : "bg-white/80 border-rose-200 text-rose-800 hover:bg-rose-50"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="truncate">{translateText("🚨 Loại 3: Dị ứng")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetChildType("OBESE")}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                    targetChildType === "OBESE"
                      ? "bg-purple-50 border-purple-600 ring-2 ring-purple-600 shadow-2xs font-bold text-purple-950"
                      : "bg-white/80 border-purple-200 text-purple-800 hover:bg-purple-50"
                  }`}
                >
                  <Scale className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="truncate">{translateText("⚖️ Loại 2: Thừa cân")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetChildType("STUNTED")}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                    targetChildType === "STUNTED"
                      ? "bg-amber-50 border-amber-600 ring-2 ring-amber-600 shadow-2xs font-bold text-amber-950"
                      : "bg-white/80 border-amber-200 text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  <Baby className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">{translateText("👶 Loại 1: Thấp còi/SDD")}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setTargetChildType("COMMON")}
                className={`w-full p-2 rounded-xl border text-center transition flex items-center justify-center gap-2 text-xs cursor-pointer ${
                  targetChildType === "COMMON"
                    ? "bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600 shadow-2xs font-bold text-emerald-950"
                    : "bg-white/80 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                }`}
              >
                <ChefHat className="w-3.5 h-3.5 text-emerald-600" />
                <span>{translateText("⭐ Món thay thế phù hợp chung cho Bếp")}</span>
              </button>
            </div>

            {/* 2. CHỌN MÓN ĂN & BỘ LỌC CÙNG LOẠI */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">{translateText("Chọn món ăn cùng loại ")}<span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">{translateText("Lọc theo nhóm món")}</span>
              </div>

              {/* Pills lọc cùng loại */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  { key: "ALL", label: translateText("Tất cả") },
                  { key: "MAIN", label: translateText("Món Mặn") },
                  { key: "SOUP", label: translateText("Món Canh") },
                  { key: "STAPLE", label: translateText("Cơm / Tinh bột") },
                  { key: "SNACK_MEAL", label: translateText("Cháo / Món Xế") },
                  { key: "DRINK", label: translateText("Đồ uống / Tráng miệng") },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategoryFilter(cat.key)}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                      categoryFilter === cat.key
                        ? "bg-slate-900 text-white shadow-3xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {translateText(cat.label)}
                  </button>
                ))}
              </div>

              {/* Search input món ăn */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={translateText("Tìm tên món ăn...")}
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50"
                />
              </div>

              <select
                value={selectedDishId}
                onChange={(e) => {
                  setSelectedDishId(e.target.value);
                  const d = dishes.find((item) => item.id === e.target.value);
                  if (d) setPortionSizeG(Number(d.standardServingSizeG) || 100);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition bg-white font-medium"
                required
              >
                <option value="">{translateText("-- Chọn món ăn --")}</option>
                {dishes
                  .filter((dish) => {
                    if (dishSearch.trim()) {
                      const query = dishSearch.trim().toLowerCase();
                      if (!(dish.name || "").toLowerCase().includes(query)) return false;
                    }
                    if (categoryFilter === "ALL") return true;
                    return (
                      detectCategory(dish.name, dish.dishType) ===
                      categoryFilter
                    );
                  })
                  .map((dish) => (
                    <option key={dish.id} value={dish.id}>
                      {dish.name} ({dish.totalCalories}{translateText(" Kcal /")}{" "}
                      {dish.standardServingSizeG}{translateText("g)")}</option>
                  ))}
              </select>
            </div>

            {/* Định lượng suất ăn & Năng lượng tính toán */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Định lượng (Gram / suất)")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    step={5}
                    value={portionSizeG}
                    onChange={(e) => setPortionSizeG(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-bold"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">{translateText("gam")}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Năng lượng dự kiến")}</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 font-black text-xs sm:text-sm flex items-center justify-between">
                  <span>{calculatedCalories}{translateText(" Kcal")}</span>
                  <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                </div>
              </div>
            </div>

            {/* Thông tin vi chất dinh dưỡng của món ăn */}
            {currentDish && (
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wide">{translateText("Chỉ số dinh dưỡng theo suất (")}{portionSizeG}{translateText("g):")}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-semibold">{translateText("Đạm (Protein)")}</span>
                    <span className="font-bold text-slate-800">
                      {translateText((
                        Number(currentDish.totalProteinG) *
                        (portionSizeG /
                          Number(currentDish.standardServingSizeG || 100))
                      ).toFixed(1))}{translateText("g")}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-semibold">{translateText("Béo (Lipid)")}</span>
                    <span className="font-bold text-slate-800">
                      {translateText((
                        Number(currentDish.totalFatG) *
                        (portionSizeG /
                          Number(currentDish.standardServingSizeG || 100))
                      ).toFixed(1))}{translateText("g")}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-semibold">{translateText("Bột đường (Carb)")}</span>
                    <span className="font-bold text-slate-800">
                      {translateText((
                        Number(currentDish.totalCarbG) *
                        (portionSizeG /
                          Number(currentDish.standardServingSizeG || 100))
                      ).toFixed(1))}{translateText("g")}</span>
                  </div>
                </div>

                {/* Danh sách thành phần nguyên liệu cấu thành */}
                {currentDish.recipeItems &&
                  currentDish.recipeItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5 text-teal-600" />{translateText("Nguyên liệu cấu thành (")}{currentDish.recipeItems.length}):
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">{translateText("Quy tắc: (Định lượng/100) × DB")}</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {currentDish.recipeItems.map((ri, idx) => {
                          const food = ri.food;
                          const ratio =
                            portionSizeG /
                            Number(currentDish.standardServingSizeG || 100);
                          const scaledNetG = (
                            Number(ri.netWeightPerPortionG) * ratio
                          ).toFixed(1);
                          const foodKcal = food
                            ? (
                                (Number(ri.netWeightPerPortionG) / 100) *
                                Number(food.energyKcal) *
                                ratio
                              ).toFixed(1)
                            : "-";
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-100 shadow-2xs"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800">
                                  {food?.name || translateText("Nguyên liệu")}
                                </span>
                                {food?.allergens &&
                                  food.allergens.length > 0 && (
                                    <span className="text-[9px] bg-red-50 text-red-600 px-1 py-0.5 rounded font-bold border border-red-100">
                                      {translateText(food.allergens.join(", "))}
                                    </span>
                                  )}
                              </div>
                              <div className="flex items-center gap-2 text-slate-500 font-medium">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">
                                  {translateText(scaledNetG)}{translateText("g")}</span>
                                <span className="text-amber-700 font-bold">
                                  {translateText(foodKcal)}{translateText(" kcal")}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Món thay thế dị ứng (Substitute Dish) theo ai-menu-advisor */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>{translateText("Món thay thế cho trẻ dị ứng (Tùy chọn)")}</span>
                <span className="text-[10px] font-normal text-emerald-600 lowercase bg-emerald-50 px-2 py-0.5 rounded-full">{translateText("Chọn món đã xác minh")}</span>
              </label>
              <select
                value={substituteDishId}
                onChange={(e) => setSubstituteDishId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition bg-white"
              >
                <option value="">{translateText("-- Không có món thay thế (Dùng chung) --")}</option>
                {dishes
                  .filter((d) => d.id !== selectedDishId)
                  .map((dish) => (
                    <option key={dish.id} value={dish.id}>
                      {dish.name} ({dish.totalCalories}{translateText(" Kcal)")}</option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">{translateText("Áp dụng cho học sinh có cảnh báo dị ứng hải sản / trứng / sữa bò trong lớp.")}</p>
            </div>

            {/* Ghi chú chế độ ăn đặc biệt */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Ghi chú chế biến & Dị ứng")}</label>
              <textarea
                value={specialDietNotes}
                onChange={(e) => setSpecialDietNotes(e.target.value)}
                placeholder={translateText("Ví dụ: Cắt hạt lựu cho lớp Mầm, băm nhuyễn, ít muối...")}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </form>

          {/* Footer Drawer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
            >{translateText("Hủy bỏ")}</button>
            <button
              type="submit"
              form="dish-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{translateText("Đang cập nhật...")}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{translateText("Xác nhận món")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
