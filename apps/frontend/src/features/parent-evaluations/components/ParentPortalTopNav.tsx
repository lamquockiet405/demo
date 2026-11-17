import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect, useRef } from "react";
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
  CreditCard,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";
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

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/payments/notifications');
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 20000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: number) => {
    try {
      await apiClient.put(`/payments/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.put('/payments/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  const linkedChildren: any[] = (user as any)?.children || [];
  const storedChildId = localStorage.getItem("parent_selected_child_id") || "";
  const effectiveChild =
    (child && child.id != null && String(child.id) !== "undefined" && String(child.id) !== "null")
      ? child
      : (storedChildId ? linkedChildren.find((c) => String(c.id) === storedChildId) : null) ||
        linkedChildren[0] ||
        child ||
        null;
  const currentChildId =
    effectiveChild && effectiveChild.id != null && String(effectiveChild.id) !== "undefined" && String(effectiveChild.id) !== "null"
      ? String(effectiveChild.id)
      : "";
  const childDisplayName = effectiveChild?.name || effectiveChild?.fullName || "";
  const childDisplayClass = effectiveChild?.className || "";

  const handleSwitchChild = (newChildId: string) => {
    localStorage.setItem("parent_selected_child_id", newChildId);
    const url = new URL(window.location.href);
    url.searchParams.set("childId", newChildId);
    window.location.href = url.toString();
  };

  const theme = React.useMemo(() => {
    switch (schoolBranding.primaryColor) {
      case "YELLOW":
        return {
          gradient: "from-amber-500 to-yellow-500",
          activeTab: "bg-amber-600 text-white font-bold shadow-xs",
          hoverTab: "text-slate-600 hover:text-amber-700 hover:bg-slate-50 font-semibold",
          titleColor: "text-amber-900",
          subColor: "text-amber-700",
          badgeColor: "text-amber-800 bg-amber-50 border-amber-200",
        };
      case "ORANGE":
        return {
          gradient: "from-orange-500 to-amber-500",
          activeTab: "bg-orange-600 text-white font-bold shadow-xs",
          hoverTab: "text-slate-600 hover:text-orange-700 hover:bg-slate-50 font-semibold",
          titleColor: "text-orange-900",
          subColor: "text-orange-700",
          badgeColor: "text-orange-800 bg-orange-50 border-orange-200",
        };
      default:
        return {
          gradient: "from-teal-600 to-emerald-500",
          activeTab: "bg-teal-600 text-white font-bold shadow-xs",
          hoverTab: "text-slate-600 hover:text-teal-700 hover:bg-slate-50 font-semibold",
          titleColor: "text-teal-800",
          subColor: "text-teal-700",
          badgeColor: "text-teal-700 bg-teal-50 border-teal-200",
        };
    }
  }, [schoolBranding.primaryColor]);

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
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${theme.gradient} p-0.5 flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0`}>
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
                <span className={`text-xl font-black tracking-tight ${theme.titleColor} leading-none`}>{translateText("Kid")}<span className="text-emerald-500">{translateText("Meal")}</span>
                </span>
                <span
                  className={`text-[10px] ${theme.subColor} font-semibold truncate max-w-[110px] sm:max-w-[160px]`}
                  title={translateText(schoolBranding.name)}
                >
                  {schoolBranding.name}
                </span>
              </div>
            </Link>
            <span className={`hidden sm:inline-flex text-[11px] font-bold ${theme.badgeColor} border px-2.5 py-0.5 rounded-full uppercase tracking-wider`}>{translateText("Cổng Phụ Huynh")}</span>

            {/* Child Profile Button or Selector */}
            {linkedChildren.length > 1 ? (
              <div className="ml-2 sm:ml-3 flex items-center gap-1.5">
                <div className="relative flex items-center">
                  <Baby className="w-3.5 h-3.5 text-teal-600 absolute left-2.5 pointer-events-none" />
                  <select
                    value={currentChildId}
                    onChange={(e) => handleSwitchChild(e.target.value)}
                    className="pl-7 pr-7 py-1.5 bg-teal-50 hover:bg-teal-100/70 border border-teal-300 text-teal-900 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer transition appearance-none shadow-xs"
                    title={translateText("Chọn học sinh muốn xem thông tin")}
                  >
                    {linkedChildren.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName || c.name} {c.className ? `· ${c.className}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-teal-600 absolute right-2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsChildModalOpen(true)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-teal-600 transition"
                  title={translateText("Xem chi tiết hồ sơ bé")}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsChildModalOpen(true)}
                className="ml-2 sm:ml-3 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-full text-xs font-semibold text-slate-700 hover:text-teal-900 transition cursor-pointer"
                title={translateText("Xem chi tiết hồ sơ học sinh của con")}
              >
                <Baby className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="truncate max-w-[130px] sm:max-w-[200px]">
                  {childDisplayName || translateText("Hồ sơ của bé")}
                  {childDisplayClass ? ` · ${childDisplayClass}` : ""}
                </span>
                <Eye className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
              </button>
            )}
          </div>

          {/* Right: Notifications & User Profile */}
          <div className="flex items-center gap-3">
            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                title={translateText("Thông báo từ nhà trường")}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">
                        {translateText("Thông báo từ Nhà trường")}
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                          {unreadCount} {translateText("mới")}
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        {translateText("Đã đọc tất cả")}
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        {translateText("Chưa có thông báo nào")}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => void markAsRead(n.id)}
                          className={`p-3.5 transition flex items-start gap-3 cursor-pointer ${
                            n.isRead ? "bg-white hover:bg-slate-50 opacity-80" : "bg-amber-50/50 hover:bg-amber-50"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            n.type === 'PAYMENT_REMINDER'
                              ? "bg-amber-100 text-amber-700"
                              : "bg-teal-100 text-teal-700"
                          }`}>
                            {n.type === 'PAYMENT_REMINDER' ? (
                              <CreditCard className="w-4 h-4" />
                            ) : (
                              <Bell className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {n.title}
                              </h4>
                              {!n.isRead && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                              {n.content}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-slate-400">
                                {n.createdAt ? new Date(n.createdAt).toLocaleDateString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : ""}
                              </span>
                              {n.type === 'PAYMENT_REMINDER' && (
                                <Link
                                  to="/parent-snack-payment"
                                  onClick={() => setIsNotifOpen(false)}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs"
                                >
                                  {translateText("Thanh toán ngay")}
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <Link
                      to="/parent/alerts"
                      onClick={() => setIsNotifOpen(false)}
                      className="text-xs text-teal-700 hover:text-teal-900 font-bold inline-flex items-center gap-1"
                    >
                      {translateText("Xem tất cả cảnh báo & theo dõi của bé")}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <UserHeaderDropdown customSubtitle="Phụ huynh" />
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
                ? theme.activeTab
                : theme.hoverTab
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>{translateText("Thực đơn & Sức ăn")}</span>
          </Link>

          {/* 3. Dị ứng & Thực phẩm cần tránh (STT 26) */}
          <Link
            to="/declare-allergy"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "allergies"
                ? theme.activeTab
                : theme.hoverTab
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{translateText("Dị ứng & Thực phẩm cần tránh")}</span>
          </Link>

          {/* 4. Thể chất & Tăng trưởng WHO (STT 81, STT 83, STT 84, STT 85) */}
          <Link
            to="/parent/growth"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "growth"
                ? theme.activeTab
                : theme.hoverTab
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{translateText("Theo dõi thể chất")}</span>
          </Link>

          {/* 5. Tổng hợp Cảnh báo (STT 93) */}
          <Link
            to="/parent/alerts"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "alerts"
                ? theme.activeTab
                : theme.hoverTab
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{translateText("Cảnh báo của con")}</span>
          </Link>

          {/* 6. Thực đơn Ăn xế & Suất ăn theo tuần VNPAY */}
          <Link
            to="/parent-snack-payment"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "breakfast" || currentTab === "snacks"
                ? "bg-amber-600 text-white font-bold shadow-xs"
                : "text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 font-bold border border-amber-200"
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>{translateText("Thực đơn ăn xế")}</span>
          </Link>

          {/* 7. Đánh giá Bữa ăn (STT 88) */}
          <Link
            to="/submit-evaluation"
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              currentTab === "evaluation"
                ? theme.activeTab
                : theme.hoverTab
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

      {/* Child Profile Modal */}
      <ChildProfileModal
        isOpen={isChildModalOpen}
        onClose={() => setIsChildModalOpen(false)}
        childId={currentChildId || child?.id || (user as any)?.children?.[0]?.id}
      />
    </header>
  );
};
