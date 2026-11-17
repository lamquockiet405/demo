export type PublishedMenu = Record<string, any>;
export interface PublishedDish {
  id: string;
  name: string;
  category: string;
  portionSizeG: number | null;
  calories: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
  fiberG: number | null;
  calciumMg: number | null;
  source: string;
  specialDietNotes?: string | null;
  substitutedFor?: string | null;
  allergens?: string[];
  hasChildAllergyConflict?: boolean;
}
export interface PublishedMenuDayOptions {
  audience?: "kitchen" | "parent";
  childId?: string;
  childHasAllergy?: boolean;
  childAllergens?: string[];
}
export interface PublishedMeal {
  mealType: string;
  title: string;
  dishes: PublishedDish[];
}
export const calendarDate = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, 10) : "";
export const schoolDate = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function isPublishedMenu(menu: PublishedMenu): boolean {
  if (menu.deletedAt || menu.isDeleted) return false;
  return (
    ["PUBLISHED", "ACTIVE"].includes(menu.status) ||
    (menu.status === "ARCHIVED" &&
      typeof menu.publishedAt === "string" &&
      Number.isFinite(Date.parse(menu.publishedAt)))
  );
}
export function menuPeriod(menu: PublishedMenu) {
  return {
    start: calendarDate(menu.startDate || menu.weekStartDate),
    end: calendarDate(menu.endDate || menu.weekEndDate),
  };
}
export function normalizeMenuAgeGroup(value: unknown): string {
  const name = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (/NHA.?TRE|TODDLER/.test(name)) return "NHA_TRE";
  if (/MAU.?GIAO|KINDERGARTEN|MAM|CHOI|^LA$/.test(name)) return "MAU_GIAO";
  return name;
}
export function publishedMenuOrder(a: PublishedMenu, b: PublishedMenu): number {
  const published = (m: PublishedMenu) =>
    Number.isFinite(Date.parse(m.publishedAt)) ? Date.parse(m.publishedAt) : 0;
  return (
    published(b) - published(a) ||
    menuPeriod(b).start.localeCompare(menuPeriod(a).start) ||
    String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
  );
}
export function publishedMenusForDate(
  menus: PublishedMenu[],
  date: string,
  ageGroup?: string,
): PublishedMenu[] {
  const selected = new Map<string, PublishedMenu>();
  const age = normalizeMenuAgeGroup(ageGroup);
  for (const menu of menus.filter(isPublishedMenu).sort(publishedMenuOrder)) {
    const { start, end } = menuPeriod(menu);
    const group = normalizeMenuAgeGroup(menu.ageGroup || menu.targetAgeGroup);
    if (!start || !end || date < start || date > end || (age && group !== age))
      continue;
    if (!selected.has(group)) selected.set(group, menu);
  }
  return [...selected.values()];
}
const mealTitles: Record<string, string> = {
  BREAKFAST: "Buổi sáng (09:00)",
  MORNING_SNACK: "Buổi sáng (09:00)",
  LUNCH: "Bữa trưa chính (11:15)",
  AFTERNOON_SNACK: "Bữa phụ xế (14:30)",
  LATE_SNACK: "Bữa phụ chiều (17:00)",
};

const mealSortOrder: Record<string, number> = {
  BREAKFAST: 1,
  MORNING_SNACK: 2,
  LUNCH: 3,
  AFTERNOON_SNACK: 4,
  LATE_SNACK: 5,
};
const numberOrNull = (value: unknown) =>
  value != null && value !== "" && Number.isFinite(Number(value))
    ? Number(value)
    : null;

const extractReplacedDishName = (notes?: string | null): string => {
  if (!notes) return "";
  const match = notes.match(/thay cho:\s*([^->]+?)(?:\s*->|$)/i);
  return match ? match[1].trim() : "";
};

const isAllergySubstituteNote = (notes?: string | null): boolean => {
  if (!notes) return false;
  return /loại 3|dị ứng/i.test(notes);
};

export function publishedMenuDay(
  menu: PublishedMenu,
  date: string,
  options?: PublishedMenuDayOptions,
): PublishedMeal[] {
  if (!isPublishedMenu(menu)) return [];
  if (!Array.isArray(menu.days))
    throw new Error("Không đọc được chi tiết thực đơn đã công bố.");
  const menuDishNotesMap = new Map<string, string>();
  if (Array.isArray(menu.menuDishes)) {
    for (const md of menu.menuDishes) {
      if (md?.id && md?.specialDietNotes) {
        menuDishNotesMap.set(String(md.id), String(md.specialDietNotes));
      }
    }
  }
  const audience = options?.audience || "parent";
  const childId = options?.childId ? String(options.childId) : "";
  const childHasAllergy = options?.childHasAllergy ?? true;
  const childAllergensLower = (options?.childAllergens || []).map((a) =>
    String(a).trim().toLowerCase(),
  );

  const days = menu.days.filter((day: any) => calendarDate(day.date) === date);
  const meals = new Map<string, PublishedMeal>();
  for (const day of days)
    for (const meal of Array.isArray(day.meals) ? day.meals : []) {
      const type = String(meal.mealType || "OTHER");
      let group = meals.get(type);
      if (!group) {
        group = { mealType: type, title: mealTitles[type] || type, dishes: [] };
        meals.set(type, group);
      }
      const rawDishes = (Array.isArray(meal.dishes) ? meal.dishes : []).map(
        (d: any) => ({
          ...d,
          specialDietNotes:
            d.specialDietNotes ||
            (d.id ? menuDishNotesMap.get(String(d.id)) : null) ||
            null,
        }),
      );

      const primaryRaw = rawDishes.filter((d: any) => !d.specialDietNotes);
      const subRaw = rawDishes.filter((d: any) => Boolean(d.specialDietNotes));
      const usedSubIds = new Set<string>();

      const toPublishedDish = (
        dish: any,
        substitutedFor?: string | null,
        hasChildAllergyConflict?: boolean,
      ): PublishedDish | null => {
        const name = dish.dishName || dish.name || dish.dish?.name;
        if (typeof name !== "string" || !name.trim()) return null;
        const nutrient = (field: string) =>
          dish.nutritionAvailable === false ? null : numberOrNull(dish[field]);
        const rawCategory = String(
          dish.categoryName || dish.categoryCode || "Món ăn",
        );
        const lowerCat = rawCategory.toLowerCase();
        const baseCategory =
          (type === "BREAKFAST" || type === "MORNING_SNACK") &&
          (lowerCat.includes("xế") ||
            lowerCat.includes("chiều") ||
            lowerCat.includes("phụ") ||
            rawCategory === "SNACK_AFTERNOON")
            ? "Món sáng"
            : rawCategory;
        return {
          id: String(dish.dishId ?? dish.dish?.id ?? dish.id ?? name),
          name: name.trim(),
          category: baseCategory,
          portionSizeG: numberOrNull(dish.portionSizeG),
          calories:
            dish.nutritionAvailable === false
              ? null
              : numberOrNull(
                  dish.energyKcal ?? dish.calories ?? dish.plannedCalories,
                ),
          proteinG: nutrient("proteinG"),
          fatG: nutrient("fatG"),
          carbG: nutrient("fatG") !== null ? nutrient("carbG") : numberOrNull(dish.carbG),
          fiberG: nutrient("fiberG"),
          calciumMg: nutrient("calciumMg"),
          source: String(menu.title || "Thực đơn đã công bố"),
          specialDietNotes: dish.specialDietNotes || null,
          substitutedFor: substitutedFor || null,
          allergens: Array.isArray(dish.allergens) ? dish.allergens : [],
          hasChildAllergyConflict: Boolean(hasChildAllergyConflict),
        };
      };

      const isChildAffectedByDish = (dish: any): boolean => {
        const affectedIds: string[] = Array.isArray(dish.affectedStudentIds)
          ? dish.affectedStudentIds.map(String)
          : [];
        if (childId && affectedIds.length > 0) {
          return affectedIds.includes(childId);
        }
        const dishAllergens: string[] = Array.isArray(dish.allergens)
          ? dish.allergens.map((a: any) => String(a).trim().toLowerCase())
          : [];
        if (childAllergensLower.length > 0 && dishAllergens.length > 0) {
          return dishAllergens.some((da) =>
            childAllergensLower.some(
              (ca) => da.includes(ca) || ca.includes(da),
            ),
          );
        }
        return childHasAllergy && dishAllergens.length > 0;
      };

      for (const primary of primaryRaw) {
        const primaryName = String(
          primary.dishName || primary.name || primary.dish?.name || "",
        ).trim();
        const primaryNameLower = primaryName.toLowerCase();

        const matchingSubs = subRaw.filter((sub: any) => {
          const replaced = extractReplacedDishName(sub.specialDietNotes).toLowerCase();
          return (
            replaced &&
            (replaced === primaryNameLower ||
              primaryNameLower.includes(replaced) ||
              replaced.includes(primaryNameLower))
          );
        });

        const allergySub =
          matchingSubs.find((s: any) =>
            isAllergySubstituteNote(s.specialDietNotes),
          ) || matchingSubs[0];

        const childAffected = isChildAffectedByDish(primary);

        if (
          audience === "parent" &&
          allergySub &&
          (childAffected ||
            (childHasAllergy &&
              isAllergySubstituteNote(allergySub.specialDietNotes)))
        ) {
          usedSubIds.add(String(allergySub.id || allergySub.dishId));
          const mappedSub = toPublishedDish(allergySub, primaryName, false);
          if (mappedSub) group.dishes.push(mappedSub);
        } else {
          const mappedPrimary = toPublishedDish(
            primary,
            null,
            audience === "parent" && childAffected,
          );
          if (mappedPrimary) group.dishes.push(mappedPrimary);
        }
      }

      if (audience === "kitchen") {
        for (const sub of subRaw) {
          const subKey = String(sub.id || sub.dishId);
          if (usedSubIds.has(subKey)) continue;
          const replacedName = extractReplacedDishName(sub.specialDietNotes);
          const mappedSub = toPublishedDish(
            sub,
            replacedName || "Suất riêng",
            false,
          );
          if (mappedSub) group.dishes.push(mappedSub);
        }
      }
    }
  return [...meals.values()]
    .filter((meal) => meal.dishes.length)
    .sort(
      (a, b) =>
        (mealSortOrder[a.mealType] || 99) - (mealSortOrder[b.mealType] || 99),
    );
}
export function publishedMenuDates(menu: PublishedMenu): string[] {
  if (!isPublishedMenu(menu) || !Array.isArray(menu.days)) return [];
  return [
    ...new Set<string>(
      menu.days.map((day: any) => calendarDate(day.date)).filter(Boolean),
    ),
  ].sort();
}

export function publishedDayNutrition(meals: PublishedMeal[]) {
  const dishes = meals.flatMap((meal) => meal.dishes);
  const total = (
    field: "calories" | "proteinG" | "fatG" | "carbG" | "fiberG" | "calciumMg",
  ) =>
    dishes.length && dishes.every((dish) => dish[field] !== null)
      ? Math.round(dishes.reduce((sum, dish) => sum + dish[field]!, 0) * 10) /
        10
      : null;
  return {
    calories: total("calories"),
    proteinG: total("proteinG"),
    fatG: total("fatG"),
    carbG: total("carbG"),
    fiberG: total("fiberG"),
    calciumMg: total("calciumMg"),
  };
}
