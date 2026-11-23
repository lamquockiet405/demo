import { t as translateText } from '../core/i18n/language';
import { useLanguage } from '../core/i18n/useLanguage';
import { nutritionistNavigation } from "../features/nutrition/nutritionist-navigation";
import "../features/kitchen/kitchen-portal.css";
import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home,
  CheckCircle2,
  LayoutDashboard,
  Users,
  ShieldAlert,
  Apple,
  UtensilsCrossed,
  CalendarDays,
  AlertCircle,
  Activity,
  Bell,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { UserProfileModal } from "../features/auth/components/UserProfileModal";
import { UserHeaderDropdown } from "../core/components/UserHeaderDropdown";
import { useSchoolBranding } from "../core/hooks/useSchoolBranding";

const getNavIcon = (path: string) => {
  if (path.includes("/dashboard")) return LayoutDashboard;
  if (path.includes("/children")) return Users;
  if (path.includes("/allergens")) return ShieldAlert;
  if (path.includes("/foods")) return Apple;
  if (path.includes("/dishes")) return UtensilsCrossed;
  if (path.includes("/menus")) return CalendarDays;
  if (path.includes("/picky-eating")) return AlertCircle;
  if (path.includes("/growth")) return Activity;
  if (path.includes("/alerts")) return Bell;
  return LayoutDashboard;
};

const getNavGroup = (path: string) => {
  if (path.includes("/dashboard") || path.includes("/menus")) return "TỔNG QUAN & THỰC ĐƠN";
  if (path.includes("/foods") || path.includes("/dishes") || path.includes("/allergens"))
    return "NGUYÊN LIỆU & MÓN ĂN";
  return "THEO DÕI HỌC SINH";
};

export const NutritionistLayout: React.FC = () => {
  useLanguage();
  const location = useLocation();
  const schoolBranding = useSchoolBranding();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  const navTabs = nutritionistNavigation;

  const groupedNav = [
    {
      title: "TỔNG QUAN & THỰC ĐƠN",
      items: navTabs.filter((t) => getNavGroup(t.path) === "TỔNG QUAN & THỰC ĐƠN"),
    },
    {
      title: "NGUYÊN LIỆU & MÓN ĂN",
      items: navTabs.filter((t) => getNavGroup(t.path) === "NGUYÊN LIỆU & MÓN ĂN"),
    },
    {
      title: "THEO DÕI HỌC SINH",
      items: navTabs.filter((t) => getNavGroup(t.path) === "THEO DÕI HỌC SINH"),
    },
  ];

  // Xác định tiêu đề breadcrumb theo URL hiện tại
  const getBreadcrumbTitle = () => {
    if (location.pathname === "/nutritionist" || location.pathname === "/nutritionist/") return "Dashboard";
    const current = navTabs.find((t) => location.pathname.startsWith(t.path));
    if (current) return current.label;
    if (location.pathname.includes("/dashboard")) return "Dashboard";
    if (location.pathname.includes("/menus")) return "Quản lý thực đơn tuần";
    if (location.pathname.includes("/rules"))
      return "Quy chuẩn dinh dưỡng & Dị ứng";
    return "Cổng Chuyên gia Dinh dưỡng";
  };

  return (
    <div
      className="role-nutritionist flex h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased"
    >
      {/* ─── 1. SIDEBAR TRÁI - TÔNG MÀU XANH LÁ CỐM SÁNG (LIGHT LIME / FRESH GREEN) RIÊNG CỦA CHUYÊN GIA DINH DƯỠNG ─── */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={translateText("Đóng menu dinh dưỡng")}
          className="fixed !m-0 inset-0 bg-slate-900/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="nutritionist-sidebar"
        aria-label={translateText("Thanh điều hướng chuyên gia dinh dưỡng")}
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } fixed inset-y-0 left-0 lg:static lg:flex w-64 shrink-0 bg-gradient-to-b from-[#f7fee7] via-[#ecfccb]/70 to-[#d9f99d]/60 border-r border-lime-300/90 flex-col justify-between shadow-sm z-40`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Header Sidebar */}
          <div className="p-5 border-b border-lime-300/70 bg-white/55 backdrop-blur-xs flex items-center justify-between gap-2">
            <Link to="/nutritionist/dashboard" className="flex items-center gap-3 overflow-hidden group">
              <div className="w-10 h-10 rounded-2xl bg-lime-500/20 border border-lime-500/40 flex items-center justify-center text-lime-800 shadow-inner shrink-0 overflow-hidden">
                {schoolBranding.logoUrl ? (
                  <img
                    src={schoolBranding.logoUrl}
                    alt={schoolBranding.name}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Apple className="w-5 h-5 text-lime-700" />
                )}
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm text-lime-950 tracking-tight">
                    {translateText("KidMeal Nutri")}
                  </span>
                </div>
                <p
                  className="text-[11px] text-lime-800 font-semibold truncate"
                  title={schoolBranding.name}
                >
                  {schoolBranding.name}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-lime-800 hover:bg-lime-200/60"
              aria-label={translateText("Đóng menu")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tag Cổng Chuyên Gia Dinh Dưỡng */}
          <div className="px-4 pt-3.5 pb-1">
            <div className="bg-lime-200/80 border border-lime-400/80 rounded-full py-1 px-3 flex items-center gap-2 text-[11px] font-bold text-lime-950 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-lime-600 animate-pulse"></span>
              <span>{translateText("CHUYÊN GIA DINH DƯỠNG")}</span>
            </div>
          </div>

          {/* Danh sách điều hướng dọc */}
          <nav className="px-3 py-3 space-y-1">
            {groupedNav.map((group) => (
              <div key={group.title} className="pb-2">
                <p className="px-3 pt-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-lime-800/80">
                  {translateText(group.title)}
                </p>
                <div className="space-y-1">
                  {group.items.map((tab) => {
                    const Icon = getNavIcon(tab.path);
                    const isActive =
                      tab.path === "/nutritionist/dashboard"
                        ? location.pathname === "/nutritionist/dashboard" ||
                          location.pathname === "/nutritionist" ||
                          location.pathname === "/nutritionist/"
                        : location.pathname.startsWith(tab.path);

                    return (
                      <Link
                        key={tab.path}
                        to={tab.path}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-gradient-to-r from-lime-600 to-green-600 text-white shadow-md shadow-lime-600/25 font-bold"
                            : "text-lime-950/85 hover:text-lime-950 hover:bg-lime-200/70"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-white" : "text-lime-700"
                          }`}
                        />
                        <span className="truncate">{translateText(tab.label)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

      </aside>

      {/* ─── 2. VÙNG NỘI DUNG CHÍNH BÊN PHẢI ─── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200/90 px-4 lg:px-8 flex items-center justify-between gap-4 z-20">
          {/* Breadcrumb bên trái */}
          <div className="min-w-0 flex-1 flex items-center gap-2 text-xs text-slate-500 font-medium">
            <button
              type="button"
              className="lg:hidden shrink-0 rounded-lg p-1.5 text-lime-800 hover:bg-lime-100"
              aria-label={translateText("Mở menu dinh dưỡng")}
              aria-expanded={sidebarOpen}
              aria-controls="nutritionist-sidebar"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to="/nutritionist/dashboard"
              className="hover:text-lime-700 hidden sm:flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5 text-lime-600" />
              <span>{translateText("Dinh dưỡng Mầm non")}</span>
            </Link>
            <span className="hidden sm:inline">›</span>
            <span className="text-slate-900 font-bold truncate">
              {translateText(getBreadcrumbTitle())}
            </span>
          </div>

          {/* Bên phải: Badge & Profile Chuyên gia Dinh dưỡng */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 bg-lime-100/80 border border-lime-400/60 text-lime-950 font-bold text-xs px-3 py-1 rounded-full shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-lime-700" />
              <span>{translateText("Không gian chuyên gia dinh dưỡng")}</span>
            </div>
            <UserHeaderDropdown />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto px-3 sm:px-6 py-4">
          <Outlet />
        </main>
      </div>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
};
