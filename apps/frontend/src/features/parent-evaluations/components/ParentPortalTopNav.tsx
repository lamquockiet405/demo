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
  Activity,
  Bell,
  Eye,
  CreditCard,
  FileText,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Menu,
  X,
  HeartHandshake,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { ChildProfile } from "../types";
import { useAuthStore } from "../../../core/stores/auth.store";
import { UserProfileModal } from "../../auth/components/UserProfileModal";
import { UserHeaderDropdown } from "../../../core/components/UserHeaderDropdown";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";
import { ChildProfileModal } from "../../children/components/ChildProfileModal";

interface ParentPortalTopNavProps {
  child?: Partial<ChildProfile>;
  activeTab?:
    | "menu-consumption"
    | "allergies"
    | "snacks"
    | "breakfast"
    | "receipts"
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const schoolBranding = useSchoolBranding();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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
  const storedChildId = typeof localStorage !== "undefined" ? localStorage.getItem("parent_selected_child_id") || "" : "";
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

  const currentTab = (() => {
    const p = location.pathname;
    if (p.includes("/growth")) return "growth";
    if (p.includes("/alerts")) return "alerts";
    if (p.includes("/declare-allergy")) return "allergies";
    if (p.includes("/parent-snack-payment") && location.search.includes("view=receipts")) return "receipts";
    if (p.includes("/parent-snack-payment") || p.includes("/vnpay")) return "snacks";
    if (p.includes("/submit-evaluation") || p.includes("/evaluation")) return "evaluation";
    if (p.includes("/parent/menus") || p.includes("/parent-published-menus")) return "published-menus";
    if (p.includes("/child-menu-consumption")) return "menu-consumption";
    return activeTab;
  })();

  const navItems = [
    {
      group: "BỮA ĂN & DINH DƯỠNG",
      items: [
        {
          id: "published-menus",
          to: "/parent/menus",
          label: "Thực đơn tuần",
          icon: Utensils,
          isActive: currentTab === "published-menus",
        },
        {
          id: "menu-consumption",
          to: "/child-menu-consumption",
          label: "Sức ăn & Ghi chú GV",
          icon: HeartHandshake,
          isActive: currentTab === "menu-consumption",
        },
        {
          id: "allergies",
          to: "/declare-allergy",
          label: "Dị ứng & Thực phẩm cần tránh",
          icon: ShieldAlert,
          isActive: currentTab === "allergies",
        },
        {
          id: "snacks",
          to: "/parent-snack-payment",
          label: "Thực đơn ăn xế & Thanh toán",
          icon: Coffee,
          isActive: currentTab === "breakfast" || currentTab === "snacks",
        },
        {
          id: "receipts",
          to: "/parent-snack-payment?view=receipts",
          label: "Lịch sử biên lai",
          icon: FileText,
          isActive: currentTab === "receipts",
        },
      ],
    },
    {
      group: "SỨC KHỎE & TƯƠNG TÁC",
      items: [
        {
          id: "growth",
          to: "/parent/growth",
          label: "Theo dõi thể chất",
          icon: Activity,
          isActive: currentTab === "growth",
        },
        {
          id: "alerts",
          to: "/parent/alerts",
          label: "Cảnh báo của con",
          icon: Bell,
          isActive: currentTab === "alerts",
        },
        {
          id: "evaluation",
          to: "/submit-evaluation",
          label: "Đánh giá & Góp ý",
          icon: MessageSquare,
          isActive: currentTab === "evaluation",
        },
      ],
    },
  ];

  const activeNavLabel =
    navItems.flatMap((g) => g.items).find((item) => item.isActive)?.label ||
    "Cổng Phụ Huynh";

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          div:has(> #parent-sidebar) {
            padding-left: 16rem;
          }
        }
      `}</style>

      {/* Backdrop trên mobile */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={translateText("Đóng menu phụ huynh")}
          className="fixed !m-0 inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── 1. SIDEBAR TRÁI - TÔNG MÀU XANH LÁ ĐẬM (DARK EMERALD / TEAL) ĐỒNG BỘ GIAO DIỆN PHỤ HUYNH ─── */}
      <aside
        id="parent-sidebar"
        ref={sidebarRef}
        aria-label={translateText("Điều hướng cổng phụ huynh")}
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } fixed inset-y-0 left-0 lg:flex w-64 shrink-0 bg-gradient-to-b from-[#064e3b] via-[#065f46] to-[#0f766e] border-r border-emerald-800/80 flex-col justify-between shadow-lg z-50 text-white`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Header Sidebar */}
          <div className="p-5 border-b border-emerald-700/60 bg-emerald-950/30 backdrop-blur-xs flex items-center justify-between gap-2">
            <Link
              to="/parent/menus"
              className="flex items-center gap-3 overflow-hidden hover:opacity-95 transition"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-300 p-0.5 flex items-center justify-center text-emerald-950 shadow-sm overflow-hidden shrink-0">
                {schoolBranding.logoUrl ? (
                  <img
                    src={schoolBranding.logoUrl}
                    alt={translateText(schoolBranding.name)}
                    className="w-full h-full object-cover rounded-[14px] bg-white"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Utensils className="w-5 h-5" />
                )}
              </div>
              <div className="overflow-hidden">
                <span className="text-base font-black tracking-tight text-white block leading-tight">
                  {translateText("Kid")}
                  <span className="text-emerald-300">{translateText("Meal")}</span>
                </span>
                <span
                  className="text-[11px] text-emerald-200 font-semibold truncate block"
                  title={translateText(schoolBranding.name)}
                >
                  {schoolBranding.name}
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60"
              aria-label={translateText("Đóng menu")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tag Cổng Phụ Huynh */}
          <div className="px-4 pt-3.5 pb-1">
            <div className="bg-emerald-900/70 border border-emerald-600/60 rounded-full py-1 px-3 flex items-center gap-2 text-[11px] font-bold text-emerald-100 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{translateText("CỔNG PHỤ HUYNH")}</span>
            </div>
          </div>

          {/* Chọn bé / Hồ sơ bé nhanh trên Sidebar */}
          <div className="px-3 pt-2.5 pb-1">
            <div className="bg-emerald-950/35 border border-emerald-700/60 rounded-2xl p-2.5 space-y-2 shadow-2xs">
              {linkedChildren.length > 1 ? (
                <div className="relative flex items-center">
                  <Baby className="w-4 h-4 text-emerald-300 absolute left-2.5 pointer-events-none" />
                  <select
                    value={currentChildId}
                    onChange={(e) => handleSwitchChild(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-emerald-900/60 hover:bg-emerald-800/70 border border-emerald-700/60 text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer transition appearance-none"
                    title={translateText("Chọn học sinh muốn xem thông tin")}
                  >
                    {linkedChildren.map((c: any) => (
                      <option key={c.id} value={c.id} className="text-slate-900 bg-white">
                        {c.fullName || c.name} {c.className ? `· ${String(c.className).replace(/\s*\([^)]*\)/g, '').trim()}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-300 absolute right-2.5 pointer-events-none" />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setIsChildModalOpen(true)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/70 border border-emerald-700/50 rounded-xl text-xs font-semibold text-emerald-50 transition cursor-pointer"
                title={translateText("Xem chi tiết hồ sơ học sinh của con")}
              >
                <span className="flex items-center gap-2 truncate">
                  <Baby className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="truncate">
                    {childDisplayName || translateText("Hồ sơ của bé")}
                    {childDisplayClass ? ` · ${String(childDisplayClass).replace(/\s*\([^)]*\)/g, '').trim()}` : ""}
                  </span>
                </span>
                <Eye className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              </button>
            </div>
          </div>

          {/* Danh mục điều hướng bên trái */}
          <nav className="px-3 py-2 space-y-1">
            {navItems.map((section) => (
              <div key={section.group} className="pb-2">
                <p className="px-3 pt-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300/80">
                  {translateText(section.group)}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.id}
                        to={item.to}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                          item.isActive
                            ? "bg-white text-emerald-900 shadow-md font-bold"
                            : "text-emerald-100/85 hover:text-white hover:bg-emerald-800/60"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            item.isActive ? "text-emerald-700" : "text-emerald-300"
                          }`}
                        />
                        <span className="truncate">{translateText(item.label)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* ─── 2. TOPBAR HEADER BÊN PHẢI ─── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Left: Mobile toggle & Breadcrumb */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                className="lg:hidden shrink-0 rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50"
                aria-label={translateText("Mở menu phụ huynh")}
                aria-expanded={sidebarOpen}
                aria-controls="parent-sidebar"
                onClick={() => setSidebarOpen((open) => !open)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium truncate">
                <span className="hidden sm:inline text-emerald-700 font-bold">
                  {translateText("Cổng Phụ Huynh")}
                </span>
                <span className="hidden sm:inline">›</span>
                <span className="text-slate-900 font-bold truncate">
                  {translateText(activeNavLabel)}
                </span>
              </div>
            </div>

            {/* Right: Notifications & User Profile */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Notification Bell Dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen((prev) => !prev)}
                  className="relative p-2 rounded-full hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
                  title={translateText("Thông báo từ nhà trường")}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-3.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">
                          {translateText("Thông báo từ Nhà trường")}
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            {unreadCount} {translateText("mới")}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
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
                              n.isRead ? "bg-white hover:bg-slate-50 opacity-80" : "bg-rose-50/40 hover:bg-rose-50/80"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              n.type === 'PAYMENT_REMINDER'
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
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
                                    className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs"
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
                        className="text-xs text-rose-700 hover:text-rose-900 font-bold inline-flex items-center gap-1"
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
    </>
  );
};
