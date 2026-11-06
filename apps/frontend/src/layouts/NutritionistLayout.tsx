import { t as translateText } from '../core/i18n/language';
import { useLanguage } from '../core/i18n/useLanguage';
import { nutritionistNavigation } from "../features/nutrition/nutritionist-navigation";
import "../features/kitchen/kitchen-portal.css";
import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  User,
  Home,
  CheckCircle2,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuthStore } from "../core/stores/auth.store";
import { UserProfileModal } from "../features/auth/components/UserProfileModal";
import { UserHeaderDropdown } from "../core/components/UserHeaderDropdown";

export const NutritionistLayout: React.FC = () => {
  useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // 10 Tabs ngang chuẩn xác theo ảnh thiết kế NutriKid
  const navTabs = nutritionistNavigation;

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
      style={
        {
          "--kp-border": "#dfe7ed",
          "--kp-green": "#157454",
        } as React.CSSProperties
      }
      className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans"
    >
      {/* ─── 1. TOPBAR HEADER CHUẨN XÁC 100% THEO HÌNH ẢNH NUTRIKID ─── */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Hàng 1: Logo NutriKid, Search Bar trung tâm, Thông báo & Profile BS. Hoàng Mai Trang */}
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo bên trái: Khung xanh rêu bo tròn + Tên NutriKid + Badge BẢN CHUẨN */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/nutritionist/dashboard"
                className="flex items-center gap-2.5 group"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#0f382c] border border-emerald-800 flex items-center justify-center text-emerald-400 shadow-md group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 fill-emerald-300" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-slate-900 tracking-tight">{translateText("NutriKid")}{" "}
                    <span className="hidden sm:inline text-slate-500 font-medium text-xs sm:text-sm">{translateText("- Dinh dưỡng Mầm non")}</span>
                  </span>
                  <span className="hidden md:inline bg-[#4eed9c]/25 border border-emerald-500/30 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">{translateText("BẢN CHUẨN")}</span>
                </div>
              </Link>
            </div>

            {/* Bên phải: Profile Chuyên gia Dinh dưỡng */}
            <div className="flex items-center gap-3">
              <UserHeaderDropdown />
            </div>
          </div>

          {/* Hàng 2: Thanh Tab Bar ngang (Horizontal Tabs) */}
          <nav
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-2 border-t border-slate-100 no-scrollbar [&::-webkit-scrollbar]:hidden"
          >
            {navTabs.map((tab) => {
              // Active nếu URL khớp hoặc startsWith
              const isActive =
                tab.path === "/nutritionist/dashboard"
                  ? location.pathname === "/nutritionist/dashboard" ||
                    location.pathname === "/nutritionist" ||
                    location.pathname === "/nutritionist/"
                  : location.pathname.startsWith(tab.path);

              return (
                <Link
                  key={tab.label}
                  to={tab.path}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? "bg-[#4eed9c] text-emerald-950 font-bold shadow-xs hover:bg-[#45dc90]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium"
                  }`}
                >
                  {translateText(tab.label)}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Hàng 3: Dải phụ (Subbar / Breadcrumb) & Huy hiệu Chuẩn VN-RDA 2024 */}
        <div className="bg-[#f8fafc] border-t border-slate-200/60 py-2.5">
          <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
            {/* Breadcrumb bên trái */}
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Link
                to="/nutritionist/dashboard"
                className="hover:text-emerald-700 flex items-center gap-1"
              >
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>{translateText("Trang chủ")}</span>
              </Link>
              <span>›</span>
              <span className="text-slate-500">{translateText("Dinh dưỡng Mầm non")}</span>
              <span>›</span>
              <span className="text-slate-900 font-bold">
                {translateText(getBreadcrumbTitle())}
              </span>
            </div>

            {/* Badge bên phải: Chuẩn VN-RDA 2024 (Viện Dinh Dưỡng Quốc Gia) */}
            <div className="flex items-center gap-1.5 bg-[#4eed9c]/20 border border-emerald-500/40 text-emerald-900 font-bold text-xs px-3.5 py-1 rounded-full shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{translateText("Không gian chuyên gia dinh dưỡng")}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── 2. VÙNG NỘI DUNG CHÍNH (RENDER CÁC TRANG CON CỦA DINH DƯỠNG) ─── */}
      <main className="flex-1 w-full min-w-0 px-2 sm:px-4 py-3">
        <Outlet />
      </main>

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
