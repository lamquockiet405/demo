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
import "../published-menus.css";

const dateLabel = (date: string) =>
  date ? date.split("-").reverse().join("/") : "—";
const number = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
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
}: {
  audience: "kitchen" | "parent";
  embedded?: boolean;
  syncDate?: boolean;
}) {
  const index = usePublishedMenus();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("ALL");
  const [age, setAge] = useState("");
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
  const meals = detail.data && date ? publishedMenuDay(detail.data, date) : [];
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
  const [selectedDish, setSelectedDish] = useState<{ id?: string | number; name?: string } | null>(null);
  return (
    <section className="pm-browser">
      <div className="pm-heading">
        <div>
          <span className="pm-eyebrow">THỰC ĐƠN NHÀ TRƯỜNG</span>
          <Heading>
            {audience === "parent"
              ? "Thực đơn đã công bố & lịch sử"
              : "Thực đơn đã công bố"}
          </Heading>
          <p>
            {audience === "parent"
              ? "Xem thực đơn hiệu trưởng đã công bố, bao gồm các tuần trước đây."
              : "Tra cứu thực đơn đã công bố để chuẩn bị món đúng ngày và từng bữa ăn."}
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
          />
          Làm mới thực đơn
        </button>
      </div>
      <div className="pm-filters">
        <input
          type="search"
          aria-label="Tìm thực đơn đã công bố"
          placeholder="Tìm tên thực đơn…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Lọc thời gian thực đơn"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="ALL">Tất cả thời gian</option>
          <option value="CURRENT">Đang áp dụng</option>
          <option value="PAST">Các tuần trước</option>
          <option value="UPCOMING">Sắp áp dụng</option>
        </select>
        <select
          aria-label="Khối tuổi thực đơn"
          value={age}
          onChange={(event) => setAge(event.target.value)}
        >
          <option value="">Tất cả khối tuổi</option>
          <option value="NHA_TRE">Nhà trẻ</option>
          <option value="MAU_GIAO">Mẫu giáo</option>
        </select>
        <span>{menus.length} thực đơn</span>
      </div>
      {index.error && (
        <div className="pm-message error" role="alert">
          {index.error}
        </div>
      )}
      {index.loading && !index.data && (
        <div className="pm-message" role="status">
          Đang tải danh sách thực đơn đã công bố…
        </div>
      )}
      {!index.loading && !index.error && !menus.length && (
        <div className="pm-empty">
          <History size={32} />
          <h2>
            {index.data?.length
              ? "Không có thực đơn phù hợp"
              : "Nhà trường chưa công bố thực đơn"}
          </h2>
          <p>
            {index.data?.length
              ? "Thay đổi từ khóa hoặc bộ lọc để xem các thực đơn khác."
              : "Thực đơn sẽ xuất hiện ở đây sau khi hiệu trưởng công bố."}
          </p>
        </div>
      )}
      {!!menus.length && (
        <div className="pm-layout">
          <aside
            className="pm-menu-list"
            aria-label="Danh sách thực đơn công bố"
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
                      {ageLabel(menu.ageGroup || menu.targetAgeGroup)}
                    </span>
                    {range.end < today ? (
                      <History size={14} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                  </div>
                  <strong>{menu.title || "Thực đơn tuần"}</strong>
                  <small>
                    <CalendarDays size={12} />
                    {dateLabel(range.start)} – {dateLabel(range.end)}
                  </small>
                  <em>
                    {range.end < today
                      ? "Đã công bố trước đây"
                      : range.start > today
                        ? "Sắp áp dụng"
                        : "Đang áp dụng"}
                  </em>
                </button>
              );
            })}
          </aside>
          <article className="pm-detail" aria-busy={busy}>
            {busy ? (
              <div className="pm-message" role="status">
                Đang tải chi tiết thực đơn…
              </div>
            ) : detail.error ? (
              <div className="pm-message error" role="alert">
                {detail.error}
                <button
                  className="pm-button"
                  onClick={() => void detail.reload()}
                >
                  Thử lại
                </button>
              </div>
            ) : (
              detail.data && (
                <>
                  <header className="pm-detail-heading">
                    <span className="pm-published-badge">
                      <CheckCircle2 size={14} />
                      Đã công bố
                      {detail.data.status === "ARCHIVED" ? " · Lưu trữ" : ""}
                    </span>
                    <h2>{detail.data.title}</h2>
                    <p>
                      {dateLabel(menuPeriod(detail.data).start)} –{" "}
                      {dateLabel(menuPeriod(detail.data).end)} ·{" "}
                      {ageLabel(
                        detail.data.ageGroup || detail.data.targetAgeGroup,
                      )}
                    </p>
                    {detail.data.publishedAt && (
                      <p>
                        Công bố lúc{" "}
                        {new Date(detail.data.publishedAt).toLocaleString(
                          "vi-VN",
                          { timeZone: "Asia/Ho_Chi_Minh" },
                        )}
                      </p>
                    )}
                  </header>
                  {!dates.length ? (
                    <div className="pm-message">
                      Thực đơn này chưa có chi tiết món ăn theo ngày.
                    </div>
                  ) : (
                    <>
                      <div className="pm-days" aria-label="Ngày trong thực đơn">
                        {dates.map((day) => (
                          <button
                            key={day}
                            className={day === date ? "selected" : ""}
                            aria-pressed={day === date}
                            onClick={() => selectDate(day)}
                          >
                            <span>
                              {new Date(`${day}T12:00:00Z`).toLocaleDateString(
                                "vi-VN",
                                {
                                  weekday: "short",
                                  timeZone: "Asia/Ho_Chi_Minh",
                                },
                              )}
                            </span>
                            <b>{dateLabel(day)}</b>
                          </button>
                        ))}
                      </div>
                      <h3 className="pm-day-title">
                        Thực đơn ngày {dateLabel(date)}
                      </h3>
                      {!meals.length ? (
                        <div className="pm-message">
                          Chưa có món ăn được xếp cho ngày này.
                        </div>
                      ) : (
                        <div className="pm-meals">
                          {meals.map((meal) => (
                            <section className="pm-meal" key={meal.mealType}>
                              <h3>
                                <UtensilsCrossed size={17} />
                                {meal.title}
                              </h3>
                              {meal.dishes.map((dish, i) => (
                                <div
                                  className="pm-dish cursor-pointer hover:bg-teal-50/70 transition"
                                  key={`${dish.id}-${i}`}
                                  onClick={() => setSelectedDish({ id: dish.id, name: dish.name })}
                                  title={`Bấm để xem chi tiết món ăn "${dish.name}" (UC41)`}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      setSelectedDish({ id: dish.id, name: dish.name });
                                    }
                                  }}
                                >
                                  <div>
                                    <strong>{dish.name}</strong>
                                    <small>{dish.category}</small>
                                  </div>
                                  <span>
                                    {dish.portionSizeG === null
                                      ? "Chưa có định lượng"
                                      : `${number(dish.portionSizeG)} g`}
                                    {dish.calories !== null && (
                                      <small>
                                        {number(dish.calories)} kcal
                                      </small>
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
      />
    </section>
  );
}
