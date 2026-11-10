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
  ];
  const schoolHasBreakfast = schoolMealTimes.includes("BREAKFAST");
  const schoolHasLunch = schoolMealTimes.includes("LUNCH");
  const schoolHasAfternoonSnack = schoolMealTimes.includes("AFTERNOON_SNACK");
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
      `Thực đơn Bán trú Thông minh Tuần ${nextWeek} (${targetAgeGroup === "KINDERGARTEN_3_5Y" ? "Mẫu giáo" : "Nhà trẻ"})`,
    );
    setPreviewData(null);
    setErrorMsg(null);
  };

  // Khởi tạo ngày: Tự động bắt đầu với chu kỳ mới nhất từ danh sách thực đơn đã có
  useEffect(() => {
    if (isOpen) {
      const validMenus = (existingMenus || []).filter(
        (m) => m.status !== "REJECTED" && m.status !== "ARCHIVED",
      );

      // Lọc các thực đơn cùng nhóm tuổi nếu có
      const isTargetToddler = targetAgeGroup === "TODDLER_18_36M";
      const sameAgeMenus = validMenus.filter((m) => {
        if (!m.targetAgeGroup || m.targetAgeGroup === "ALL_AGES") return true;
        const isMageToddler =
          m.targetAgeGroup === "TODDLER_18_36M" || m.targetAgeGroup === "NHA_TRE";
        return isMageToddler === isTargetToddler;
      });

      const poolMenus = sameAgeMenus.length > 0 ? sameAgeMenus : validMenus;

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
        const day = now.getDay();
        const diffToMonday = day === 0 ? 1 : (8 - day) % 7 || 7;
        const nextMon = new Date(now);
        nextMon.setDate(now.getDate() + diffToMonday);
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
        `Thực đơn Bán trú Thông minh Tuần ${nextWeekNumber} (${targetAgeGroup === "KINDERGARTEN_3_5Y" ? "Mẫu giáo" : "Nhà trẻ"})`,
      );
      setPreviewData(null);
      setErrorMsg(null);
    }
  }, [isOpen, daysCount, targetAgeGroup, existingMenus]);

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
                      `Thực đơn Bán trú Thông minh Tuần ${cycleWeekNumber} (${val === "KINDERGARTEN_3_5Y" ? "Mẫu giáo" : "Nhà trẻ"})`,
                    );
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="KINDERGARTEN_3_5Y">{translateText("Mẫu giáo (3 - 6 tuổi: 615 - 726 Kcal)")}</option>
                  <option value="TODDLER_18_36M">{translateText("Nhà trẻ (18 - 36 tháng: 500 - 650 Kcal)")}</option>
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
                <label className="text-[11px] font-bold text-slate-600 block mb-1">{translateText("Quy tắc chống ngán (Từ cấu hình trường)")}</label>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold h-[38px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{translateText(`Cách ly ${cycleWeeks} tuần (`)}{excludePreviousDays}{translateText(" ngày - không lặp món tuần trước)")}</span>
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
                disabled={loadingPreview || Boolean(conflictingMenu)}
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
                  <span className="text-xl font-black text-slate-900">
                    {previewData.averageCalories}{translateText(" Kcal")}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                    {translateText(previewData.antiFatigueReport.standardEvaluation)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">{translateText("Cơ cấu P : L : G trung bình")}</span>
                  <span className="text-base font-extrabold text-slate-800">{translateText("P: ")}{previewData.averageProteinG}{translateText("g • L:")}{" "}
                    {previewData.averageFatG}{translateText("g • G: ")}{previewData.averageCarbG}{translateText("g")}</span>
                  <span className="text-[10px] text-teal-700 font-bold block mt-0.5">{translateText("Cân đối RDA 2024")}</span>
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

              {/* Bảng Ma Trận Các Ngày Trong Tuần */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div
                  className={`grid grid-cols-1 ${daysCount === 6 ? "sm:grid-cols-6" : "sm:grid-cols-5"} divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-white`}
                >
                  {previewData.dailySummary.map((day) => (
                    <div
                      key={day.dayOfWeek}
                      className="flex flex-col justify-between p-3.5 space-y-3"
                    >
                      {/* Tiêu đề ngày */}
                      <div className="border-b border-slate-100 pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">
                            {day.dayName}
                          </span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            {day.totalCalories}{translateText(" Kcal")}</span>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-600 block mt-0.5 truncate">
                          {translateText(day.standardNote)}
                        </span>
                      </div>

                      {/* Buổi Sáng (09:00) */}
                      {day.dishes.some((d) => d.mealTime === "BREAKFAST" || d.mealTime === "MORNING_SNACK") && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1 text-[10px] font-black text-amber-800">
                            <Sun className="w-3 h-3 text-amber-600" />
                            <span>{translateText("BUỔI SÁNG (09:00)")}</span>
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

                      {/* Bữa Trưa */}
                      {day.dishes.some((d) => d.mealTime === "LUNCH") && (
                        <div className="space-y-1.5 border-t border-slate-100 pt-2 flex-1">
                          <div className="flex items-center gap-1 text-[10px] font-black text-teal-800">
                            <Utensils className="w-3 h-3 text-teal-600" />
                            <span>{translateText("BỮA TRƯA (11:00)")}</span>
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

                      {/* Bữa Xế Chiều */}
                      {day.dishes.some((d) => d.mealTime === "AFTERNOON_SNACK") && (
                        <div className="space-y-1.5 border-t border-slate-100 pt-2">
                          <div className="flex items-center gap-1 text-[10px] font-black text-purple-800">
                            <Coffee className="w-3 h-3 text-purple-600" />
                            <span>{translateText("XẾ CHIỀU (14:30)")}</span>
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

                      {/* Dinh Dưỡng Cuối Cột Của Ngày */}
                      <div className="pt-2 border-t border-slate-100 text-[10px] space-y-1 bg-slate-50/80 -mx-3.5 -mb-3.5 p-2.5">
                        <div className="flex items-center justify-between text-slate-600 font-bold">
                          <span>{translateText("Đạm: ")}{day.totalProteinG}{translateText("g")}</span>
                          <span>{translateText("Béo: ")}{day.totalFatG}{translateText("g")}</span>
                          <span>{translateText("G: ")}{day.totalCarbG}{translateText("g")}</span>
                        </div>
                        <div className="text-[9.5px] font-black text-slate-700 flex justify-between">
                          <span>{translateText("P:L:G")}</span>
                          <span>
                            {day.proteinPct}% : {day.lipidPct}% :{" "}
                            {day.glucidPct}%
                          </span>
                        </div>
                        {/* Thanh 3 màu tỷ lệ */}
                        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200">
                          <div
                            style={{ width: `${day.proteinPct}%` }}
                            className="bg-blue-500 h-full"
                            title={translateText("Protein")}
                          />
                          <div
                            style={{ width: `${day.lipidPct}%` }}
                            className="bg-amber-500 h-full"
                            title={translateText("Lipid")}
                          />
                          <div
                            style={{ width: `${day.glucidPct}%` }}
                            className="bg-purple-500 h-full"
                            title={translateText("Glucid")}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
                disabled={saving}
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
