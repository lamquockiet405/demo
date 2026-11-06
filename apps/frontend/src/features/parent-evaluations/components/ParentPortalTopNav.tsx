import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Utensils,
  ShieldAlert,
  Coffee,
  MessageSquare,
  Baby,
  User,
  Activity,
  Bell,
  Eye,
} from "lucide-react";
import { ChildProfile } from "../types";
import { useAuthStore } from "../../../core/stores/auth.store";
import { UserProfileModal } from "../../auth/components/UserProfileModal";
import { UserHeaderDropdown } from "../../../core/components/UserHeaderDropdown";
import { LogoutButton } from "../../../core/components/LogoutButton";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";
import { ChildProfileModal } from "../../children/components/ChildProfileModal";

interface ParentPortalTopNavProps {
  child?: Partial<ChildProfile>;
  activeTab?:
    | "menu-consumption"
    | "allergies"
    | "snacks"
    | "breakfast"
    | "tuition"
    | "evaluation"
    | "published-menus"
    | "growth"
    | "alerts";
}

export const ParentPortalTopNav: React.FC<ParentPortalTopNavProps> = ({
  child,
  activeTab = "evaluation",
}) => {
  useLanguage();
  const location = useLocation();
  const { user } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const schoolBranding = useSchoolBranding();

  const currentTab = (() => {
    const p = location.pathname;
    if (p.includes("/growth")) return "growth";
    if (p.includes("/alerts")) return "alerts";
    if (p.includes("/declare-allergy")) return "allergies";
    if (p.includes("/parent-snack-payment") || p.includes("/vnpay")) return "snacks";
    if (p.includes("/submit-evaluation") || p.includes("/evaluation")) return "evaluation";
    if (p.includes("/child-menu-consumption") || p.includes("/parent-published-menus")) return "menu-consumption";
    return activeTab;
  })();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Portal Badge */}
          <div className="flex items-center gap-3">
            <Link
              to="/child-menu-consumption"
              className="flex items-center gap-2 hover:opacity-90 transition"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 p-0.5 flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0">
                {schoolBranding.logoUrl ? (
                  <img
                    src={schoolBranding.logoUrl}
                    alt={translateText(schoolBranding.name)}
                    className="w-full h-full object-cover rounded-[10px]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Utensils className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-teal-800 leading-none">{translateText("Kid")}<span className="text-emerald-500">{translateText("Meal")}</span>
                </span>
                <span
                  className="text-[10px] text-teal-700 font-semibold truncate max-w-[110px] sm:max-w-[160px]"
                  title={translateText(schoolBranding.name)}
                >
                  {schoolBranding.name}
                </span>
              </div>
            </Link>
            <span className="hidden sm:inline-flex text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">{translateText("Cổng Phụ Huynh")}</span>

            {/* Child Profile Button (UC26) */}
            <button
              type="button"
              onClick={() => setIsChildModalOpen(true)}
              className="ml-3 hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-full text-xs font-semibold text-slate-700 hover:text-teal-900 transition cursor-pointer"
              title={translateText("Xem chi tiết hồ sơ học sinh của con (UC26)")}
            >
              <Baby className="w-4 h-4 text-teal-600" />
              <span>
                {child?.name || translateText("Hồ sơ của bé")}
                {child?.className ? ` · ${child.className}` : ""}
              </span>
              <Eye className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>
          </div>

          {/* Right: User Dropdown Profile */}
          <div className="flex items-center gap-4">
            <UserHeaderDropdown customSubtitle={child?.parentRole || "Phụ huynh"} />
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          className="flex items-center gap-1 text-xs font-semibold overflow-x-auto pb-3 pt-1 [&>a]:shrink-0 [&>a]:whitespace-nowrap"
          aria-label={translateText("Điều hướng cổng phụ huynh")}
        >
          {/* 2. Thực đơn & Sức ăn (STT 87, STT 71) */}
          <Link
            to="/child-menu-consumption"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "menu-consumption" || currentTab === "published-menus"
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : "text-slate-600 hover:text-teal-700 hover:bg-slate-50 font-semibold"
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>{translateText("Thực đơn & Sức ăn")}</span>
          </Link>

          {/* 3. Dị ứng & Dinh dưỡng (STT 26, STT 29) */}
          <Link
            to="/declare-allergy"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "allergies"
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : "text-slate-600 hover:text-teal-700 hover:bg-slate-50 font-semibold"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{translateText("Dị ứng & Dinh dưỡng")}</span>
          </Link>

          {/* 4. Thể chất & Tăng trưởng WHO (STT 81, STT 83, STT 84, STT 85) */}
          <Link
            to="/parent/growth"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "growth"
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : "text-slate-600 hover:text-teal-700 hover:bg-slate-50 font-semibold"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{translateText("Thể chất & Z-Score")}</span>
          </Link>

          {/* 5. Tổng hợp Cảnh báo (STT 93) */}
          <Link
            to="/parent/alerts"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "alerts"
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : "text-slate-600 hover:text-teal-700 hover:bg-slate-50 font-semibold"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{translateText("Cảnh báo của con")}</span>
          </Link>

          {/* 6. Dịch vụ Ăn phụ & Ăn sáng VNPAY (STT 56-57, STT 61, STT 62) */}
          <Link
            to="/parent-snack-payment"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "breakfast" || currentTab === "snacks"
                ? "bg-amber-600 text-white font-bold shadow-xs"
                : "text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 font-bold border border-amber-200"
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>{translateText("Dịch vụ Ăn phụ (VNPAY)")}</span>
          </Link>

          {/* 7. Đánh giá Bữa ăn (STT 88) */}
          <Link
            to="/submit-evaluation"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "evaluation"
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : "text-slate-600 hover:text-teal-700 hover:bg-slate-50 font-semibold"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{translateText("Đánh giá & Góp ý")}</span>
          </Link>
        </nav>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Child Profile Modal (UC26) */}
      <ChildProfileModal
        isOpen={isChildModalOpen}
        onClose={() => setIsChildModalOpen(false)}
        childId={child?.id}
      />
    </header>
  );
};
