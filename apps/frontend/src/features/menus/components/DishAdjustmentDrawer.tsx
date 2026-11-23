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
  Info,
  Lock,
} from "lucide-react";
import {
  DishItem,
  MenuDishItem,
  AdjustDishPayload,
  MenuAdvisoryResponse,
} from "../api/weekly-menus.api";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";
import { getDishAllergyConflicts } from "../utils/allergy-conflicts";

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
  advisory?: MenuAdvisoryResponse | null;
}

// Phân loại nhóm món ăn chuẩn dinh dưỡng
export type DishCategoryKey =
  | "MAIN"
  | "SOUP"
  | "STAPLE"
  | "SNACK_MORNING"
  | "SNACK_AFTERNOON"
  | "DRINK"
  | "DESSERT";

export const CATEGORY_INFO: Record<
  DishCategoryKey,
  { label: string; shortName: string; icon: string; badgeColor: string; description: string }
> = {
  MAIN: {
    label: "Món Mặn (Thịt / Cá / Trứng / Tôm / Đậu hũ)",
    shortName: "Món Mặn",
    icon: "🥩",
    badgeColor: "bg-red-50 text-red-800 border-red-200",
    description: "Món mặn giàu đạm chính trong bữa trưa",
  },
  SOUP: {
    label: "Món Canh / Súp Nước Trưa",
    shortName: "Món Canh / Nước",
    icon: "🍲",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Món canh, món nước thanh nhiệt bổ sung nước",
  },
  STAPLE: {
    label: "Cơm / Tinh Bột",
    shortName: "Cơm / Tinh Bột",
    icon: "🍚",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Cơm trắng, cơm tấm, xôi, bánh mì cung cấp tinh bột",
  },
  SNACK_MORNING: {
    label: "Món Nước Sáng / Điểm Tâm (Bún / Phở / Miến)",
    shortName: "Món Nước Sáng",
    icon: "🍜",
    badgeColor: "bg-orange-50 text-orange-800 border-orange-200",
    description: "Món điểm tâm buổi sáng giàu năng lượng",
  },
  SNACK_AFTERNOON: {
    label: "Món Ăn Xế Chiều (Cháo / Bánh / Mì)",
    shortName: "Món Chiều Xế",
    icon: "🥣",
    badgeColor: "bg-violet-50 text-violet-800 border-violet-200",
    description: "Món ăn phụ chiều nhẹ bụng, dễ tiêu hóa",
  },
  DRINK: {
    label: "Thức Uống Dinh Dưỡng (Sữa / Nước Hoa Quả)",
    shortName: "Đồ Uống",
    icon: "🥛",
    badgeColor: "bg-cyan-50 text-cyan-800 border-cyan-200",
    description: "Sữa tươi, sữa hạt, yaourt, nước ép hoa quả 14:30",
  },
  DESSERT: {
    label: "Tráng Miệng (Hoa Quả / Bánh Flan)",
    shortName: "Tráng Miệng",
    icon: "🍉",
    badgeColor: "bg-pink-50 text-pink-800 border-pink-200",
    description: "Trái cây tươi, thạch, bánh flan tráng miệng trưa",
  },
};

export const detectCategory = (
  name: string,
  dishType?: string,
  categoryCode?: string,
): DishCategoryKey => {
  const code = (categoryCode || dishType || "").toUpperCase().trim();
  const n = (name || "").toLowerCase().trim();

  // 1. Phân loại chuẩn xác theo code của danh mục
  if (code === "SOUP" || n.startsWith("canh ") || n.includes("canh chua") || n.includes("canh rau") || n.includes("canh cá") || n.includes("canh tôm") || n.includes("canh thịt") || n.includes("canh bắp cải") || n.includes("canh cua")) return "SOUP";
  if (code === "RICE" || code === "STAPLE" || n.startsWith("cơm") || n.includes("xôi") || n.includes("bánh mì")) return "STAPLE";
  if (code === "DRINK" || n.includes("nước mía") || n.includes("nước cam") || n.includes("nước chanh") || n.includes("sữa đậu") || n.includes("sữa tươi") || n.includes("yaourt") || n.includes("sữa chua") || n.includes("sữa trái cây") || n.includes("sâm bí đao") || n.includes("nước đậu rang")) return "DRINK";
  if (code === "DESSERT" || n.includes("bánh flan") || n.includes("rau câu") || n.includes("dưa hấu") || n.includes("đu đủ") || n.includes("thanh long") || n.includes("táo tây") || n.includes("nho") || n.includes("lê đường") || n.includes("chuối")) return "DESSERT";
  if (code === "SNACK_MORNING" || n.includes("bún bò") || n.includes("bún mọc") || n.includes("phở bò") || n.includes("phở gà") || n.includes("miến gà") || n.includes("bánh canh") || n.includes("súp trứng cút")) return "SNACK_MORNING";
  if (code === "SNACK_AFTERNOON" || n.startsWith("cháo ") || n.includes("bánh bao") || n.includes("hủ tiếu") || n.includes("mì thịt") || n.includes("bánh ngọt") || n.includes("cháo thịt") || n.includes("cháo cá")) return "SNACK_AFTERNOON";
  if (code === "MAIN" || code === "SIDE") return "MAIN";

  // Fallback từ khóa
  if (n.includes("bún") || n.includes("phở") || n.includes("miến") || n.includes("cháo") || n.includes("hủ tiếu")) return "SNACK_MORNING";
  if (n.includes("súp")) return "SOUP";
  return "MAIN";
};

export const DishAdjustmentDrawer: React.FC<DishAdjustmentDrawerProps> = ({
  isOpen,
  onClose,
  onSubmit,
  dishes,
  initialSlot,
  advisory,
}) => {
  useLanguage();
  const schoolBranding = useSchoolBranding();
  const configuredMealTimes = schoolBranding.operationalSettings?.mealTimes || [
    "BREAKFAST",
    "LUNCH",
    "AFTERNOON_SNACK",
    "LATE_SNACK",
  ];
  const hasBreakfast = configuredMealTimes.includes("BREAKFAST");
  const hasLunch = configuredMealTimes.includes("LUNCH");
  const hasAfternoonSnack = configuredMealTimes.includes("AFTERNOON_SNACK");
  const hasLateSnack = configuredMealTimes.includes("LATE_SNACK");

  const firstAvailableMeal = hasLunch
    ? "LUNCH"
    : hasAfternoonSnack
      ? "AFTERNOON_SNACK"
      : hasLateSnack
        ? "LATE_SNACK"
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
  const [targetCategory, setTargetCategory] = useState<DishCategoryKey>("MAIN");
  const [isStrictLock, setIsStrictLock] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [dishSearch, setDishSearch] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nhận diện xung đột dị ứng của món gốc hiện tại
  const currentConflicts =
    initialSlot?.existingDish && advisory?.allergyConflicts
      ? getDishAllergyConflicts(advisory.allergyConflicts, initialSlot.existingDish)
      : [];
  const hasAllergyConflict = currentConflicts.length > 0;

  const getCategorySafeExampleText = () => {
    if (mealTime === "BREAKFAST" || mealTime === "MORNING_SNACK" || mealTime === "LATE_SNACK") {
      return "ví dụ: Bún mọc, Bánh canh cá lóc, Miến gà...";
    }
    if (mealTime === "AFTERNOON_SNACK") {
      return "ví dụ: Yaourt, Sữa tươi, Trái cây tươi, Bánh flan...";
    }
    if (targetCategory === "MAIN") {
      return "ví dụ: Thịt heo kho, Cá lóc kho, Trứng chiên thịt...";
    }
    if (targetCategory === "SOUP") {
      return "ví dụ: Canh cải ngọt thịt bằm, Canh bí đỏ, Canh rong biển...";
    }
    if (targetCategory === "STAPLE") {
      return "ví dụ: Cơm trắng, Cơm tấm, Xôi...";
    }
    if (targetCategory === "DESSERT") {
      return "ví dụ: Dưa hấu, Chuối cau, Thanh long...";
    }
    return "ví dụ: các món an toàn cùng loại...";
  };

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
    AFTERNOON_SNACK: "Buổi phụ (14h30)",
    LATE_SNACK: "Buổi chiều xế (17h00)",
  };

  const isLiquidDish = (name: string) => {
    const lower = (name || "").toLowerCase();
    return (
      lower.includes("cháo") ||
      lower.includes("súp") ||
      lower.includes("bún") ||
      lower.includes("phở") ||
      lower.includes("miến") ||
      lower.includes("hủ tiếu") ||
      lower.includes("bánh canh") ||
      lower.includes("nui") ||
      lower.includes("mì") ||
      lower.includes("hoành thánh")
    ) && !lower.includes("khô") && !lower.includes("xào") && !lower.includes("bánh bao") && !lower.includes("bánh bông lan");
  };

  const isCakeDish = (name: string) => {
    const lower = (name || "").toLowerCase();
    return (
      lower.includes("bánh flan") ||
      lower.includes("bánh su kem") ||
      lower.includes("bánh bông lan") ||
      lower.includes("bánh bao") ||
      lower.includes("bánh ngọt") ||
      lower.includes("rau câu")
    );
  };

  const isFruitDish = (name: string) => {
    const lower = (name || "").toLowerCase();
    return (
      lower.includes("chuối") ||
      lower.includes("quýt") ||
      lower.includes("dưa") ||
      lower.includes("nho") ||
      lower.includes("táo") ||
      lower.includes("đu đủ") ||
      lower.includes("thanh long") ||
      lower.includes("hồng giòn") ||
      lower.includes("hồng xiêm") ||
      lower.includes("lê đường")
    );
  };

  const isDrinkDish = (name: string, dishType?: string, categoryCode?: string) => {
    const cat = detectCategory(name, dishType, categoryCode);
    const lower = (name || "").toLowerCase();
    return cat === "DRINK" || lower.includes("sữa") || lower.includes("yaourt") || lower.includes("nước ");
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
        } else if (chosenMeal === 'LATE_SNACK' && !hasLateSnack) {
          chosenMeal = firstAvailableMeal;
        }
      }
      setMealTime(chosenMeal);
      if (initialSlot.existingDish) {
        const origIdStr = String(initialSlot.existingDish.dishId);
        setSelectedDishId(origIdStr);
        setPortionSizeG(Number(initialSlot.existingDish.portionSizeG) || 100);
        setSubstituteDishId(initialSlot.existingDish.substituteDishId ? String(initialSlot.existingDish.substituteDishId) : "");
        const note = initialSlot.existingDish.specialDietNotes || "";
        setSpecialDietNotes(note);
        const noteUp = note.toUpperCase();
        let childType: "STANDARD" | "ALLERGIES" | "OBESE" | "STUNTED" | "COMMON" = "STANDARD";
        if (noteUp.includes("LOẠI 3") || noteUp.includes("DỊ ỨNG"))
          childType = "ALLERGIES";
        else if (
          noteUp.includes("LOẠI 2") ||
          noteUp.includes("BÉO PHÌ") ||
          noteUp.includes("THỪA CÂN")
        )
          childType = "OBESE";
        else if (
          noteUp.includes("LOẠI 1") ||
          noteUp.includes("SDD") ||
          noteUp.includes("CÒI XƯƠNG")
        )
          childType = "STUNTED";
        else if (noteUp.includes("CHUNG")) childType = "COMMON";
        else childType = "STANDARD";
        setTargetChildType(childType);

        // Tìm món hiện tại và nhận diện nhóm chuẩn để khóa đổi cùng loại
        const originDish = dishes.find((d) => String(d.id) === origIdStr) || initialSlot.existingDish.dish;
        const detectedCat = originDish
          ? detectCategory(originDish.name, originDish.dishType, (originDish as any).categoryCode)
          : "MAIN";
        setTargetCategory(detectedCat);
        if (chosenMeal === "AFTERNOON_SNACK") {
          setCategoryFilter("AFTERNOON_ALL");
        } else {
          setCategoryFilter(detectedCat);
        }
        setIsStrictLock(true);

        // Tự động tìm món an toàn thay thế đầu tiên nếu món hiện tại có cảnh báo dị ứng
        const conflicts = advisory?.allergyConflicts
          ? getDishAllergyConflicts(advisory.allergyConflicts, initialSlot.existingDish)
          : [];
        if (conflicts.length > 0 && childType === "STANDARD") {
          const safeAlt = dishes.find((d) => {
            if (String(d.id) === origIdStr) return false;
            if (chosenMeal === "BREAKFAST" || chosenMeal === "MORNING_SNACK" || chosenMeal === "LATE_SNACK") {
              return isLiquidDish(d.name);
            }
            if (chosenMeal === "AFTERNOON_SNACK") {
              return !isLiquidDish(d.name) && (isCakeDish(d.name) || isFruitDish(d.name) || isDrinkDish(d.name, d.dishType, (d as any).categoryCode));
            }
            return detectCategory(d.name, d.dishType, (d as any).categoryCode) === detectedCat;
          });
          if (safeAlt) {
            setSelectedDishId(String(safeAlt.id));
            setPortionSizeG(Number(safeAlt.standardServingSizeG) || 100);
          }
        }
      } else {
        setSelectedDishId(dishes[0] ? String(dishes[0].id) : "");
        setPortionSizeG(100);
        setSubstituteDishId("");
        setSpecialDietNotes("");

        let defaultCat: DishCategoryKey = "MAIN";
        if (chosenMeal === "BREAKFAST") defaultCat = "SNACK_MORNING";
        else if (chosenMeal === "AFTERNOON_SNACK") defaultCat = "DRINK";
        else if (chosenMeal === "LATE_SNACK") defaultCat = "SNACK_AFTERNOON";
        setTargetCategory(defaultCat);
        if (chosenMeal === "AFTERNOON_SNACK") {
          setCategoryFilter("AFTERNOON_ALL");
        } else {
          setCategoryFilter(defaultCat);
        }
        setIsStrictLock(false);
      }
    }
    setError(null);
  }, [initialSlot, dishes, isOpen]);

  // Món ăn được chọn
  const currentDish = dishes.find((d) => String(d.id) === String(selectedDishId));
  const substituteDish = dishes.find((d) => String(d.id) === String(substituteDishId));

  // Danh sách món ăn được lọc theo quy tắc: nếu bật Khóa chuẩn thì 100% đúng loại món đó
  const eligibleDishes = dishes.filter((dish) => {
    if (dishSearch.trim()) {
      const query = dishSearch.trim().toLowerCase();
      if (!(dish.name || "").toLowerCase().includes(query)) return false;
    }
    const cat = detectCategory(dish.name, dish.dishType, (dish as any).categoryCode);

    if (isStrictLock) {
      if (mealTime === "BREAKFAST" || mealTime === "MORNING_SNACK" || mealTime === "LATE_SNACK") {
        return isLiquidDish(dish.name);
      }
      if (mealTime === "AFTERNOON_SNACK") {
        if (isLiquidDish(dish.name)) return false;
        const isCake = isCakeDish(dish.name);
        const isFruit = isFruitDish(dish.name);
        const isDrink = isDrinkDish(dish.name, dish.dishType, (dish as any).categoryCode);
        if (!isCake && !isFruit && !isDrink) return false;

        if (categoryFilter === "AFTERNOON_CAKE") return isCake;
        if (categoryFilter === "AFTERNOON_FRUIT") return isFruit;
        if (categoryFilter === "AFTERNOON_DRINK") return isDrink;
        return true;
      }
      return cat === targetCategory;
    }

    if (categoryFilter === "ALL" || categoryFilter === "AFTERNOON_ALL") return true;
    if (categoryFilter === "AFTERNOON_CAKE") return isCakeDish(dish.name);
    if (categoryFilter === "AFTERNOON_FRUIT") return isFruitDish(dish.name);
    if (categoryFilter === "AFTERNOON_DRINK") return isDrinkDish(dish.name, dish.dishType, (dish as any).categoryCode);
    return cat === categoryFilter;
  });

  const eligibleSubstituteDishes = dishes.filter((d) => {
    if (d.id === selectedDishId) return false;
    if (isStrictLock) {
      if (mealTime === "BREAKFAST" || mealTime === "MORNING_SNACK" || mealTime === "LATE_SNACK") {
        return isLiquidDish(d.name);
      }
      if (mealTime === "AFTERNOON_SNACK") {
        if (isLiquidDish(d.name)) return false;
        return isCakeDish(d.name) || isFruitDish(d.name) || isDrinkDish(d.name, d.dishType, (d as any).categoryCode);
      }
      return detectCategory(d.name, d.dishType, (d as any).categoryCode) === targetCategory;
    }
    return true;
  });

  // Tính calo dự kiến dựa trên định lượng gram
  const calculatedCalories = currentDish
    ? Math.round(
      Number(currentDish.totalCalories) *
      (portionSizeG / Number(currentDish.standardServingSizeG || 100)),
    )
    : 0;

  const isExistingSlot = !!initialSlot?.existingDish;
  const isSameDish = isExistingSlot && String(selectedDishId) === String(initialSlot?.existingDish?.dishId);
  const isSamePortion = isExistingSlot && Number(portionSizeG) === Number(initialSlot?.existingDish?.portionSizeG || 100);
  const isUnchangedForWholeClass = isExistingSlot && targetChildType === "STANDARD" && isSameDish && isSamePortion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDishId) {
      setError("Vui lòng chọn một món ăn.");
      return;
    }

    if (isUnchangedForWholeClass) {
      setError(
        "Món đang chọn vẫn là món cũ chưa có thay đổi nào. Vui lòng bấm chọn một món khác bên dưới để thay đổi món cho cả lớp!",
      );
      return;
    }

    if (
      targetChildType === "STANDARD" &&
      hasAllergyConflict &&
      isSameDish
    ) {
      setError(
        "Món đang chọn vẫn là món cũ có cảnh báo dị ứng. Vui lòng bấm chọn một món ăn an toàn khác bên dưới để thay thế cho cả lớp!",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      let finalNotes = specialDietNotes.trim();
      if (targetChildType === "STANDARD") {
        // Xóa các tiền tố chế độ riêng cũ nếu chuyển sang Cả lớp dùng chung
        finalNotes = finalNotes
          .replace(/\[Loại \d+[^\]]*\]/gi, "")
          .replace(/\[Món Chung\]/gi, "")
          .trim();
      } else if (targetChildType === "ALLERGIES" && !finalNotes.includes("Loại 3")) {
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

      const isWholeClass = targetChildType === "STANDARD" || targetChildType === "COMMON";

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
        newDishId: selectedDishId,
        portionSizeG: Number(portionSizeG),
        substituteDishId: isWholeClass ? undefined : (substituteDishId || undefined),
        specialDietNotes: isWholeClass ? null : (finalNotes || undefined),
        keepOriginalDish: !isWholeClass,
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
                    <option value="AFTERNOON_SNACK">{translateText("Buổi phụ - Nước / Trái cây (14h30)")}</option>
                  ) : (
                    <option value="AFTERNOON_SNACK" disabled>{translateText("Buổi phụ (14h30) - Trường không cấu hình")}</option>
                  )}
                  {hasLateSnack ? (
                    <option value="LATE_SNACK">{translateText("Buổi chiều xế - Món ăn (17h00)")}</option>
                  ) : (
                    <option value="LATE_SNACK" disabled>{translateText("Buổi chiều xế (17h00) - Trường không cấu hình")}</option>
                  )}
                </select>
              </div>
            </div>

            {/* 1. MỤC ĐÍCH MÓN ĂN / THAY THẾ CHO LOẠI BÉ NÀO */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">{translateText("Mục đích món ăn & Đối tượng trẻ áp dụng:")}</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTargetChildType("STANDARD");
                    if (hasAllergyConflict && String(selectedDishId) === String(initialSlot?.existingDish?.dishId)) {
                      const firstAlt = eligibleDishes.find((d) => String(d.id) !== String(initialSlot?.existingDish?.dishId));
                      if (firstAlt) {
                        setSelectedDishId(String(firstAlt.id));
                        setPortionSizeG(Number(firstAlt.standardServingSizeG) || 100);
                      }
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${targetChildType === "STANDARD"
                    ? "bg-white border-slate-700 ring-2 ring-slate-700 shadow-2xs font-bold text-slate-900"
                    : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white"
                    }`}
                >
                  <Users className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">{translateText("🌟 Gán cho cả lớp")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetChildType("ALLERGIES")}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${targetChildType === "ALLERGIES"
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
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${targetChildType === "OBESE"
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
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${targetChildType === "STUNTED"
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
                className={`w-full p-2 rounded-xl border text-center transition flex items-center justify-center gap-2 text-xs cursor-pointer ${targetChildType === "COMMON"
                  ? "bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600 shadow-2xs font-bold text-emerald-950"
                  : "bg-white/80 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                  }`}
              >
                <ChefHat className="w-3.5 h-3.5 text-emerald-600" />
                <span>{translateText("⭐ Món thay thế phù hợp chung cho Bếp")}</span>
              </button>

              {/* Thẻ giải thích mục đích áp dụng của Chuyên gia Dinh dưỡng */}
              <div className="pt-1">
                {targetChildType === "STANDARD" && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                    <span className="text-lg shrink-0">🌟</span>
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">{translateText("Gán món ăn cho toàn bộ lớp học (Món gốc):")}</span>
                      <span className="text-[11px] text-slate-600 leading-relaxed block mt-0.5">
                        {translateText("Món ăn Chuyên gia chọn bên dưới sẽ được gán làm món chính cho toàn bộ học sinh trong lớp / trường. Bếp chỉ cần nấu duy nhất một món này, không chia suất riêng.")}
                      </span>
                    </div>
                  </div>
                )}
                {targetChildType === "ALLERGIES" && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                    <span className="text-lg shrink-0">🚨</span>
                    <div>
                      <span className="font-bold text-rose-950 block text-xs">{translateText("Nấu suất riêng cho trẻ dị ứng (Loại 3):")}</span>
                      <span className="text-[11px] text-rose-700 leading-relaxed block mt-0.5">
                        {translateText("Giữ món gốc cho các bạn khác trong lớp, Bếp sẽ nấu thêm suất riêng món này cho trẻ có cơ địa dị ứng đã ghi nhận.")}
                      </span>
                    </div>
                  </div>
                )}
                {targetChildType === "OBESE" && (
                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-800 flex items-start gap-2.5">
                    <span className="text-lg shrink-0">⚖️</span>
                    <div>
                      <span className="font-bold text-purple-950 block text-xs">{translateText("Nấu suất riêng giảm béo (Loại 2 - Thừa cân / Béo phì):")}</span>
                      <span className="text-[11px] text-purple-700 leading-relaxed block mt-0.5">
                        {translateText("Giữ món gốc cho cả lớp, Bếp chuẩn bị suất riêng tiết chế calo & giảm béo theo Chuẩn Dinh Dưỡng.")}
                      </span>
                    </div>
                  </div>
                )}
                {targetChildType === "STUNTED" && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                    <span className="text-lg shrink-0">👶</span>
                    <div>
                      <span className="font-bold text-amber-950 block text-xs">{translateText("Nấu suất riêng tăng đạm (Loại 1 - Thấp còi / Suy dinh dưỡng):")}</span>
                      <span className="text-[11px] text-amber-700 leading-relaxed block mt-0.5">
                        {translateText("Giữ món gốc cho cả lớp, Bếp chuẩn bị suất riêng tăng đạm sinh học theo QĐ 1246.")}
                      </span>
                    </div>
                  </div>
                )}
                {targetChildType === "COMMON" && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
                    <span className="text-lg shrink-0">⭐</span>
                    <div>
                      <span className="font-bold text-emerald-950 block text-xs">{translateText("Món thay thế đa năng tối ưu cho Bếp:")}</span>
                      <span className="text-[11px] text-emerald-700 leading-relaxed block mt-0.5">
                        {translateText("Món ăn an toàn, cân bằng, phù hợp chung cho cả trẻ dị ứng và các nhóm dinh dưỡng đặc thù để bếp thuận tiện chế biến chung.")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cảnh báo hướng dẫn xử lý dị ứng khi chọn Cả lớp dùng chung */}
              {hasAllergyConflict && targetChildType === "STANDARD" && (
                <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-xs">
                      {translateText("Món gốc hiện tại đang có cảnh báo dị ứng (")}{currentConflicts.length} {translateText("bé):")}
                    </span>
                    <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                      {translateText("Để gán món an toàn cho cả lớp và xóa cảnh báo dị ứng, Chuyên gia vui lòng bấm chọn 1 món an toàn bên dưới (")}{getCategorySafeExampleText()}{translateText(") rồi bấm Xác nhận món.")}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* THẺ SO SÁNH TRỰC QUAN MÓN HIỆN TẠI VÀ MÓN MỚI (CHO CẢ LỚP DÙNG CHUNG) */}
            {initialSlot?.existingDish && targetChildType === "STANDARD" && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">
                    {translateText("1. Món hiện tại trên thực đơn:")}
                  </span>
                  {hasAllergyConflict && (
                    <span className="text-[9.5px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                      ⚠ Có cảnh báo dị ứng ({currentConflicts.length} bé)
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    {initialSlot.existingDish.dish?.name || translateText("Món ăn")}
                  </span>
                  <span className="text-slate-500 font-semibold">{initialSlot.existingDish.portionSizeG}g</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[10.5px] font-bold text-teal-800 uppercase tracking-wide">
                    {translateText("2. Món mới thay thế cho cả lớp:")}
                  </span>
                  {!isSameDish ? (
                    <span className="text-[9.5px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-700" />
                      {translateText("✓ Đã chọn món thay thế")}
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                      {translateText("👉 Chưa chọn món mới")}
                    </span>
                  )}
                </div>

                {!isSameDish && currentDish ? (
                  <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-400 flex items-center justify-between text-xs text-teal-950 font-bold shadow-2xs animate-in fade-in">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {currentDish.name}
                    </span>
                    <span className="text-amber-800 font-black">{calculatedCalories} Kcal ({portionSizeG}g)</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-dashed border-amber-300 text-xs text-amber-900 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{translateText("Vui lòng bấm chọn một món ăn gợi ý ở bên dưới để gán cho cả lớp.")}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. CHỌN MÓN ĂN & BỘ LỌC CÙNG LOẠI */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                  {translateText("Chọn món ăn thay thế ")}<span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {eligibleDishes.length} {translateText("món khả dụng")}
                </span>
              </div>

              {/* KHUNG KHÓA ĐỔI MÓN CÙNG LOẠI (Món nước là món nước, món mặn là món mặn - KHÔNG CHO CHỌN KHÁC LOẠI) */}
              {initialSlot?.existingDish && (
                <div className="p-3 rounded-2xl border bg-teal-50/90 border-teal-300 text-teal-950 shadow-2xs flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-inner bg-teal-600 text-white shadow-teal-700/20">
                      🔒
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs text-teal-950">
                          {translateText("BẮT BUỘC ĐÚNG LOẠI MÓN:")}
                        </span>
                        {mealTime === "AFTERNOON_SNACK" ? (
                          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border bg-purple-50 text-purple-800 border-purple-200">
                            🧁 Món Phụ
                          </span>
                        ) : mealTime === "BREAKFAST" || mealTime === "MORNING_SNACK" || mealTime === "LATE_SNACK" ? (
                          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border bg-orange-50 text-orange-800 border-orange-200">
                            🍜 Món Nước (Bún / Phở / Miến / Cháo / Súp)
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border ${CATEGORY_INFO[targetCategory]?.badgeColor}`}>
                            {CATEGORY_INFO[targetCategory]?.icon} {translateText(CATEGORY_INFO[targetCategory]?.shortName)}
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-teal-800/90 mt-0.5 font-medium leading-tight">
                        {mealTime === "AFTERNOON_SNACK"
                          ? translateText("Món phụ 14h30: Bánh ngọt, Trái cây tươi, Sữa / Yaourt dinh dưỡng sau giờ ngủ trưa.")
                          : (mealTime === "BREAKFAST" || mealTime === "LATE_SNACK")
                            ? translateText("Món nước là món nước: Khóa chuẩn 100%, chỉ hiển thị các món bún, phở, miến, cháo, súp, bánh canh đúng chuẩn.")
                            : translateText(`Món nước là món nước, món mặn là món mặn. Khóa chuẩn 100%, chỉ hiển thị các món "${CATEGORY_INFO[targetCategory]?.shortName}" (tuyệt đối không cho phép chọn món khác loại).`)}
                      </p>
                    </div>
                  </div>

                  <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-teal-800 text-white border border-teal-900 shadow-2xs shrink-0 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-teal-300" />
                    <span>{translateText("Đang khóa chuẩn")}</span>
                  </div>
                </div>
              )}

              {/* Pills lọc cùng loại (Chỉ hiển thị cho buổi phụ 14h30) */}
              {mealTime === "AFTERNOON_SNACK" && (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "AFTERNOON_ALL", label: translateText("Tất cả món phụ"), icon: "✨" },
                    { key: "AFTERNOON_CAKE", label: translateText("Bánh / Flan / Su kem"), icon: "🍰" },
                    { key: "AFTERNOON_FRUIT", label: translateText("Trái cây tươi"), icon: "🍉" },
                    { key: "AFTERNOON_DRINK", label: translateText("Sữa / Yaourt / Nước"), icon: "🥛" },
                  ].map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategoryFilter(cat.key)}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 ${categoryFilter === cat.key
                        ? "bg-slate-900 text-white shadow-3xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{translateText(cat.label)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* BẢNG GỢI Ý MÓN CÙNG LOẠI BẤM 1-CLICK ĐỔI NGAY (ĐẶT LÊN TRÊN ĐỂ DỄ THẤY VÀ BẤM NGAY) */}
              {eligibleDishes.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] font-black text-teal-800 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {translateText("Gợi ý đổi nhanh cùng loại (Bấm để chọn 1-click):")}
                    </span>
                    <span className="text-[9.5px] font-semibold text-slate-400">
                      {Math.min(6, eligibleDishes.length)}/{eligibleDishes.length} {translateText("món")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {eligibleDishes.slice(0, 6).map((dish) => {
                      const isSelected = String(selectedDishId) === String(dish.id);
                      const isCurrentDish = String(initialSlot?.existingDish?.dishId) === String(dish.id);
                      const cat = detectCategory(dish.name, dish.dishType, (dish as any).categoryCode);
                      return (
                        <div
                          key={dish.id}
                          onClick={() => {
                            setSelectedDishId(String(dish.id));
                            setPortionSizeG(Number(dish.standardServingSizeG) || 100);
                          }}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${isSelected
                            ? "bg-teal-50 border-teal-500 ring-2 ring-teal-500/30 shadow-2xs font-bold text-teal-950"
                            : "bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50 text-slate-800"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[11px] font-bold leading-tight line-clamp-1">
                              {CATEGORY_INFO[cat]?.icon} {dish.name}
                            </span>
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                            ) : isCurrentDish ? (
                              <span className="text-[8.5px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 font-bold shrink-0">
                                {translateText("Hiện tại")}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between text-[9.5px] text-slate-500 mt-1 font-semibold">
                            <span className="text-amber-700 font-bold">{dish.totalCalories} Kcal</span>
                            <span>Đạm: {dish.totalProteinG}g</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hoặc tìm kiếm / chọn từ danh mục */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  {translateText(`Hoặc chọn từ danh sách (${eligibleDishes.length} món):`)}
                </span>
                {/* Search input món ăn */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={
                      isStrictLock
                        ? translateText(`Tìm trong danh mục ${CATEGORY_INFO[targetCategory]?.shortName}...`)
                        : translateText("Tìm tên món ăn...")
                    }
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-slate-50"
                  />
                </div>

                {/* Select Dropdown chọn món ăn */}
                <select
                  value={selectedDishId}
                  onChange={(e) => {
                    setSelectedDishId(e.target.value);
                    const d = dishes.find((item) => String(item.id) === String(e.target.value));
                    if (d) setPortionSizeG(Number(d.standardServingSizeG) || 100);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition bg-white font-medium"
                  required
                >
                  <option value="">
                    {translateText(`-- Chọn món cùng loại (${eligibleDishes.length} món) --`)}
                  </option>
                  {eligibleDishes.map((dish) => {
                    const cat = detectCategory(dish.name, dish.dishType, (dish as any).categoryCode);
                    return (
                      <option key={dish.id} value={dish.id}>
                        {CATEGORY_INFO[cat]?.icon} {dish.name} ({dish.totalCalories}{translateText(" Kcal /")}{" "}
                        {dish.standardServingSizeG}{translateText("g)")}
                      </option>
                    );
                  })}
                </select>

                {String(selectedDishId) === String(initialSlot?.existingDish?.dishId) && targetChildType === "STANDARD" && (
                  <p className="text-[10.5px] text-amber-700/90 font-medium italic mt-1 flex items-center gap-1.5 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/80">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{translateText("Đang chọn món hiện tại. Bấm chọn món khác ở trên để thay thế món mới cho cả lớp.")}</span>
                  </p>
                )}
              </div>
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
                <span className="text-[10px] font-bold text-teal-700 lowercase bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {eligibleSubstituteDishes.length} {translateText("món cùng loại")}
                </span>
              </label>
              <select
                value={substituteDishId}
                onChange={(e) => setSubstituteDishId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition bg-white font-medium"
              >
                <option value="">{translateText("-- Không có món thay thế (Dùng chung) --")}</option>
                {eligibleSubstituteDishes.map((dish) => {
                  const cat = detectCategory(dish.name, dish.dishType, (dish as any).categoryCode);
                  return (
                    <option key={dish.id} value={dish.id}>
                      {CATEGORY_INFO[cat]?.icon} {dish.name} ({dish.totalCalories}{translateText(" Kcal /")}{" "}
                      {dish.standardServingSizeG}{translateText("g)")}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {isStrictLock
                  ? translateText(`Bắt buộc cùng loại: Chỉ hiển thị các món thay thế thuộc danh mục "${CATEGORY_INFO[targetCategory]?.shortName}" an toàn cho trẻ dị ứng.`)
                  : translateText("Áp dụng cho học sinh có cảnh báo dị ứng hải sản / trứng / sữa bò trong lớp.")}
              </p>
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
              disabled={isSubmitting || isUnchangedForWholeClass}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition ${isUnchangedForWholeClass
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/25 cursor-pointer"
                }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{translateText("Đang cập nhật...")}</span>
                </>
              ) : isUnchangedForWholeClass ? (
                <>
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>{translateText("👉 Vui lòng chọn món mới bên dưới")}</span>
                </>
              ) : isSameDish && !isSamePortion ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{translateText(`✓ Cập nhật định lượng (${portionSizeG}g)`)}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{translateText(`✓ Xác nhận đổi sang: ${currentDish?.name || 'Món mới'}`)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
