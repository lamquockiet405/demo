import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Flame,
  Utensils,
  Coffee,
  ShieldCheck,
  Layers,
  ChevronRight,
  Info,
  Sun,
} from "lucide-react";
import {
  weeklyMenusApi,
  AutoGeneratePayload,
  AutoGeneratePreviewResponse,
  WeeklyMenu,
} from "../api/weekly-menus.api";
import {
  nutritionEngineApi,
  MealDistributionOverview,
} from "../api/nutrition-rule-engine.api";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";

interface AutoGenerateMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMenu: WeeklyMenu) => void;
  currentMenu?: WeeklyMenu | null;
  existingMenus?: WeeklyMenu[];
}

export const AutoGenerateMenuModal: React.FC<AutoGenerateMenuModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentMenu,
  existingMenus = [],
}) => {
  useLanguage();
  const schoolBranding = useSchoolBranding();
  const schoolMealTimes = schoolBranding.operationalSettings?.mealTimes || [
    "BREAKFAST",
    "LUNCH",
    "AFTERNOON_SNACK",
    "LATE_SNACK",
  ];
  const schoolHasBreakfast = schoolMealTimes.includes("BREAKFAST");
  const schoolHasLunch = schoolMealTimes.includes("LUNCH");
  const schoolHasAfternoonSnack = schoolMealTimes.includes("AFTERNOON_SNACK");
  const schoolHasLateSnack = schoolMealTimes.includes("LATE_SNACK");
  const cycleWeeks =
    Number(schoolBranding.operationalSettings?.standardWeeklyCycleLength) || 2;
  const defaultExcludeDays = cycleWeeks * 7;

  // Form State
  const [targetAgeGroup, setTargetAgeGroup] = useState<
    "KINDERGARTEN_3_5Y" | "TODDLER_18_36M"
  >("KINDERGARTEN_3_5Y");
  const [daysCount, setDaysCount] = useState<number>(5);
  const [cycleWeekNumber, setCycleWeekNumber] = useState<number>(() => {
    return currentMenu?.cycleWeekNumber
      ? currentMenu.cycleWeekNumber + 1
      : 1;
  });
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [excludePreviousDays, setExcludePreviousDays] =
    useState<number>(defaultExcludeDays);
  const [academicYear, setAcademicYear] = useState<Awaited<ReturnType<typeof weeklyMenusApi.getAcademicYearContext>>>(null);
  const [yearLoading, setYearLoading] = useState(true);
  const [mealDistributionOverview, setMealDistributionOverview] =
    useState<MealDistributionOverview | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const dbAgeGroup = targetAgeGroup === "TODDLER_18_36M" ? "NHA_TRE" : "MAU_GIAO";
    nutritionEngineApi
      .getMealDistributionOverview(dbAgeGroup)
      .then((data) => {
        if (!cancelled) setMealDistributionOverview(data);
      })
      .catch(() => {
        if (!cancelled) setMealDistributionOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, targetAgeGroup]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setYearLoading(true);
    weeklyMenusApi.getAcademicYearContext().then((year) => {
      if (!cancelled) setAcademicYear(year);
    }).catch(() => {
      if (!cancelled) setAcademicYear(null);
    }).finally(() => {
      if (!cancelled) setYearLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen]);
  // Đồng bộ chu kỳ khi mở modal hoặc khi cấu hình trường thay đổi
  useEffect(() => {
    if (isOpen) {
      setExcludePreviousDays(cycleWeeks * 7);
    }
  }, [isOpen, cycleWeeks]);

  // Preview & Processing State
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewData, setPreviewData] =
    useState<AutoGeneratePreviewResponse | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hàm kiểm tra xem khoảng ngày [start, end] có trùng với thực đơn đã có hay không
  const findOverlappingMenu = (
    start: string,
    end: string,
    ageGroup: string,
  ): WeeklyMenu | null => {
    if (!start || !end || !existingMenus || existingMenus.length === 0)
      return null;
    const s = start.split("T")[0];
    const e = end.split("T")[0];
    return (
      existingMenus.find((m) => {
        if (m.status === "REJECTED" || m.status === "ARCHIVED") return false;
        const mS = m.startDate?.split("T")[0];
        const mE = m.endDate?.split("T")[0];
        if (!mS || !mE) return false;
        // Kiểm tra giao khoảng thời gian: s <= mE && e >= mS
        const isOverlapDates = s <= mE && e >= mS;
        if (!isOverlapDates) return false;

        // Kiểm tra nhóm tuổi
        if (ageGroup === "ALL_AGES" || m.targetAgeGroup === "ALL_AGES")
          return true;
        const isToddler1 = ageGroup === "TODDLER_18_36M";
        const isToddler2 = m.targetAgeGroup === "TODDLER_18_36M";
        return isToddler1 === isToddler2;
      }) || null
    );
  };

  const conflictingMenu = findOverlappingMenu(
    startDate,
    endDate,
    targetAgeGroup,
  );

  // Chuyển sang tuần tiếp theo (+7 ngày)
  const handleJumpToNextWeek = () => {
    const baseDate = startDate ? new Date(startDate) : new Date();
    baseDate.setDate(baseDate.getDate() + 7);
    const newMonStr = baseDate.toISOString().split("T")[0];

    const fri = new Date(baseDate);
    fri.setDate(baseDate.getDate() + 4);
    const newFriStr = fri.toISOString().split("T")[0];

    const nextWeek = cycleWeekNumber + 1;
    setStartDate(newMonStr);
    setEndDate(newFriStr);
    setCycleWeekNumber(nextWeek);
    setTitle(
      `Thực đơn Bán trú Tuần ${nextWeek} (${targetAgeGroup === "KINDERGARTEN_3_5Y" ? "Mẫu giáo" : "Nhà trẻ"})`,
    );
    setPreviewData(null);
    setErrorMsg(null);
  };

  // Khởi tạo ngày: Tự động bắt đầu với chu kỳ mới nhất từ danh sách thực đơn đã có
  useEffect(() => {
    if (isOpen && !yearLoading) {
      const validMenus = (existingMenus || []).filter(
        (m) => {
          if (m.status === "REJECTED" || m.status === "ARCHIVED") return false;
          if (academicYear) {
            const start = m.startDate?.slice(0, 10);
            const end = m.endDate?.slice(0, 10);
            return Boolean(start && end && start >= academicYear.startDate && end <= academicYear.endDate);
          }
          return true;
        },
      );

      // Lọc các thực đơn cùng nhóm tuổi nếu có
      const isTargetToddler = targetAgeGroup === "TODDLER_18_36M";
      const sameAgeMenus = validMenus.filter((m) => {
        if (!m.targetAgeGroup || m.targetAgeGroup === "ALL_AGES") return true;
        const isMageToddler =
          m.targetAgeGroup === "TODDLER_18_36M" || m.targetAgeGroup === "NHA_TRE";
        return isMageToddler === isTargetToddler;
      });

      const poolMenus = sameAgeMenus;

      let latestMenu: WeeklyMenu | null = null;
      let latestEndMs = 0;
      let maxWeekNum = 0;

      for (const m of poolMenus) {
        const endStr = m.endDate || m.startDate;
        if (endStr) {
          const ms = new Date(endStr).getTime();
          if (ms > latestEndMs) {
            latestEndMs = ms;
            latestMenu = m;
          }
        }
        let w = m.cycleWeekNumber || 0;
        if (!w && m.title) {
          const match = m.title.match(/Tuần\s*(\d+)/i);
          if (match) w = parseInt(match[1], 10);
        }
        if (w > maxWeekNum) maxWeekNum = w;
      }

      let chosenMonDate: Date;
      let nextWeekNumber: number;

      if (latestMenu && latestEndMs > 0) {
        // Lấy ngày Thứ Hai ngay sau ngày kết thúc của thực đơn mới nhất
        const lastEnd = new Date(latestMenu.endDate || latestMenu.startDate);
        const nextMon = new Date(lastEnd);
        do {
          nextMon.setDate(nextMon.getDate() + 1);
        } while (nextMon.getDay() !== 1);
        chosenMonDate = nextMon;

        nextWeekNumber = maxWeekNum > 0 ? maxWeekNum + 1 : 1;
      } else {
        // Dự phòng khi chưa có thực đơn nào: Thứ Hai tới gần nhất
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const anchor = academicYear && (today < academicYear.startDate || today > academicYear.endDate)
          ? academicYear.startDate : today;
        const nextMon = new Date(`${anchor}T00:00:00Z`);
        const day = nextMon.getUTCDay();
        const diffToMonday = anchor !== today ? (8 - day) % 7 : ((8 - day) % 7 || 7);
        nextMon.setUTCDate(nextMon.getUTCDate() + diffToMonday);
        chosenMonDate = nextMon;
        nextWeekNumber = 1;
      }

      const chosenMonStr = chosenMonDate.toISOString().split("T")[0];
      const endD = new Date(chosenMonDate);
      endD.setDate(chosenMonDate.getDate() + 4);
      const chosenFriStr = endD.toISOString().split("T")[0];

      setStartDate(chosenMonStr);
      setEndDate(chosenFriStr);
      setCycleWeekNumber(nextWeekNumber);
      setTitle(
        `Thực đơn Bán trú Tuần ${nextWeekNumber} (${targetAgeGroup === "KINDERGARTEN_3_5Y" ? "Mẫu giáo" : "Nhà trẻ"})`,
      );
      setPreviewData(null);
      setErrorMsg(null);
    }
  }, [isOpen, daysCount, targetAgeGroup, existingMenus, academicYear, yearLoading]);

  // Handle DaysCount change -> update endDate
  const handleDaysCountChange = (count: number) => {
    setDaysCount(count);
    if (startDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (count === 6 ? 5 : 4));
      setEndDate(d.toISOString().split("T")[0]);
    }
  };

  // Generate / Preview Menu
  const handleGeneratePreview = async () => {
    if (conflictingMenu) {
      setErrorMsg(
        `Không thể tạo thực đơn! Khoảng thời gian từ ${startDate} đến ${endDate} đã có thực đơn "${conflictingMenu.title}" (${conflictingMenu.status}). Vui lòng bấm 'Chuyển sang Tuần kế tiếp' để chọn tuần trống.`,
      );
      return;
    }

    try {
      setLoadingPreview(true);
      setErrorMsg(null);

      const payload: AutoGeneratePayload = {
        title,
        targetAgeGroup,
        startDate,
        endDate,
        daysCount,
        cycleWeekNumber,
        excludePreviousDays,
        includeBreakfast: schoolHasBreakfast,
        includeLunch: schoolHasLunch,
        includeAfternoonSnack: schoolHasAfternoonSnack,
        previewOnly: true,
      };

      const res = await weeklyMenusApi.previewAutoGenerateMenu(payload);
      setPreviewData(res);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message ||
        "Không thể tạo bản xem trước thực đơn. Vui lòng kiểm tra lại dữ liệu món ăn.",
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  // Save to Database
  const handleSaveMenu = async () => {
    if (conflictingMenu) {
      setErrorMsg(
        `Không thể lưu thực đơn trùng thời gian với "${conflictingMenu.title}"! Vui lòng chọn tuần khác.`,
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      const payload: AutoGeneratePayload = {
        title,
        targetAgeGroup,
        startDate,
        endDate,
        daysCount,
        cycleWeekNumber,
        excludePreviousDays,
        includeBreakfast: schoolHasBreakfast,
        includeLunch: schoolHasLunch,
        includeAfternoonSnack: schoolHasAfternoonSnack,
        previewOnly: false,
        dailyPlan: previewData?.dailySummary,
      };

      const newMenu = await weeklyMenusApi.autoGenerateMenu(payload);
      onSuccess(newMenu);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message ||
        "Lỗi khi lưu thực đơn vào cơ sở dữ liệu.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div
          style={{ backgroundColor: "#064e3b" }}
          className="bg-emerald-900 bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900 text-white p-5 sm:p-6 shrink-0 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
              <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{translateText("Tạo Thực Đơn Bán Trú Tự Động")}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-400/25 border border-emerald-300/40 text-emerald-200">{translateText("Gợi ý theo quy tắc")}</span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-0.5">{translateText("Tạo ứng viên từ món ăn, công thức và quy tắc đã cấu hình. Kiểm tra kết quả trước khi gửi phê duyệt.")}</p>
            </div>
          </div>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{translateText(errorMsg)}</span>
            </div>
          )}

          {/* 1. Configuration Panel */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>{translateText("Thiết lập thông số thực đơn tuần")}</span>
            </div>

            {academicYear && (
              <p className="text-xs text-slate-600">
                Năm học {academicYear.name} (đang áp dụng) · Gợi ý tuần phục vụ theo năm học.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tên thực đơn */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">{translateText("Tên thực đơn tuần")}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={translateText("Nhập tên thực đơn tuần...")}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Nhóm tuổi */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">{translateText("Khối mầm non")}</label>
                <select
                  value={targetAgeGroup}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setTargetAgeGroup(val);
                    setTitle(
                      `Thực đơn Bán trú Tuần ${cycleWeekNumber} · ${val === "KINDERGARTEN_3_5Y" ? "Mẫu giáo" : "Nhà trẻ"}`,
                    );
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="KINDERGARTEN_3_5Y">
                    {mealDistributionOverview?.totals?.atSchool?.energyKcal
                      ? `Mẫu giáo 3–6 tuổi · ${Math.round(mealDistributionOverview.totals.atSchool.energyKcal.min)}–${Math.round(mealDistributionOverview.totals.atSchool.energyKcal.max)} Kcal`
                      : translateText("Mẫu giáo 3–6 tuổi · 615–726 Kcal")}
                  </option>
                </select>
              </div>

              {/* Số ngày bán trú */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">{translateText("Số ngày bán trú")}</label>
                <div className="w-full h-[38px] px-3 text-xs font-bold rounded-xl border border-emerald-600 bg-emerald-600 text-white shadow-xs flex items-center justify-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {translateText("5 ngày (T2 - T6)")}
                </div>
              </div>

              {/* Ngày bắt đầu */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">{translateText("Ngày bắt đầu (Thứ 2)")}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (val) {
                      const d = new Date(val);
                      d.setDate(d.getDate() + 4);
                      setEndDate(d.toISOString().split("T")[0]);
                    }
                  }}
                  className="w-full h-[38px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Ngày kết thúc */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">{translateText("Ngày kết thúc (Thứ 6)")}</label>
                <input
                  type="date"
                  value={endDate}
                  readOnly
                  disabled
                  className="w-full h-[38px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600 cursor-not-allowed"
                />
              </div>

              {/* Quy tắc chống ngán */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">{translateText("Quy tắc chống ngán theo cấu hình trường")}</label>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold h-[38px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{translateText(`Cách ly ${cycleWeeks} tuần · `)}{excludePreviousDays}{translateText(" ngày không lặp món tuần trước")}</span>
                </div>
              </div>

              {/* Cảnh báo nếu trùng lặp thời gian với thực đơn đã có */}
              {conflictingMenu && (
                <div className="sm:col-span-2 lg:col-span-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <span className="font-black text-rose-800 uppercase tracking-wider text-[11px] block">{translateText("Trùng lặp thời gian thực đơn")}</span>
                      <span className="text-rose-700 font-medium text-xs">{translateText("Khoảng thời gian từ ")}<strong>{translateText(startDate)}</strong>{translateText(" đến")}{" "}
                        <strong>{translateText(endDate)}</strong>{translateText(" đã có thực đơn:")}{" "}
                        <strong className="underline">
                          {translateText(conflictingMenu.title)}
                        </strong>{" "}{translateText("(Trạng thái: ")}{translateText(conflictingMenu.status)}).
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleJumpToNextWeek}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{translateText("Chuyển sang Tuần kế tiếp (+7 ngày)")}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Nút Kích hoạt Sinh Thực đơn & Xem Trước */}
            <div className="pt-2 flex items-center justify-between">
              {conflictingMenu ? (
                <div className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{translateText("Không thể tạo do trùng khoảng thời gian với thực đơn đã có")}</span>
                </div>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={yearLoading || loadingPreview || Boolean(conflictingMenu)}
                className={`px-5 py-2.5 rounded-2xl text-white text-xs font-bold shadow-md flex items-center gap-2 transition cursor-pointer ${conflictingMenu
                  ? "bg-slate-400 opacity-60 cursor-not-allowed"
                  : "bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25"
                  }`}
              >
                {loadingPreview ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>{translateText("Đang phối món & tối ưu dinh dưỡng...")}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {translateText(previewData
                        ? "Xáo lại phương án khác (Re-shuffle)"
                        : "Phối Món Tự Động & Xem Trước")}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Live Preview Section */}
          {previewData && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              {/* Thẻ Báo cáo Thống kê Chuẩn */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/70 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white p-4 rounded-2xl border border-emerald-200/90 shadow-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">{translateText("Năng lượng TB / ngày")}</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-slate-900">
                      {previewData.averageCalories}{translateText(" Kcal")}
                    </span>
                    <span className="text-[9.5px] font-extrabold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                      QĐ 1
                    </span>
                  </div>
                  <div className="text-[10.5px] font-bold text-amber-800 mt-1 flex items-center gap-1">
                    <span>QĐ 2 (khi thêm ăn xế):</span>
                    <strong className="text-amber-950 font-black">
                      {previewData.averageCalories +
                        Math.round(
                          previewData.dailySummary.reduce((sum, d) => {
                            const sc = d.dishes
                              .filter((x) => x.mealTime === "LATE_SNACK")
                              .reduce((s, x) => s + (Number(x.plannedCalories) || 0), 0);
                            return sum + sc;
                          }, 0) / (previewData.dailySummary.length || 1),
                        )}{" "}
                      Kcal
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">{translateText("Cơ cấu P : L : G trung bình")}</span>
                  {previewData.qd1Averages && previewData.qd2Averages ? (
                    <div className="space-y-1 mt-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-teal-800">QĐ 1:</span>
                        <span className="font-black text-slate-800">
                          {previewData.qd1Averages.proteinPct}% : {previewData.qd1Averages.lipidPct}% : {previewData.qd1Averages.glucidPct}%
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-medium leading-none">
                        {previewData.qd1Averages.proteinG}g Đ • {previewData.qd1Averages.fatG}g B • {previewData.qd1Averages.carbG}g G
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                        <span className="font-extrabold text-amber-900">QĐ 2 (+xế):</span>
                        <span className="font-black text-slate-800">
                          {previewData.qd2Averages.proteinPct}% : {previewData.qd2Averages.lipidPct}% : {previewData.qd2Averages.glucidPct}%
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-medium leading-none">
                        {previewData.qd2Averages.proteinG}g Đ • {previewData.qd2Averages.fatG}g B • {previewData.qd2Averages.carbG}g G
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-base font-extrabold text-slate-800">
                        {translateText("P: ")}{previewData.averageProteinG}{translateText("g • L:")}{" "}
                        {previewData.averageFatG}{translateText("g • G: ")}{previewData.averageCarbG}{translateText("g")}
                      </span>
                      <span className="text-[10px] text-teal-700 font-bold block mt-0.5">{translateText("Cân đối RDA 2024")}</span>
                    </>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">{translateText("Độ đa dạng món ăn")}</span>
                  <span className="text-xl font-black text-slate-900">
                    {previewData.antiFatigueReport.uniqueDishesUsed}{translateText(" món duy nhất")}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">{translateText("0 món trùng lặp giữa các ngày")}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">{translateText(`Chu kỳ ${cycleWeeks} tuần`)}</span>
                  <span className="text-base font-extrabold text-emerald-800">{translateText("Không lặp lại món")}</span>
                  <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                    {translateText(previewData.antiFatigueReport.cycleCompliance)}
                  </span>
                </div>
              </div>

              {/* Thanh chỉ dẫn 2 Quy định Thực đơn Calo */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-slate-800 text-[11px]">{translateText("So sánh 2 Quy định:")}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-bold text-[10.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                    {translateText("Quy định 1: Thực đơn bán trú tiêu chuẩn (50–55% Kcal)")}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-bold text-[10.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                    {translateText("Quy định 2: Tự động cộng món ăn xế khi phụ huynh đóng tiền (60–70% Kcal)")}
                  </span>
                </div>
              </div>

              {/* Bảng Ma Trận Các Ngày Trong Tuần */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div
                  className={`grid grid-cols-1 ${daysCount === 6 ? "sm:grid-cols-6" : "sm:grid-cols-5"} divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-white`}
                >
                  {previewData.dailySummary.map((day) => {
                    const qd1Dishes = day.dishes.filter((d) => d.mealTime !== "LATE_SNACK");
                    const dayQd1Calo = day.qd1Nutrition?.calories ?? Math.round(
                      qd1Dishes.reduce((sum, d) => sum + (Number(d.plannedCalories) || 0), 0) * 10,
                    ) / 10;
                    const dayQd1Prot = day.qd1Nutrition?.proteinG ?? Math.round(
                      qd1Dishes.reduce((sum, d) => sum + (Number(d.proteinG) || 0), 0) * 10,
                    ) / 10;
                    const dayQd1Fat = day.qd1Nutrition?.fatG ?? Math.round(
                      qd1Dishes.reduce((sum, d) => sum + (Number(d.fatG) || 0), 0) * 10,
                    ) / 10;
                    const dayQd1Carb = day.qd1Nutrition?.carbG ?? Math.round(
                      qd1Dishes.reduce((sum, d) => sum + (Number(d.carbG) || 0), 0) * 10,
                    ) / 10;
                    const qd1MacroSum = dayQd1Prot * 4 + dayQd1Fat * 9 + dayQd1Carb * 4 || dayQd1Calo || 1;
                    const dayQd1PPct = day.qd1Nutrition?.proteinPct ?? Math.round(((dayQd1Prot * 4) / qd1MacroSum) * 1000) / 10;
                    const dayQd1LPct = day.qd1Nutrition?.lipidPct ?? Math.round(((dayQd1Fat * 9) / qd1MacroSum) * 1000) / 10;
                    const dayQd1CPct = day.qd1Nutrition?.glucidPct ?? Math.max(0, Math.round((100 - dayQd1PPct - dayQd1LPct) * 10) / 10);

                    const lateSnackDishes = day.dishes.filter((d) => d.mealTime === "LATE_SNACK");
                    const dayLateSnackCalo = day.lateSnackNutrition?.calories ?? Math.round(
                      lateSnackDishes.reduce((sum, d) => sum + (Number(d.plannedCalories) || 0), 0) * 10,
                    ) / 10;
                    const dayLateSnackProt = day.lateSnackNutrition?.proteinG ?? Math.round(
                      lateSnackDishes.reduce((sum, d) => sum + (Number(d.proteinG) || 0), 0) * 10,
                    ) / 10;
                    const dayLateSnackFat = day.lateSnackNutrition?.fatG ?? Math.round(
                      lateSnackDishes.reduce((sum, d) => sum + (Number(d.fatG) || 0), 0) * 10,
                    ) / 10;
                    const dayLateSnackCarb = day.lateSnackNutrition?.carbG ?? Math.round(
                      lateSnackDishes.reduce((sum, d) => sum + (Number(d.carbG) || 0), 0) * 10,
                    ) / 10;

                    const dayQd2Calo = day.qd2Nutrition?.calories ?? Math.round((dayQd1Calo + dayLateSnackCalo) * 10) / 10;
                    const dayQd2Prot = day.qd2Nutrition?.proteinG ?? Math.round((dayQd1Prot + dayLateSnackProt) * 10) / 10;
                    const dayQd2Fat = day.qd2Nutrition?.fatG ?? Math.round((dayQd1Fat + dayLateSnackFat) * 10) / 10;
                    const dayQd2Carb = day.qd2Nutrition?.carbG ?? Math.round((dayQd1Carb + dayLateSnackCarb) * 10) / 10;
                    const qd2MacroSum = dayQd2Prot * 4 + dayQd2Fat * 9 + dayQd2Carb * 4 || dayQd2Calo || 1;
                    const dayQd2PPct = day.qd2Nutrition?.proteinPct ?? Math.round(((dayQd2Prot * 4) / qd2MacroSum) * 1000) / 10;
                    const dayQd2LPct = day.qd2Nutrition?.lipidPct ?? Math.round(((dayQd2Fat * 9) / qd2MacroSum) * 1000) / 10;
                    const dayQd2CPct = day.qd2Nutrition?.glucidPct ?? Math.max(0, Math.round((100 - dayQd2PPct - dayQd2LPct) * 10) / 10);

                    const isQd1Compliant = dayQd1Calo >= 615 && dayQd1Calo <= 726;
                    const isQd2Compliant = dayQd2Calo >= 765 && dayQd2Calo <= 926;

                    return (
                      <div
                        key={day.dayOfWeek}
                        className="flex flex-col justify-between p-3.5 space-y-3"
                      >
                        {/* Tiêu đề ngày & 2 Chỗ hiển thị Calo Quy định 1 & Quy định 2 */}
                        <div className="border-b border-slate-100 pb-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              {day.dayName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {day.dishes.length} món
                            </span>
                          </div>

                          {/* 2 Chỗ hiển thị Calo */}
                          <div className="space-y-1">
                            {/* Chỗ 1: Quy định 1 (Bán trú tiêu chuẩn) */}
                            <div
                              className={`flex items-center justify-between px-2 py-1 rounded-lg border text-[10px] ${isQd1Compliant
                                ? "bg-teal-50 border-teal-200/90 text-teal-950"
                                : dayQd1Calo < 615
                                  ? "bg-amber-50 border-amber-300 text-amber-950"
                                  : "bg-rose-50 border-rose-300 text-rose-950"
                                }`}
                            >
                              <span className="font-bold flex items-center gap-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isQd1Compliant ? "bg-teal-600" : "bg-amber-500"
                                    }`}
                                ></span>
                                {translateText("Quy định 1:")}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="font-black">
                                  {dayQd1Calo} Kcal
                                </span>
                                {isQd1Compliant ? (
                                  <span className="text-[8.5px] px-1 py-0.2 rounded bg-teal-100/80 text-teal-800 font-bold">
                                    {translateText("Đạt")}
                                  </span>
                                ) : (
                                  <span
                                    className="text-[8.5px] px-1 py-0.2 rounded bg-amber-200 text-amber-900 font-bold"
                                    title={translateText("Chuẩn 615–726 Kcal")}
                                  >
                                    {dayQd1Calo < 615 ? translateText("Thiếu") : translateText("Vượt")}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Chỗ 2: Quy định 2 khi thêm ăn xế */}
                            <div
                              className={`flex items-center justify-between px-2 py-1 rounded-lg border text-[10px] ${isQd2Compliant
                                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                                : dayQd2Calo < 765
                                  ? "bg-orange-50 border-orange-300 text-orange-950"
                                  : "bg-rose-50 border-rose-300 text-rose-950"
                                }`}
                            >
                              <span className="font-bold flex items-center gap-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isQd2Compliant ? "bg-emerald-600" : "bg-orange-500 animate-pulse"
                                    }`}
                                ></span>
                                {translateText("QĐ 2 (+Ăn xế):")}
                              </span>
                              <div className="flex items-center gap-1">
                                {dayLateSnackCalo > 0 && (
                                  <span className="text-[9px] font-semibold text-orange-700">
                                    (+{dayLateSnackCalo})
                                  </span>
                                )}
                                <span className="font-black">
                                  {dayQd2Calo} Kcal
                                </span>
                                {isQd2Compliant ? (
                                  <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                                    {translateText("Đạt")}
                                  </span>
                                ) : (
                                  <span
                                    className="text-[8.5px] px-1 py-0.2 rounded bg-orange-200 text-orange-900 font-bold"
                                    title={translateText("Chuẩn 765–926 Kcal")}
                                  >
                                    {dayQd2Calo < 765 ? translateText("Thiếu") : translateText("Vượt")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[9.5px] font-bold block mt-0.5 truncate ${day.isCompliant ? "text-emerald-600" : "text-amber-700"
                              }`}
                            title={day.standardNote}
                          >
                            {translateText(
                              day.standardNote
                                .replace(/^[✅⚠️\s]+/, "")
                                .replace(/[A-Z_]+:\s*/g, "")
                                .replace(/\s*\([^)]*\)/g, ""),
                            )}
                          </span>
                        </div>

                        {/* Buổi Sáng · 09:00 */}
                        {day.dishes.some((d) => d.mealTime === "BREAKFAST" || d.mealTime === "MORNING_SNACK") && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-black text-amber-800">
                              <Sun className="w-3 h-3 text-amber-600" />
                              <span>{translateText("BUỔI SÁNG · 09:00 (MÓN NƯỚC)")}</span>
                            </div>
                            <div className="space-y-1 text-[11px]">
                              {day.dishes
                                .filter((d) => d.mealTime === "BREAKFAST" || d.mealTime === "MORNING_SNACK")
                                .map((dish, idx) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 rounded-lg bg-amber-50/70 border border-amber-200/70 text-slate-800 text-[10.5px]"
                                  >
                                    <span className="font-semibold block leading-tight">
                                      {dish.dishName}
                                    </span>
                                    <span className="text-[9.5px] text-amber-700 font-medium">
                                      {dish.portionSizeG}{translateText("g •")}{" "}
                                      {dish.plannedCalories}{translateText(" Kcal")}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Bữa Trưa Chính · 11:00 */}
                        {day.dishes.some((d) => d.mealTime === "LUNCH") && (
                          <div className="space-y-1.5 border-t border-slate-100 pt-2 flex-1">
                            <div className="flex items-center gap-1 text-[10px] font-black text-teal-800">
                              <Utensils className="w-3 h-3 text-teal-600" />
                              <span>{translateText("BỮA TRƯA CHÍNH · 11:00")}</span>
                            </div>
                            <div className="space-y-1 text-[11px]">
                              {day.dishes
                                .filter((d) => d.mealTime === "LUNCH")
                                .map((dish, idx) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 rounded-lg bg-slate-50 border border-slate-100/90 text-slate-800 text-[10.5px]"
                                  >
                                    <span className="font-semibold block leading-tight">
                                      {dish.dishName}
                                    </span>
                                    <span className="text-[9.5px] text-slate-400 font-medium">
                                      {dish.portionSizeG}{translateText("g • ")}{dish.plannedCalories}{" "}{translateText("Kcal")}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Buổi Phụ · 14:30 */}
                        {day.dishes.some((d) => d.mealTime === "AFTERNOON_SNACK") && (
                          <div className="space-y-1.5 border-t border-slate-100 pt-2">
                            <div className="flex items-center gap-1 text-[10px] font-black text-purple-800">
                              <Coffee className="w-3 h-3 text-purple-600" />
                              <span>{translateText("BUỔI PHỤ · 14:30")}</span>
                            </div>
                            <div className="space-y-1 text-[11px]">
                              {day.dishes
                                .filter((d) => d.mealTime === "AFTERNOON_SNACK")
                                .map((dish, idx) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 rounded-lg bg-purple-50/50 border border-purple-100/80 text-slate-800 text-[10.5px]"
                                  >
                                    <span className="font-semibold block leading-tight">
                                      {dish.dishName}
                                    </span>
                                    <span className="text-[9.5px] text-slate-400 font-medium">
                                      {dish.portionSizeG}{translateText("g • ")}{dish.plannedCalories}{" "}{translateText("Kcal")}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Buổi Chiều Xế · 17:00 */}
                        {day.dishes.some((d) => d.mealTime === "LATE_SNACK") && (
                          <div className="space-y-1.5 border-t border-slate-100 pt-2">
                            <div className="flex items-center justify-between text-[10px] font-black text-orange-800">
                              <div className="flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-600" />
                                <span>{translateText("BUỔI CHIỀU XẾ · 17:00 (MÓN NƯỚC)")}</span>
                              </div>
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-900 border border-orange-200">
                                {translateText("QĐ 2 (Ăn xế)")}
                              </span>
                            </div>
                            <div className="space-y-1 text-[11px]">
                              {day.dishes
                                .filter((d) => d.mealTime === "LATE_SNACK")
                                .map((dish, idx) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 rounded-lg bg-orange-50/60 border border-orange-200/70 text-slate-800 text-[10.5px]"
                                  >
                                    <span className="font-semibold block leading-tight">
                                      {dish.dishName}
                                    </span>
                                    <span className="text-[9.5px] text-orange-700 font-medium">
                                      {dish.portionSizeG}{translateText("g • ")}{dish.plannedCalories}{" "}{translateText("Kcal")}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Dinh Dưỡng Cuối Cột Của Ngày - Tách bạch rõ ràng 2 Quy định */}
                        <div className="pt-2 border-t border-slate-200 text-[10px] space-y-2 bg-slate-50/90 -mx-3.5 -mb-3.5 p-2.5">
                          {/* Khối QĐ 1: Bán trú tiêu chuẩn không xế */}
                          <div className="p-2 rounded-xl bg-white border border-teal-200/90 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-black text-teal-950">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                                {translateText("QĐ 1 (Tiêu chuẩn):")}
                              </span>
                              <span className="bg-teal-50 text-teal-800 px-1 py-0.2 rounded border border-teal-200 text-[9.5px]">
                                {dayQd1Calo} Kcal
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-600">
                              <span>{translateText("Đạm:")} <strong className="text-blue-900">{dayQd1Prot}g</strong></span>
                              <span>{translateText("Béo:")} <strong className="text-amber-900">{dayQd1Fat}g</strong></span>
                              <span>{translateText("Đường:")} <strong className="text-purple-900">{dayQd1Carb}g</strong></span>
                            </div>
                            <div className="text-[9px] font-black text-slate-700 flex justify-between pt-0.5">
                              <span>{translateText("P:L:G")}</span>
                              <span>{dayQd1PPct}% : {dayQd1LPct}% : {dayQd1CPct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200">
                              <div style={{ width: `${dayQd1PPct}%` }} className="bg-blue-500 h-full" title={`Protein ${dayQd1PPct}%`} />
                              <div style={{ width: `${dayQd1LPct}%` }} className="bg-amber-500 h-full" title={`Lipid ${dayQd1LPct}%`} />
                              <div style={{ width: `${dayQd1CPct}%` }} className="bg-purple-500 h-full" title={`Glucid ${dayQd1CPct}%`} />
                            </div>
                          </div>

                          {/* Khối QĐ 2: Có thêm ăn xế chiều */}
                          <div className="p-2 rounded-xl bg-amber-50/50 border border-amber-200/90 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-black text-amber-950">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                {translateText("QĐ 2 (+Ăn xế):")}
                              </span>
                              <span className="bg-amber-100/70 text-amber-900 px-1 py-0.2 rounded border border-amber-300 text-[9.5px]">
                                {dayQd2Calo} Kcal
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-600">
                              <span>{translateText("Đạm:")} <strong className="text-blue-900">{dayQd2Prot}g</strong></span>
                              <span>{translateText("Béo:")} <strong className="text-amber-900">{dayQd2Fat}g</strong></span>
                              <span>{translateText("Đường:")} <strong className="text-purple-900">{dayQd2Carb}g</strong></span>
                            </div>
                            <div className="text-[9px] font-black text-slate-700 flex justify-between pt-0.5">
                              <span>{translateText("P:L:G")}</span>
                              <span>{dayQd2PPct}% : {dayQd2LPct}% : {dayQd2CPct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200">
                              <div style={{ width: `${dayQd2PPct}%` }} className="bg-blue-500 h-full" title={`Protein ${dayQd2PPct}%`} />
                              <div style={{ width: `${dayQd2LPct}%` }} className="bg-amber-500 h-full" title={`Lipid ${dayQd2LPct}%`} />
                              <div style={{ width: `${dayQd2CPct}%` }} className="bg-purple-500 h-full" title={`Glucid ${dayQd2CPct}%`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{translateText("Thực đơn tạo ra sẽ ở trạng thái")}{" "}
              <strong>{translateText("Bản dự thảo (DRAFT)")}</strong>{translateText(" để chuyên viên tinh chỉnh nếu cần.")}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
            >{translateText("Hủy bỏ")}</button>

            {previewData && (
              <button
                type="button"
                onClick={handleSaveMenu}
                disabled={yearLoading || saving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>{translateText("Đang lưu vào hệ thống...")}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{translateText("Xác Nhận & Lưu Thực Đơn")}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
