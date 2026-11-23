import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  PieChart,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Utensils,
  Sparkles,
  Database,
  RefreshCw,
  Droplets,
} from 'lucide-react';
import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { WeeklyMenu } from '../api/weekly-menus.api';
import {
  nutritionEngineApi,
  MealDistributionOverview,
} from '../api/nutrition-rule-engine.api';
import { useSchoolBranding } from '../../../core/hooks/useSchoolBranding';

interface DailyMealBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  menu: WeeklyMenu | null;
  initialDay?: number; // 1 = T2, 2 = T3, 3 = T4, 4 = T5, 5 = T6, 6 = T7, 7 = CN
}

const MEAL_STYLE_MAP: Record<
  string,
  { barColor: string; textColor: string; bgColor: string; badgeColor: string }
> = {
  BREAKFAST: {
    barColor: 'bg-amber-400',
    textColor: 'text-amber-800',
    bgColor: 'bg-amber-50',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  MORNING_SNACK: {
    barColor: 'bg-amber-400',
    textColor: 'text-amber-800',
    bgColor: 'bg-amber-50',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  LUNCH: {
    barColor: 'bg-emerald-500',
    textColor: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  AFTERNOON_SNACK: {
    barColor: 'bg-purple-500',
    textColor: 'text-purple-800',
    bgColor: 'bg-purple-50',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
  },
  LATE_SNACK: {
    barColor: 'bg-orange-500',
    textColor: 'text-orange-800',
    bgColor: 'bg-orange-50',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300',
  },
};

const DAY_LABELS: Record<number, { label: string; short: string }> = {
  1: { label: 'Thứ Hai', short: 'T2' },
  2: { label: 'Thứ Ba', short: 'T3' },
  3: { label: 'Thứ Tư', short: 'T4' },
  4: { label: 'Thứ Năm', short: 'T5' },
  5: { label: 'Thứ Sáu', short: 'T6' },
  6: { label: 'Thứ Bảy', short: 'T7' },
  7: { label: 'Chủ Nhật', short: 'CN' },
};

export const DailyMealBreakdownModal: React.FC<DailyMealBreakdownModalProps> = ({
  isOpen,
  onClose,
  menu,
  initialDay = 1,
}) => {
  useLanguage();
  const schoolBranding = useSchoolBranding();
  const schoolMealTimes = schoolBranding.operationalSettings?.mealTimes || [
    'BREAKFAST',
    'LUNCH',
    'AFTERNOON_SNACK',
    'LATE_SNACK',
  ];
  const [selectedDay, setSelectedDay] = useState<number | 'AVG'>(initialDay);
  const [distributionOverview, setDistributionOverview] =
    useState<MealDistributionOverview | null>(null);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const isToddler =
    menu?.targetAgeGroup === 'NHA_TRE' || (menu as any)?.ageGroup === 'NHA_TRE';
  const ageGroup = isToddler ? 'NHA_TRE' : 'MAU_GIAO';

  // Lấy dữ liệu phân bổ năng lượng & định mức chuẩn thực tế từ DATABASE
  const fetchDbDistribution = async () => {
    setIsLoadingDb(true);
    setDbError(null);
    try {
      const data = await nutritionEngineApi.getMealDistributionOverview(ageGroup);
      setDistributionOverview(data);
    } catch (err: any) {
      console.warn('Lỗi khi tải bảng phân bổ dinh dưỡng từ Database:', err);
      setDbError(err?.response?.data?.message || 'Không thể tải cấu hình từ database');
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDbDistribution();
    }
  }, [isOpen, ageGroup]);

  // Chuẩn cả ngày lấy trực tiếp từ Database (bảng nutrition_intake_standards & meal_energy_distributions)
  const allDayStandard = useMemo(() => {
    if (distributionOverview?.dailyStandard) {
      const std = distributionOverview.dailyStandard;
      const avg = Math.round(((std.energy.min + std.energy.max) / 2) * 10) / 10;
      const waterMin = std.water?.min ?? (isToddler ? 800 : 1600);
      const waterMax = std.water?.max ?? (isToddler ? 1000 : 2000);
      const waterAvg = Math.round(((waterMin + waterMax) / 2) * 10) / 10;
      return {
        min: std.energy.min,
        max: std.energy.max,
        avg,
        waterMin,
        waterMax,
        waterAvg,
        atSchoolMinPct:
          distributionOverview.totals?.atSchool?.energyPct?.min ??
          std.atSchoolPct.min,
        atSchoolMaxPct:
          distributionOverview.totals?.atSchool?.energyPct?.max ??
          std.atSchoolPct.max,
        atSchoolWaterMinPct: std.atSchoolWaterPct?.min ?? (isToddler ? 60 : 50),
        atSchoolWaterMaxPct: std.atSchoolWaterPct?.max ?? (isToddler ? 70 : 55),
        standardName: std.standardName,
        source: std.source,
      };
    }
    // Giá trị chuẩn 01/VBHN-BGDĐT dự phòng khi chưa tải xong DB
    return isToddler
      ? {
          min: 930,
          max: 1000,
          avg: 965,
          waterMin: 800,
          waterMax: 1000,
          waterAvg: 900,
          atSchoolMinPct: 60,
          atSchoolMaxPct: 70,
          atSchoolWaterMinPct: 60,
          atSchoolWaterMaxPct: 70,
          standardName: '01/VBHN-BGDĐT (Nhà trẻ)',
          source: 'REFERENCE',
        }
      : {
          min: 1230,
          max: 1320,
          avg: 1275,
          waterMin: 1600,
          waterMax: 2000,
          waterAvg: 1800,
          atSchoolMinPct: 50,
          atSchoolMaxPct: 55,
          atSchoolWaterMinPct: 50,
          atSchoolWaterMaxPct: 55,
          standardName: '01/VBHN-BGDĐT (Mẫu giáo)',
          source: 'REFERENCE',
        };
  }, [distributionOverview, isToddler]);

  // Cấu hình các bữa ăn lấy trực tiếp từ Database (bảng meal_energy_distributions)
  // và lọc theo cấu hình các bữa ăn tổ chức tại trường (operationalSettings.mealTimes)
  const configuredMealSlots = useMemo(() => {
    let rawSlots = [];
    if (distributionOverview?.meals && distributionOverview.meals.length > 0) {
      rawSlots = distributionOverview.meals.map((m) => {
        const style = MEAL_STYLE_MAP[m.mealType] || {
          barColor: 'bg-sky-500',
          textColor: 'text-sky-800',
          bgColor: 'bg-sky-50',
          badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
        };
        const defaultWaterMl = isToddler
          ? (m.mealType === 'LUNCH' ? { min: 250, max: 350 } : m.mealType === 'BREAKFAST' ? { min: 100, max: 150 } : { min: 150, max: 250 })
          : (m.mealType === 'LUNCH' ? { min: 450, max: 600 } : m.mealType === 'BREAKFAST' ? { min: 150, max: 250 } : { min: 250, max: 350 });

        return {
          key: m.mealType,
          aliases:
            m.mealType === 'BREAKFAST'
              ? ['BREAKFAST', 'MORNING_SNACK']
              : [m.mealType],
          name: m.mealLabel,
          time: m.mealTime || '11:00',
          displayOrder: m.displayOrder,
          stdRange: { min: m.energyPct.min, max: m.energyPct.max },
          waterMl: m.waterMl || defaultWaterMl,
          waterPct: m.waterPct || { min: m.energyPct.min, max: m.energyPct.max },
          note: m.note,
          ...style,
        };
      });
    } else {
      // Dự phòng chuẩn mặc định khi đang tải hoặc ngoại tuyến
      rawSlots = isToddler
        ? [
            {
              key: 'BREAKFAST',
              aliases: ['BREAKFAST', 'MORNING_SNACK'],
              name: 'Buổi sáng',
              time: '09:00',
              displayOrder: 1,
              stdRange: { min: 5, max: 10 },
              waterMl: { min: 100, max: 150 },
              waterPct: { min: 10, max: 15 },
              ...MEAL_STYLE_MAP.BREAKFAST,
            },
            {
              key: 'LUNCH',
              aliases: ['LUNCH'],
              name: 'Bữa trưa chính',
              time: '11:00',
              displayOrder: 2,
              stdRange: { min: 30, max: 35 },
              waterMl: { min: 250, max: 350 },
              waterPct: { min: 30, max: 35 },
              ...MEAL_STYLE_MAP.LUNCH,
            },
            {
              key: 'AFTERNOON_SNACK',
              aliases: ['AFTERNOON_SNACK'],
              name: 'Buổi phụ',
              time: '14:30',
              displayOrder: 3,
              stdRange: { min: 20, max: 25 },
              waterMl: { min: 100, max: 150 },
              waterPct: { min: 15, max: 20 },
              ...MEAL_STYLE_MAP.AFTERNOON_SNACK,
            },
            {
              key: 'LATE_SNACK',
              aliases: ['LATE_SNACK'],
              name: 'Buổi chiều xế',
              time: '17:00',
              displayOrder: 4,
              stdRange: { min: 5, max: 10 },
              waterMl: { min: 50, max: 100 },
              waterPct: { min: 5, max: 10 },
              ...MEAL_STYLE_MAP.LATE_SNACK,
            },
          ]
        : [
            {
              key: 'BREAKFAST',
              aliases: ['BREAKFAST', 'MORNING_SNACK'],
              name: 'Buổi sáng',
              time: '09:00',
              displayOrder: 1,
              stdRange: { min: 5, max: 10 },
              waterMl: { min: 150, max: 250 },
              waterPct: { min: 10, max: 15 },
              ...MEAL_STYLE_MAP.BREAKFAST,
            },
            {
              key: 'LUNCH',
              aliases: ['LUNCH'],
              name: 'Bữa trưa chính',
              time: '11:00',
              displayOrder: 2,
              stdRange: { min: 30, max: 35 },
              waterMl: { min: 450, max: 600 },
              waterPct: { min: 30, max: 35 },
              ...MEAL_STYLE_MAP.LUNCH,
            },
            {
              key: 'AFTERNOON_SNACK',
              aliases: ['AFTERNOON_SNACK'],
              name: 'Buổi phụ',
              time: '14:30',
              displayOrder: 3,
              stdRange: { min: 10, max: 15 },
              waterMl: { min: 150, max: 200 },
              waterPct: { min: 10, max: 15 },
              ...MEAL_STYLE_MAP.AFTERNOON_SNACK,
            },
            {
              key: 'LATE_SNACK',
              aliases: ['LATE_SNACK'],
              name: 'Buổi chiều xế',
              time: '17:00',
              displayOrder: 4,
              stdRange: { min: 5, max: 10 },
              waterMl: { min: 100, max: 150 },
              waterPct: { min: 5, max: 10 },
              ...MEAL_STYLE_MAP.LATE_SNACK,
            },
          ];
    }

    return rawSlots.filter(
      (slot) =>
        Number(slot.stdRange.max) > 0 &&
        (schoolMealTimes.includes(slot.key) ||
          menu?.menuDishes?.some(
            (d) => !d.deletedAt && slot.aliases.includes(d.mealTime),
          )),
    );
  }, [distributionOverview, isToddler, schoolMealTimes, menu]);

  // Trích xuất các ngày có món thực tế trong thực đơn
  const menuDays = useMemo(() => {
    if (!menu?.menuDishes?.length) {
      return [1, 2, 3, 4, 5].map((d) => ({ day: d, ...DAY_LABELS[d] }));
    }
    const daySet = new Set<number>();
    menu.menuDishes.forEach((d) => {
      if (!d.deletedAt && d.dayOfWeek) {
        daySet.add(d.dayOfWeek);
      }
    });
    if (daySet.size === 0) {
      return [1, 2, 3, 4, 5].map((d) => ({ day: d, ...DAY_LABELS[d] }));
    }
    return Array.from(daySet)
      .sort((a, b) => a - b)
      .map((d) => ({
        day: d,
        ...(DAY_LABELS[d] || { label: `Ngày ${d}`, short: `N${d}` }),
      }));
  }, [menu]);

  const hasDayOne = menu?.menuDishes?.some((md) => md.dayOfWeek === 1);

  // Tính toán dữ liệu dinh dưỡng từng bữa ăn cho 1 ngày cụ thể từ các món ăn thực tế
  const computeDayData = (dayNum: number) => {
    if (!menu?.menuDishes)
      return { meals: [], totalDay: { calo: 0, p: 0, l: 0, g: 0 } };

    const dayDishes = menu.menuDishes.filter(
      (md) =>
        (md.dayOfWeek === dayNum || (!hasDayOne && md.dayOfWeek === dayNum + 1)) &&
        !md.deletedAt &&
        !(
          md.specialDietNotes &&
          md.specialDietNotes.toUpperCase().includes('THAY CHO')
        ),
    );

    let dayCalo = 0;
    let dayP = 0;
    let dayL = 0;
    let dayG = 0;

    const meals = configuredMealSlots
      .map((slot) => {
        const dishesInSlot = dayDishes.filter((d) =>
          slot.aliases.includes(d.mealTime),
        );

        let slotCalo = 0;
        let slotP = 0;
        let slotL = 0;
        let slotG = 0;

        for (const md of dishesInSlot) {
          const dish = md.dish;
          const portion = Number(md.portionSizeG) || 100;
          const standardSize =
            dish && Number(dish.standardServingSizeG) > 0
              ? Number(dish.standardServingSizeG)
              : 100;
          const ratio = portion / standardSize;

          if (dish) {
            slotP += (Number(dish.totalProteinG) || 0) * ratio;
            slotL += (Number(dish.totalFatG) || 0) * ratio;
            slotG += (Number(dish.totalCarbG) || 0) * ratio;
          }
          slotCalo +=
            md.plannedCalories != null &&
            Number.isFinite(Number(md.plannedCalories))
              ? Number(md.plannedCalories)
              : (Number(dish?.totalCalories) || 0) * ratio;
        }

        slotCalo = Math.round(slotCalo * 10) / 10;
        slotP = Math.round(slotP * 10) / 10;
        slotL = Math.round(slotL * 10) / 10;
        slotG = Math.round(slotG * 10) / 10;

        dayCalo += slotCalo;
        dayP += slotP;
        dayL += slotL;
        dayG += slotG;

        return {
          ...slot,
          dishes: dishesInSlot,
          calories: slotCalo,
          proteinG: slotP,
          fatG: slotL,
          carbG: slotG,
        };
      })
      .filter((m) => m.dishes.length > 0);

    dayCalo = Math.round(dayCalo * 10) / 10;
    dayP = Math.round(dayP * 10) / 10;
    dayL = Math.round(dayL * 10) / 10;
    dayG = Math.round(dayG * 10) / 10;

    return {
      meals,
      totalDay: { calo: dayCalo, p: dayP, l: dayL, g: dayG },
    };
  };

  // Tính trung bình các ngày trong tuần
  const computeWeekAverage = () => {
    const validDays = menuDays
      .map((d) => computeDayData(d.day))
      .filter((d) => d.totalDay.calo > 0);
    const count = validDays.length || 1;

    let avgCalo = 0;
    let avgP = 0;
    let avgL = 0;
    let avgG = 0;

    const mealsMap: Record<
      string,
      {
        calo: number;
        p: number;
        l: number;
        g: number;
        count: number;
        dishesNames: Set<string>;
      }
    > = {};

    for (const d of validDays) {
      avgCalo += d.totalDay.calo;
      avgP += d.totalDay.p;
      avgL += d.totalDay.l;
      avgG += d.totalDay.g;

      for (const m of d.meals) {
        if (!mealsMap[m.key]) {
          mealsMap[m.key] = {
            calo: 0,
            p: 0,
            l: 0,
            g: 0,
            count: 0,
            dishesNames: new Set(),
          };
        }
        mealsMap[m.key].calo += m.calories;
        mealsMap[m.key].p += m.proteinG;
        mealsMap[m.key].l += m.fatG;
        mealsMap[m.key].g += m.carbG;
        mealsMap[m.key].count += 1;
        m.dishes.forEach((item) => {
          if (item.dish?.name) mealsMap[m.key].dishesNames.add(item.dish.name);
        });
      }
    }

    avgCalo = Math.round((avgCalo / count) * 10) / 10;
    avgP = Math.round((avgP / count) * 10) / 10;
    avgL = Math.round((avgL / count) * 10) / 10;
    avgG = Math.round((avgG / count) * 10) / 10;

    const meals = configuredMealSlots
      .map((slot) => {
        const agg = mealsMap[slot.key];
        const mCount = agg?.count || 1;
        const slotCalo = agg ? Math.round((agg.calo / mCount) * 10) / 10 : 0;
        const slotP = agg ? Math.round((agg.p / mCount) * 10) / 10 : 0;
        const slotL = agg ? Math.round((agg.l / mCount) * 10) / 10 : 0;
        const slotG = agg ? Math.round((agg.g / mCount) * 10) / 10 : 0;

        return {
          ...slot,
          dishes: Array.from(agg?.dishesNames || []).map(
            (name) => ({ dish: { name } }) as any,
          ),
          calories: slotCalo,
          proteinG: slotP,
          fatG: slotL,
          carbG: slotG,
        };
      })
      .filter((m) => m.calories > 0);

    return {
      meals,
      totalDay: { calo: avgCalo, p: avgP, l: avgL, g: avgG },
    };
  };

  const currentData = useMemo(() => {
    if (selectedDay === 'AVG') return computeWeekAverage();
    return computeDayData(selectedDay);
  }, [selectedDay, menu, configuredMealSlots]);

  const totalAtSchoolCalo = currentData.totalDay.calo;
  // % Calo các bữa tại trường so với nhu cầu CẢ NGÀY của trẻ
  const atSchoolPctOfAllDay =
    allDayStandard.avg > 0
      ? Math.round((totalAtSchoolCalo / allDayStandard.avg) * 1000) / 10
      : 0;

  // Nhu cầu còn lại ở nhà
  const remainingAtHomeCalo = Math.max(
    0,
    Math.round(allDayStandard.avg - totalAtSchoolCalo),
  );
  const remainingAtHomePct = Math.max(
    0,
    Math.round((100 - atSchoolPctOfAllDay) * 10) / 10,
  );

  // Nhu cầu nước tại trường và ở nhà
  const totalAtSchoolWater = useMemo<{ min: number; max: number }>(() => {
    if (distributionOverview?.totals?.atSchool?.waterMl) {
      return {
        min: Number(distributionOverview.totals.atSchool.waterMl.min) || 0,
        max: Number(distributionOverview.totals.atSchool.waterMl.max) || 0,
      };
    }
    let min = 0;
    let max = 0;
    for (const s of configuredMealSlots) {
      if (s.waterMl) {
        min += Number(s.waterMl.min) || 0;
        max += Number(s.waterMl.max) || 0;
      }
    }
    return { min, max };
  }, [distributionOverview, configuredMealSlots]);

  const remainingAtHomeWater = useMemo<{ min: number; max: number }>(() => {
    if (distributionOverview?.totals?.atHome?.waterMl) {
      return {
        min: Number(distributionOverview.totals.atHome.waterMl.min) || 0,
        max: Number(distributionOverview.totals.atHome.waterMl.max) || 0,
      };
    }
    return {
      min: Math.max(0, allDayStandard.waterMin - totalAtSchoolWater.max),
      max: Math.max(0, allDayStandard.waterMax - totalAtSchoolWater.min),
    };
  }, [distributionOverview, allDayStandard, totalAtSchoolWater]);

  // Keep all hooks above this guard so opening/closing the modal never changes
  // the number or order of hooks invoked by this component.
  if (!isOpen || typeof document === 'undefined') return null;

  // Phân tách số liệu theo 2 Quy định: QĐ 1 (không ăn xế) vs QĐ 2 (có ăn xế)
  const lateSnackMeal = currentData.meals.find(
    (m) => m.key === 'LATE_SNACK' || m.key === 'AFTERNOON_MAIN',
  );
  const hasLateSnack = Boolean(lateSnackMeal && lateSnackMeal.calories > 0);

  const qd1Meals = currentData.meals.filter(
    (m) => m.key !== 'LATE_SNACK' && m.key !== 'AFTERNOON_MAIN',
  );
  const qd1Calo =
    Math.round(qd1Meals.reduce((s, m) => s + m.calories, 0) * 10) / 10;
  const qd1P =
    Math.round(qd1Meals.reduce((s, m) => s + m.proteinG, 0) * 10) / 10;
  const qd1L =
    Math.round(qd1Meals.reduce((s, m) => s + m.fatG, 0) * 10) / 10;
  const qd1G =
    Math.round(qd1Meals.reduce((s, m) => s + m.carbG, 0) * 10) / 10;
  const qd1MacroCalo = qd1P * 4 + qd1L * 9 + qd1G * 4 || qd1Calo || 1;
  const qd1PPct = Math.round(((qd1P * 4) / qd1MacroCalo) * 100);
  const qd1LPct = Math.round(((qd1L * 9) / qd1MacroCalo) * 100);
  const qd1GPct = Math.max(0, 100 - qd1PPct - qd1LPct);
  const qd1PctOfAllDay =
    allDayStandard.avg > 0
      ? Math.round((qd1Calo / allDayStandard.avg) * 1000) / 10
      : 0;

  let qd1WaterMin = 0;
  let qd1WaterMax = 0;
  for (const m of qd1Meals) {
    if (m.waterMl) {
      qd1WaterMin += Number(m.waterMl.min) || 0;
      qd1WaterMax += Number(m.waterMl.max) || 0;
    }
  }
  if (qd1WaterMin === 0 && totalAtSchoolWater.min > 0) {
    qd1WaterMin = Math.round(totalAtSchoolWater.min * 0.75);
    qd1WaterMax = Math.round(totalAtSchoolWater.max * 0.75);
  }

  // QĐ 2 (có ăn xế)
  const qd2Calo = currentData.totalDay.calo;
  const qd2P = currentData.totalDay.p;
  const qd2L = currentData.totalDay.l;
  const qd2G = currentData.totalDay.g;
  const qd2MacroCalo = qd2P * 4 + qd2L * 9 + qd2G * 4 || qd2Calo || 1;
  const qd2PPct = Math.round(((qd2P * 4) / qd2MacroCalo) * 100);
  const qd2LPct = Math.round(((qd2L * 9) / qd2MacroCalo) * 100);
  const qd2GPct = Math.max(0, 100 - qd2PPct - qd2LPct);
  const qd2PctOfAllDay = atSchoolPctOfAllDay;

  // Tính tỷ lệ P:L:G thực tế đạt được của toàn ngày tại trường
  const macroCalo = qd2MacroCalo;
  const pPct = qd2PPct;
  const lPct = qd2LPct;
  const gPct = qd2GPct;

  return createPortal(
    <div className="fixed !m-0 inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed !m-0 inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-4 sm:p-7 overflow-hidden z-10 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-xs">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {translateText(
                    'Bảng Thành Phần Ăn & Tỷ Lệ Năng Lượng Trong Ngày',
                  )}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                  {translateText(
                    isToddler ? 'Nhà trẻ 12–36 tháng' : 'Mẫu giáo 3–6 tuổi',
                  )}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span>{translateText(allDayStandard.standardName)}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {translateText(
                  'Phân tích chi tiết từng bữa ăn (sáng, trưa, chiều) chiếm bao nhiêu % Calo và dinh dưỡng trong ngày từ Database chuẩn.',
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDbDistribution}
              title={translateText('Tải lại dữ liệu chuẩn từ Database')}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingDb ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">
                {translateText('In biểu mẫu')}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab chọn Ngày trong tuần */}
        <div className="py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {translateText('Chọn ngày:')}
            </span>
            {menuDays.map((d) => (
              <button
                key={d.day}
                type="button"
                onClick={() => setSelectedDay(d.day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedDay === d.day
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {translateText(d.label)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedDay('AVG')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                selectedDay === 'AVG'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{translateText('Trung bình cả tuần')}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 font-medium">
            <div>
              {translateText('Năng lượng cả ngày:')}{' '}
              <strong className="text-slate-800">
                {allDayStandard.min} – {allDayStandard.max} Kcal
              </strong>
            </div>
            <div className="flex items-center gap-1 font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-full">
              <Droplets className="w-3.5 h-3.5 text-cyan-600" />
              <span>{translateText('Nước cả ngày:')} {allDayStandard.waterMin} – {allDayStandard.waterMax} ml</span>
            </div>
          </div>
        </div>

        {/* Nội dung có thể cuộn */}
        <div className="overflow-y-auto flex-1 py-4 space-y-4 pr-1">
          {/* Thanh phân bổ thị giác (Visual Stacked Bar) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-sky-600" />
                {translateText(
                  'Cơ cấu phân bổ % Calo các bữa so với nhu cầu cả ngày (100%):',
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                {hasLateSnack ? (
                  <>
                    <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-900 border border-teal-200 px-2 py-0.5 rounded-lg text-[10.5px]">
                      <strong className="font-black">QĐ 1:</strong> {qd1Calo} Kcal ({qd1PctOfAllDay}%) • P:L:G {qd1PPct}:{qd1LPct}:{qd1GPct}%
                    </span>
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg text-[10.5px]">
                      <strong className="font-black">QĐ 2 (+xế):</strong> {qd2Calo} Kcal ({qd2PctOfAllDay}%) • P:L:G {qd2PPct}:{qd2LPct}:{qd2GPct}%
                    </span>
                  </>
                ) : (
                  <span>
                    {translateText('Tại trường:')}{' '}
                    <strong className="text-sky-700">
                      {atSchoolPctOfAllDay}%
                    </strong>{' '}
                    ({translateText('Chuẩn')} {allDayStandard.atSchoolMinPct}–{allDayStandard.atSchoolMaxPct}%)
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-lg text-[10.5px]">
                  <Droplets className="w-3 h-3 text-cyan-600" />
                  {translateText('Nước:')} {totalAtSchoolWater.min}–{totalAtSchoolWater.max} ml
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex h-8 w-full rounded-xl overflow-hidden border border-slate-200 bg-white shadow-inner">
              {currentData.meals.map((m) => {
                const pct =
                  allDayStandard.avg > 0
                    ? (m.calories / allDayStandard.avg) * 100
                    : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={m.key}
                    className={`${m.barColor} text-white text-[11px] font-black flex items-center justify-center truncate transition-all duration-300 px-1`}
                    style={{ width: `${Math.max(pct, 5)}%` }}
                    title={`${m.name}: ${m.calories} Kcal (${Math.round(pct * 10) / 10}% cả ngày)`}
                  >
                    {pct >= 6
                      ? `${m.name} ${Math.round(pct * 10) / 10}%`
                      : `${Math.round(pct)}%`}
                  </div>
                );
              })}
              <div
                className="bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center truncate px-1 transition-all duration-300"
                style={{ width: `${Math.max(remainingAtHomePct, 8)}%` }}
                title={`${translateText('Ăn ở nhà')}: ${remainingAtHomeCalo} Kcal (${remainingAtHomePct}% cả ngày)`}
              >
                {remainingAtHomePct >= 10
                  ? `${translateText('Ở nhà')} ${remainingAtHomePct}%`
                  : `${Math.round(remainingAtHomePct)}%`}
              </div>
            </div>

            {/* Chú giải màu sắc với tỷ lệ lấy trực tiếp từ Database */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold text-slate-600">
              {currentData.meals.map((m) => {
                const pct =
                  allDayStandard.avg > 0
                    ? Math.round((m.calories / allDayStandard.avg) * 1000) / 10
                    : 0;
                return (
                  <div key={m.key} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full ${m.barColor}`} />
                    <span>
                      {translateText(m.name)}:{' '}
                      <strong className="text-slate-800">{pct}%</strong>{' '}
                      <span className="text-slate-400 font-normal">
                        ({translateText('Chuẩn')} {m.stdRange.min}–{m.stdRange.max}%)
                      </span>
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span>
                  {translateText('Ở nhà')}:{' '}
                  <strong className="text-slate-800">
                    {remainingAtHomePct}%
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* BẢNG CHÍNH: CHI TIẾT THÀNH PHẦN ĂN & DINH DƯỠNG THEO BỮA */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">{translateText('Bữa ăn')}</th>
                  <th className="py-3 px-2 text-center">{translateText('Giờ')}</th>
                  <th className="py-3 px-3">
                    {translateText('Món ăn trong bữa')}
                  </th>
                  <th className="py-3 px-3 text-right">
                    {translateText('Năng lượng (Kcal)')}
                  </th>
                  <th className="py-3 px-3 text-center">
                    {translateText('% Calo trong ngày')}
                  </th>
                  <th className="py-3 px-3 text-center">
                    {translateText('Chuẩn DB')}
                  </th>
                  <th className="py-3 px-3 text-right text-cyan-900 font-black">
                    {translateText('Nước cần thiết (ml)')}
                  </th>
                  <th className="py-3 px-3 text-center">
                    {translateText('Đánh giá')}
                  </th>
                  <th className="py-3 px-3 text-right text-blue-900">
                    {translateText('Đạm - P (g)')}
                  </th>
                  <th className="py-3 px-3 text-right text-amber-900">
                    {translateText('Béo - L (g)')}
                  </th>
                  <th className="py-3 px-3 text-right text-emerald-900">
                    {translateText('Đường - G (g)')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentData.meals.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-10 text-center text-slate-400 font-medium"
                    >
                      {translateText(
                        'Chưa có món ăn được lên lịch cho ngày này.',
                      )}
                    </td>
                  </tr>
                ) : (
                  currentData.meals.map((m) => {
                    const pctOfAllDay =
                      allDayStandard.avg > 0
                        ? Math.round(
                            (m.calories / allDayStandard.avg) * 1000,
                          ) / 10
                        : 0;

                    // Đánh giá tỷ lệ % calo so với khoảng chuẩn trong Database
                    let status: 'OPTIMAL' | 'LOW' | 'HIGH' = 'OPTIMAL';
                    if (pctOfAllDay < m.stdRange.min) status = 'LOW';
                    else if (pctOfAllDay > m.stdRange.max) status = 'HIGH';

                    return (
                      <tr
                        key={m.key}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${m.barColor}`}
                            />
                            <span>{translateText(m.name)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-center text-slate-500 font-semibold">
                          {m.time}
                        </td>
                        <td className="py-3.5 px-3 max-w-[220px]">
                          <div className="space-y-1">
                            {m.dishes.map((item, idx) => (
                              <div
                                key={idx}
                                className="text-slate-800 font-medium flex items-center gap-1.5 truncate"
                                title={item.dish?.name}
                              >
                                <span className="text-[10px] text-slate-400 font-bold">
                                  •
                                </span>
                                <span className="truncate">
                                  {item.dish?.name ||
                                    translateText('Chưa đặt tên')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-black text-slate-900 text-sm">
                          {m.calories}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">
                            Kcal
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-black text-slate-900 text-sm">
                            {pctOfAllDay}%
                          </span>
                          <span className="block text-[10px] text-slate-400 font-medium">
                            {totalAtSchoolCalo > 0
                              ? `(${Math.round((m.calories / totalAtSchoolCalo) * 100)}% ở trường)`
                              : ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center text-slate-600 font-bold">
                          {m.stdRange.min}% – {m.stdRange.max}%
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-cyan-900">
                          {m.waterMl ? `${m.waterMl.min} – ${m.waterMl.max} ml` : '—'}
                          <span className="block text-[10px] text-cyan-700 font-normal">
                            ({m.waterPct ? `${m.waterPct.min}–${m.waterPct.max}%` : `${m.stdRange.min}–${m.stdRange.max}%`})
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {status === 'OPTIMAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {translateText('Đạt chuẩn')}
                            </span>
                          )}
                          {status === 'LOW' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" />
                              {translateText('Hơi thấp')}
                            </span>
                          )}
                          {status === 'HIGH' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              {translateText('Hơi cao')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-blue-900">
                          {m.proteinG}g
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-amber-900">
                          {m.fatG}g
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-emerald-900">
                          {m.carbG}g
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* HÀNG TỔNG CỘNG TẠI TRƯỜNG THEO 2 QUY ĐỊNH */}
                {hasLateSnack ? (
                  <>
                    {/* HÀNG TỔNG CỘNG QUY ĐỊNH 1: BÁN TRÚ TIÊU CHUẨN (KHÔNG ĂN XẾ) */}
                    <tr className="bg-teal-50/80 border-t-2 border-teal-300 text-xs font-bold">
                      <td colSpan={3} className="py-3 px-4 font-black text-teal-950">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0"></span>
                          <span className="text-teal-900 font-black">
                            {translateText('QĐ 1: BÁN TRÚ TIÊU CHUẨN (Sáng, Trưa, Phụ - Không ăn xế)')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-teal-950 text-sm">
                        {qd1Calo}{' '}
                        <span className="text-[10px] font-normal">Kcal</span>
                      </td>
                      <td className="py-3 px-3 text-center font-black text-teal-950 text-sm">
                        {qd1PctOfAllDay}%
                      </td>
                      <td className="py-3 px-3 text-center text-teal-800 font-bold">
                        50% – 58%
                        <span className="block text-[9.5px] font-normal text-teal-700">
                          (615–726 Kcal)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-cyan-950 text-xs">
                        {qd1WaterMin} – {qd1WaterMax} ml
                        <span className="block text-[10px] font-semibold text-cyan-800">
                          (~50–60%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {(isToddler ? (qd1Calo >= 465 && qd1Calo <= 560) : (qd1Calo >= 615 && qd1Calo <= 726)) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />{' '}
                            {translateText('Cân đối')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" />{' '}
                            {translateText('Chênh lệch')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-blue-950">
                        {qd1P}g{' '}
                        <span className="text-[10px] text-blue-700 font-normal">
                          ({qd1PPct}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-950">
                        {qd1L}g{' '}
                        <span className="text-[10px] text-amber-700 font-normal">
                          ({qd1LPct}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-950">
                        {qd1G}g{' '}
                        <span className="text-[10px] text-emerald-700 font-normal">
                          ({qd1GPct}%)
                        </span>
                      </td>
                    </tr>

                    {/* HÀNG TỔNG CỘNG QUY ĐỊNH 2: BÁN TRÚ TOÀN DIỆN (CÓ ĂN XẾ) */}
                    <tr className="bg-amber-50/80 border-t border-amber-300 text-xs font-bold">
                      <td colSpan={3} className="py-3 px-4 font-black text-amber-950">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0"></span>
                          <span className="text-amber-900 font-black">
                            {translateText('QĐ 2: BÁN TRÚ TOÀN DIỆN (Cộng suất ăn xế chiều 17:00)')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-950 text-sm">
                        {qd2Calo}{' '}
                        <span className="text-[10px] font-normal">Kcal</span>
                      </td>
                      <td className="py-3 px-3 text-center font-black text-amber-950 text-sm">
                        {qd2PctOfAllDay}%
                      </td>
                      <td className="py-3 px-3 text-center text-amber-800 font-bold">
                        62% – 73%
                        <span className="block text-[9.5px] font-normal text-amber-700">
                          (765–926 Kcal)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-cyan-950 text-xs">
                        {totalAtSchoolWater.min} – {totalAtSchoolWater.max} ml
                        <span className="block text-[10px] font-semibold text-cyan-800">
                          (~{allDayStandard.atSchoolWaterMinPct}–{allDayStandard.atSchoolWaterMaxPct}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {(isToddler ? (qd2Calo >= 580 && qd2Calo <= 720) : (qd2Calo >= 762 && qd2Calo <= 963)) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />{' '}
                            {translateText('Cân đối')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" />{' '}
                            {translateText('Chênh lệch')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-blue-950">
                        {qd2P}g{' '}
                        <span className="text-[10px] text-blue-700 font-normal">
                          ({qd2PPct}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-950">
                        {qd2L}g{' '}
                        <span className="text-[10px] text-amber-700 font-normal">
                          ({qd2LPct}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-950">
                        {qd2G}g{' '}
                        <span className="text-[10px] text-emerald-700 font-normal">
                          ({qd2GPct}%)
                        </span>
                      </td>
                    </tr>
                  </>
                ) : (
                  /* HÀNG TỔNG CỘNG TẠI TRƯỜNG ĐƠN */
                  <tr className="bg-sky-50/80 border-t-2 border-sky-200 text-xs font-bold">
                    <td colSpan={3} className="py-3 px-4 font-black text-sky-950">
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-sky-700" />
                        <span>{translateText('TỔNG CỘNG CÁC BỮA TẠI TRƯỜNG')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-sky-950 text-sm">
                      {totalAtSchoolCalo} <span className="text-[10px] font-normal">Kcal</span>
                    </td>
                    <td className="py-3 px-3 text-center font-black text-sky-950 text-sm">
                      {atSchoolPctOfAllDay}%
                    </td>
                    <td className="py-3 px-3 text-center text-sky-800 font-bold">
                      {allDayStandard.atSchoolMinPct}% – {allDayStandard.atSchoolMaxPct}%
                    </td>
                    <td className="py-3 px-3 text-right font-black text-cyan-950 text-xs">
                      {totalAtSchoolWater.min} – {totalAtSchoolWater.max} ml
                      <span className="block text-[10px] font-semibold text-cyan-800">
                        (~{allDayStandard.atSchoolWaterMinPct}–{allDayStandard.atSchoolWaterMaxPct}%)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {atSchoolPctOfAllDay >= allDayStandard.atSchoolMinPct &&
                      atSchoolPctOfAllDay <= allDayStandard.atSchoolMaxPct ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> {translateText('Cân đối')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" /> {translateText('Chênh lệch')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-blue-950">
                      {currentData.totalDay.p}g <span className="text-[10px] text-blue-700 font-normal">({pPct}%)</span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-amber-950">
                      {currentData.totalDay.l}g <span className="text-[10px] text-amber-700 font-normal">({lPct}%)</span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-950">
                      {currentData.totalDay.g}g <span className="text-[10px] text-emerald-700 font-normal">({gPct}%)</span>
                    </td>
                  </tr>
                )}

                {/* HÀNG NHU CẦU Ở NHÀ BỔ SUNG */}
                <tr className="bg-slate-50/70 border-t border-slate-200 text-xs text-slate-600">
                  <td
                    colSpan={3}
                    className="py-3 px-4 font-bold text-slate-700"
                  >
                    <span>
                      {translateText(
                        'Nhu cầu phụ huynh bổ sung ở nhà (Bữa sáng sớm & bữa tối)',
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                    ~{remainingAtHomeCalo}{' '}
                    <span className="text-[10px] font-normal">Kcal</span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-800">
                    ~{remainingAtHomePct}%
                  </td>
                  <td className="py-3 px-3 text-center text-slate-500">
                    {100 - allDayStandard.atSchoolMaxPct}% –{' '}
                    {100 - allDayStandard.atSchoolMinPct}%
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-700 text-xs">
                    ~{remainingAtHomeWater.min} – {remainingAtHomeWater.max} ml
                  </td>
                  <td className="py-3 px-3 text-center text-[11px] text-slate-400">
                    {translateText('Gia đình nấu')}
                  </td>
                  <td
                    colSpan={3}
                    className="py-3 px-3 text-[11px] text-slate-500 italic text-right"
                  >
                    {translateText(
                      'Bổ sung thêm sữa tươi, canh rau củ thịt bằm vào buổi tối',
                    )}
                  </td>
                </tr>

                {/* HÀNG TỔNG 100% CẢ NGÀY */}
                <tr className="bg-slate-100 font-extrabold text-xs text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={3} className="py-3 px-4">
                    <span>
                      {translateText(
                        'TỔNG NHU CẦU DINH DƯỠNG CẢ NGÀY (100% - Database)',
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-black text-slate-900">
                    {allDayStandard.min} – {allDayStandard.max} Kcal
                  </td>
                  <td className="py-3 px-3 text-center font-black">100%</td>
                  <td className="py-3 px-3 text-center text-slate-600">100%</td>
                  <td className="py-3 px-3 text-right font-black text-cyan-950 text-xs">
                    {allDayStandard.waterMin} – {allDayStandard.waterMax} ml
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10px] font-bold text-slate-600">
                      {translateText(allDayStandard.standardName)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-blue-900">
                    {isToddler ? '13–20%' : '13–20%'}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-900">
                    {isToddler ? '30–40%' : '25–35%'}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-900">
                    {isToddler ? '47–50%' : '52–60%'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Hộp giải thích & nguồn dữ liệu Database */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {translateText(
                  'Cơ sở dữ liệu cấu hình & Tỷ lệ chuẩn áp dụng:',
                )}
              </span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pl-1 leading-relaxed">
              <li>
                <strong>{translateText('Nguồn cấu hình:')}</strong>{' '}
                {translateText(
                  `Bảng meal_energy_distributions và nutrition_intake_standards (quy chuẩn "${allDayStandard.standardName}").`,
                )}
              </li>
              <li>
                <strong>{translateText('Tỷ lệ phân bổ từng bữa:')}</strong>{' '}
                {configuredMealSlots
                  .map((m) => `${m.name}: ${m.stdRange.min}–${m.stdRange.max}% (${m.waterMl.min}–${m.waterMl.max} ml nước)`)
                  .join(' • ')}
                .
              </li>
              <li>
                <strong>{translateText('Khuyến nghị năng lượng & nước tại trường:')}</strong>{' '}
                {isToddler
                  ? translateText(
                      'Nhà trẻ (12–36 tháng): Ăn tại trường 60–70% năng lượng cả ngày; Cung cấp 500–700 ml nước/ngày tại trường (nhu cầu cả ngày 800–1.000 ml).',
                    )
                  : translateText(
                      'Mẫu giáo (3–6 tuổi): Ăn tại trường 50–55% năng lượng cả ngày; Cung cấp 800–1.100 ml nước/ngày tại trường (nhu cầu cả ngày 1.600–2.000 ml).',
                    )}
              </li>
              <li>
                <strong>{translateText('Nguồn cung cấp nước:')}</strong>{' '}
                {translateText(
                  'Bao gồm nước uống đun sôi để nguội/tinh khiết, sữa tươi/sữa bột pha, và nước từ canh, súp, cháo trong các bữa ăn.',
                )}
              </li>
              <li>
                <strong>{translateText('Phần năng lượng & nước còn lại ở nhà:')}</strong>{' '}
                {translateText(
                  'Được chia sẻ trong sổ liên lạc điện tử để phụ huynh chuẩn bị bữa ăn sáng sớm, bữa tối và cho bé uống đủ nước tại gia đình, đảm bảo bé phát triển toàn diện.',
                )}
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden shrink-0">
          <span>
            {translateText('Thực đơn:')}{' '}
            <strong className="text-slate-800">{menu?.title}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer"
          >
            {translateText('Đóng')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
