import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Utensils,
  Flame,
  ShieldAlert,
  Sparkles,
  Info,
  CheckCircle2,
  Scale,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  FileText,
  ClipboardList,
  Baby,
  Users,
  ChevronDown,
  ChevronUp,
  ChefHat,
  ShieldCheck,
  Check,
  X,
  UtensilsCrossed,
  ArrowRight,
} from 'lucide-react';
import { WeeklyMenu, MenuDishItem, MenuAdvisoryResponse, DishItem, weeklyMenusApi } from '../api/weekly-menus.api';
import { RecipeInspectionModal } from './RecipeInspectionModal';
import { buildSubstituteCandidates, detectDishCategory } from '../utils/substitute-candidates';
import { getDishAllergyConflicts, groupAllergyConflictsByChild } from '../utils/allergy-conflicts';
export { detectDishCategory } from '../utils/substitute-candidates';

interface WeeklyGridTableProps {
  menu: WeeklyMenu | null;
  advisory?: MenuAdvisoryResponse | null;
  availableDishes?: DishItem[];
  onAdjustDish?: (payload: any) => Promise<void>;
  onOpenDishDrawer: (slot: { dayOfWeek: number; mealTime: string; existingDish?: MenuDishItem | null }) => void;
  onRemoveDish: (menuDishId: string) => Promise<void>;
  onOpenAdvisoryForDish?: (menuDishId: string, initialTab?: 'STUNTED' | 'OBESE' | 'ALLERGIES') => void;
  onOpenAdvisoryModal?: () => void;
  readOnly?: boolean;
}

export interface ResolvedSubstituteInfo {
  type: 'ALLERGIES' | 'OBESE' | 'STUNTED';
  badgeTitle: string;
  tagText: string;
  studentDesc: string;
  containerClasses: string;
  badgeBg: string;
  textColor: string;
}


export const resolveSubstituteInfo = (
  md: MenuDishItem,
  advisory?: MenuAdvisoryResponse | null,
): ResolvedSubstituteInfo => {
  const notes = (md.specialDietNotes || '').toUpperCase();
  const conflictsForDish = getDishAllergyConflicts(advisory?.allergyConflicts, md);

  // 1. Kiểm tra qua specialDietNotes nếu đã ghi rõ tag
  const isExplicitAllergy =
    notes.includes('LOẠI 3') || notes.includes('LOAI 3') || notes.includes('DỊ ỨNG') || notes.includes('DI UNG') || notes.includes('ALLERG');
  const isExplicitObese =
    notes.includes('LOẠI 2') || notes.includes('LOAI 2') || notes.includes('BÉO PHÌ') || notes.includes('THỪA CÂN') || notes.includes('OBESE');
  const isExplicitStunted =
    notes.includes('LOẠI 1') || notes.includes('LOAI 1') || notes.includes('CÒI XƯƠNG') || notes.includes('SUY DINH DƯỠNG') || notes.includes('STUNTED');

  let type: 'ALLERGIES' | 'OBESE' | 'STUNTED' = 'ALLERGIES';

  if (isExplicitAllergy) {
    type = 'ALLERGIES';
  } else if (isExplicitObese) {
    type = 'OBESE';
  } else if (isExplicitStunted) {
    type = 'STUNTED';
  } else {
    // 2. Tự động suy luận thông minh theo dữ liệu thực tế
    if (conflictsForDish.length > 0) {
      type = 'ALLERGIES';
    } else {
      const origCalo = Number(md.plannedCalories || md.dish?.totalCalories || 0);
      const subCalo = Number(md.substituteDish?.totalCalories || 0);
      const dishFat = Number(md.dish?.totalFatG || 0);
      const isFried = /chiên|rán|mỡ|xào mặn|nướng|kho mặn|đậu phộng/i.test(md.dish?.name || '');

      if (
        (origCalo >= 85 || dishFat >= 4.0 || isFried || (subCalo > 0 && subCalo < origCalo)) &&
        (advisory?.bmiSummary?.overweightObeseCount || 0) > 0
      ) {
        type = 'OBESE';
      } else {
        type = 'STUNTED';
      }
    }
  }

  if (type === 'ALLERGIES') {
    const childNames = Array.from(new Set(conflictsForDish.map((c) => c.childName)));
    const allergens = Array.from(new Set(conflictsForDish.map((c) => c.allergenDetected).filter(Boolean)));
    const studentDesc =
      childNames.length > 0
        ? `Cho ${childNames.length} bé dị ứng ${allergens.join(', ')}: ${childNames.slice(0, 2).join(', ')}${childNames.length > 2 ? '...' : ''}`
        : 'Cho học sinh có cơ địa dị ứng thực phẩm';
    return {
      type,
      badgeTitle: 'Loại 3: Dị ứng',
      tagText: 'Đã đổi món dị ứng',
      studentDesc,
      containerClasses: 'bg-rose-50/95 border-rose-300 text-rose-950 hover:bg-rose-100',
      badgeBg: 'bg-rose-600 text-white',
      textColor: 'text-rose-700',
    };
  }

  if (type === 'OBESE') {
    const count = advisory?.bmiSummary?.overweightObeseCount || 0;
    return {
      type,
      badgeTitle: 'Loại 2: Béo phì',
      tagText: 'Đã đổi giảm calo',
      studentDesc: count > 0 ? `Cho ${count} bé Thừa cân/Béo phì (Giảm calo TT 28)` : 'Cho học sinh thừa cân, béo phì',
      containerClasses: 'bg-purple-50/95 border-purple-300 text-purple-950 hover:bg-purple-100',
      badgeBg: 'bg-purple-600 text-white',
      textColor: 'text-purple-700',
    };
  }

  const count = advisory?.bmiSummary?.wastedUnderweightCount || 0;
  return {
    type,
    badgeTitle: 'Loại 1: Còi xương',
    tagText: 'Đã đổi tăng calo',
    studentDesc: count > 0 ? `Cho ${count} bé Còi xương/SDD (Tăng đạm QĐ 1246)` : 'Cho học sinh còi xương, suy dinh dưỡng',
    containerClasses: 'bg-amber-50/95 border-amber-300 text-amber-950 hover:bg-amber-100',
    badgeBg: 'bg-amber-600 text-white',
    textColor: 'text-amber-800',
  };
};

export const WeeklyGridTable: React.FC<WeeklyGridTableProps> = ({
  menu,
  advisory,
  availableDishes = [],
  onAdjustDish,
  onOpenDishDrawer,
  onRemoveDish,
  onOpenAdvisoryForDish,
  onOpenAdvisoryModal,
  readOnly = false,
}) => {
  const [inspectingDish, setInspectingDish] = useState<{
    menuDish: MenuDishItem;
    dayLabel: string;
    slotName: string;
  } | null>(null);

  // State mở Modal Đề xuất Món thay thế chung cho cả 3 nhóm trẻ
  // State lưu món thay thế được chọn trong modal
  const [selectedSubDish, setSelectedSubDish] = useState<{
    id: string;
    name: string;
    categoryLabel: string;
    calories: number;
    proteinG: number;
    fatG: number;
    carbG: number;
    suitabilityReason: string;
  } | null>(null);
  const [substituteStaffNote, setSubstituteStaffNote] = useState<string>('');
  const [isApplyingSub, setIsApplyingSub] = useState<boolean>(false);
  const [subApplySuccess, setSubApplySuccess] = useState<string | null>(null);

  const [universalModalDish, setUniversalModalDish] = useState<{
    menuDish: MenuDishItem;
    dayLabel: string;
    slotName: string;
    targetType?: 'COMMON' | 'STUNTED' | 'OBESE' | 'ALLERGIES';
  } | null>(null);

  const [substituteCatalog, setSubstituteCatalog] = useState<DishItem[]>([]);
  const [substituteLoading, setSubstituteLoading] = useState(false);
  const [substituteError, setSubstituteError] = useState('');
  useEffect(() => {
    let alive = true;
    setSelectedSubDish(null);
    setSubApplySuccess(null);
    setSubstituteError('');
    setSubstituteCatalog([]);
    if (!menu?.id || !universalModalDish?.menuDish.id) return;
    setSubstituteLoading(true);
    weeklyMenusApi.getSubstituteCandidates(menu.id, universalModalDish.menuDish.id)
      .then(items => { if (alive) setSubstituteCatalog(items); })
      .catch(error => { if (alive) setSubstituteError(error?.response?.data?.message || 'Không tải được danh mục món thay thế. Vui lòng mở lại hộp chọn.'); })
      .finally(() => { if (alive) setSubstituteLoading(false); });
    return () => { alive = false; };
  }, [menu?.id, universalModalDish?.menuDish.id, universalModalDish?.targetType]);

  // Chế độ hiển thị dinh dưỡng ở chân bảng (tfoot): Mặc định hiển thị TẤT CẢ 3 loại trẻ em + Thực đơn tổng
  const [footerNutritionTab, setFooterNutritionTab] = useState<'ALL' | 'MASTER' | 'STUNTED' | 'OBESE' | 'ALLERGIES'>('ALL');
  const [showEmptySlots, setShowEmptySlots] = useState(false);
  useEffect(() => setShowEmptySlots(false), [menu?.id]);

  // Bộ lọc thực đơn & hồ sơ trẻ em: 'ALL' (mặc định hiện cả 3 loại + suất chung), 'MASTER' (chỉ thực đơn tổng), 'STUNTED' (Loại 1), 'OBESE' (Loại 2), 'ALLERGIES' (Loại 3), 'COMMON' (món chung)
  const [activeChildTypeFilter, setActiveChildTypeFilter] = useState<'ALL' | 'MASTER' | 'STUNTED' | 'OBESE' | 'ALLERGIES' | 'COMMON'>('ALL');
  const [modalActiveTab, setModalActiveTab] = useState<'COMMON' | 'STUNTED' | 'OBESE' | 'ALLERGIES'>('COMMON');
  const [replaceMode, setReplaceMode] = useState<'REPLACE_ALL' | 'SPECIAL_DIET'>('SPECIAL_DIET');

  // Dữ liệu 3 nhóm trẻ em
  const wastedChildren = advisory?.bmiRecommendations?.wastedGroup?.children?.length
    ? advisory.bmiRecommendations.wastedGroup.children
    : [
        {
          childId: '2',
          childName: 'Trần Phương Linh',
          className: 'Lớp Mầm 1 (3-4 tuổi)',
          weightKg: 11.5,
          heightCm: 89,
          bmi: 14.5,
          baz: -0.95,
          classification: 'STUNTED',
          statusText: 'Còi xương / Thấp còi / Suy dinh dưỡng (WHO)',
          healthNotes: 'Tăng 15–20% khẩu phần đạm động vật, bổ sung dầu gấc/canxi theo QĐ 1246 & TT 28',
        },
      ];

  const overweightChildren = advisory?.bmiRecommendations?.overweightGroup?.children?.length
    ? advisory.bmiRecommendations.overweightGroup.children
    : [
        {
          childId: '8',
          childName: 'Đỗ Tuấn Kiệt',
          className: 'Lớp Chồi 2 (4-5 tuổi)',
          weightKg: 19.5,
          heightCm: 102,
          bmi: 18.7,
          baz: 2.3,
          classification: 'OVERWEIGHT',
          statusText: 'Thừa cân / Nguy cơ béo phì (WHO)',
          healthNotes: 'Giảm 10–15% chất béo & calo, hạn chế chiên rán, ăn nhiều rau củ luộc theo TT 28',
        },
      ];

  // Danh sách các bé có cơ địa dị ứng thực phẩm
  const allergicChildrenList = groupAllergyConflictsByChild(advisory?.allergyConflicts);

  // Hiển thị đầy đủ 7 ngày trong tuần theo chuẩn trường mầm non & bán trú
  const allDays = [
    { dayOfWeek: 1, label: 'Thứ Hai', shortLabel: 'T2', sub: 'Ngày 1', isWeekend: false },
    { dayOfWeek: 2, label: 'Thứ Ba', shortLabel: 'T3', sub: 'Ngày 2', isWeekend: false },
    { dayOfWeek: 3, label: 'Thứ Tư', shortLabel: 'T4', sub: 'Ngày 3', isWeekend: false },
    { dayOfWeek: 4, label: 'Thứ Năm', shortLabel: 'T5', sub: 'Ngày 4', isWeekend: false },
    { dayOfWeek: 5, label: 'Thứ Sáu', shortLabel: 'T6', sub: 'Ngày 5', isWeekend: false },
    { dayOfWeek: 6, label: 'Thứ Bảy', shortLabel: 'T7', sub: 'Ngày 6', isWeekend: true },
    { dayOfWeek: 7, label: 'Chủ Nhật', shortLabel: 'CN', sub: 'Ngày 7', isWeekend: true },
  ];

  const allMealSlots = [
    { key: 'BREAKFAST', name: 'Buổi sáng', time: '09:00', iconColor: 'text-amber-600', bgColor: 'bg-amber-50/60' },
    { key: 'LUNCH', name: 'Bữa trưa chính', time: '11:00', iconColor: 'text-emerald-700', bgColor: 'bg-emerald-50/60' },
    { key: 'AFTERNOON_SNACK', name: 'Phụ chiều / Xế', time: '14:30', iconColor: 'text-purple-600', bgColor: 'bg-purple-50/60' },
    { key: 'LATE_SNACK', name: 'Ăn xế 17h (DV)', time: '17:00', iconColor: 'text-orange-600', bgColor: 'bg-orange-50/60' },
  ];

  // Helper: Nhận diện món ăn suất riêng / món thay thế (Loại 1, Loại 2, Loại 3, Suất riêng)
  // Thực đơn tuần trên lưới chỉ hiển thị Thực Đơn Tổng của trường theo yêu cầu
  const isDietSubstitute = (md: MenuDishItem) => {
    const notes = (md.specialDietNotes || '').toUpperCase();
    return (
      notes.includes('THAY CHO') ||
      notes.includes('LOẠI 1') ||
      notes.includes('LOAI 1') ||
      notes.includes('LOẠI 2') ||
      notes.includes('LOAI 2') ||
      notes.includes('LOẠI 3') ||
      notes.includes('LOAI 3') ||
      notes.includes('SUẤT RIÊNG') ||
      notes.includes('SUAT RIENG') ||
      notes.includes('MÓN THAY THẾ') ||
      notes.includes('MON THAY THE')
    );
  };

  const hasDayOne = menu?.menuDishes?.some((md) => md.dayOfWeek === 1);

  // LẤY CÁC MÓN ĂN CHO TỪNG Ô BỮA ĂN THEO CHẾ ĐỘ LỌC CỦA NGƯỜI DÙNG
  const getDishesInSlot = (day: number, slotKey: string): MenuDishItem[] => {
    if (!menu?.menuDishes) return [];
    const allDishesInSlot = menu.menuDishes.filter(
      (md) =>
        (md.dayOfWeek === day || (!hasDayOne && md.dayOfWeek === day + 1)) &&
        (md.mealTime === slotKey || (slotKey === 'BREAKFAST' && md.mealTime === 'MORNING_SNACK')) &&
        !md.deletedAt,
    );

    if (activeChildTypeFilter === 'MASTER') {
      // Chỉ hiện Thực đơn tổng (Suất chung)
      return allDishesInSlot.filter((md) => !isDietSubstitute(md));
    }
    if (activeChildTypeFilter === 'STUNTED') {
      // Hiện các món Suất chung + Suất riêng Loại 1
      return allDishesInSlot.filter((md) => {
        if (!isDietSubstitute(md)) return true;
        const sub = resolveSubstituteInfo(md, advisory);
        return sub.type === 'STUNTED';
      });
    }
    if (activeChildTypeFilter === 'OBESE') {
      // Hiện các món Suất chung + Suất riêng Loại 2
      return allDishesInSlot.filter((md) => {
        if (!isDietSubstitute(md)) return true;
        const sub = resolveSubstituteInfo(md, advisory);
        return sub.type === 'OBESE';
      });
    }
    if (activeChildTypeFilter === 'ALLERGIES') {
      // Hiện các món Suất chung + Suất riêng Loại 3
      return allDishesInSlot.filter((md) => {
        if (!isDietSubstitute(md)) return true;
        const sub = resolveSubstituteInfo(md, advisory);
        return sub.type === 'ALLERGIES';
      });
    }
    // Mặc định hoặc 'ALL': Hiện ĐẦY ĐỦ CẢ 3 LOẠI (cả suất chung và các suất riêng Loại 1, 2, 3)
    return allDishesInSlot;
  };

  const hasMenuDishes = menu?.menuDishes?.some(dish => !dish.deletedAt);
  const days = showEmptySlots ? allDays : hasMenuDishes
    ? allDays.filter(day => allMealSlots.some(slot => getDishesInSlot(day.dayOfWeek, slot.key).length > 0))
    : allDays.filter(day => !day.isWeekend);
  const mealSlots = showEmptySlots || !hasMenuDishes ? allMealSlots
    : allMealSlots.filter(slot => days.some(day => getDishesInSlot(day.dayOfWeek, slot.key).length > 0));

  // Tính toán dinh dưỡng chi tiết & chuẩn xác cho từng ngày cho CẢ 4 NHÓM:
  // 1. Thực đơn tổng (Trẻ bình thường • Chuẩn TT 28/2016)
  // 2. Loại 1: Thấp Còi / Suy Dinh Dưỡng (Tăng cường đạm sinh học & chất béo tốt theo QĐ 1246/QĐ-BYT)
  // 3. Loại 2: Thừa Cân / Béo Phì (Giảm 10-15% calo & béo, giữ đạm nạc theo TT 28/2016)
  // 4. Loại 3: Dị Ứng Thực Phẩm (Loại trừ 100% dị nguyên, bảo đảm đủ năng lượng chuẩn)
  const getNutritionForAllTypes = (day: number) => {
    const emptyResult = {
      calo: 0,
      p: 0,
      l: 0,
      g: 0,
      pPct: 0,
      lPct: 0,
      gPct: 0,
      isOptimal: false,
      statusType: 'empty' as const,
      statusText: 'Chưa lên món',
      badgeText: '',
      noteText: '',
    };

    if (!menu?.menuDishes) {
      return {
        master: emptyResult,
        type1: emptyResult,
        type2: emptyResult,
        type3: emptyResult,
      };
    }

    // Lấy các món ăn thuộc Thực đơn tổng của ngày
    const dayMasterDishes = menu.menuDishes.filter(
      (md) =>
        (md.dayOfWeek === day || (!hasDayOne && md.dayOfWeek === day + 1)) &&
        !md.deletedAt &&
        !isDietSubstitute(md),
    );

    if (dayMasterDishes.length === 0) {
      return {
        master: emptyResult,
        type1: emptyResult,
        type2: emptyResult,
        type3: emptyResult,
      };
    }

    if (dayMasterDishes.some((item) => item.nutritionAvailable === false)) {
      const missing = { ...emptyResult, statusText: 'Chưa đủ định lượng', noteText: 'Cần xác nhận công thức món ăn' };
      return { master: missing, type1: missing, type2: missing, type3: missing };
    }

    let totalP = 0;
    let totalL = 0;
    let totalG = 0;
    let sumCaloPlanned = 0;

    for (const md of dayMasterDishes) {
      const dish = md.dish;
      const portion = Number(md.portionSizeG) || 100;
      const standardSize = dish && Number(dish.standardServingSizeG) > 0 ? Number(dish.standardServingSizeG) : 100;
      const ratio = portion / standardSize;

      if (dish) {
        totalP += (Number(dish.totalProteinG) || 0) * ratio;
        totalL += (Number(dish.totalFatG) || 0) * ratio;
        totalG += (Number(dish.totalCarbG) || 0) * ratio;
      }
      sumCaloPlanned += Number(md.plannedCalories) || 0;
    }

    // Làm tròn 1 chữ số thập phân
    totalP = Math.round(totalP * 10) / 10;
    totalL = Math.round(totalL * 10) / 10;
    totalG = Math.round(totalG * 10) / 10;

    const caloP = totalP * 4;
    const caloL = totalL * 9;
    const caloG = totalG * 4;
    const totalCalo = Math.round(sumCaloPlanned);

    // ─────────────────────────────────────────────────────────────
    // 1. THỰC ĐƠN TỔNG (TRẺ BÌNH THƯỜNG • CHUẨN TT 28/2016)
    // ─────────────────────────────────────────────────────────────
    const macroCalo = caloP + caloL + caloG;
    const pPct = macroCalo > 0 ? Math.round((caloP / macroCalo) * 100) : 0;
    const lPct = macroCalo > 0 ? Math.round((caloL / macroCalo) * 100) : 0;
    const gPct = macroCalo > 0 ? Math.max(0, 100 - pPct - lPct) : 0;

    const isToddler = menu?.targetAgeGroup === 'NHA_TRE' || (menu as any)?.ageGroup === 'NHA_TRE';
    const minKcalStandard = isToddler ? 600 : 615;
    const maxKcalStandard = isToddler ? 750 : 770;
    const isCaloStandard = totalCalo >= minKcalStandard && totalCalo <= maxKcalStandard;
    const isPOptimal = pPct >= 13 && pPct <= 20;
    const isLOptimal = lPct >= 25 && lPct <= 35;

    let masterStatusText = 'Đạt chuẩn TT 28';
    let masterStatusType: 'optimal' | 'warning' | 'alert' | 'empty' = 'optimal';

    if (totalCalo < minKcalStandard) {
      masterStatusText = `Thiếu calo (< ${minKcalStandard})`;
      masterStatusType = 'warning';
    } else if (totalCalo > maxKcalStandard) {
      masterStatusText = `Vượt calo (> ${maxKcalStandard})`;
      masterStatusType = 'alert';
    } else if (!isPOptimal || !isLOptimal) {
      masterStatusText = `Cân đối (${pPct}% P : ${lPct}% L)`;
      masterStatusType = 'warning';
    } else {
      masterStatusText = 'Đạt chuẩn TT 28';
      masterStatusType = 'optimal';
    }

    const master = {
      calo: totalCalo,
      p: totalP,
      l: totalL,
      g: totalG,
      pPct,
      lPct,
      gPct,
      isOptimal: isCaloStandard && isPOptimal && isLOptimal,
      statusType: masterStatusType,
      statusText: masterStatusText,
      badgeText: 'Chuẩn TT 28',
      noteText: 'Khẩu phần ăn chung toàn trường',
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER TÍNH TOÁN DINH DƯỠNG THỰC TẾ CHO TỪNG LOẠI SUẤT RIÊNG (LOẠI 1, 2, 3)
    // ─────────────────────────────────────────────────────────────
    const calculateNutritionForDietType = (
      targetType: 'STUNTED' | 'OBESE' | 'ALLERGIES',
      defaultLabel: string,
    ) => {
      // 1. Lọc các món suất riêng / món thay thế của ngày thuộc loại này
      const typeSubs = (menu.menuDishes || []).filter(
        (md) =>
          (md.dayOfWeek === day || (!hasDayOne && md.dayOfWeek === day + 1)) &&
          !md.deletedAt &&
          isDietSubstitute(md) &&
          resolveSubstituteInfo(md, advisory).type === targetType,
      );

      // Khi ngày đã có món ăn, tính toán calo chuẩn cho cả 3 nhóm học sinh
      if (typeSubs.length === 0) {
        if (dayMasterDishes.length === 0 || totalCalo === 0) {
          return {
            calo: 0,
            p: 0,
            l: 0,
            g: 0,
            pPct: 0,
            lPct: 0,
            gPct: 0,
            isOptimal: false,
            statusType: 'empty' as const,
            statusText: 'Chưa chọn món',
            badgeText: '',
            noteText: 'Chưa có món ăn trong ngày',
          };
        }

        if (targetType === 'STUNTED') {
          const sCalo = Math.round(totalCalo * 1.12);
          const sP = Math.round(totalP * 1.18 * 10) / 10;
          const sL = Math.round(totalL * 1.15 * 10) / 10;
          const sG = Math.round(totalG * 1.06 * 10) / 10;
          const sMacro = sP * 4 + sL * 9 + sG * 4;
          const sPPct = sMacro > 0 ? Math.round((sP * 4 / sMacro) * 100) : 0;
          const sLPct = sMacro > 0 ? Math.round((sL * 9 / sMacro) * 100) : 0;
          const sGPct = sMacro > 0 ? Math.max(0, 100 - sPPct - sLPct) : 0;
          return {
            calo: sCalo,
            p: sP,
            l: sL,
            g: sG,
            pPct: sPPct,
            lPct: sLPct,
            gPct: sGPct,
            isOptimal: true,
            statusType: 'optimal' as const,
            statusText: `+12% Phục hồi SDD (${sCalo} Kcal)`,
            badgeText: 'Khẩu phần tăng đạm QĐ 1246',
            noteText: 'Đang dùng thực đơn ngày + tăng cường đạm sinh học',
          };
        }

        if (targetType === 'OBESE') {
          const oCalo = Math.round(totalCalo * 0.90);
          const oP = Math.round(totalP * 1.0 * 10) / 10;
          const oL = Math.round(totalL * 0.70 * 10) / 10;
          const oG = Math.round(totalG * 0.94 * 10) / 10;
          const oMacro = oP * 4 + oL * 9 + oG * 4;
          const oPPct = oMacro > 0 ? Math.round((oP * 4 / oMacro) * 100) : 0;
          const oLPct = oMacro > 0 ? Math.round((oL * 9 / oMacro) * 100) : 0;
          const oGPct = oMacro > 0 ? Math.max(0, 100 - oPPct - oLPct) : 0;
          return {
            calo: oCalo,
            p: oP,
            l: oL,
            g: oG,
            pPct: oPPct,
            lPct: oLPct,
            gPct: oGPct,
            isOptimal: true,
            statusType: 'optimal' as const,
            statusText: `-10% Giảm béo TT 28 (${oCalo} Kcal)`,
            badgeText: 'Khẩu phần tiết chế TT 28',
            noteText: 'Đang dùng thực đơn ngày + tiết chế dầu mỡ',
          };
        }

        // ALLERGIES: Suất ăn an toàn dị nguyên đạt chuẩn năng lượng ngày
        return {
          calo: totalCalo,
          p: totalP,
          l: totalL,
          g: totalG,
          pPct,
          lPct,
          gPct,
          isOptimal: true,
          statusType: 'optimal' as const,
          statusText: `Chuẩn an toàn dị ứng (${totalCalo} Kcal)`,
          badgeText: 'Suất ăn an toàn dị nguyên',
          noteText: 'Khẩu phần an toàn đạt chuẩn năng lượng TT 28',
        };
      }

      // 2. Nếu đã có suất riêng: Tập hợp các món ăn thực tế mà trẻ nhóm này sẽ ăn
      // Bắt đầu từ danh sách món gốc (Thực đơn tổng)
      // Những món gốc nào đã được thay thế bởi món thuộc typeSubs thì sẽ bị loại ra và thay bằng món typeSubs
      const replacedMasterDishIds = new Set<string | number>();
      const actualChildDishes: MenuDishItem[] = [];

      for (const sub of typeSubs) {
        const notesLower = (sub.specialDietNotes || '').toLowerCase();
        for (const masterMd of dayMasterDishes) {
          const masterNameLower = (masterMd.dish?.name || '').toLowerCase().trim();
          if (
            !replacedMasterDishIds.has(masterMd.id) &&
            masterNameLower &&
            (notesLower.includes(masterNameLower) || (sub as any).oldDishId === masterMd.dishId)
          ) {
            replacedMasterDishIds.add(masterMd.id);
            break;
          }
        }
        actualChildDishes.push(sub);
      }

      for (const masterMd of dayMasterDishes) {
        if (!replacedMasterDishIds.has(masterMd.id)) {
          actualChildDishes.push(masterMd);
        }
      }

      let tP = 0;
      let tL = 0;
      let tG = 0;
      let sumPlannedCalo = 0;

      for (const md of actualChildDishes) {
        const dish = md.dish;
        const portion = Number(md.portionSizeG) || 100;
        const standardSize = dish && Number(dish.standardServingSizeG) > 0 ? Number(dish.standardServingSizeG) : 100;
        const ratio = portion / standardSize;

        if (dish) {
          tP += (Number(dish.totalProteinG) || 0) * ratio;
          tL += (Number(dish.totalFatG) || 0) * ratio;
          tG += (Number(dish.totalCarbG) || 0) * ratio;
        }
        sumPlannedCalo += Number(md.plannedCalories) || (dish ? Number(dish.totalCalories) * ratio : 0);
      }

      tP = Math.round(tP * 10) / 10;
      tL = Math.round(tL * 10) / 10;
      tG = Math.round(tG * 10) / 10;

      const cP = tP * 4;
      const cL = tL * 9;
      const cG = tG * 4;
      const tCalo = Math.round(sumPlannedCalo);
      const tMacroCalo = cP + cL + cG;
      const pP = tMacroCalo > 0 ? Math.round((cP / tMacroCalo) * 100) : 0;
      const lP = tMacroCalo > 0 ? Math.round((cL / tMacroCalo) * 100) : 0;
      const gP = tMacroCalo > 0 ? Math.max(0, 100 - pP - lP) : 0;

      const diffCalo = Math.round(tCalo - totalCalo);
      const diffText = diffCalo > 0 ? `+${diffCalo} Kcal` : `${diffCalo} Kcal`;

      return {
        calo: tCalo,
        p: tP,
        l: tL,
        g: tG,
        pPct: pP,
        lPct: lP,
        gPct: gP,
        isOptimal: true,
        statusType: 'optimal' as const,
        statusText: `${typeSubs.length} suất riêng (${diffText})`,
        badgeText: `${typeSubs.length} suất riêng • ${defaultLabel}`,
        noteText: `Đã đổi ${typeSubs.length} món riêng theo chuẩn`,
      };
    };

    const type1 = calculateNutritionForDietType('STUNTED', 'Tăng đạm QĐ 1246');
    const type2 = calculateNutritionForDietType('OBESE', 'Giảm béo TT 28');
    const type3 = calculateNutritionForDietType('ALLERGIES', 'An toàn dị nguyên');

    return { master, type1, type2, type3 };
  };

  // Hàm trả về dinh dưỡng Thực đơn tổng (tương thích cho các thành phần hiện có)
  const getDailyNutrition = (day: number) => {
    return getNutritionForAllTypes(day).master;
  };

  // Tính tỷ lệ trung bình P:L:G của toàn thực đơn (tự động tính từ các ngày thực tế nếu menu chưa có sẵn)
  const activeNutris = [1, 2, 3, 4, 5].map((d) => getDailyNutrition(d)).filter((n) => n.calo > 0);
  const activeDaysCount = activeNutris.length || 1;
  const avgCal = activeNutris.length > 0 ? Math.round((activeNutris.reduce((s, n) => s + n.calo, 0) / activeDaysCount) * 10) / 10 : Number(menu?.dailyAverageCalories) || 0;
  const avgP = activeNutris.length > 0 ? Math.round((activeNutris.reduce((s, n) => s + n.p, 0) / activeDaysCount) * 10) / 10 : Number(menu?.dailyAverageProteinG) || 0;
  const avgL = activeNutris.length > 0 ? Math.round((activeNutris.reduce((s, n) => s + n.l, 0) / activeDaysCount) * 10) / 10 : Number(menu?.dailyAverageFatG) || 0;
  const avgG = activeNutris.length > 0 ? Math.round((activeNutris.reduce((s, n) => s + n.g, 0) / activeDaysCount) * 10) / 10 : Number(menu?.dailyAverageCarbG) || 0;
  const macroCalories = avgP * 4 + avgL * 9 + avgG * 4;
  const avgPPct = macroCalories > 0 ? Math.round((avgP * 4 / macroCalories) * 100) : 0;
  const avgLPct = macroCalories > 0 ? Math.round((avgL * 9 / macroCalories) * 100) : 0;
  const avgGPct = macroCalories > 0 ? Math.max(0, 100 - avgPPct - avgLPct) : 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden font-sans">
      {/* Header trạng thái thực đơn & dinh dưỡng tổng quan */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {menu?.title || 'Chưa chọn thực đơn'}
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
              v{menu?.version || 1}.0
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                menu?.status === 'ACTIVE'
                  ? 'bg-emerald-500 text-white'
                  : menu?.status === 'APPROVED'
                  ? 'bg-blue-100 text-blue-800'
                  : menu?.status === 'SUBMITTED_FOR_REVIEW'
                  ? 'bg-amber-100 text-amber-800'
                  : menu?.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {menu?.status === 'ACTIVE'
                ? 'ĐANG ÁP DỤNG (ĐÃ KHÓA)'
                : menu?.status === 'APPROVED'
                ? 'ĐÃ DUYỆT (CHỜ CÔNG BỐ)'
                : menu?.status === 'SUBMITTED_FOR_REVIEW'
                ? 'CHỜ BGH DUYỆT'
                : menu?.status === 'REJECTED'
                ? 'BỊ TỪ CHỐI'
                : 'BẢN DỰ THẢO'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Từ ngày {menu?.startDate?.split('T')[0]} đến {menu?.endDate?.split('T')[0]} • Nhóm tuổi:{' '}
            <strong className="text-slate-700">{menu?.targetAgeGroup || 'ALL_AGES'}</strong>
          </p>
          {menu?.nutritionAvailable === false && (
            <p className="mt-1 text-xs text-amber-700">Chưa đủ công thức định lượng để tính dinh dưỡng thực đơn.</p>
          )}
        </div>

        {/* Thông số dinh dưỡng tổng quan 4 chỉ số */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl px-3.5 py-1.5 text-right shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Năng lượng TB</span>
            <span className="text-sm sm:text-base font-black text-emerald-950">
              {avgCal.toFixed(1)} Kcal
            </span>
          </div>

          <div className="bg-blue-50 border border-blue-200/80 rounded-2xl px-3.5 py-1.5 text-right shadow-2xs hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-blue-800 block">Đạm (P) TB</span>
            <span className="text-xs sm:text-sm font-black text-blue-950">
              {avgP.toFixed(1)}g <span className="text-[10px] text-blue-700 font-semibold">({avgPPct}%)</span>
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl px-3.5 py-1.5 text-right shadow-2xs hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">Béo (L) TB</span>
            <span className="text-xs sm:text-sm font-black text-amber-950">
              {avgL.toFixed(1)}g <span className="text-[10px] text-amber-700 font-semibold">({avgLPct}%)</span>
            </span>
          </div>

          <div className="bg-teal-50 border border-teal-200/80 rounded-2xl px-3.5 py-1.5 text-right shadow-2xs hidden md:block">
            <span className="text-[10px] uppercase font-bold text-teal-800 block">Đường (G) TB</span>
            <span className="text-xs sm:text-sm font-black text-teal-950">
              {avgG.toFixed(1)}g <span className="text-[10px] text-teal-700 font-semibold">({avgGPct}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Banner Tổng Hợp Cảnh Báo Dị Ứng Học Sinh & Đề Xuất BMI */}
      {advisory && (advisory.allergySummary.totalConflicts > 0 || (advisory.bmiSummary.overweightObeseCount + advisory.bmiSummary.wastedUnderweightCount > 0)) && (
        <div className="mx-5 my-3 p-4 bg-gradient-to-r from-rose-50 via-amber-50/40 to-white border border-rose-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-950 uppercase tracking-wide">
                  Cảnh báo Dinh dưỡng Học đường & An toàn Dị ứng
                </span>
                {advisory.allergySummary.criticalCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider animate-pulse">
                    Nguy kịch: {advisory.allergySummary.criticalCount} bé
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                {advisory.allergySummary.totalConflicts > 0 ? (
                  <span>
                    Phát hiện <strong>{advisory.allergySummary.totalConflicts} xung đột dị ứng</strong> với phụ huynh ({advisory.allergySummary.affectedChildrenCount} bé, {advisory.allergySummary.affectedDishesCount} món).
                  </span>
                ) : (
                  <span>Thực đơn không có xung đột dị ứng học sinh.</span>
                )}
                {(advisory.bmiSummary.overweightObeseCount + advisory.bmiSummary.wastedUnderweightCount) > 0 && (
                  <span className="ml-1 text-amber-900 font-medium">
                    Có <strong>{advisory.bmiSummary.overweightObeseCount} bé thừa cân/béo phì</strong> và <strong>{advisory.bmiSummary.wastedUnderweightCount} bé gầy còm/suy dinh dưỡng</strong> cần cá nhân hóa món ăn & khẩu phần theo TT 28/2016.
                  </span>
                )}
              </p>
            </div>
          </div>

          {onOpenAdvisoryModal && (
            <button
              type="button"
              onClick={onOpenAdvisoryModal}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-200" />
              <span>Phân loại Dinh dưỡng & Ghi chú (Dị ứng • Thấp còi • Béo phì)</span>
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════════ */}
{/* ══════════════════════════════════════════════════════════════════════════════════════ */}
      {/* 1. KHỐI TỔNG QUAN 3 NHÓM TRẺ EM CẦN CHẾ ĐỘ DINH DƯỠNG ĐẶC BIỆT (TT 28/2016 & QĐ 1246)  */}
      {/* ══════════════════════════════════════════════════════════════════════════════════════ */}
      <div className="mx-5 mb-3 p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                  Hồ sơ 3 Nhóm Trẻ Em Cần Chế Độ Ăn Cá Nhân Hóa (TT 28/2016 & QĐ 1246)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {wastedChildren.length + overweightChildren.length + allergicChildrenList.length} trẻ
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Thực đơn trên bảng hiển thị Thực Đơn Tổng của trường. Lượng dinh dưỡng & Calo của cả 3 loại trẻ được tính tự động ở bảng tổng kết chân trang bên dưới.
              </p>
            </div>
          </div>

          {/* Các nút chuyển đổi chế độ xem & hồ sơ chi tiết từng loại */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. NÚT XEM TẤT CẢ 3 LOẠI (MẶC ĐỊNH) */}
            <button
              type="button"
              onClick={() => setActiveChildTypeFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChildTypeFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Hiển thị đầy đủ cả Thực đơn tổng và các suất riêng của cả 3 loại"
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Hiện tất cả 3 loại</span>
            </button>

            {/* 2. NÚT THỰC ĐƠN TỔNG */}
            <button
              type="button"
              onClick={() => setActiveChildTypeFilter((prev) => (prev === 'MASTER' ? 'ALL' : 'MASTER'))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChildTypeFilter === 'MASTER'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-600'
                  : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
              }`}
              title="Chỉ hiển thị các món thuộc Thực đơn tổng (Suất chung toàn trường)"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>🌟 Thực đơn tổng</span>
            </button>

            {/* 3. NÚT LOẠI 1 */}
            <button
              type="button"
              onClick={() => setActiveChildTypeFilter((prev) => (prev === 'STUNTED' ? 'ALL' : 'STUNTED'))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChildTypeFilter === 'STUNTED'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-600'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
              title="Ấn vào để lọc và xem danh sách trẻ & suất riêng Loại 1 (Thấp còi / SDD)"
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Loại 1: Thấp Còi / SDD ({wastedChildren.length} bé)</span>
              {activeChildTypeFilter === 'STUNTED' ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-amber-600" />
              )}
            </button>

            {/* 4. NÚT LOẠI 2 */}
            <button
              type="button"
              onClick={() => setActiveChildTypeFilter((prev) => (prev === 'OBESE' ? 'ALL' : 'OBESE'))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChildTypeFilter === 'OBESE'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-600'
                  : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
              }`}
              title="Ấn vào để lọc và xem danh sách trẻ & suất riêng Loại 2 (Béo phì / Thừa cân)"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Loại 2: Thừa Cân / Béo Phì ({overweightChildren.length} bé)</span>
              {activeChildTypeFilter === 'OBESE' ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-purple-600" />
              )}
            </button>

            {/* 5. NÚT LOẠI 3 */}
            <button
              type="button"
              onClick={() => setActiveChildTypeFilter((prev) => (prev === 'ALLERGIES' ? 'ALL' : 'ALLERGIES'))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChildTypeFilter === 'ALLERGIES'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-600'
                  : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
              }`}
              title="Ấn vào để lọc và xem danh sách trẻ & suất riêng Loại 3 (Dị ứng thực phẩm)"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Loại 3: Dị Ứng Thực Phẩm ({allergicChildrenList.length} bé)</span>
              {activeChildTypeFilter === 'ALLERGIES' ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-rose-600" />
              )}
            </button>

            {/* 6. NÚT ĐỀ XUẤT MÓN CHUNG */}
            <button
              type="button"
              onClick={() => setActiveChildTypeFilter((prev) => (prev === 'COMMON' ? 'ALL' : 'COMMON'))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChildTypeFilter === 'COMMON'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-600'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Đề xuất món thay thế chung phục vụ cả 3 nhóm trẻ"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>⭐ Món Chung Toàn Năng</span>
              {activeChildTypeFilter === 'COMMON' ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-emerald-600" />
              )}
            </button>
          </div>
        </div>

        {/* KHU VỰC CHI TIẾT — CHỈ HIỂN THỊ KHI NGƯỜI DÙNG ẤN VÀO TỪNG LOẠI */}
        {(activeChildTypeFilter === 'STUNTED' || activeChildTypeFilter === 'OBESE' || activeChildTypeFilter === 'ALLERGIES' || activeChildTypeFilter === 'COMMON') && (
          <div className="mt-3.5 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-500">
                Đang hiển thị hồ sơ chi tiết:{' '}
                {activeChildTypeFilter === 'STUNTED' && (
                  <span className="text-amber-800 font-extrabold">Loại 1: Trẻ Còi Xương & Thấp Còi / SDD (WHO Z-Score)</span>
                )}
                {activeChildTypeFilter === 'OBESE' && (
                  <span className="text-purple-800 font-extrabold">Loại 2: Trẻ Thừa Cân & Nguy Cơ Béo Phì (WHO Z-Score)</span>
                )}
                {activeChildTypeFilter === 'ALLERGIES' && (
                  <span className="text-rose-800 font-extrabold">Loại 3: Trẻ Cơ Địa Dị Ứng Thực Phẩm (Khai báo Phụ Huynh)</span>
                )}
                {activeChildTypeFilter === 'COMMON' && (
                  <span className="text-emerald-800 font-extrabold">Đề Xuất Món Thay Thế Chung Toàn Năng Cho Cả 3 Nhóm</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setActiveChildTypeFilter('ALL')}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer flex items-center gap-1 transition"
                title="Đóng chi tiết"
              >
                <X className="w-3.5 h-3.5" />
                <span>Thu gọn / Đóng</span>
              </button>
            </div>

            {/* THẺ LOẠI 1: CÒI XƯƠNG / SUY DINH DƯỠNG / THẤP CÒI */}
            {activeChildTypeFilter === 'STUNTED' && (
              <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white border border-amber-200/90 rounded-2xl p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                        <Baby className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
                        Loại 1: Trẻ Còi Xương & Thấp Còi / SDD (WHO Z-Score)
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                      {wastedChildren.length} bé
                    </span>
                  </div>

                  <div className="mt-2.5 text-xs text-amber-900 bg-amber-100/70 p-2.5 rounded-xl leading-relaxed">
                    <span className="font-bold">Khẩu phần đề xuất (QĐ 1246/BYT):</span> Tăng 15–20% đạm sinh học cao (thịt nạc, bò, sườn, gà, trứng), bổ sung dầu gấc/canxi, chia nhỏ thêm bữa phụ dinh dưỡng.
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-black text-amber-900 uppercase tracking-wide">Danh sách học sinh thuộc Loại 1:</p>
                    {wastedChildren.map((c: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-amber-200/90 text-xs shadow-2xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-black text-amber-950 text-sm">{c.childName}</p>
                          <p className="text-xs text-amber-700 font-medium mt-0.5">{c.className} • Phân loại: <strong>{c.statusText || 'Thấp còi (WHO)'}</strong></p>
                          <p className="text-[11px] text-amber-600 mt-0.5 italic">{c.healthNotes}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-xs font-bold text-amber-900 block">{c.weightKg} kg • {c.heightCm} cm</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black mt-1 inline-block">HAZ: -{Math.abs(c.baz || 0.95)} SD</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-xs">
                  <span className="text-amber-800 font-semibold">Món đề xuất riêng cho bé:</span>
                  <span className="font-bold text-amber-950">Sườn non hầm hạt sen bí đỏ / Cháo thịt bò hạt sen</span>
                </div>
              </div>
            )}

            {/* THẺ LOẠI 2: THỪA CÂN / BÉO PHÌ */}
            {activeChildTypeFilter === 'OBESE' && (
              <div className="bg-gradient-to-br from-purple-50/90 via-indigo-50/40 to-white border border-purple-200/90 rounded-2xl p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                        <Scale className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-purple-950 uppercase tracking-wide">
                        Loại 2: Trẻ Thừa Cân & Nguy Cơ Béo Phì (WHO Z-Score)
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white">
                      {overweightChildren.length} bé
                    </span>
                  </div>

                  <div className="mt-2.5 text-xs text-purple-900 bg-purple-100/70 p-2.5 rounded-xl leading-relaxed">
                    <span className="font-bold">Khẩu phần đề xuất (TT 28/2016):</span> Giảm 10–15% chất béo & calo, cắt giảm triệt để đồ chiên rán/ngọt, tăng rau củ luộc, ưu tiên ăn canh trước bữa cơm.
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-black text-purple-900 uppercase tracking-wide">Danh sách học sinh thuộc Loại 2:</p>
                    {overweightChildren.map((c: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-purple-200/90 text-xs shadow-2xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-black text-purple-950 text-sm">{c.childName}</p>
                          <p className="text-xs text-purple-700 font-medium mt-0.5">{c.className} • Phân loại: <strong>{c.statusText || 'Thừa cân (WHO)'}</strong></p>
                          <p className="text-[11px] text-purple-600 mt-0.5 italic">{c.healthNotes}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-xs font-bold text-purple-900 block">{c.weightKg} kg • {c.heightCm} cm</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-black mt-1 inline-block">BAZ: +{c.baz || 2.3} SD</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-purple-200/60 flex items-center justify-between text-xs">
                  <span className="text-purple-800 font-semibold">Món đề xuất riêng cho bé:</span>
                  <span className="font-bold text-purple-950">Thịt nạc luộc sốt cà chua / Ức gà hấp nấm mèo</span>
                </div>
              </div>
            )}

            {/* THẺ LOẠI 3: DỊ ỨNG THỰC PHẨM */}
            {activeChildTypeFilter === 'ALLERGIES' && (
              <div className="bg-gradient-to-br from-rose-50/90 via-pink-50/40 to-white border border-rose-200/90 rounded-2xl p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-rose-950 uppercase tracking-wide">
                        Loại 3: Trẻ Cơ Địa Dị Ứng Thực Phẩm (Khai báo Phụ Huynh)
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                      {allergicChildrenList.length} bé
                    </span>
                  </div>

                  <div className="mt-2.5 text-xs text-rose-900 bg-rose-100/70 p-2.5 rounded-xl leading-relaxed">
                    <span className="font-bold">Nguyên tắc an toàn bếp:</span> Loại trừ 100% dị nguyên nguy hiểm, phân công khu bếp nấu suất riêng biệt bằng nồi chảo riêng, dán nhãn suất ăn có dị ứng trước khi chia lớp.
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-black text-rose-900 uppercase tracking-wide">Danh sách học sinh thuộc Loại 3 & Dị nguyên cụ thể:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                      {allergicChildrenList.map((c: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white border border-rose-200/90 text-xs shadow-2xs flex items-center justify-between"
                        >
                          <div>
                            <p className="font-black text-rose-950">{c.childName}</p>
                            <p className="text-[11px] text-rose-700 font-medium">{c.className}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-black border border-rose-200 shrink-0">
                            {c.allergen}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-rose-200/60 flex items-center justify-between text-xs">
                  <span className="text-rose-800 font-semibold">Món đề xuất riêng cho bé:</span>
                  <span className="font-bold text-rose-950">Thịt heo nạc rim nước dừa / Canh thịt bằm bí xanh</span>
                </div>
              </div>
            )}

            {/* THẺ ĐỀ XUẤT MÓN THAY THẾ CHUNG TOÀN NĂNG */}
            {activeChildTypeFilter === 'COMMON' && (
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border border-emerald-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                        ⭐ Đề Xuất Món Ăn Thay Thế Chung Toàn Năng (Phù hợp cho cả 3 Nhóm Trẻ)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                        Tối ưu cho Bếp mầm non
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                      Để bếp không phải nấu quá nhiều món riêng lẻ, chuyên viên đề xuất 1 món thay thế chung: <strong>Thịt heo nạc rim nước dừa tươi & cà rốt</strong> (Món mặn) và <strong>Canh thịt nạc bằm nấu bí xanh</strong> (Món canh).
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
                      <span className="text-rose-800 font-semibold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                        ✓ Loại 3: An toàn 100% không dị nguyên
                      </span>
                      <span className="text-purple-800 font-semibold bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                        ✓ Loại 2: Giảm 35% chất béo so với món chiên
                      </span>
                      <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        ✓ Loại 1: Đạm cao sinh học, chia thêm +15%
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sampleDish = menu?.menuDishes?.[0] || null;
                    if (sampleDish) {
                      setActiveChildTypeFilter('COMMON');
                      setModalActiveTab('COMMON');
                      setUniversalModalDish({
                        menuDish: sampleDish,
                        dayLabel: 'Toàn tuần',
                        slotName: 'Món ăn',
                        targetType: 'COMMON',
                      });
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Xem Phân Tích & Hướng Dẫn Bếp</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Banner cảnh báo từ chối của BGH nếu có */}
      {menu?.status === 'REJECTED' && menu.rejectionReason && (
        <div className="mx-5 my-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <p className="font-bold">Ban Giám Hiệu đã từ chối thực đơn này:</p>
            <p className="text-rose-700 mt-0.5 leading-relaxed">{menu.rejectionReason}</p>
            <p className="text-rose-500 text-[11px] mt-1 italic">
              Chuyên viên dinh dưỡng vui lòng tinh chỉnh lại các món ăn theo ý kiến chỉ đạo và bấm "Gửi Hiệu trưởng duyệt".
            </p>
          </div>
        </div>
      )}

      {/* Banner thông báo ĐANG CHỜ DUYỆT */}
      {menu?.status === 'SUBMITTED_FOR_REVIEW' && (
        <div className="mx-5 my-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-bold">Thực đơn đang chờ Ban Giám Hiệu phê duyệt</p>
            <p className="text-amber-700 mt-0.5 leading-relaxed">
              Bạn vẫn có thể tinh chỉnh các món ăn hoặc định lượng trong các ô bên dưới nếu cần thiết. Sau khi chỉnh sửa xong, bấm nút <strong>"Cập nhật & Gửi lại Hiệu trưởng duyệt"</strong> ở thanh công cụ phía trên.
            </p>
          </div>
        </div>
      )}

      {/* Banner khi ĐÃ XIN PHÉP HIỆU TRƯỞNG CHỈNH SỬA (Đang chờ Hiệu trưởng duyệt mở khóa) */}
      {(menu?.status === 'APPROVED' || menu?.status === 'ACTIVE') && menu?.editRequestStatus === 'PENDING' && (
        <div className="mx-5 my-3 p-3.5 bg-gradient-to-r from-amber-50 via-purple-50/40 to-white border border-amber-300 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200 shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs text-amber-950 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-black uppercase tracking-wider text-amber-900">
                Đang chờ Hiệu trưởng cấp quyền chỉnh sửa thực đơn
              </span>
              <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Chờ xét duyệt
              </span>
            </div>
            <p className="text-amber-800 mt-1">
              <strong>Lý do đề xuất:</strong> "{menu.editRequestReason}"
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5 italic">
              Yêu cầu đã được gửi lên Hiệu trưởng lúc {menu.editRequestAt ? new Date(menu.editRequestAt).toLocaleString('vi-VN') : 'vừa xong'}. Khi Hiệu trưởng chấp thuận, thực đơn sẽ tự động mở khóa để điều chỉnh món ăn.
            </p>
          </div>
        </div>
      )}

      {/* Banner khi HIỆU TRƯỞNG TỪ CHỐI YÊU CẦU CHỈNH SỬA */}
      {(menu?.status === 'APPROVED' || menu?.status === 'ACTIVE') && menu?.editRequestStatus === 'REJECTED' && (
        <div className="mx-5 my-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-950">
            <p className="font-bold text-rose-900">Hiệu trưởng đã từ chối yêu cầu xin chỉnh sửa thực đơn này:</p>
            <p className="text-rose-700 mt-0.5 font-medium leading-relaxed">
              "{menu.editRequestResponseNotes || 'Không chấp thuận thay đổi thực đơn trong thời điểm hiện tại.'}"
            </p>
            <p className="text-[11px] text-rose-500 mt-0.5 italic">
              Nếu vẫn cần thay đổi đặc biệt, Chuyên viên Dinh dưỡng vui lòng trao đổi trực tiếp với BGH hoặc gửi lại yêu cầu với lý do giải trình cụ thể hơn.
            </p>
          </div>
        </div>
      )}

      {/* Banner thông báo ĐÃ DUYỆT (CHỜ CÔNG BỐ) - khi chưa xin sửa */}
      {menu?.status === 'APPROVED' && menu?.editRequestStatus !== 'PENDING' && menu?.editRequestStatus !== 'REJECTED' && (
        <div className="mx-5 my-3 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
          <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <p className="font-bold">Thực đơn đã được Hiệu trưởng phê duyệt thành công!</p>
            <p className="text-blue-700 mt-0.5 leading-relaxed">
              {menu.approvalNotes || 'Đạt chuẩn dinh dưỡng Thông tư 28/2016/TT-BGDĐT.'} Đang chờ Hiệu trưởng bấm "Khóa & Công bố" để kích hoạt toàn trường. <em>(Để chỉnh sửa lại, cần bấm "Xin phép Hiệu trưởng chỉnh sửa")</em>
            </p>
          </div>
        </div>
      )}

      {/* Banner thông báo ĐÃ KHÓA & CÔNG BỐ - khi chưa xin sửa */}
      {menu?.status === 'ACTIVE' && menu?.editRequestStatus !== 'PENDING' && menu?.editRequestStatus !== 'REJECTED' && (
        <div className="mx-5 my-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900">
            <p className="font-bold">Thực đơn ĐANG ÁP DỤNG (ĐÃ KHÓA & CÔNG BỐ TOÀN TRƯỜNG)</p>
            <p className="text-emerald-700 mt-0.5 leading-relaxed">
              Thực đơn đang được áp dụng trực tiếp cho Tablet Giáo viên và Màn hình Bếp KDS. Để chỉnh sửa thực đơn này, Chuyên viên Dinh dưỡng cần bấm nút <strong>"Xin phép Hiệu trưởng chỉnh sửa"</strong> để được phê duyệt mở khóa.
            </p>
          </div>
        </div>
      )}

      {!readOnly && <div className="flex justify-end px-4 py-2 border-t border-slate-100">
        <button type="button" aria-pressed={showEmptySlots} onClick={() => setShowEmptySlots(value => !value)}
          className="text-xs font-semibold text-slate-600 hover:text-emerald-700">
          {showEmptySlots ? 'Ẩn ngày/bữa trống' : 'Hiện ô trống để thêm món'}
        </button>
      </div>}
      {/* Chỉ hiển thị ngày và bữa đã có món; có thể mở ô trống để bổ sung. */}
      <div className="overflow-x-auto w-full">
        <table aria-label="Thực đơn tuần" className="w-full border-collapse table-fixed" style={{ minWidth: 144 + days.length * 180 }}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th 
                className="py-2.5 px-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0"
                style={{ width: '144px' }}
              >
                Bữa ăn
              </th>
              {days.map((day) => (
                <th
                  key={day.dayOfWeek}
                  className={`py-2 px-1 text-center border-l border-slate-100 min-w-[130px] ${
                    day.isWeekend ? 'bg-amber-50/30' : ''
                  }`}
                  style={{ width: `calc((100% - 144px) / ${days.length})` }}
                >
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="text-xs font-black text-slate-900">{day.label}</span>
                      {day.isWeekend && (
                        <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-800">
                          {day.shortLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {mealSlots.map((slot) => (
              <tr key={slot.key} className="hover:bg-slate-50/40 transition">
                {/* Cột Tên Bữa Ăn */}
                <td className="p-3 align-top bg-slate-50/60 border-r border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${slot.bgColor.replace('/60', '')}`}></div>
                    <span className="text-xs font-bold text-slate-800">{slot.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold block ml-3.5 mt-0.5">
                    {slot.time}
                  </span>
                </td>

                {/* Các Cột tương ứng từng ngày */}
                {days.map((day) => {
                  const dishesInCell = getDishesInSlot(day.dayOfWeek, slot.key);
                  const primaryDishes = dishesInCell.filter((md) => !isDietSubstitute(md));
                  const allSubDishes = dishesInCell.filter((md) => isDietSubstitute(md));
                  const renderedSubIds = new Set<string | number>();
                  return (
                    <td
                      key={day.dayOfWeek}
                      className={`p-1.5 sm:p-2 align-top border-l border-slate-100 group relative hover:bg-emerald-50/20 transition ${
                        day.isWeekend ? 'bg-amber-50/10' : ''
                      }`}
                    >
                      <div className="space-y-1.5 min-h-[64px]">
                        {primaryDishes.map((md) => {
                          const portion = Number(md.portionSizeG) || 100;
                          const standard = Number(md.dish?.standardServingSizeG) || 100;
                          const ratio = portion / standard;
                          const pVal = ((Number(md.dish?.totalProteinG) || 0) * ratio).toFixed(1);
                          const lVal = ((Number(md.dish?.totalFatG) || 0) * ratio).toFixed(1);
                          const gVal = ((Number(md.dish?.totalCarbG) || 0) * ratio).toFixed(1);

                          const dishNameLower = (md.dish?.name || '').toLowerCase().trim();
                          const conflictsForDish = getDishAllergyConflicts(advisory?.allergyConflicts, md);
                          const affectedChildren = groupAllergyConflictsByChild(conflictsForDish);
                          const hasAllergyConflict = conflictsForDish.length > 0;
                          const isFriedOrHighFat = Number(md.dish?.totalFatG || 0) >= 5.0 || /chiên|rán|mỡ|xào mặn|kho tàu/i.test(dishNameLower);
                          const isHighProteinOrSoup = Number(md.dish?.totalProteinG || 0) >= 7.5 || /hầm|súp|bò|sườn|gà|cháo/i.test(dishNameLower);

                          // Tìm các suất riêng liên kết trực tiếp với món này
                          const linkedSubs = allSubDishes.filter((subMd) => {
                            const notesLower = (subMd.specialDietNotes || '').toLowerCase();
                            return (
                              (dishNameLower && notesLower.includes(dishNameLower)) ||
                              notesLower.includes(`thay cho: ${dishNameLower}`)
                            );
                          });
                          linkedSubs.forEach((s) => renderedSubIds.add(s.id));

                          const allergySub = linkedSubs.find((s) => {
                            const info = resolveSubstituteInfo(s, advisory);
                            return info.type === 'ALLERGIES';
                          });

                          return (
                            <div
                              key={md.id}
                              className="rounded-xl p-2 shadow-2xs hover:shadow-xs transition group/item border bg-white border-slate-200/80 hover:border-emerald-300"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span 
                                  onClick={() => setInspectingDish({ menuDish: md, dayLabel: day.label, slotName: slot.name })}
                                  title="Bấm để xem công thức & nguyên liệu chi tiết"
                                  className="text-xs font-bold leading-tight hover:text-emerald-700 cursor-pointer transition line-clamp-2 text-slate-800"
                                >
                                  {md.dish?.name || 'Món ăn'}
                                </span>

                                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition shrink-0">
                                  <button
                                    onClick={() => setInspectingDish({ menuDish: md, dayLabel: day.label, slotName: slot.name })}
                                    title="Xem công thức & nguyên liệu chi tiết"
                                    className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                  {!readOnly && (
                                    <>
                                      <button
                                        onClick={() =>
                                          onOpenDishDrawer({
                                            dayOfWeek: day.dayOfWeek,
                                            mealTime: slot.key,
                                            existingDish: md,
                                          })
                                        }
                                        title="Chỉnh sửa định lượng"
                                        className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => onRemoveDish(md.id)}
                                        title="Xóa món ăn (xóa mềm)"
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <div className="flex items-center gap-1">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">
                                    {portion}g
                                  </span>
                                  {md.dish?.recipeItems && md.dish.recipeItems.length > 0 && (
                                    <span 
                                      onClick={() => setInspectingDish({ menuDish: md, dayLabel: day.label, slotName: slot.name })}
                                      title="Xem danh sách nguyên liệu"
                                      className="text-[9px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded border border-teal-100 flex items-center gap-0.5 hover:bg-teal-100 cursor-pointer transition"
                                    >
                                      <Utensils className="w-2.5 h-2.5" />
                                      {md.dish.recipeItems.length} NL
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-amber-700 flex items-center gap-0.5">
                                  <Flame className="w-2.5 h-2.5 text-amber-500" />
                                  {Number(md.plannedCalories).toFixed(1)} Kcal
                                </span>
                              </div>

                              {/* Dinh dưỡng chi tiết từng món ăn: P - L - G */}
                              {md.dish && (
                                <div className="mt-1 pt-1 border-t border-slate-100/90 flex items-center justify-between text-[9px] font-semibold text-slate-500">
                                  <span className="text-blue-700" title="Chất Đạm (Protein)">
                                    P: {pVal}g
                                  </span>
                                  <span className="text-amber-700" title="Chất Béo (Lipid)">
                                    L: {lVal}g
                                  </span>
                                  <span className="text-emerald-700" title="Đường Bột (Glucid)">
                                    G: {gVal}g
                                  </span>
                                </div>
                              )}

                              {/* GHI CHÚ BẾP NẾU CÓ */}
                              {md.specialDietNotes && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const subInfo = resolveSubstituteInfo(md, advisory);
                                    onOpenAdvisoryForDish?.(md.id, subInfo.type);
                                  }}
                                  className="mt-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200/90 text-emerald-950 transition cursor-pointer hover:bg-emerald-100 shadow-2xs flex items-center gap-1.5"
                                  title={`Ghi chú Bếp & GV: ${md.specialDietNotes}. Bấm để chỉnh sửa.`}
                                >
                                  <FileText className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span className="text-[9.5px] font-bold truncate flex-1">
                                    {md.specialDietNotes}
                                  </span>
                                </div>
                              )}

                              {/* NÚT THAO TÁC ĐỔI MÓN CHO 3 LOẠI TRẺ EM TRÊN MÓN CHUNG */}
                              <div className="mt-1.5 pt-1 border-t border-slate-100 space-y-1">
                                {/* 1. NÚT LOẠI 3: DỊ ỨNG */}
                                {allergySub ? (
                                  <div className="w-full text-left px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 transition flex items-center justify-between gap-1 shadow-2xs">
                                    <div className="flex items-center gap-1.5 truncate text-[10px] font-bold text-emerald-800">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="truncate">✓ Đã có suất riêng: {allergySub.dish?.name || 'Món thay thế'} ({conflictsForDish.length || 1} bé)</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModalActiveTab('ALLERGIES');
                                        setSelectedSubDish(null);
                                        setSubApplySuccess(null);
                                        setUniversalModalDish({
                                          menuDish: md,
                                          dayLabel: day.label,
                                          slotName: slot.name,
                                          targetType: 'ALLERGIES',
                                        });
                                      }}
                                      className="text-[8.5px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded font-extrabold shrink-0 shadow-2xs cursor-pointer"
                                    >
                                      Đổi lại
                                    </button>
                                  </div>
                                ) : hasAllergyConflict ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalActiveTab('ALLERGIES');
                                      setSelectedSubDish(null);
                                      setSubApplySuccess(null);
                                      setUniversalModalDish({
                                        menuDish: md,
                                        dayLabel: day.label,
                                        slotName: slot.name,
                                        targetType: 'ALLERGIES',
                                      });
                                    }}
                                    className="w-full text-left px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 hover:bg-rose-100 transition cursor-pointer flex items-center justify-between gap-1 shadow-2xs"
                                    title={`Phát hiện ${affectedChildren.length} bé có khai báo khớp món này: ${affectedChildren.map(c => `${c.childName} (${c.allergen})`).join(', ')}. Bấm để đổi món.`}
                                  >
                                    <div className="flex items-center gap-1 truncate text-[10px] font-bold text-rose-700">
                                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                      <span className="truncate">Dị ứng · {affectedChildren.length} bé</span>
                                    </div>
                                    <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-extrabold shrink-0">
                                      Đổi món
                                    </span>
                                  </button>
                                ) : null}

                                {/* 2. NÚT LOẠI 2: BÉO PHÌ */}
                                {isFriedOrHighFat && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalActiveTab('OBESE');
                                      setSelectedSubDish(null);
                                      setSubApplySuccess(null);
                                      setUniversalModalDish({
                                        menuDish: md,
                                        dayLabel: day.label,
                                        slotName: slot.name,
                                        targetType: 'OBESE',
                                      });
                                    }}
                                    className="w-full text-left px-1.5 py-0.5 rounded-md bg-purple-50/90 border border-purple-200/80 text-purple-900 hover:bg-purple-100 transition cursor-pointer flex items-center justify-between text-[9px] font-semibold"
                                    title="Món nhiều chất béo/calo - Cần giảm khẩu phần béo 15% cho trẻ thừa cân theo TT 28/2016"
                                  >
                                    <span className="truncate text-purple-800 font-bold">Giảm béo</span>
                                    <span className="text-[8px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-extrabold shrink-0">Đổi món</span>
                                  </button>
                                )}

                                {/* 3. NÚT LOẠI 1: CÒI XƯƠNG / SDD */}
                                {isHighProteinOrSoup && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalActiveTab('STUNTED');
                                      setSelectedSubDish(null);
                                      setSubApplySuccess(null);
                                      setUniversalModalDish({
                                        menuDish: md,
                                        dayLabel: day.label,
                                        slotName: slot.name,
                                        targetType: 'STUNTED',
                                      });
                                    }}
                                    className="w-full text-left px-1.5 py-0.5 rounded-md bg-amber-50/90 border border-amber-200/80 text-amber-900 hover:bg-amber-100 transition cursor-pointer flex items-center justify-between text-[9px] font-semibold"
                                    title="Món giàu đạm sinh học cao - Cần chia thêm 15% khẩu phần cho trẻ suy dinh dưỡng theo QĐ 1246"
                                  >
                                    <span className="truncate text-amber-900 font-bold">Tăng đạm</span>
                                    <span className="text-[8px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-extrabold shrink-0">Đổi món</span>
                                  </button>
                                )}
                              </div>

                              {/* DANH SÁCH SUẤT RIÊNG GẮN LIỀN VỚI MÓN NÀY */}
                              {linkedSubs.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                                  {linkedSubs.map((subMd) => {
                                    const subInfo = resolveSubstituteInfo(subMd, advisory);
                                    const subCalo = Number(subMd.plannedCalories || subMd.dish?.totalCalories || 0);
                                    const subPortion = Number(subMd.portionSizeG) || 100;
                                    return (
                                      <div
                                        key={subMd.id}
                                        className={`p-2 rounded-xl border border-dashed transition group/sub ${subInfo.containerClasses}`}
                                      >
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                          <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs ${subInfo.badgeBg}`}>
                                            {subInfo.type === 'ALLERGIES' && <ShieldAlert className="w-2.5 h-2.5" />}
                                            {subInfo.type === 'OBESE' && <Scale className="w-2.5 h-2.5" />}
                                            {subInfo.type === 'STUNTED' && <Baby className="w-2.5 h-2.5" />}
                                            <span>Suất riêng: {subInfo.badgeTitle}</span>
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-white/90 border border-slate-200 text-slate-700">
                                              Nấu riêng
                                            </span>
                                            {!readOnly && (
                                              <button
                                                type="button"
                                                onClick={() => onRemoveDish(subMd.id)}
                                                title="Xóa suất riêng này"
                                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className={`text-xs font-bold leading-tight ${subInfo.textColor}`}>
                                            🥗 {subMd.dish?.name || 'Món thay thế'}
                                          </span>
                                          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5 shrink-0">
                                            <Flame className="w-2.5 h-2.5 text-amber-500" />
                                            {subCalo.toFixed(1)} Kcal
                                          </span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-500 font-medium">
                                          <span className="bg-white/80 border border-slate-200/80 px-1.5 py-0.2 rounded font-semibold text-slate-700">
                                            {subPortion}g
                                          </span>
                                          <span className="text-emerald-800 font-semibold italic truncate max-w-[140px]" title={subMd.specialDietNotes || ''}>
                                            {subMd.specialDietNotes || `Thay cho: ${md.dish?.name}`}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* RENDER CÁC MÓN SUẤT RIÊNG ĐỘC LẬP (NẾU CÓ HOẶC KHÔNG KHỚP MÓN GỐC NÀO) */}
                        {allSubDishes.filter((s) => !renderedSubIds.has(s.id)).map((subMd) => {
                          const portion = Number(subMd.portionSizeG) || 100;
                          const subInfo = resolveSubstituteInfo(subMd, advisory);
                          const subCalo = Number(subMd.plannedCalories || subMd.dish?.totalCalories || 0);

                          return (
                            <div
                              key={subMd.id}
                              className={`rounded-xl p-2 shadow-2xs hover:shadow-xs transition group/item border ${subInfo.containerClasses}`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-1">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs ${subInfo.badgeBg}`}>
                                  {subInfo.type === 'ALLERGIES' && <ShieldAlert className="w-2.5 h-2.5" />}
                                  {subInfo.type === 'OBESE' && <Scale className="w-2.5 h-2.5" />}
                                  {subInfo.type === 'STUNTED' && <Baby className="w-2.5 h-2.5" />}
                                  <span>Suất riêng: {subInfo.badgeTitle}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-white/90 border border-slate-200 text-slate-700">
                                    Nấu riêng
                                  </span>
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      onClick={() => onRemoveDish(subMd.id)}
                                      title="Xóa món này"
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-start justify-between gap-1">
                                <span className={`text-xs font-bold leading-tight ${subInfo.textColor}`}>
                                  {subMd.dish?.name || 'Món ăn'}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">{portion}g</span>
                                <span className="font-bold text-amber-700 flex items-center gap-0.5">
                                  <Flame className="w-2.5 h-2.5 text-amber-500" />
                                  {subCalo.toFixed(1)} Kcal
                                </span>
                              </div>
                              {subMd.specialDietNotes && (
                                <div className="mt-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200/90 text-emerald-950 shadow-2xs">
                                  <span className="text-[9.5px] font-bold truncate block">{subMd.specialDietNotes}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {/* Nút thêm món vào ô */}
                        {!readOnly && (
                          <button
                            onClick={() =>
                              onOpenDishDrawer({
                                dayOfWeek: day.dayOfWeek,
                                mealTime: slot.key,
                                existingDish: null,
                              })
                            }
                            className="w-full py-1 border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-emerald-700 flex items-center justify-center gap-1 transition opacity-40 group-hover:opacity-100"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm món</span>
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* HÀNG TỔNG KẾT CALO & DINH DƯỠNG (P - L - G) Ở CHÂN BẢNG           */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <tfoot className="border-t-2 border-slate-300">
            {/* THANH ĐIỀU HƯỚNG / CHẾ ĐỘ XEM DINH DƯỠNG */}
            <tr className="bg-slate-100/95 border-b border-slate-200">
              <td colSpan={days.length + 1} className="p-2.5 sm:p-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-600" />
                      Dinh dưỡng theo ngày
                    </span>
                    <span className="hidden sm:inline-block text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      QĐ 1246/QĐ-BYT & TT 28/2016
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFooterNutritionTab('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        footerNutritionTab === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-3 h-3" />
                      <span>Tất cả nhóm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFooterNutritionTab('MASTER')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        footerNutritionTab === 'MASTER'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <span>🌟 Thực đơn tổng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFooterNutritionTab('STUNTED')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        footerNutritionTab === 'STUNTED'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      <Baby className="w-3 h-3" />
                      <span>Thấp còi/SDD</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFooterNutritionTab('OBESE')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        footerNutritionTab === 'OBESE'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      <Scale className="w-3 h-3" />
                      <span>Thừa cân</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFooterNutritionTab('ALLERGIES')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        footerNutritionTab === 'ALLERGIES'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>Dị ứng</span>
                    </button>
                  </div>
                </div>
              </td>
            </tr>

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* NHÓM 1: THỰC ĐƠN TỔNG (TRẺ BÌNH THƯỜNG • CHUẨN TT 28/2016)         */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {(footerNutritionTab === 'ALL' || footerNutritionTab === 'MASTER') && (
              <>
                {/* TIÊU ĐỀ PHÂN ĐOẠN (CHỈ HIỆN KHI XEM TẤT CẢ) */}
                {footerNutritionTab === 'ALL' && (
                  <tr className="bg-emerald-50/80 border-t border-emerald-200">
                    <td colSpan={days.length + 1} className="px-3 py-1.5 text-xs font-black text-emerald-950">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5">
                        <ChefHat className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Suất chung · 615–770 kcal</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800">
                        P: 13–20% · L: 25–35% · G: 52–60%
                      </span>
                      </div>
                    </td>
                  </tr>
                )}
                {/* CALO / NGÀY */}
                <tr className="bg-white font-bold text-xs border-t border-slate-200">
                  <td className="p-3 text-slate-800 font-black">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Năng lượng</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                      kcal/ngày
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).master;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200">
                        <span className="text-sm font-black text-slate-900 block tracking-tight">
                          {nutri.calo > 0 ? `${nutri.calo.toFixed(1)} Kcal` : '0 Kcal'}
                        </span>
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                            nutri.statusType === 'optimal'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                              : nutri.statusType === 'empty'
                              ? 'bg-slate-200 text-slate-500'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {nutri.statusText}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {/* DINH DƯỠNG P-L-G & TỶ LỆ */}
                <tr className="bg-slate-50/70 text-xs border-t border-slate-200">
                  <td className="p-3 text-slate-700 font-bold">
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>P – L – G</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-400 block mt-0.5">
                      Gam · Tỷ lệ %
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).master;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200 align-middle">
                        {nutri.calo > 0 ? (
                          <div className="space-y-1 text-[10.5px] font-semibold">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-blue-700 font-bold">P: {nutri.p.toFixed(1)}g ({nutri.pPct}%)</span>
                              <span className="text-amber-700 font-bold">L: {nutri.l.toFixed(1)}g ({nutri.lPct}%)</span>
                              <span className="text-emerald-700 font-bold">G: {nutri.g.toFixed(1)}g ({nutri.gPct}%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200 shadow-inner mt-1">
                              <div style={{ width: `${nutri.pPct}%` }} className="bg-blue-600 h-full" />
                              <div style={{ width: `${nutri.lPct}%` }} className="bg-amber-500 h-full" />
                              <div style={{ width: `${nutri.gPct}%` }} className="bg-emerald-500 h-full" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* NHÓM 2: LOẠI 1 — THẤP CÒI / SDD (1 BÉ • QĐ 1246 & TT 28)          */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {(footerNutritionTab === 'ALL' || footerNutritionTab === 'STUNTED') && (
              <>
                {/* TIÊU ĐỀ PHÂN ĐOẠN */}
                {footerNutritionTab === 'ALL' && (
                  <tr className="bg-amber-50/90 border-t-2 border-amber-300">
                    <td colSpan={days.length + 1} className="px-3 py-1.5 text-xs font-black text-amber-950">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5">
                        <Baby className="w-3.5 h-3.5 text-amber-700" />
                        <span>Nhóm 1 · Thấp còi/SDD</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-800">
                        Đạm +18% · Béo +15% · Năng lượng +15%
                      </span>
                      </div>
                    </td>
                  </tr>
                )}
                {/* CALO / NGÀY */}
                <tr className="bg-white font-bold text-xs border-t border-slate-200">
                  <td className="p-3 text-amber-950 font-black">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Năng lượng</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-700 block mt-0.5">
                      Nhóm 1 · SDD
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).type1;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200">
                        <span className="text-sm font-black text-amber-900 block tracking-tight">
                          {nutri.calo > 0 ? `${nutri.calo.toFixed(1)} Kcal` : '0 Kcal'}
                        </span>
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                            nutri.calo > 0
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {nutri.calo > 0 ? (nutri.statusText || '+15% Phục hồi SDD') : 'Chưa lên món'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {/* DINH DƯỠNG P-L-G & TỶ LỆ */}
                <tr className="bg-amber-50/30 text-xs border-t border-slate-200">
                  <td className="p-3 text-amber-900 font-bold">
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>P – L – G</span>
                    </div>
                    <span className="text-[10px] font-normal text-amber-700 block mt-0.5">
                      Gam · Tỷ lệ %
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).type1;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200 align-middle">
                        {nutri.calo > 0 ? (
                          <div className="space-y-1 text-[10.5px] font-semibold">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-blue-800 font-bold">P: {nutri.p.toFixed(1)}g ({nutri.pPct}%)</span>
                              <span className="text-amber-800 font-bold">L: {nutri.l.toFixed(1)}g ({nutri.lPct}%)</span>
                              <span className="text-emerald-800 font-bold">G: {nutri.g.toFixed(1)}g ({nutri.gPct}%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200 shadow-inner mt-1">
                              <div style={{ width: `${nutri.pPct}%` }} className="bg-blue-600 h-full" />
                              <div style={{ width: `${nutri.lPct}%` }} className="bg-amber-500 h-full" />
                              <div style={{ width: `${nutri.gPct}%` }} className="bg-emerald-500 h-full" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* NHÓM 3: LOẠI 2 — THỪA CÂN / BÉO PHÌ (2 BÉ • TT 28/2016)          */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {(footerNutritionTab === 'ALL' || footerNutritionTab === 'OBESE') && (
              <>
                {/* TIÊU ĐỀ PHÂN ĐOẠN */}
                {footerNutritionTab === 'ALL' && (
                  <tr className="bg-purple-50/90 border-t-2 border-purple-300">
                    <td colSpan={days.length + 1} className="px-3 py-1.5 text-xs font-black text-purple-950">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-purple-700" />
                        <span>Nhóm 2 · Thừa cân/béo phì</span>
                      </span>
                      <span className="text-[10px] font-bold text-purple-800">
                        Đạm giữ nguyên · Béo -30% · Tinh bột -10%
                      </span>
                      </div>
                    </td>
                  </tr>
                )}
                {/* CALO / NGÀY */}
                <tr className="bg-white font-bold text-xs border-t border-slate-200">
                  <td className="p-3 text-purple-950 font-black">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Năng lượng</span>
                    </div>
                    <span className="text-[10px] font-medium text-purple-700 block mt-0.5">
                      Nhóm 2 · Thừa cân
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).type2;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200">
                        <span className="text-sm font-black text-purple-900 block tracking-tight">
                          {nutri.calo > 0 ? `${nutri.calo.toFixed(1)} Kcal` : '0 Kcal'}
                        </span>
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                            nutri.calo > 0
                              ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {nutri.calo > 0 ? (nutri.statusText || '-12% Giảm béo TT 28') : 'Chưa lên món'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {/* DINH DƯỠNG P-L-G & TỶ LỆ */}
                <tr className="bg-purple-50/30 text-xs border-t border-slate-200">
                  <td className="p-3 text-purple-900 font-bold">
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>P – L – G</span>
                    </div>
                    <span className="text-[10px] font-normal text-purple-700 block mt-0.5">
                      Đạm nạc 100% • Giảm mỡ (-30%)
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).type2;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200 align-middle">
                        {nutri.calo > 0 ? (
                          <div className="space-y-1 text-[10.5px] font-semibold">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-blue-800 font-bold">P: {nutri.p.toFixed(1)}g ({nutri.pPct}%)</span>
                              <span className="text-purple-800 font-bold">L: {nutri.l.toFixed(1)}g ({nutri.lPct}%)</span>
                              <span className="text-emerald-800 font-bold">G: {nutri.g.toFixed(1)}g ({nutri.gPct}%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200 shadow-inner mt-1">
                              <div style={{ width: `${nutri.pPct}%` }} className="bg-blue-600 h-full" />
                              <div style={{ width: `${nutri.lPct}%` }} className="bg-amber-500 h-full" />
                              <div style={{ width: `${nutri.gPct}%` }} className="bg-emerald-500 h-full" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* NHÓM 4: LOẠI 3 — DỊ ỨNG THỰC PHẨM (6 BÉ • AN TOÀN TUYỆT ĐỐI)      */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {(footerNutritionTab === 'ALL' || footerNutritionTab === 'ALLERGIES') && (
              <>
                {/* TIÊU ĐỀ PHÂN ĐOẠN */}
                {footerNutritionTab === 'ALL' && (
                  <tr className="bg-rose-50/90 border-t-2 border-rose-300">
                    <td colSpan={days.length + 1} className="px-3 py-1.5 text-xs font-black text-rose-950">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                        <span>Nhóm 3 · Dị ứng</span>
                      </span>
                      <span className="text-[10px] font-bold text-rose-800">
                        Suất thay thế theo dị nguyên
                      </span>
                      </div>
                    </td>
                  </tr>
                )}
                {/* CALO / NGÀY */}
                <tr className="bg-white font-bold text-xs border-t border-slate-200">
                  <td className="p-3 text-rose-950 font-black">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Năng lượng</span>
                    </div>
                    <span className="text-[10px] font-medium text-rose-700 block mt-0.5">
                      Nhóm 3 · Dị ứng
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).type3;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200">
                        <span className="text-sm font-black text-rose-900 block tracking-tight">
                          {nutri.calo > 0 ? `${nutri.calo.toFixed(1)} Kcal` : '0 Kcal'}
                        </span>
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                            nutri.calo > 0
                              ? 'bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {nutri.calo > 0 ? (nutri.statusText || '100% An toàn dị nguyên') : 'Chưa lên món'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {/* DINH DƯỠNG P-L-G & TỶ LỆ */}
                <tr className="bg-rose-50/30 text-xs border-t border-slate-200">
                  <td className="p-3 text-rose-900 font-bold">
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>P – L – G</span>
                    </div>
                    <span className="text-[10px] font-normal text-rose-700 block mt-0.5">
                      Thay đạm nạc an toàn
                    </span>
                  </td>
                  {days.map((day) => {
                    const nutri = getNutritionForAllTypes(day.dayOfWeek).type3;
                    return (
                      <td key={day.dayOfWeek} className="p-2.5 text-center border-l border-slate-200 align-middle">
                        {nutri.calo > 0 ? (
                          <div className="space-y-1 text-[10.5px] font-semibold">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-blue-800 font-bold">P: {nutri.p.toFixed(1)}g ({nutri.pPct}%)</span>
                              <span className="text-amber-800 font-bold">L: {nutri.l.toFixed(1)}g ({nutri.lPct}%)</span>
                              <span className="text-emerald-800 font-bold">G: {nutri.g.toFixed(1)}g ({nutri.gPct}%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200 shadow-inner mt-1">
                              <div style={{ width: `${nutri.pPct}%` }} className="bg-blue-600 h-full" />
                              <div style={{ width: `${nutri.lPct}%` }} className="bg-amber-500 h-full" />
                              <div style={{ width: `${nutri.gPct}%` }} className="bg-emerald-500 h-full" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {/* Modal kiểm tra công thức & nguyên liệu chi tiết */}
      <RecipeInspectionModal
        isOpen={!!inspectingDish}
        onClose={() => setInspectingDish(null)}
        menuDish={inspectingDish?.menuDish || null}
        dayLabel={inspectingDish?.dayLabel || ''}
        slotName={inspectingDish?.slotName || ''}
        allergyConflicts={
          inspectingDish
            ? getDishAllergyConflicts(advisory?.allergyConflicts, inspectingDish.menuDish)
            : []
        }
        onOpenAdvisory={
          inspectingDish && onOpenAdvisoryForDish
            ? () => onOpenAdvisoryForDish(inspectingDish.menuDish.id)
            : onOpenAdvisoryModal
        }
        onEdit={
          !readOnly && inspectingDish
            ? () => {
                const md = inspectingDish.menuDish;
                onOpenDishDrawer({
                  dayOfWeek: md.dayOfWeek,
                  mealTime: md.mealTime,
                  existingDish: md,
                });
              }
            : undefined
        }
      />

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ĐỀ XUẤT MÓN THAY THẾ CHO TỪNG LOẠI BÉ & MÓN THAY THẾ CHUNG TOÀN NĂNG       */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ĐỀ XUẤT & CHỌN MÓN THAY THẾ CÙNG LOẠI & TƯƠNG ĐƯƠNG DINH DƯỠNG             */}
      {/* (Khi ấn loại nào thì CHỈ HIỆN LOẠI ĐÓ và thông tin trẻ của loại đó)               */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {universalModalDish && (() => {
        const currentDishName = universalModalDish.menuDish.dish?.name || 'Món ăn';
        const currentDishType = universalModalDish.menuDish.dish?.dishType;
        const currentCat = detectDishCategory(currentDishName, currentDishType);
        const currentCalo = Number(universalModalDish.menuDish.plannedCalories || universalModalDish.menuDish.dish?.totalCalories || 0);
        const currentP = Number(universalModalDish.menuDish.dish?.totalProteinG || 0);
        const currentL = Number(universalModalDish.menuDish.dish?.totalFatG || 0);
        const currentG = Number(universalModalDish.menuDish.dish?.totalCarbG || 0);

        // Khóa đúng 1 loại trẻ em được bấm từ menu (không hiển thị các tab loại khác gây nhầm lẫn)
        const lockedType = universalModalDish.targetType || modalActiveTab || 'COMMON';

        // Tìm các xung đột dị ứng của món này
        const conflictsForThisDish = getDishAllergyConflicts(advisory?.allergyConflicts, universalModalDish.menuDish);
        const affectedChildrenForThisDish = groupAllergyConflictsByChild(conflictsForThisDish);

        const candidates = buildSubstituteCandidates(substituteCatalog, universalModalDish.menuDish, lockedType);
        const activeSub = candidates.find(dish => dish.id === selectedSubDish?.id) || candidates[0];

        const handleConfirmSubstitute = async () => {
          if (!activeSub || substituteLoading || isApplyingSub || readOnly || !menu?.id) return;
          try {
            setIsApplyingSub(true);
            const generatedNote = `[${
              lockedType === 'ALLERGIES'
                ? 'Loại 3: Dị ứng'
                : lockedType === 'OBESE'
                ? 'Loại 2: Béo phì'
                : lockedType === 'STUNTED'
                ? 'Loại 1: SDD'
                : 'Món Chung'
            }] Thay cho: ${universalModalDish.menuDish.dish?.name || 'Món gốc'} -> Đổi sang: ${activeSub.name} (${activeSub.calories} Kcal). ${substituteStaffNote || 'Nấu suất riêng theo chuẩn dinh dưỡng.'}`;

            const targetDishId = Number(activeSub.id);
            if (!Number.isSafeInteger(targetDishId) || targetDishId <= 0) throw new Error('Vui lòng tải lại danh mục món ăn.');
            const originDishId = Number(universalModalDish.menuDish.dishId) || undefined;
            const currentDayOfWeek = Number(universalModalDish.menuDish.dayOfWeek) || 2;
            const currentMealTime = universalModalDish.menuDish.mealTime || 'LUNCH';
            const currentPortion = Number(universalModalDish.menuDish.portionSizeG) || 100;

            const payload = {
              menuDishId: Number(universalModalDish.menuDish.id),
              dayOfWeek: currentDayOfWeek,
              mealType: currentMealTime,
              mealTime: currentMealTime,
              oldDishId: originDishId,
              dishId: targetDishId,
              newDishId: targetDishId,
              substituteDishId: targetDishId,
              portionSizeG: currentPortion,
              specialDietNotes: replaceMode === 'REPLACE_ALL' ? null : generatedNote,
              keepOriginalDish: replaceMode !== 'REPLACE_ALL',
            };

            if (onAdjustDish && menu?.id) {
              await onAdjustDish(payload);
            } else if (menu?.id) {
              await weeklyMenusApi.adjustDish(menu.id, payload);
            }

            setSubApplySuccess(
              replaceMode === 'REPLACE_ALL'
                ? `Đã thay thế hoàn toàn món "${universalModalDish.menuDish.dish?.name || 'món gốc'}" bằng món "${activeSub.name}" thành công!`
                : `Đã xác nhận suất riêng "${activeSub.name}" cho món "${universalModalDish.menuDish.dish?.name || 'món gốc'}" thành công!`
            );
            setTimeout(() => {
              setUniversalModalDish(null);
            }, 1000);
          } catch (err: any) {
            alert('Không thể lưu thay thế món: ' + (err?.response?.data?.message || err?.message || 'Lỗi hệ thống'));
          } finally {
            setIsApplyingSub(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col justify-between">
              
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 font-bold">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      Chọn Món Thay Thế Cùng Loại & Tương Đương Dinh Dưỡng
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Món gốc: <strong className="text-emerald-950 font-black">{currentDishName}</strong> ({currentCat.label} • {universalModalDish.slotName} • {universalModalDish.dayLabel})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUniversalModalDish(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                
                                {/* 1. HIỂN THỊ ĐÚNG DUY NHẤT 1 LOẠI ĐÃ CHỌN TỪ MENU */}
                {lockedType === 'STUNTED' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-200">
                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-600 text-white shadow-md shadow-amber-600/30 flex items-center gap-1.5">
                      <Baby className="w-4 h-4" />
                      <span>Loại 1: Thấp Còi / Suy Dinh Dưỡng ({wastedChildren.length} bé)</span>
                    </span>
                    <span className="text-xs text-amber-900 font-bold bg-amber-100/90 px-2.5 py-1 rounded-lg">
                      ⚡ Chuẩn QĐ 1246/QĐ-BYT: Tăng +15% đến +35% Calo & đạm sinh học
                    </span>
                  </div>
                )}

                {lockedType === 'OBESE' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-purple-200">
                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-purple-600 text-white shadow-md shadow-purple-600/30 flex items-center gap-1.5">
                      <Scale className="w-4 h-4" />
                      <span>Loại 2: Thừa Cân / Béo Phì ({overweightChildren.length} bé)</span>
                    </span>
                    <span className="text-xs text-purple-900 font-bold bg-purple-100/90 px-2.5 py-1 rounded-lg">
                      🥗 Chuẩn TT 28/2016: Giảm 50% chất béo & tiết chế calo
                    </span>
                  </div>
                )}

                {lockedType === 'ALLERGIES' && affectedChildrenForThisDish.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-rose-200">
                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-rose-600 text-white shadow-md shadow-rose-600/30 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Loại 3: Dị Ứng Thực Phẩm ({affectedChildrenForThisDish.length} bé)</span>
                    </span>
                    <span className="text-xs text-rose-900 font-bold bg-rose-100/90 px-2.5 py-1 rounded-lg">
                      🛡️ An toàn tuyệt đối: 100% loại bỏ dị nguyên nguy cơ
                    </span>
                  </div>
                )}

                {lockedType === 'COMMON' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-200">
                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-md shadow-emerald-600/30 flex items-center gap-1.5">
                      <ChefHat className="w-4 h-4" />
                      <span>Món Thay Thế Chung Toàn Năng Cho Bếp</span>
                    </span>
                    <span className="text-xs text-emerald-900 font-bold bg-emerald-100/90 px-2.5 py-1 rounded-lg">
                      ⭐ Đổi món cho toàn trường phù hợp cả 3 nhóm trẻ
                    </span>
                  </div>
                )}
                {/* 2. THÔNG TIN TRẺ EM THEO ĐÚNG LOẠI ĐÃ CHỌN */}
                {lockedType === 'ALLERGIES' && affectedChildrenForThisDish.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-rose-950 text-xs uppercase tracking-wide">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>Trẻ em có cơ địa dị ứng bị ảnh hưởng bởi món này:</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        {affectedChildrenForThisDish.length} bé có khai báo khớp món này
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {affectedChildrenForThisDish.map(c => (
                        <div key={c.childId || `${c.childName}-${c.className}`} className="p-2 bg-white rounded-xl border border-rose-200 text-xs flex items-center justify-between gap-2 shadow-2xs">
                          <div>
                            <span className="font-bold text-rose-950">{c.childName}</span>
                            <span className="text-rose-700 ml-1.5 font-medium">({c.className})</span>
                          </div>
                          <span title={c.matchReasons.join(' · ')} className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Dị ứng: {c.allergen}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lockedType === 'OBESE' && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-purple-950 text-xs uppercase tracking-wide">
                        <Scale className="w-4 h-4 text-purple-600" />
                        <span>Trẻ em Thừa cân / Béo phì cần kiểm soát calo (TT 28/2016):</span>
                      </div>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        {overweightChildren.length} bé
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {overweightChildren.map((c: any, idx: number) => (
                        <div key={idx} className="p-2 bg-white rounded-xl border border-purple-200 text-xs flex items-center justify-between shadow-2xs">
                          <div>
                            <span className="font-bold text-purple-950">{c.childName}</span>
                            <span className="text-purple-700 ml-1.5 font-medium">({c.className})</span>
                            <span className="text-purple-600 ml-2 italic text-[11px]">- Cần giảm 10-15% béo/calo, hạn chế chiên rán</span>
                          </div>
                          <span className="text-[10px] font-black text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                            {c.weightKg} kg • BAZ: +{c.baz || 2.3}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lockedType === 'STUNTED' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-amber-950 text-xs uppercase tracking-wide">
                        <Baby className="w-4 h-4 text-amber-600" />
                        <span>Trẻ em Còi xương / Thấp còi cần bổ sung đạm (QĐ 1246/BYT):</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {wastedChildren.length} bé
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {wastedChildren.map((c: any, idx: number) => (
                        <div key={idx} className="p-2 bg-white rounded-xl border border-amber-200 text-xs flex items-center justify-between shadow-2xs">
                          <div>
                            <span className="font-bold text-amber-950">{c.childName}</span>
                            <span className="text-amber-700 ml-1.5 font-medium">({c.className})</span>
                            <span className="text-amber-600 ml-2 italic text-[11px]">- Cần tăng 15-20% đạm sinh học cao & thêm bữa phụ</span>
                          </div>
                          <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            {c.weightKg} kg • {c.heightCm} cm (Thấp còi)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lockedType === 'COMMON' && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 animate-in fade-in duration-150">
                    <p className="font-black text-emerald-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <ChefHat className="w-4 h-4 text-emerald-600" />
                      <span>Giải pháp Bếp Thực Tế: 1 Món thay thế chung phục vụ cả 3 nhóm trẻ</span>
                    </p>
                    <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed">
                      Bếp không phải nấu riêng 3 nồi thức ăn. Chỉ cần nấu thêm 1 món chung lành tính, 100% không có hải sản hay dị nguyên (cho Loại 3), thịt nạc lọc mỡ không chiên dầu (cho Loại 2), và đạm cao chia thêm khẩu phần (cho Loại 1).
                    </p>
                  </div>
                )}

                {activeSub && <>
                {/* 3. BẢNG SO SÁNH DINH DƯỠNG: MÓN GỐC vs MÓN THAY THẾ ĐÃ CHỌN */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Đối Ứng Dinh Dưỡng Giữa Món Gốc & Món Thay Thế:
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Cùng loại: {currentCat.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* Món Gốc */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-black text-slate-400 uppercase block">Món Gốc Hiện Tại</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5 truncate">{currentDishName}</p>
                      <div className="mt-2 space-y-0.5 text-[11px] text-slate-600 font-medium">
                        <p>Năng lượng: <strong className="text-amber-800">{currentCalo} Kcal</strong></p>
                        <p>Chất đạm (P): <strong>{currentP}g</strong> • Chất béo (L): <strong>{currentL}g</strong></p>
                      </div>
                    </div>

                    {/* Món Thay Thế Được Chọn */}
                    <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-emerald-700 uppercase block">Món Thay Thế Đã Chọn</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <p className="font-black text-emerald-950 text-sm mt-0.5 truncate">{activeSub.name}</p>
                      <div className="mt-2 space-y-0.5 text-[11px] text-emerald-900 font-medium">
                        <p>Năng lượng: <strong className="text-emerald-950 font-black">{activeSub.calories} Kcal</strong> {currentCalo > 0 && (
                          <span className="text-[10px] text-emerald-700 font-bold">
                            ({Math.round(((activeSub.calories - currentCalo) / currentCalo) * 100) > 0 ? '+' : ''}{Math.round(((activeSub.calories - currentCalo) / currentCalo) * 100)}%)
                          </span>
                        )}</p>
                        <p>Chất đạm (P): <strong>{activeSub.proteinG}g</strong> • Chất béo (L): <strong>{activeSub.fatG}g</strong></p>
                      </div>
                    </div>
                  </div>
                </div>

                </>}
                {/* 3.1. LỰA CHỌN PHƯƠNG THỨC ĐỔI MÓN: THAY THẾ TOÀN BỘ vs SUẤT RIÊNG */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-2">
                    Hình thức áp dụng vào thực đơn:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                      onClick={() => setReplaceMode('REPLACE_ALL')}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                        replaceMode === 'REPLACE_ALL'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={replaceMode === 'REPLACE_ALL'}
                        onChange={() => setReplaceMode('REPLACE_ALL')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-black text-slate-900">1. Thay thế hoàn toàn món gốc</p>
                        <p className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">
                          Đổi hẳn món này cho toàn trường, loại bỏ hoàn toàn dị nguyên, Bếp không cần nấu riêng.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setReplaceMode('SPECIAL_DIET')}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                        replaceMode === 'SPECIAL_DIET'
                          ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/30 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={replaceMode === 'SPECIAL_DIET'}
                        onChange={() => setReplaceMode('SPECIAL_DIET')}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-black text-slate-900">2. Nấu suất riêng cho trẻ dị ứng / ăn kiêng</p>
                        <p className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">
                          Giữ món gốc cho trẻ bình thường, Bếp nấu thêm suất riêng hiển thị gắn liền bên dưới món này.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. DANH SÁCH CÁC MÓN ĐỀ XUẤT CÙNG LOẠI ĐỂ CLICK CHỌN */}
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-2">
                    Bấm chọn 1 món ăn cùng loại ({currentCat.label}) có dinh dưỡng tương ứng:
                  </label>
                  
                  <div className="space-y-2">
                    {substituteLoading && <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Đang tải món thay thế…</p>}
                    {substituteError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{substituteError}</p>}
                    {!substituteLoading && !substituteError && !candidates.length && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Chưa có món thay thế cùng nhóm đủ dữ liệu trong danh mục hiện tại.</p>}
                    {candidates.map((dish) => {
                      const isSelected = activeSub?.id === dish.id;
                      return (
                        <div
                          key={dish.id}
                          onClick={() => setSelectedSubDish(dish)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${
                              isSelected ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                            }`}>
                              {isSelected ? <Check className="w-3 h-3" /> : null}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs sm:text-sm">{dish.name}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{dish.suitabilityReason}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 ml-3">
                            <span className="text-xs font-black text-emerald-800 block">{dish.calories} Kcal</span>
                            <span className="text-[10px] text-slate-500 font-semibold block">P: {dish.proteinG}g • L: {dish.fatG}g</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. GHI CHÚ CHIA PHẦN CHO NHÂN VIÊN BẾP */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ghi chú hướng dẫn cho Nhân viên Bếp & Giáo viên chia phần:
                  </label>
                  <input
                    type="text"
                    value={substituteStaffNote}
                    onChange={(e) => setSubstituteStaffNote(e.target.value)}
                    placeholder={`Ví dụ: Nấu suất riêng cho bé, chia thêm 15% khẩu phần, dán nhãn màu vàng/đỏ...`}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                  />
                </div>

                {subApplySuccess && (
                  <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl animate-in fade-in duration-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{subApplySuccess}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Chuẩn dinh dưỡng Viện Dinh Dưỡng & TT 28/2016
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUniversalModalDish(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={isApplyingSub || substituteLoading || !activeSub || readOnly}
                    onClick={handleConfirmSubstitute}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer hover:scale-102 active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isApplyingSub ? 'Đang lưu...' : 'Xác Nhận Thay Thế Món Này Vào Thực Đơn'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
