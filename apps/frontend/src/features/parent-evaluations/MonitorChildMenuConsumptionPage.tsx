import { t as translateText } from '../../core/i18n/language';
import { useLanguage } from '../../core/i18n/useLanguage';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { SubmitMealEvaluationPage } from "./SubmitMealEvaluationPage";
import { parentEvaluationApi } from "./api/parentEvaluationApi";
import { ChildMenuConsumptionData } from "./types";
import { ParentPortalTopNav } from "./components/ParentPortalTopNav";
import { ConsumptionKPIStrip } from "./components/ConsumptionKPIStrip";
import { DaySelectorTabs } from "./components/DaySelectorTabs";
import { DailySessionsTimeline } from "./components/DailySessionsTimeline";
import { NutritionOverviewCard } from "./components/NutritionOverviewCard";
import { WeeklyConsumptionHistoryTable } from "./components/WeeklyConsumptionHistoryTable";
import { ParentNutritionAdviceCard } from "./components/ParentNutritionAdviceCard";
import { PortalFooter } from "./components/PortalFooter";
import { Loader2, Utensils, RefreshCw, Baby } from "lucide-react";
import { usePublishedDay } from "../menus/hooks/usePublishedMenus";
import {
  publishedDayNutrition,
  publishedMenuDay,
  schoolDate,
} from "../menus/utils/published-menus";
import { childrenApi, ChildItem } from "../children/api/children.api";
import { useAuthStore } from "../../core/stores/auth.store";

const ChildMenuConsumptionView: React.FC = () => {
  useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [children, setChildren] = useState<ChildItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(
    searchParams.get("childId") || "",
  );

  const [data, setData] = useState<ChildMenuConsumptionData | null>(null);
  const selectedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date") || "")
      ? searchParams.get("date")!
      : schoolDate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const matchedChild = children.find(c => String(c.id) === selectedChildId) || children[0];
  const matchedChildAllergens = (matchedChild?.allergies || [])
    .filter((a: any) => a?.isActive !== false)
    .map((a: any) => a?.allergenName || a?.customAllergenName || "")
    .filter(Boolean);
  const matchedChildHasAllergy = Boolean(
    (matchedChild as any)?.hasAllergy ||
      matchedChildAllergens.length > 0 ||
      data?.child?.allergyWarning,
  );
  const published = usePublishedDay(
    selectedDate,
    matchedChild?.ageGroup || data?.child?.gradeLevel,
    {
      audience: "parent",
      childId: matchedChild ? String(matchedChild.id) : selectedChildId,
      childHasAllergy: matchedChildHasAllergy,
      childAllergens: matchedChildAllergens,
    },
  );

  // 1. Tải danh sách học sinh của phụ huynh
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await childrenApi.getChildren({ limit: 50 });
        const list = Array.isArray(res) ? res : res.items || [];
        setChildren(list);
        if (list.length > 0 && !selectedChildId) {
          setSelectedChildId(String(list[0].id));
        }
      } catch (err) {
        console.error("Không thể tải danh sách con:", err);
      }
    };
    void fetchChildren();
  }, []);

  // 2. Tải dữ liệu thực đơn & sức ăn
  const loadData = useCallback(
    async (date?: string, childId?: string) => {
      const request = ++requestRef.current;
      try {
        setLoading(true);
        setError(null);
        setData(null);
        const activeChildId = childId || selectedChildId || undefined;
        const res = await parentEvaluationApi.getChildMenuConsumption(
          activeChildId,
          date || selectedDate,
        );
        if (request !== requestRef.current) return;
        setData(res);
      } catch (err: any) {
        if (request !== requestRef.current) return;
        console.error("Error fetching child menu and consumption data:", err);
        setError(err.message || "Không thể tải dữ liệu thực từ máy chủ.");
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [selectedDate, selectedChildId],
  );

  useEffect(() => {
    void loadData(selectedDate, selectedChildId);
    return () => {
      requestRef.current++;
    };
  }, [loadData, selectedDate, selectedChildId]);

  const handleHeartReaction = async (attendanceId: string) => {
    try {
      return await parentEvaluationApi.toggleHeartReaction(attendanceId);
    } catch (err) {
      console.error("Error sending heart reaction:", err);
      throw err;
    }
  };

  const handleSelectChild = (cId: string) => {
    setSelectedChildId(cId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("childId", cId);
      return next;
    });
  };

  const setSelectedDate = (date: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("date", date);
      next.delete("menuId");
      return next;
    });
  };

  useEffect(() => {
    const requestedChild = searchParams.get("childId");
    const child = children.find(c => String(c.id) === requestedChild) || children[0];
    if (child) setSelectedChildId(String(child.id));
  }, [searchParams, children]);

  const child = data?.child || {
    id: data?.childId || matchedChild?.id || "1",
    name: data?.childName || matchedChild?.fullName || "Hồ sơ của bé",
    age: matchedChild?.dateOfBirth
      ? Math.max(
          1,
          new Date().getFullYear() - new Date(matchedChild.dateOfBirth).getFullYear(),
        )
      : 4,
    className:
      data?.className ||
      matchedChild?.className ||
      matchedChild?.class?.name ||
      "Lớp mầm non",
    gradeLevel: data?.child?.gradeLevel || matchedChild?.ageGroup || "Mẫu giáo",
    weight: data?.child?.weight || 0,
    height: data?.child?.height || 0,
    allergyWarning: data?.child?.allergyWarning || "",
    parentName: user?.fullName || "Phụ huynh",
    parentRole: "Phụ huynh",
  };

  const metrics = data?.metrics || {
    consumptionRate: 0,
    consumptionStatusLabel: "Chưa có đánh giá sức ăn",
    waterIntakeToday: "Chưa ghi nhận",
    waterPercentage: 0,
    allergyStatusText: "An toàn, không dị ứng",
    syncStatusText: "Chưa đồng bộ",
  };

  const daysInWeek = Array.isArray(data?.daysInWeek) ? data?.daysInWeek : [];
  const sessions = (Array.isArray(data?.sessions) ? data?.sessions : []).map(
    (session) => {
      const type =
        session.mealType === "SNACK" ? "AFTERNOON_SNACK" : session.mealType;
      const matchingMeals = published.meals.filter(
        (meal) =>
          meal.mealType === type ||
          (type === "BREAKFAST" && meal.mealType === "MORNING_SNACK"),
      );
      const names = matchingMeals.flatMap((meal) => meal.dishes.map((dish) => dish.name));
      const mealCalories = matchingMeals.reduce(
        (sum, meal) =>
          sum +
          meal.dishes.reduce(
            (s, d) => s + (typeof d.calories === "number" ? d.calories : 0),
            0,
          ),
        0,
      );
      const rate = typeof session.consumptionPercentage === "number" ? session.consumptionPercentage : 0;
      const eatenCalories = Math.round((mealCalories * rate) / 100);
      return {
        ...session,
        mealCalories,
        eatenCalories,
        dishesServed: published.loading
          ? "Đang tải thực đơn đã công bố…"
          : published.error
            ? "Chưa tải được thực đơn đã công bố."
            : names.join(", ") ||
              "Chưa có món trong thực đơn đã công bố cho bữa này.",
      };
    },
  );
  const nutritionSummaryToday = publishedDayNutrition(published.meals);
  const totalMenuCalories = sessions.reduce((sum, s) => sum + (s.mealCalories || 0), 0) || nutritionSummaryToday.calories || 0;
  const totalEatenCalories = sessions.reduce((sum, s) => sum + (s.eatenCalories || 0), 0);
  const isMenuPublished =
    !published.loading && !published.error && published.menus.length > 0;
  const publishedMenuTitle = [
    ...new Set(published.menus.map((menu) => menu.title)),
  ].join(" · ");
  const weeklySummary = (
    Array.isArray(data?.weeklySummary) ? data?.weeklySummary : []
  ).map((day) => ({
    ...day,
    dishes:
      published.menus
        .flatMap((menu) =>
          publishedMenuDay(menu, day.date, {
            audience: "parent",
            childId: matchedChild ? String(matchedChild.id) : selectedChildId,
            childHasAllergy: matchedChildHasAllergy,
            childAllergens: matchedChildAllergens,
          }),
        )
        .filter((meal) => meal.mealType === "LUNCH")
        .flatMap((meal) => meal.dishes.map((dish) => dish.name))
        .join(", ") || "Chưa có thực đơn đã công bố cho ngày này.",
  }));

    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col antialiased">
        {/* 1. Top Navigation Bar with active tab "Thực đơn & Sức ăn" */}
        <ParentPortalTopNav child={child} activeTab="menu-consumption" />

        {/* Main Content Container */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
          <section aria-labelledby="child-consumption-heading">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h2 id="child-consumption-heading" className="text-base font-bold text-slate-900">
                  {translateText("Sức ăn của bé ngày ")}{translateText(selectedDate.split("-").reverse().join("/"))}
                </h2>
                {children.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
                    <Baby className="w-3.5 h-3.5 text-teal-600" />
                    <select
                      value={selectedChildId}
                      onChange={(e) => handleSelectChild(e.target.value)}
                      className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                      aria-label={translateText("Chọn bé để theo dõi")}
                    >
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label={translateText("Ngày xem thực đơn và sức ăn")}
                  value={selectedDate}
                  onChange={event => { if (event.target.value) setSelectedDate(event.target.value); }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    void loadData(selectedDate, selectedChildId);
                    void published.reload();
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title={translateText("Làm mới")}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>{translateText("Làm mới")}</span>
                </button>
              </div>
            </div>
            {loading && (
            <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-600" role="status">
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />{translateText("Đang tải dữ liệu sức ăn của bé…")}</div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
              <p>{translateText(error)}</p>
              <button type="button" onClick={() => void loadData(selectedDate, selectedChildId)} className="mt-2 underline font-bold">{translateText("Thử lại dữ liệu sức ăn")}</button>
            </div>
          )}
          {!loading && !error && data && <>
        {/* 3. KPI Metrics Overview Strip */}
        <ConsumptionKPIStrip
          metrics={metrics}
          totalMenuCalories={totalMenuCalories}
          totalEatenCalories={totalEatenCalories}
        />

        {/* 3.1. Hướng dẫn bổ sung dinh dưỡng tại nhà cho bé kén ăn (STT 71) */}
        <ParentNutritionAdviceCard childId={String(child.id)} />

        {/* 3.2. Trạng thái đồng bộ với thực đơn trường đã công bố */}
        {published.loading ? (
          <div className="mb-4 text-xs text-slate-500" role="status">{translateText("Đang tải thực đơn đã công bố…")}</div>
        ) : published.error ? (
          <div
            className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs"
            role="alert"
          >
            {translateText(published.error)}
          </div>
        ) : isMenuPublished ? (
          publishedMenuTitle && (
            <div className="mb-4 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{translateText("Thực đơn trường đã công bố: ")}{translateText(publishedMenuTitle)}</span>
            </div>
          )
        ) : null}

        {/* 4. Weekday Selector Tabs */}
        <DaySelectorTabs
          days={daysInWeek}
          selectedDate={selectedDate}
          onSelectDate={(newDate) => setSelectedDate(newDate)}
        />

        {/* 6. Nutrition Overview Card (Standards of National Institute of Nutrition) */}
        {isMenuPublished && (
          <NutritionOverviewCard nutrition={nutritionSummaryToday} />
        )}

        {/* 7. Weekly Consumption History Table */}
        <WeeklyConsumptionHistoryTable
          history={weeklySummary}
          childName={child.name}
        />
          </>}
        </section>
      </main>

      {/* 8. Footer */}
      <PortalFooter />
    </div>
  );
};

export const MonitorChildMenuConsumptionPage: React.FC = () => {
  useLanguage();
  const [params] = useSearchParams();
  return params.get("tab") === "evaluation" ? (
    <SubmitMealEvaluationPage />
  ) : (
    <ChildMenuConsumptionView />
  );
};
