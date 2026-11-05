import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export function ParentPublishedMenusPage() {
  const location = useLocation();
  return (
    <Navigate to={{ pathname: "/child-menu-consumption", search: location.search, hash: location.hash }} replace />
  );
}
