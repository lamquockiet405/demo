import { getLocale, t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  History,
  RefreshCw,
  UtensilsCrossed,
} from "lucide-react";
import { fetchPublishedMenu } from "../api/published-menus.api";
import { useMenuResource, usePublishedMenus } from "../hooks/usePublishedMenus";
import {
  menuPeriod,
  normalizeMenuAgeGroup,
  publishedMenuDates,
  publishedMenuDay,
  schoolDate,
} from "../utils/published-menus";
import { DishDetailModal } from "../../dishes/components/DishDetailModal";
import { childrenApi, ChildItem } from "../../children/api/children.api";
import "../published-menus.css";

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
  childHasAllergy,
  childAllergens,
}: {
  audience: "kitchen" | "parent";
  embedded?: boolean;
  syncDate?: boolean;
  childId?: string;
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
    childAllergens && childAllergens.length > 0
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
  return (
    <section className="pm-browser">
      <div className="pm-heading">
        <div>
          <span className="pm-eyebrow">{translateText("THỰC ĐƠN NHÀ TRƯỜNG")}</span>
          <Heading>
            {translateText(audience === "parent"
              ? "Thực đơn đã công bố & lịch sử"
              : "Thực đơn đã công bố")}
          </Heading>
          <p>
            {translateText(audience === "parent"
              ? "Xem thực đơn hiệu trưởng đã công bố, bao gồm các tuần trước đây."
              : "Tra cứu thực đơn đã công bố để chuẩn bị món đúng ngày và từng bữa ăn.")}
          </p>
        </div>
        <button
          className="pm-button"
          onClick={() => void index.reload()}
          disabled={index.loading}
        >
          <RefreshCw
            size={15}
            className={index.loading ? "animate-spin" : ""}
          />{translateText("Làm mới thực đơn")}</button>
      </div>
      <div className="pm-filters">
        <input
          type="search"
          aria-label={translateText("Tìm thực đơn đã công bố")}
          placeholder={translateText("Tìm tên thực đơn…")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label={translateText("Lọc thời gian thực đơn")}
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
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
        >
          <option value="">{translateText("Mẫu giáo (3 - 6 tuổi)")}</option>
          <option value="MAU_GIAO">{translateText("Mẫu giáo (3 - 6 tuổi) - Chuẩn chung")}</option>
        </select>
        <span>{menus.length}{translateText(" thực đơn")}</span>
      </div>
      {index.error && (
        <div className="pm-message error" role="alert">
          {translateText(index.error)}
        </div>
      )}
      {index.loading && !index.data && (
        <div className="pm-message" role="status">{translateText("Đang tải danh sách thực đơn đã công bố…")}</div>
      )}
      {!index.loading && !index.error && !menus.length && (
        <div className="pm-empty">
          <History size={32} />
          <h2>
            {translateText(index.data?.length
              ? "Không có thực đơn phù hợp"
              : "Nhà trường chưa công bố thực đơn")}
          </h2>
          <p>
            {translateText(index.data?.length
              ? "Thay đổi từ khóa hoặc bộ lọc để xem các thực đơn khác."
              : "Thực đơn sẽ xuất hiện ở đây sau khi hiệu trưởng công bố.")}
          </p>
        </div>
      )}
      {!!menus.length && (
        <div className="pm-layout">
          <aside
            className="pm-menu-list"
            aria-label={translateText("Danh sách thực đơn công bố")}
          >
            {menus.map((menu) => {
              const range = menuPeriod(menu);
              return (
                <button
                  key={menu.id}
                  className={`pm-menu-card ${String(menu.id) === String(selected?.id) ? "selected" : ""}`}
                  onClick={() => selectMenu(String(menu.id))}
                  aria-pressed={String(menu.id) === String(selected?.id)}
                >
                  <div className="pm-menu-card-top">
                    <span>
                      {translateText(ageLabel(menu.ageGroup || menu.targetAgeGroup))}
                    </span>
                    {range.end < today ? (
                      <History size={14} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                  </div>
                  <strong>{menu.title || translateText("Thực đơn tuần")}</strong>
                  <small>
                    <CalendarDays size={12} />
                    {translateText(dateLabel(range.start))} – {translateText(dateLabel(range.end))}
                  </small>
                  <em>
                    {translateText(range.end < today
                      ? "Đã công bố trước đây"
                      : range.start > today
                        ? "Sắp áp dụng"
                        : "Đang áp dụng")}
                  </em>
                </button>
              );
            })}
          </aside>
          <article className="pm-detail" aria-busy={busy}>
            {busy ? (
              <div className="pm-message" role="status">{translateText("Đang tải chi tiết thực đơn…")}</div>
            ) : detail.error ? (
              <div className="pm-message error" role="alert">
                {translateText(detail.error)}
                <button
                  className="pm-button"
                  onClick={() => void detail.reload()}
                >{translateText("Thử lại")}</button>
              </div>
            ) : (
              detail.data && (
                <>
                  <header className="pm-detail-heading">
                    <span className="pm-published-badge">
                      <CheckCircle2 size={14} />{translateText("Đã công bố")}{translateText(detail.data.status === "ARCHIVED" ? " · Lưu trữ" : "")}
                    </span>
                    <h2>{translateText(detail.data.title)}</h2>
                    <p>
                      {translateText(dateLabel(menuPeriod(detail.data).start))} –{" "}
                      {translateText(dateLabel(menuPeriod(detail.data).end))} ·{" "}
                      {translateText(ageLabel(
                        detail.data.ageGroup || detail.data.targetAgeGroup,
                      ))}
                    </p>
                    {detail.data.publishedAt && (
                      <p>{translateText("Công bố lúc")}{" "}
                        {translateText(new Date(detail.data.publishedAt).toLocaleString(
                          getLocale(),
                          { timeZone: "Asia/Ho_Chi_Minh" },
                        ))}
                      </p>
                    )}
                  </header>
                  {!dates.length ? (
                    <div className="pm-message">{translateText("Thực đơn này chưa có chi tiết món ăn theo ngày.")}</div>
                  ) : (
                    <>
                      <div className="pm-days" aria-label={translateText("Ngày trong thực đơn")}>
                        {dates.map((day) => (
                          <button
                            key={day}
                            className={day === date ? "selected" : ""}
                            aria-pressed={day === date}
                            onClick={() => selectDate(day)}
                          >
                            <span>
                              {translateText(new Date(`${day}T12:00:00Z`).toLocaleDateString(
                                getLocale(),
                                {
                                  weekday: "short",
                                  timeZone: "Asia/Ho_Chi_Minh",
                                },
                              ))}
                            </span>
                            <b>{translateText(dateLabel(day))}</b>
                          </button>
                        ))}
                      </div>
                      <h3 className="pm-day-title">{translateText("Thực đơn ngày ")}{translateText(dateLabel(date))}
                      </h3>
                      {!meals.length ? (
                        <div className="pm-message">{translateText("Chưa có món ăn được xếp cho ngày này.")}</div>
                      ) : (
                        <div className="pm-meals">
                          {meals.map((meal) => (
                            <section className="pm-meal" key={meal.mealType}>
                              <h3>
                                <UtensilsCrossed size={17} />
                                {translateText(meal.title)}
                              </h3>
                              {meal.dishes.map((dish, i) => (
                                <div
                                  className="pm-dish cursor-pointer hover:bg-teal-50/70 transition"
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
                                  <div>
                                    <strong>{dish.name}</strong>
                                    <small>{translateText(dish.category)}</small>
                                    {dish.substitutedFor && (
                                      <small className="block mt-1 text-emerald-700 font-semibold">
                                        {audience === "kitchen"
                                          ? `🍱 ${translateText("Suất riêng")} (${translateText("Thay cho: ")}${dish.substitutedFor})`
                                          : translateText("✓ Đã đổi suất riêng cho bé (Thay cho: ") + dish.substitutedFor + ")"}
                                      </small>
                                    )}
                                    {!dish.substitutedFor && dish.hasChildAllergyConflict && dish.allergens && dish.allergens.length > 0 && (
                                      <small className="block mt-1 text-rose-600 font-semibold">
                                        {translateText("⚠ Lưu ý dị ứng của bé: ")}{dish.allergens.join(", ")}
                                      </small>
                                    )}
                                  </div>
                                  <span>
                                    {translateText(dish.portionSizeG === null
                                      ? "Chưa có định lượng"
                                      : `${number(dish.portionSizeG)} g`)}
                                    {dish.calories !== null && (
                                      <small>
                                        {translateText(number(dish.calories))}{translateText(" kcal")}</small>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </section>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )
            )}
          </article>
        </div>
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
