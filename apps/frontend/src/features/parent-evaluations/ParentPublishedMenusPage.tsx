import { useLanguage } from '../../core/i18n/useLanguage';
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export function ParentPublishedMenusPage() {
  useLanguage();
  const location = useLocation();
  return (
    <Navigate to={{ pathname: "/child-menu-consumption", search: location.search, hash: location.hash }} replace />
  );
}
