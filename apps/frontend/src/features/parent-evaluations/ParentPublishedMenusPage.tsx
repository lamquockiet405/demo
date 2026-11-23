import { useLanguage } from '../../core/i18n/useLanguage';
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ParentPortalTopNav } from "./components/ParentPortalTopNav";
import { PortalFooter } from "./components/PortalFooter";
import { PublishedMenusBrowser } from "../menus/components/PublishedMenusBrowser";
import { childrenApi, ChildItem } from "../children/api/children.api";
import { useAuthStore } from "../../core/stores/auth.store";

export function ParentPublishedMenusPage() {
  useLanguage();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [children, setChildren] = useState<ChildItem[]>([]);

  useEffect(() => {
    let active = true;
    childrenApi
      .getChildren({ limit: 50 })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : res?.items || [];
        setChildren(list);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      active = false;
    };
  }, []);

  const storedChildId =
    typeof localStorage !== "undefined" ? localStorage.getItem("parent_selected_child_id") || "" : "";
  const requestedChildId = searchParams.get("childId") || storedChildId;
  const matchedChild =
    children.find((c) => String(c.id) === String(requestedChildId)) ||
    children[0] ||
    ((user as any)?.children?.[0] as ChildItem | undefined);

  const childAllergens = (matchedChild?.allergies || [])
    .filter((a: any) => a?.isActive !== false)
    .map((a: any) => a?.allergenName || a?.customAllergenName || "")
    .filter(Boolean);
  const childHasAllergy = Boolean((matchedChild as any)?.hasAllergy || childAllergens.length > 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col antialiased">
      <ParentPortalTopNav
        child={
          matchedChild
            ? {
                id: String(matchedChild.id),
                name: matchedChild.fullName,
                className: matchedChild.className,
              }
            : undefined
        }
        activeTab="published-menus"
      />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
        <PublishedMenusBrowser
          audience="parent"
          syncDate
          childId={matchedChild ? String(matchedChild.id) : requestedChildId || undefined}
          childName={matchedChild?.fullName}
          childHasAllergy={childHasAllergy}
          childAllergens={childAllergens}
        />
      </main>
      <PortalFooter />
    </div>
  );
}
