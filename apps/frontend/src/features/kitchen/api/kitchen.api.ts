import { apiClient } from "../../../core/api/axios";
import { rowsOf } from "../utils/kitchen-operations";
import {
  extractInspectionMenuDishes,
  isInspectionMenuForDate,
} from "../utils/inspection-menu";

// Read every page before filtering locally so results never omit later pages.
export async function fetchKitchenCollection(
  path: string,
  params: Record<string, unknown> = {},
) {
  const first = (
    await apiClient.get(path, { params: { ...params, page: 1, limit: 200 } })
  ).data;
  const rows = rowsOf(first);
  const pages = Math.ceil(
    Number(first?.total ?? first?.meta?.total ?? rows.length) / 200,
  );
  const results = await Promise.allSettled(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
      apiClient.get(path, {
        params: { ...params, page: index + 2, limit: 200 },
      }),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    rows.push(...rowsOf(result.value.data));
  }
  return rows;
}

export async function getInspectionMenuDishes(
  date: string,
  mealSession: string,
) {
  const candidates = (await fetchKitchenCollection("/menus")).filter((menu) =>
    isInspectionMenuForDate(menu, date),
  );
  const details = await Promise.allSettled(
    candidates.map((menu) =>
      apiClient.get(`/menus/${encodeURIComponent(String(menu.id))}`),
    ),
  );
  const menus: Record<string, any>[] = [];
  for (const detail of details) {
    if (detail.status === "rejected") throw detail.reason;
    menus.push(detail.value.data);
  }
  return extractInspectionMenuDishes(menus, date, mealSession);
}
