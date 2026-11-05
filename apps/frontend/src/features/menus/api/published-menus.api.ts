import { apiClient } from "../../../core/api/axios";
import {
  isPublishedMenu,
  PublishedMenu,
  publishedMenuOrder,
} from "../utils/published-menus";

async function fetchMenuStatus(
  status: "PUBLISHED" | "ARCHIVED",
): Promise<PublishedMenu[]> {
  const first = (
    await apiClient.get("/menus", {
      params: { status, page: 1, limit: 200, includeDeleted: false },
    })
  ).data;
  if (!Array.isArray(first?.items))
    throw new Error("Không đọc được danh sách thực đơn công bố.");
  const menus = [...first.items];
  const pages = Math.ceil(Number(first.total || menus.length) / 200);
  const results = await Promise.allSettled(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      apiClient.get("/menus", {
        params: { status, page: i + 2, limit: 200, includeDeleted: false },
      }),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    if (!Array.isArray(result.value.data?.items))
      throw new Error("Không đọc được lịch sử thực đơn.");
    menus.push(...result.value.data.items);
  }
  return menus;
}
export async function fetchPublishedMenus(): Promise<PublishedMenu[]> {
  const groups = await Promise.allSettled([
    fetchMenuStatus("PUBLISHED"),
    fetchMenuStatus("ARCHIVED"),
  ]);
  const menus = new Map<string, PublishedMenu>();
  for (const group of groups) {
    if (group.status === "rejected") throw group.reason;
    for (const menu of group.value)
      if (isPublishedMenu(menu)) menus.set(String(menu.id), menu);
  }
  return [...menus.values()].sort(publishedMenuOrder);
}
export async function fetchPublishedMenu(id: string): Promise<PublishedMenu> {
  const menu = (await apiClient.get(`/menus/${encodeURIComponent(id)}`)).data;
  if (!menu || !isPublishedMenu(menu))
    throw new Error("Thực đơn này chưa được công bố hoặc đã được thu hồi.");
  if (!Array.isArray(menu.days))
    throw new Error("Không đọc được chi tiết thực đơn công bố.");
  return menu;
}

export const publishedMenusEvent = "menus-published";
export const publicationStorageKey = (tenant: string) =>
  `published-menu-update:${tenant}`;
export function notifyMenuPublished() {
  const tenant = localStorage.getItem("tenant_id") || "1";
  try {
    localStorage.setItem(publicationStorageKey(tenant), String(Date.now()));
  } catch {
    /* Refresh still works when browser storage is unavailable. */
  }
  window.dispatchEvent(
    new CustomEvent(publishedMenusEvent, { detail: { tenant } }),
  );
}
