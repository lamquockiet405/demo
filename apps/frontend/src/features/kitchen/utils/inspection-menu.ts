export interface InspectionMenuDish {
  id: string;
  name: string;
  menus: string[];
  sessionLabel?: string;
}

type Menu = Record<string, any>;
const dateOnly = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 10) : "";

export function isInspectionMenuForDate(menu: Menu, date: string): boolean {
  const start = dateOnly(menu.startDate || menu.weekStartDate);
  const end = dateOnly(menu.endDate || menu.weekEndDate);
  return (
    ["APPROVED", "ACTIVE", "PUBLISHED"].includes(menu.status) &&
    !!start &&
    !!end &&
    start <= date &&
    end >= date
  );
}

export function extractInspectionMenuDishes(
  menus: Menu[],
  date: string,
  mealSession: string,
): InspectionMenuDish[] {
  const dishes = new Map<string, InspectionMenuDish>();
  const isAllDay =
    !mealSession ||
    mealSession === "ALL_DAY" ||
    mealSession === "ALL" ||
    mealSession === "FULL_DAY" ||
    mealSession === "3_MEALS";

  for (const menu of menus) {
    if (!isInspectionMenuForDate(menu, date)) continue;
    if (!Array.isArray(menu.days))
      throw new Error("Không đọc được chi tiết thực đơn. Vui lòng tải lại.");
    for (const day of menu.days) {
      if (dateOnly(day.date) !== date) continue;
      for (const meal of Array.isArray(day.meals) ? day.meals : []) {
        const matches = isAllDay
          ? true
          : mealSession === "BREAKFAST"
            ? ["BREAKFAST", "MORNING_SNACK"].includes(meal.mealType)
            : meal.mealType === mealSession;
        if (!matches) continue;

        const sessionLabel =
          meal.mealType === "BREAKFAST" || meal.mealType === "MORNING_SNACK"
            ? "Bữa sáng"
            : meal.mealType === "LUNCH"
              ? "Bữa trưa"
              : meal.mealType === "AFTERNOON_SNACK" || meal.mealType === "SNACK"
                ? "Bữa xế"
                : "Bữa ăn";

        for (const dish of Array.isArray(meal.dishes) ? meal.dishes : []) {
          const name =
            typeof (dish.dishName ?? dish.dish?.name) === "string"
              ? (dish.dishName ?? dish.dish.name).trim()
              : "";
          if (!name) continue;
          const id = String(
            dish.dishId ??
              dish.dish?.id ??
              `name:${name.toLocaleLowerCase("vi")}`,
          );
          const title = String(menu.title || "Thực đơn đã duyệt");
          const existing = dishes.get(id);
          if (existing) {
            if (!existing.menus.includes(title)) existing.menus.push(title);
            if (!existing.sessionLabel) existing.sessionLabel = sessionLabel;
          } else {
            dishes.set(id, { id, name, menus: [title], sessionLabel });
          }
        }
      }
    }
  }
  return [...dishes.values()];
}

export function inspectionDishNames(
  selected: InspectionMenuDish[],
  additional: string,
): string[] {
  const names = [
    ...selected.map((dish) => dish.name),
    ...additional.split("\n"),
  ]
    .map((name) => name.trim())
    .filter(Boolean);
  return [
    ...new Map(
      names.map((name) => [name.toLocaleLowerCase("vi"), name]),
    ).values(),
  ];
}
