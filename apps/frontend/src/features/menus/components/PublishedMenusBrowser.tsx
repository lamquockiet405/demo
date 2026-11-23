import { getLocale, t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  History,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  UtensilsCrossed,
} from "lucide-react";
import {
  downloadWeeklyMenusMatrixExcel,
  WeeklyMenuExportWeek,
} from "../../../core/utils/excel-export";
import { exportWeeklyMenusToPdf } from "../../../core/utils/pdf-export";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";
import { parentEvaluationApi } from "../../parent-evaluations/api/parentEvaluationApi";
import { fetchPublishedMenu } from "../api/published-menus.api";
import { useMenuResource, usePublishedDay, usePublishedMenus } from "../hooks/usePublishedMenus";
import { fetchParentSnackOverview } from "../../snack-services/api/snackServicesApi";
import { ParentSnackOverviewResponse } from "../../snack-services/types";
import {
  mealTimes,
  mealTitles,
  menuPeriod,
  normalizeMenuAgeGroup,
  publishedMenuDates,
  publishedMenuDay,
  publishedMenusForExport,
  schoolDate,
} from "../utils/published-menus";
import { DishDetailModal } from "../../dishes/components/DishDetailModal";
import { childrenApi, ChildItem } from "../../children/api/children.api";
import { KitchenSummaryCards } from "../../kitchen/components/KitchenSummaryCards";

const dateLabel = (date: string) =>
  date ? date.split("-").reverse().join("/") : "—";
const number = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString(getLocale(), { maximumFractionDigits: 1 });
const ageLabel = (age: unknown) =>
  normalizeMenuAgeGroup(age) === "NHA_TRE"
    ? "Nhà trẻ"
    : normalizeMenuAgeGroup(age) === "MAU_GIAO"
      ? "Mẫu giáo"
      : String(age || "Toàn trường");

export function PublishedMenusBrowser({
  audience,
  embedded = false,
  syncDate = false,
  childId,
  childName,
  childHasAllergy,
  childAllergens,
}: {
  audience: "kitchen" | "parent";
  embedded?: boolean;
  syncDate?: boolean;
  childId?: string;
  childName?: string;
  childHasAllergy?: boolean;
  childAllergens?: string[];
}) {
  useLanguage();
  const index = usePublishedMenus();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("ALL");
  const [age, setAge] = useState("");
  const [autoChild, setAutoChild] = useState<ChildItem | null>(null);

  useEffect(() => {
    if (audience !== "parent" || childId) return;
    let active = true;
    childrenApi
      .getChildren({ limit: 10 })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : res?.items || [];
        if (list.length > 0) setAutoChild(list[0]);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      active = false;
    };
  }, [audience, childId]);

  const effectiveChildId =
    childId || params.get("childId") || (autoChild ? String(autoChild.id) : "");
  const effectiveAllergens =
    childAllergens !== undefined
      ? childAllergens
      : (autoChild?.allergies || [])
        .filter((a: any) => a?.isActive !== false)
        .map((a: any) => a?.allergenName || a?.customAllergenName || "")
        .filter(Boolean);
  const effectiveHasAllergy =
    childHasAllergy !== undefined
      ? childHasAllergy
      : autoChild
        ? Boolean((autoChild as any).hasAllergy || effectiveAllergens.length > 0)
        : true;
  const today = schoolDate();
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
  const menus = (index.data || []).filter((menu) => {
    const range = menuPeriod(menu);
    return (
      (!age ||
        normalizeMenuAgeGroup(menu.ageGroup || menu.targetAgeGroup) === age) &&
      normalized(`${menu.title} ${range.start} ${range.end}`).includes(
        normalized(search.trim()),
      ) &&
      (period === "ALL" ||
        (period === "PAST" && range.end < today) ||
        (period === "CURRENT" && range.start <= today && range.end >= today) ||
        (period === "UPCOMING" && range.start > today))
    );
  });
  const requestedDate = params.get("date") || "";
  const selectionDate = syncDate && requestedDate ? requestedDate : today;
  const selected =
    menus.find((menu) => String(menu.id) === params.get("menuId")) ||
    menus.find((menu) => {
      const range = menuPeriod(menu);
      return (
        range.start <= selectionDate && range.end >= selectionDate &&
        (syncDate || menu.status !== "ARCHIVED")
      );
    }) ||
    menus[0];
  const detail = useMenuResource(
    `published-menu:${index.tenant}:${selected?.id || ""}:${index.revision}`,
    () => fetchPublishedMenu(String(selected.id)),
    !!selected && !index.loading && !index.error,
  );
  const dates = detail.data ? publishedMenuDates(detail.data) : [];
  const date = syncDate && requestedDate && !params.get("menuId")
    ? requestedDate
    : dates.includes(requestedDate)
      ? requestedDate
      : dates.includes(today)
        ? today
        : dates[0] || "";
  const meals =
    detail.data && date
      ? publishedMenuDay(detail.data, date, {
        audience,
        childId: effectiveChildId,
        childHasAllergy: effectiveHasAllergy,
        childAllergens: effectiveAllergens,
      })
      : [];
  const selectMenu = (id: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("menuId", id);
      next.delete("date");
      return next;
    });
  const selectDate = (date: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("menuId", String(selected.id));
      next.set("date", date);
      return next;
    });
  const busy = index.loading || detail.loading;
  useEffect(() => {
    if (!syncDate || busy || detail.error || !date || date === requestedDate) return;
    // A deliberate menu selection also selects one of its available days.
    // An explicit date outside published menus remains available for consumption history.
    if (requestedDate && !params.get("menuId")) return;
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("date", date);
      return next;
    }, { replace: true });
  }, [syncDate, busy, detail.error, date, requestedDate, params, setParams]);
  const Heading = embedded ? "h2" : "h1";
  const [selectedDish, setSelectedDish] = useState<{
    id?: string | number;
    name?: string;
    portionSizeG?: number | null;
    calories?: number | null;
  } | null>(null);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"WEEK" | "DAY">("WEEK");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);

  useEffect(() => {
    if (audience !== "parent" || !effectiveChildId) {
      setTodaySessions([]);
      return;
    }
    let active = true;
    parentEvaluationApi
      .getChildMenuConsumption(effectiveChildId, today)
      .then((res) => {
        if (!active) return;
        setTodaySessions(Array.isArray(res?.sessions) ? res.sessions : []);
      })
      .catch(() => {
        if (active) setTodaySessions([]);
      });
    return () => {
      active = false;
    };
  }, [audience, effectiveChildId, today]);

  const [snackOverview, setSnackOverview] = useState<ParentSnackOverviewResponse | null>(null);

  useEffect(() => {
    if (audience === "parent") {
      let active = true;
      fetchParentSnackOverview(effectiveChildId)
        .then((res) => {
          if (active) setSnackOverview(res);
        })
        .catch(() => {
          if (active) setSnackOverview(null);
        });
      return () => {
        active = false;
      };
    }
  }, [audience, effectiveChildId]);

  const isLateSnackPaidForWeek = (): boolean => {
    if (audience !== "parent") return true;
    if (!snackOverview || !Array.isArray(snackOverview.publishedPackages)) return false;

    const menuStart = selected?.startDate;
    const menuEnd = selected?.endDate;

    return snackOverview.publishedPackages.some((pkg) => {
      if (!pkg.isPaid) return false;
      if (menuStart && menuEnd && pkg.startDate === menuStart && pkg.endDate === menuEnd) return true;
      if (dates.length > 0 && dates.some((d) => d >= pkg.startDate && d <= pkg.endDate)) return true;
      return false;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuDropdownOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const isParent = audience === "parent";
  const ringFocus = isParent ? "focus:ring-emerald-500" : "focus:ring-sky-500";
  const dayTotalCalories = meals.reduce(
    (sum, m) =>
      sum + m.dishes.reduce((s, d) => s + (typeof d.calories === "number" ? d.calories : 0), 0),
    0,
  );
  const allergyConflictCount = meals.reduce(
    (sum, m) =>
      sum + m.dishes.filter((d) => !d.substitutedFor && d.hasChildAllergyConflict).length,
    0,
  );

  // Dữ liệu cho chế độ xem nguyên tuần
  const weekDaysData = detail.data
    ? dates.map((d) => {
      const dayMeals = publishedMenuDay(detail.data, d, {
        audience,
        childId: effectiveChildId,
        childHasAllergy: effectiveHasAllergy,
        childAllergens: effectiveAllergens,
      });
      const totalCalories = dayMeals.reduce(
        (sum, m) =>
          sum + m.dishes.reduce((s, dish) => s + (typeof dish.calories === "number" ? dish.calories : 0), 0),
        0,
      );
      return { day: d, meals: dayMeals, totalCalories };
    })
    : [];

  const mealSessions: { mealType: string; title: string; time?: string }[] = [];
  weekDaysData.forEach(({ meals: dayMeals }) => {
    dayMeals.forEach((m) => {
      if (!mealSessions.some((s) => s.mealType === m.mealType)) {
        mealSessions.push({
          mealType: m.mealType,
          title: m.title,
          time: m.time || mealTimes[m.mealType],
        });
      }
    });
  });

  const [exporting, setExporting] = useState(false);
  const schoolBranding = useSchoolBranding();

  const buildExportWeeks = async (limit = 3): Promise<WeeklyMenuExportWeek[]> => {
    const exportMenus = publishedMenusForExport(menus, selected, audience, limit);
    if (!exportMenus.length) return [];

    const details = await Promise.all(
      exportMenus.map((m) =>
        String(m.id) === String(selected?.id) && detail.data
          ? Promise.resolve(detail.data)
          : fetchPublishedMenu(String(m.id)),
      ),
    );

    const groups = [
      {
        mealLabel: "Phụ Sáng",
        bgColor: "FFFFC000",
        match: (type: string) => type === "BREAKFAST" || type === "MORNING_SNACK",
      },
      {
        mealLabel: "Chính trưa",
        bgColor: "FF00B050",
        match: (type: string) => type === "LUNCH",
      },
      {
        mealLabel: "Xế + Phụ chiều",
        bgColor: "FFF79646",
        match: (type: string) =>
          type !== "BREAKFAST" && type !== "MORNING_SNACK" && type !== "LUNCH",
      },
    ];

    return details.map((menuDetail) => {
      const mDates = publishedMenuDates(menuDetail);
      const range = menuPeriod(menuDetail);
      const dayMealsMap = mDates.map((d) => ({
        day: d,
        meals: publishedMenuDay(menuDetail, d, {
          audience,
          childId: effectiveChildId,
          childHasAllergy: effectiveHasAllergy,
          childAllergens: effectiveAllergens,
        }),
      }));

      const days = mDates.map((d) => {
        const dt = new Date(`${d}T12:00:00Z`);
        const weekdayNum = dt.getUTCDay();
        const weekdayLabel =
          weekdayNum === 0 ? "Chủ nhật" : `Thứ ${weekdayNum + 1}`;
        return {
          day: d,
          weekdayLabel,
          dateLabel: `Ngày ${dateLabel(d)}`,
        };
      });

      const rows = groups.map((grp) => ({
        mealLabel: grp.mealLabel,
        bgColor: grp.bgColor,
        cells: dayMealsMap.map(({ meals: dMeals }) => {
          const matchedDishes = dMeals
            .filter((m) => grp.match(m.mealType))
            .flatMap((m) => m.dishes);
          if (!matchedDishes.length) return "—";
          return matchedDishes.map((dish) => `- ${dish.name}`).join("\n");
        }),
      }));

      return {
        title: (menuDetail.title || "Thực đơn tuần").replace(/\s*\([^)]*\)/g, "").trim(),
        dateRange: `${dateLabel(range.start)} – ${dateLabel(range.end)}`,
        ageGroupLabel: ageLabel(menuDetail.ageGroup || menuDetail.targetAgeGroup),
        days,
        rows,
      };
    });
  };

  const handleExportPdf = async () => {
    if (!menus.length || exporting || (isParent && (!selected || busy || !!detail.error))) return;
    setExporting(true);
    try {
      const weeks = await buildExportWeeks(isParent ? 1 : 3);
      if (!weeks.length) return;
      exportWeeklyMenusToPdf({
        schoolName: schoolBranding.name,
        schoolAddress: schoolBranding.address,
        schoolPhone: schoolBranding.phone,
        logoUrl: schoolBranding.logoUrl,
        childName: childName || (childId ? undefined : autoChild?.fullName),
        weeks,
        orientation: 'portrait',
      });
    } finally {
      setExporting(false);
    }
  };

  const todayPublished = usePublishedDay(
    today,
    autoChild?.ageGroup,
    {
      audience,
      childId: effectiveChildId,
      childHasAllergy: effectiveHasAllergy,
      childAllergens: effectiveAllergens,
    },
  );
  // Tính calo thực đơn hôm nay & lượng calo bé đã ăn hôm nay
  const todayPublishedMeals =
    detail.data && dates.includes(today)
      ? publishedMenuDay(detail.data, today, {
        audience,
        childId: effectiveChildId,
        childHasAllergy: effectiveHasAllergy,
        childAllergens: effectiveAllergens,
      })
      : todayPublished.meals || [];
  const todayMenuCalories = todayPublishedMeals.reduce(
    (sum, m) => sum + m.dishes.reduce((s, d) => s + (typeof d.calories === "number" ? d.calories : 0), 0),
    0,
  );
  const todayEatenCalories = todayPublishedMeals.reduce((sum, m) => {
    const mealKcal = m.dishes.reduce((s, d) => s + (typeof d.calories === "number" ? d.calories : 0), 0);
    const matchedSession = todaySessions.find((s) => {
      const sType = s.mealType === "SNACK" ? "AFTERNOON_SNACK" : s.mealType;
      return sType === m.mealType || (sType === "BREAKFAST" && m.mealType === "MORNING_SNACK");
    });
    const pct = typeof matchedSession?.consumptionPercentage === "number" ? matchedSession.consumptionPercentage : 0;
    return sum + Math.round((mealKcal * pct) / 100);
  }, 0);

  const handleExportExcel = async () => {
    if (!menus.length || exporting || (isParent && (!selected || busy || !!detail.error))) return;
    setExporting(true);
    try {
      const weeks = await buildExportWeeks(isParent ? 1 : 3);
      if (!weeks.length) return;
      await downloadWeeklyMenusMatrixExcel(
        isParent ? `Thuc_don_tuan_${menuPeriod(selected || menus[0]).start}.xlsx` : `Thuc_don_3_tuan_gan_nhat_${today}.xlsx`,
        weeks,
      );
    } finally {
      setExporting(false);
    }
  };

  const selectedRange = selected ? menuPeriod(selected) : null;
  const selectedIsPast = selectedRange ? selectedRange.end < today : false;
  const selectedIsUpcoming = selectedRange ? selectedRange.start > today : false;

  return (
    <section className="space-y-5">
      {audience === 'kitchen' && index.data && !index.error && (
        <KitchenSummaryCards metrics={[
          { label: 'Thực đơn đã công bố', value: index.data.length, icon: CalendarDays },
          { label: 'Đang áp dụng', value: index.data.filter((menu) => { const range = menuPeriod(menu); return range.start <= today && range.end >= today; }).length, icon: CheckCircle2, tone: 'success' },
          { label: 'Sắp áp dụng', value: index.data.filter((menu) => menuPeriod(menu).start > today).length, icon: Clock, tone: 'warning' },
          { label: 'Đã kết thúc', value: index.data.filter((menu) => menuPeriod(menu).end < today).length, icon: History, tone: 'neutral' },
        ]} />
      )}
      {/* Compact Action & Dropdown Selector Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Dropdown Menu Selector Button */}
        <div className="relative flex-1 min-w-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setMenuDropdownOpen((prev) => !prev)}
            aria-expanded={menuDropdownOpen}
            aria-label={translateText("Chọn thực đơn tuần")}
            className={`w-full xl:w-auto xl:min-w-[380px] max-w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border transition cursor-pointer text-left ${menuDropdownOpen
              ? isParent
                ? "border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-200"
                : "border-sky-300 bg-sky-50/50 ring-2 ring-sky-200"
              : "border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300"
              }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isParent ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-600"
                  }`}
              >
                <CalendarDays className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {selected
                      ? (selected.title || translateText("Thực đơn tuần")).replace(/\s*\([^)]*\)/g, "").trim()
                      : translateText("Chọn thực đơn tuần")}
                  </span>
                  {selectedRange && (
                    <span
                      className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${selectedIsPast
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : selectedIsUpcoming
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                    >
                      {translateText(
                        selectedIsPast
                          ? "Đã công bố trước đây"
                          : selectedIsUpcoming
                            ? "Sắp áp dụng"
                            : "Đang áp dụng",
                      )}
                    </span>
                  )}
                </div>
                {selectedRange && (
                  <span className="block text-[11px] font-medium text-slate-500 truncate mt-0.5">
                    {translateText(dateLabel(selectedRange.start))} – {translateText(dateLabel(selectedRange.end))} · {translateText(ageLabel(selected?.ageGroup || selected?.targetAgeGroup))} · {menus.length} {translateText("thực đơn")}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${menuDropdownOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          {/* Dropdown Panel */}
          {menuDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-full sm:w-[460px] bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-3 space-y-3">
              {/* Filter inside dropdown */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    aria-label={translateText("Tìm thực đơn đã công bố")}
                    placeholder={translateText("Tìm tên thực đơn…")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 ${ringFocus} transition`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label={translateText("Lọc thời gian thực đơn")}
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    className={`px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-none focus:ring-2 ${ringFocus} cursor-pointer`}
                  >
                    <option value="ALL">{translateText("Tất cả thời gian")}</option>
                    <option value="CURRENT">{translateText("Đang áp dụng")}</option>
                    <option value="PAST">{translateText("Các tuần trước")}</option>
                    <option value="UPCOMING">{translateText("Sắp áp dụng")}</option>
                  </select>
                  <select
                    aria-label={translateText("Khối tuổi thực đơn")}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    className={`px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-none focus:ring-2 ${ringFocus} cursor-pointer`}
                  >
                    <option value="">{translateText("Tất cả khối tuổi")}</option>
                    <option value="MAU_GIAO">{translateText("Mẫu giáo")}</option>
                    <option value="NHA_TRE">{translateText("Nhà trẻ")}</option>
                  </select>
                </div>
              </div>

              {/* Menu List */}
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {!menus.length ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    {translateText("Không có thực đơn phù hợp.")}
                  </p>
                ) : (
                  menus.map((menu) => {
                    const range = menuPeriod(menu);
                    const isSelected = String(menu.id) === String(selected?.id);
                    const isPast = range.end < today;
                    const isUpcoming = range.start > today;
                    const statusLabel = isPast
                      ? "Đã công bố trước đây"
                      : isUpcoming
                        ? "Sắp áp dụng"
                        : "Đang áp dụng";
                    const statusBadgeClass = isPast
                      ? "bg-slate-100 text-slate-600 border-slate-200"
                      : isUpcoming
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200";
                    return (
                      <button
                        key={menu.id}
                        type="button"
                        onClick={() => {
                          selectMenu(String(menu.id));
                          setMenuDropdownOpen(false);
                        }}
                        className={`w-full text-left rounded-xl border p-3 transition cursor-pointer ${isSelected
                          ? isParent
                            ? "bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300"
                            : "bg-sky-50/80 border-sky-300 ring-1 ring-sky-300"
                          : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isSelected
                              ? isParent
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-sky-100 text-sky-700"
                              : "bg-slate-100 text-slate-600"
                              }`}
                          >
                            {translateText(ageLabel(menu.ageGroup || menu.targetAgeGroup))}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClass}`}
                          >
                            {isPast ? <History className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                            {translateText(statusLabel)}
                          </span>
                        </div>
                        <strong className="block text-xs font-bold text-slate-900 mt-1.5">
                          {(menu.title || translateText("Thực đơn tuần")).replace(/\s*\([^)]*\)/g, "").trim()}
                        </strong>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-1">
                          <CalendarDays className="w-3 h-3 text-slate-400" />
                          {translateText(dateLabel(range.start))} – {translateText(dateLabel(range.end))}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: View Toggle + Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("WEEK")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${viewMode === "WEEK"
                ? isParent
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-sky-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>{translateText("Cả tuần")}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("DAY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${viewMode === "DAY"
                ? isParent
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-sky-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{translateText("Theo ngày")}</span>
            </button>
          </div>

          <button
            type="button"
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            onClick={() => void index.reload()}
            disabled={index.loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${index.loading ? "animate-spin" : ""}`} />
            <span>{translateText("Làm mới")}</span>
          </button>

          <button
            type="button"
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            onClick={() => void handleExportExcel()}
            disabled={!menus.length || exporting || (isParent && (busy || !!detail.error))}
            title={translateText("Xuất thực đơn ra Excel")}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>

          <button
            type="button"
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            onClick={() => void handleExportPdf()}
            disabled={!menus.length || exporting || (isParent && (busy || !!detail.error))}
            title={translateText("Xuất thực đơn ra PDF")}
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>{translateText("Xuất PDF")}</span>
          </button>
        </div>
      </div>

      {index.error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700" role="alert">
          {translateText(index.error)}
        </div>
      )}

      {index.loading && !index.data && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-medium text-slate-500" role="status">
          {translateText("Đang tải danh sách thực đơn đã công bố…")}
        </div>
      )}

      {!index.loading && !index.error && !menus.length && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-2xs space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            {translateText(index.data?.length
              ? "Không có thực đơn phù hợp"
              : "Nhà trường chưa công bố thực đơn")}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {translateText(index.data?.length
              ? "Thay đổi từ khóa hoặc bộ lọc để xem các thực đơn khác."
              : "Thực đơn sẽ xuất hiện ở đây sau khi hiệu trưởng công bố.")}
          </p>
        </div>
      )}

      {/* Full-Width Weekly / Daily Menu Detail */}
      {!!menus.length && (
        <article className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs min-w-0" aria-busy={busy}>
          {busy ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500" role="status">
              {translateText("Đang tải chi tiết thực đơn…")}
            </div>
          ) : detail.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between gap-3 text-xs font-semibold text-rose-700" role="alert">
              <span>{translateText(detail.error)}</span>
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold cursor-pointer"
                onClick={() => void detail.reload()}
              >
                {translateText("Thử lại")}
              </button>
            </div>
          ) : (
            detail.data && (
              <>
                <header className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {translateText("Đã công bố")}
                        {detail.data.status === "ARCHIVED" ? translateText(" · Lưu trữ") : ""}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        {translateText(ageLabel(detail.data.ageGroup || detail.data.targetAgeGroup))}
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-2">
                      {translateText((detail.data.title || "").replace(/\s*\([^)]*\)/g, "").trim())}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 mt-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        {translateText(dateLabel(menuPeriod(detail.data).start))} – {translateText(dateLabel(menuPeriod(detail.data).end))}
                      </span>
                      {detail.data.publishedAt && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {translateText("Công bố lúc")}{" "}
                          {translateText(new Date(detail.data.publishedAt).toLocaleString(
                            getLocale(),
                            { timeZone: "Asia/Ho_Chi_Minh" },
                          ))}
                        </span>
                      )}
                    </div>
                  </div>

                  {isParent && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 flex items-center gap-3 shrink-0">
                      <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Flame className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="block text-[11px] font-bold text-amber-800">
                          {translateText("Bé ăn hôm nay")} · {translateText(dateLabel(today))}
                        </span>
                        <strong className="block text-sm font-black text-slate-900">
                          {todayMenuCalories > 0
                            ? `${number(todayEatenCalories)} / ${number(todayMenuCalories)} ${translateText("kcal")}`
                            : `${number(todayEatenCalories)} ${translateText("kcal")} · ${translateText("Chưa có thực đơn hôm nay")}`}
                        </strong>
                      </div>
                    </div>
                  )}
                </header>

                {!dates.length ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    {translateText("Thực đơn này chưa có chi tiết món ăn theo ngày.")}
                  </div>
                ) : viewMode === "WEEK" ? (
                  /* FULL WEEK MATRIX VIEW */
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200/80">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 min-w-[140px] sticky left-0 bg-slate-50/95 z-10 border-r border-slate-200/80">
                            {translateText("Bữa ăn")}
                          </th>
                          {weekDaysData.map(({ day, totalCalories }) => {
                            const isToday = day === today;
                            const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString(
                              getLocale(),
                              { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" },
                            );
                            return (
                              <th
                                key={day}
                                className={`p-3.5 min-w-[210px] border-r last:border-r-0 border-slate-200/70 align-top ${isToday
                                  ? isParent
                                    ? "bg-emerald-50/70"
                                    : "bg-sky-50/70"
                                  : ""
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      selectDate(day);
                                      setViewMode("DAY");
                                    }}
                                    className="text-left group cursor-pointer"
                                    title={translateText("Bấm để xem chi tiết ngày này")}
                                  >
                                    <span className={`block text-xs font-bold capitalize ${isToday ? (isParent ? "text-emerald-700" : "text-sky-700") : "text-slate-800"} group-hover:underline`}>
                                      {translateText(weekday)}
                                    </span>
                                    <span className="block text-[11px] font-semibold text-slate-500 mt-0.5">
                                      {translateText(dateLabel(day))}
                                    </span>
                                  </button>
                                  <div className="flex flex-col items-end gap-1">
                                    {isToday && (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isParent ? "bg-emerald-600 text-white" : "bg-sky-600 text-white"}`}>
                                        {translateText("Hôm nay")}
                                      </span>
                                    )}
                                    {totalCalories > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                                        <Flame className="w-3 h-3" />
                                        {number(totalCalories)} kcal
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80">
                        {mealSessions.map((session) => {
                          const isLateSnackLocked =
                            session.mealType === "LATE_SNACK" &&
                            audience === "parent" &&
                            !isLateSnackPaidForWeek();

                          return (
                            <tr key={session.mealType} className="align-top">
                              <td className="p-3.5 sticky left-0 bg-white z-10 border-r border-slate-200/80">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                      isLateSnackLocked
                                        ? "bg-amber-100 text-amber-800"
                                        : isParent
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-sky-50 text-sky-600"
                                    }`}
                                  >
                                    {isLateSnackLocked ? (
                                      <Lock className="w-3.5 h-3.5" />
                                    ) : (
                                      <UtensilsCrossed className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                  <div>
                                    <span className="text-xs font-bold text-slate-800 leading-snug block">
                                      {translateText(session.title)}
                                    </span>
                                    {session.time && (
                                      <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                                        {session.time}
                                      </span>
                                    )}
                                    {isLateSnackLocked && (
                                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded px-1.5 py-0.2 mt-0.5 inline-block">
                                        {translateText("Chưa đăng ký")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {isLateSnackLocked ? (
                                <td colSpan={weekDaysData.length} className="p-3.5 bg-amber-50/40 border-r border-slate-200/80">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-amber-200 shadow-2xs">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                                        <Lock className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <strong className="text-xs font-bold text-slate-900 block">
                                          {translateText("Chưa đăng ký dịch vụ suất ăn xế chiều cho bé")}
                                        </strong>
                                        <p className="text-[11px] text-slate-600 mt-0.5">
                                          {translateText("Thực đơn Buổi chiều xế được xem trước và đăng ký tại mục \"Thực đơn ăn xế & Thanh toán\". Sau khi hoàn tất thanh toán, thực đơn tuần sẽ tự động mở khóa hiển thị.")}
                                        </p>
                                      </div>
                                    </div>
                                    <Link
                                      to="/parent-snack-payment"
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition hover:scale-105 active:scale-95 shrink-0 whitespace-nowrap"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>{translateText("Xem trước & Đăng ký ăn xế")}</span>
                                    </Link>
                                  </div>
                                </td>
                              ) : (
                                weekDaysData.map(({ day, meals: dayMeals }) => {
                                  const foundMeal = dayMeals.find((m) => m.mealType === session.mealType);
                                  const isToday = day === today;
                                  return (
                                    <td
                                      key={`${day}-${session.mealType}`}
                                      className={`p-2.5 border-r last:border-r-0 border-slate-100 ${isToday
                                        ? isParent
                                          ? "bg-emerald-50/20"
                                          : "bg-sky-50/20"
                                        : ""
                                        }`}
                                    >
                                      {!foundMeal || !foundMeal.dishes.length ? (
                                        <span className="text-xs text-slate-400 italic px-1">
                                          {translateText("Chưa có món")}
                                        </span>
                                      ) : (
                                        <div className="space-y-1.5">
                                          {(() => {
                                            const cellKcal = foundMeal.dishes.reduce(
                                              (s, d) => s + (typeof d.calories === "number" ? d.calories : 0),
                                              0,
                                            );
                                            return cellKcal > 0 ? (
                                              <div className="flex items-center justify-between px-1 pb-0.5">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 rounded-md px-1.5 py-0.5">
                                                  <Flame className="w-3 h-3" />
                                                  {translateText("Tổng bữa: ")}{number(cellKcal)} kcal
                                                </span>
                                              </div>
                                            ) : null;
                                          })()}
                                          {foundMeal.dishes.map((dish, idx) => (
                                            <button
                                              key={`${dish.id}-${idx}`}
                                              type="button"
                                              onClick={() =>
                                                setSelectedDish({
                                                  id: dish.id,
                                                  name: dish.name,
                                                  portionSizeG: dish.portionSizeG,
                                                  calories: dish.calories,
                                                })
                                              }
                                              className={`w-full text-left p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 transition cursor-pointer ${isParent
                                                ? "hover:bg-emerald-50/70 hover:border-emerald-200"
                                                : "hover:bg-sky-50/70 hover:border-sky-200"
                                                }`}
                                              title={translateText(`Bấm để xem chi tiết món ăn "${dish.name}"`)}
                                            >
                                              <strong className="block text-xs font-bold text-slate-900 leading-snug">
                                                {dish.name}
                                              </strong>
                                              {!isParent && <div className="flex items-center justify-between gap-2 mt-1 text-[11px] font-semibold text-slate-500">
                                                <span>{translateText(dish.category)}</span>
                                                <span>
                                                  {dish.portionSizeG !== null ? `${number(dish.portionSizeG)}g` : "—"}
                                                  {dish.calories !== null ? ` · ${number(dish.calories)} kcal` : ""}
                                                </span>
                                              </div>}
                                              {!isParent && dish.substitutedFor && (
                                                <span className="mt-1.5 inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                                                  {translateText("✓ Đổi suất: ")}{dish.substitutedFor}
                                                </span>
                                              )}
                                              {!isParent && !dish.substitutedFor && dish.hasChildAllergyConflict && dish.allergens && dish.allergens.length > 0 && (
                                                <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                                  {dish.allergens.join(", ")}
                                                </span>
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* SINGLE DAY VIEW */
                  <>
                    <div className="flex flex-wrap gap-2 my-5" aria-label={translateText("Ngày trong thực đơn")}>
                      {dates.map((day) => {
                        const isSelectedDay = day === date;
                        const dayBtnClass = isSelectedDay
                          ? isParent
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
                        return (
                          <button
                            key={day}
                            type="button"
                            className={`px-3.5 py-2 rounded-xl border text-left transition cursor-pointer ${dayBtnClass}`}
                            aria-pressed={isSelectedDay}
                            onClick={() => selectDate(day)}
                          >
                            <span className={`block text-[11px] font-semibold ${isSelectedDay ? "text-white/90" : "text-slate-500"}`}>
                              {translateText(new Date(`${day}T12:00:00Z`).toLocaleDateString(
                                getLocale(),
                                {
                                  weekday: "short",
                                  timeZone: "Asia/Ho_Chi_Minh",
                                },
                              ))}
                            </span>
                            <b className="block text-xs font-bold mt-0.5">
                              {translateText(dateLabel(day))}
                            </b>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800">
                        {translateText("Thực đơn ngày ")}{translateText(dateLabel(date))}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {dayTotalCalories > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                            <Flame className="w-3.5 h-3.5" />
                            {translateText("Tổng ngày: ")}{number(dayTotalCalories)}{translateText(" kcal")}
                          </span>
                        )}
                        {isParent && allergyConflictCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {allergyConflictCount} {translateText("món cần lưu ý dị ứng")}
                          </span>
                        )}
                        {isParent && allergyConflictCount === 0 && effectiveAllergens.length > 0 && meals.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {translateText("An toàn theo hồ sơ dị ứng")}
                          </span>
                        )}
                      </div>
                    </div>

                    {meals.length > 0 && dayTotalCalories > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                        {meals.map((meal) => {
                          const mKcal = meal.dishes.reduce(
                            (sum, d) => sum + (typeof d.calories === "number" ? d.calories : 0),
                            0,
                          );
                          const pct = dayTotalCalories > 0 ? Math.round((mKcal / dayTotalCalories) * 100) : 0;
                          return (
                            <div
                              key={meal.mealType}
                              className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="block text-[11px] font-semibold text-slate-500 truncate">
                                  {translateText(meal.title)}{meal.time ? ` (${meal.time})` : ''}
                                </span>
                                <strong className="block text-sm font-black text-slate-900 mt-0.5">
                                  {number(mKcal)} {translateText("kcal")}
                                </strong>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700 shrink-0">
                                {pct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!meals.length ? (
                      <div className="py-10 text-center text-sm text-slate-500">
                        {translateText("Chưa có món ăn được xếp cho ngày này.")}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {meals.map((meal) => {
                          const isLateSnackLocked =
                            meal.mealType === "LATE_SNACK" &&
                            audience === "parent" &&
                            !isLateSnackPaidForWeek();

                          if (isLateSnackLocked) {
                            return (
                              <section
                                className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4"
                                key={meal.mealType}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                                      <Lock className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-900">
                                          {translateText(meal.title)}{meal.time ? ` (${meal.time})` : ""}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                          {translateText("Chưa đăng ký")}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-600 mt-1">
                                        {translateText("Bé chưa đăng ký suất ăn xế chiều cho ngày này. Vui lòng xem trước thực đơn và hoàn tất đăng ký tại mục \"Thực đơn ăn xế & Thanh toán\".")}
                                      </p>
                                    </div>
                                  </div>
                                  <Link
                                    to="/parent-snack-payment"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition hover:scale-105 active:scale-95 shrink-0 whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{translateText("Xem trước & Đăng ký ăn xế")}</span>
                                  </Link>
                                </div>
                              </section>
                            );
                          }

                          const mealCalories = meal.dishes.reduce(
                            (sum, d) => sum + (typeof d.calories === "number" ? d.calories : 0),
                            0,
                          );
                          return (
                            <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden" key={meal.mealType}>
                              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${isParent ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-600"}`}>
                                    <UtensilsCrossed className="w-3.5 h-3.5" />
                                  </span>
                                  <span>{translateText(meal.title)}</span>
                                  {meal.time && (
                                    <span className="text-xs font-semibold text-slate-400">
                                      ({meal.time})
                                    </span>
                                  )}
                                </h3>
                                {mealCalories > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                                    <Flame className="w-3.5 h-3.5 text-amber-600" />
                                    {translateText("Tổng bữa: ")}{number(mealCalories)} {translateText("kcal")}
                                  </span>
                                )}
                              </div>

                              <div className="divide-y divide-slate-100">
                                {meal.dishes.map((dish, i) => (
                                  <div
                                    className={`group px-4 py-3.5 flex items-center justify-between gap-4 cursor-pointer transition ${isParent ? "hover:bg-emerald-50/40" : "hover:bg-sky-50/40"}`}
                                    key={`${dish.id}-${i}`}
                                    onClick={() =>
                                      setSelectedDish({
                                        id: dish.id,
                                        name: dish.name,
                                        portionSizeG: dish.portionSizeG,
                                        calories: dish.calories,
                                      })
                                    }
                                    title={translateText(`Bấm để xem chi tiết món ăn "${dish.name}"`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        setSelectedDish({
                                          id: dish.id,
                                          name: dish.name,
                                          portionSizeG: dish.portionSizeG,
                                          calories: dish.calories,
                                        });
                                      }
                                    }}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <strong className="text-sm font-semibold text-slate-900">
                                          {dish.name}
                                        </strong>
                                        {!isParent && dish.category && (
                                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                                            {translateText(dish.category)}
                                          </span>
                                        )}
                                      </div>

                                      {!isParent && dish.substitutedFor && (
                                        <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                          🍱 {translateText("Suất riêng")} ({translateText("Thay cho: ")}{dish.substitutedFor})
                                        </div>
                                      )}

                                      {!isParent && !dish.substitutedFor && dish.hasChildAllergyConflict && dish.allergens && dish.allergens.length > 0 && (
                                        <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                          <span>{translateText("Lưu ý dị ứng của bé: ")}{dish.allergens.join(", ")}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      {!isParent && <div className="text-right">
                                        <span className="block text-xs font-bold text-slate-700">
                                          {translateText(dish.portionSizeG === null
                                            ? "Chưa có định lượng"
                                            : `${number(dish.portionSizeG)} g`)}
                                        </span>
                                        {dish.calories !== null && (
                                          <span className="block text-[11px] font-semibold text-slate-500 mt-0.5">
                                            {translateText(number(dish.calories))}{translateText(" kcal")}
                                          </span>
                                        )}
                                      </div>}
                                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )
          )}
        </article>
      )}

      <DishDetailModal
        isOpen={!!selectedDish}
        onClose={() => setSelectedDish(null)}
        dishId={selectedDish?.id}
        dishName={selectedDish?.name}
        initialCalories={selectedDish?.calories}
        initialPortionSizeG={selectedDish?.portionSizeG}
      />
    </section>
  );
}
