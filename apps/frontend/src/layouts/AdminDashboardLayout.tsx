import { t as translateText } from '../core/i18n/language';
import { useLanguage } from '../core/i18n/useLanguage';
import { principalNavigation } from "../features/school/principal-navigation";
import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  Coffee,
  FileCheck2,
  PackageOpen,
  ShieldCheck,
  ShieldAlert,
  CircleDollarSign,
  Headphones,
  MoreVertical,
  Bell,
  UtensilsCrossed,
  Scale,
  Activity,
  Star,
  MessageSquareText,
  ClipboardCheck,
  Menu,
} from "lucide-react";
import { UserProfileModal } from "../features/auth/components/UserProfileModal";
import { UserHeaderDropdown } from "../core/components/UserHeaderDropdown";
import { LogoutButton } from "../core/components/LogoutButton";
import { useAuthStore } from "../core/stores/auth.store";
import { tenantApi, TenantProfile } from "../core/api/tenant.api";

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "BGH";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const AdminDashboardLayout: React.FC = () => {
  useLanguage();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);
  const { user } = useAuthStore();
  const canManageParents = (user?.roles || []).some((role) =>
    [
      "SCHOOL_MANAGER",
      "PRINCIPAL",
      "SUPER_ADMIN",
      "SCHOOL_MANAGEMENT",
    ].includes(role.toUpperCase()),
  );
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState<string>(
    () => localStorage.getItem("school_name") || "Hệ thống Bán trú KidMeal",
  );
  const [schoolLogo, setSchoolLogo] = useState<string>("");
  const [schoolPhone, setSchoolPhone] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    tenantApi
      .getProfile()
      .then((profile) => {
        if (!mounted || !profile) return;
        if (profile.name) {
          setSchoolName(profile.name);
          localStorage.setItem("school_name", profile.name);
        }
        setSchoolLogo(profile.branding?.logoUrl || "");
        setSchoolPhone(profile.phone || "");
      })
      .catch(() => {
        // Giữ nguyên giá trị từ localStorage nếu chưa tải được
      });

    const handleTenantUpdated = (e: Event) => {
      const detail = (e as CustomEvent<TenantProfile>).detail;
      if (detail) {
        if (detail.name) setSchoolName(detail.name);
        setSchoolLogo(detail.branding?.logoUrl || "");
        setSchoolPhone(detail.phone || "");
      }
    };
    window.addEventListener("tenant-profile-updated", handleTenantUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("tenant-profile-updated", handleTenantUpdated);
    };
  }, []);

  // Danh mục menu Ban Giám Hiệu
  const navItems = principalNavigation;
  const getBreadcrumbTitle = () =>
    navItems.find((item) => location.pathname === item.path)?.label ||
    "Cổng Ban Giám Hiệu";

  const userInitials = getInitials(user?.fullName);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans antialiased text-slate-800">
      {/* 1. Sidebar Trái */}
      {sidebarOpen && <button type="button" aria-label={translateText("Đóng menu quản trị")} className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside id="admin-sidebar" className={`${sidebarOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 lg:static lg:flex w-64 shrink-0 bg-white border-r border-slate-200/80 flex-col justify-between shadow-xs z-40`}>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Header Sidebar: KidMeal BGH & Tên trường thực tế */}
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 shadow-inner shrink-0 overflow-hidden">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt={schoolName}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <UtensilsCrossed className="w-5 h-5" />
              )}
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-slate-900 tracking-tight">{translateText("KidMeal BGH")}</span>
              </div>
              <p
                className="text-[11px] text-slate-500 font-medium truncate"
                title={schoolName}
              >
                {schoolName}
              </p>
            </div>
          </div>

          {/* Tag Cổng Ban Giám Hiệu */}
          <div className="px-4 pt-3.5 pb-1">
            <div className="bg-teal-50/80 border border-teal-200/60 rounded-full py-1 px-3 flex items-center gap-2 text-[11px] font-bold text-teal-800">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
              <span>{translateText("CỔNG BAN GIÁM HIỆU")}</span>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <nav className="px-3 py-3 space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive =
                item.path === "/settings"
                  ? location.pathname === "/settings" ||
                    location.pathname === "/tenant/settings" ||
                    location.pathname === "/"
                  : location.pathname.startsWith(item.path);

              return (
                <React.Fragment key={item.path}>
                  {(index === 0 ||
                    item.group !== navItems[index - 1].group) && (
                    <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {translateText(item.group)}
                    </p>
                  )}
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-teal-600 text-white shadow-md shadow-teal-600/25 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`}
                    />
                    <span>{translateText(item.label)}</span>
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Chân Sidebar */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {/* Thẻ Hotline Nhà trường */}
          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-slate-400 leading-tight">{translateText("Hotline Nhà trường")}</p>
              <p className="text-xs font-bold text-teal-800 tracking-tight truncate">
                {translateText(schoolPhone || "Chưa cập nhật")}
              </p>
            </div>
          </div>

          {/* Thẻ User BGH */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-2.5 flex items-center justify-between shadow-xs">
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer flex-1 overflow-hidden"
            >
              <div className="w-8 h-8 rounded-full bg-teal-800 text-teal-50 font-bold text-xs flex items-center justify-center shadow-inner shrink-0">
                {userInitials}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                  {user?.fullName || user?.email || translateText("Ban Giám Hiệu")}
                </p>
                <p className="text-[10px] text-slate-400">{translateText("Hiệu trưởng / Quản lý")}</p>
              </div>
            </div>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              title={translateText("Xem & Cập nhật hồ sơ cá nhân")}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 shrink-0 gap-3 bg-white border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between z-20">
          {/* Breadcrumb */}
          <div className="min-w-0 flex-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <button type="button" className="lg:hidden shrink-0 rounded-lg p-1 text-teal-700 hover:bg-teal-50" aria-label={translateText("Mở menu quản trị")} aria-expanded={sidebarOpen} aria-controls="admin-sidebar" onClick={() => setSidebarOpen(open => !open)}><Menu className="h-5 w-5" /></button>
            <UtensilsCrossed className="hidden xl:block w-4 h-4 shrink-0 text-teal-600" />
            <span className="hidden xl:inline truncate hover:text-slate-800 cursor-pointer">
              {schoolName}
            </span>
            <span className="hidden xl:inline">›</span>
            <span className="truncate text-slate-900 font-semibold">
              {translateText(getBreadcrumbTitle())}
            </span>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-4">
            <UserHeaderDropdown />
          </div>
        </header>

        {/* Scrollable Page Container */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Modal Hồ sơ cá nhân */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};
