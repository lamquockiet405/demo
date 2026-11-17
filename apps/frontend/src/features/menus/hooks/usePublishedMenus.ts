import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../../core/stores/auth.store";
import {
  fetchPublishedMenu,
  fetchPublishedMenus,
  publicationStorageKey,
  publishedMenusEvent,
} from "../api/published-menus.api";
import {
  PublishedMeal,
  PublishedMenu,
  PublishedMenuDayOptions,
  publishedMenuDay,
  publishedMenusForDate,
} from "../utils/published-menus";

export function useMenuResource<T>(
  key: string,
  loader: () => Promise<T>,
  enabled = true,
) {
  const request = useRef(0);
  const keyRef = useRef(key);
  keyRef.current = key;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    loading: boolean;
    error: string;
    revision: number;
  }>({ key: "", data: null, loading: false, error: "", revision: 0 });
  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!enabled) {
      setState({ key, data: null, loading: false, error: "", revision: id });
      return;
    }
    setState((previous) => ({
      key,
      data: previous.key === key ? previous.data : null,
      loading: true,
      error: "",
      revision: previous.revision,
    }));
    try {
      const data = await loader();
      if (id === request.current && keyRef.current === key)
        setState({ key, data, loading: false, error: "", revision: id });
    } catch (error: any) {
      if (id === request.current && keyRef.current === key)
        setState({
          key,
          data: null,
          loading: false,
          error:
            error?.response?.status === 403
              ? "Tài khoản chưa được cấp quyền xem thực đơn."
              : error?.response?.status >= 500
                ? "Chưa tải được thực đơn. Vui lòng thử lại."
                : error?.message || "Chưa tải được thực đơn.",
          revision: id,
        });
    }
  }, [key, enabled]);
  useEffect(() => {
    void reload();
    return () => {
      request.current++;
    };
  }, [reload]);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : "",
    loading: enabled && (state.key !== key || state.loading),
    revision: state.key === key ? state.revision : 0,
    reload,
  };
}

export function usePublishedMenus() {
  const tenant = useAuthStore(
    (state) => state.selectedTenantId || state.user?.tenantId || "1",
  );
  const resource = useMenuResource(
    `published-index:${tenant}`,
    fetchPublishedMenus,
  );
  useEffect(() => {
    const focus = () => {
      if (document.visibilityState === "visible") void resource.reload();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === publicationStorageKey(tenant)) void resource.reload();
    };
    const published = (event: Event) => {
      if ((event as CustomEvent).detail?.tenant === tenant)
        void resource.reload();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("storage", storage);
    window.addEventListener(publishedMenusEvent, published);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("storage", storage);
      window.removeEventListener(publishedMenusEvent, published);
    };
  }, [tenant, resource.reload]);
  return { ...resource, tenant };
}

export function usePublishedDay(
  date: string,
  ageGroup?: string,
  options?: PublishedMenuDayOptions,
) {
  const index = usePublishedMenus();
  const candidates = publishedMenusForDate(index.data || [], date, ageGroup);
  const childKey = `${options?.audience || "parent"}:${options?.childId || ""}:${options?.childHasAllergy ?? true}:${(options?.childAllergens || []).join(",")}`;
  const key = `published-day:${index.tenant}:${date}:${ageGroup || "ALL"}:${childKey}:${index.revision}:${candidates.map((menu) => menu.id).join(",")}`;
  const detail = useMenuResource(
    key,
    async () => {
      const results = await Promise.allSettled(
        candidates.map((menu) => fetchPublishedMenu(String(menu.id))),
      );
      const menus: PublishedMenu[] = [];
      const meals: PublishedMeal[] = [];
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
        menus.push(result.value);
        meals.push(...publishedMenuDay(result.value, date, options));
      }
      return { menus, meals };
    },
    index.data !== null && !index.loading && !index.error,
  );
  return {
    menus: detail.data?.menus || [],
    meals: detail.data?.meals || [],
    loading: index.loading || detail.loading,
    error: index.error || detail.error,
    reload: index.reload,
  };
}
