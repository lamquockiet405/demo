import { t as translateText } from '../core/i18n/language';
import { useLanguage } from '../core/i18n/useLanguage';
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Apple,
  Bell,
  Calculator,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  CalendarDays,
  FileBarChart2,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ShieldCheck,
  User,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "../core/stores/auth.store";
import { useSchoolBranding } from "../core/hooks/useSchoolBranding";
import { UserProfileModal } from "../features/auth/components/UserProfileModal";
import { UserHeaderDropdown } from "../core/components/UserHeaderDropdown";
import "../features/kitchen/kitchen-portal.css";

const groups = [
  {
    title: "ĐIỀU PHỐI",
    items: [
      {
        to: "/kitchen",
        label: "Tổng quan bếp",
        icon: LayoutDashboard,
        end: true,
      },
      {
        to: "/kitchen/portions",
        label: "Kế hoạch suất ăn",
        icon: ClipboardList,
      },
      {
        to: "/kitchen/menus",
        label: "Thực đơn đã công bố",
        icon: CalendarDays,
      },
      { to: "/kitchen/snack-roster", label: "Danh sách ăn sáng", icon: Users },
      { to: "/kitchen/notes", label: "Ghi chú phối hợp", icon: MessageSquare },
    ],
  },
  {
    title: "DANH MỤC & CHẾ ĐỘ ĂN",
    items: [
      {
        to: "/kitchen/allergies",
        label: "Dị ứng & chế độ ăn",
        icon: ShieldCheck,
      },
      { to: "/kitchen/allergy-alerts", label: "Cảnh báo dị ứng", icon: Bell },
      { to: "/kitchen/foods", label: "Nguyên liệu thực phẩm", icon: Apple },
      {
        to: "/kitchen/dishes",
        label: "Danh sách món ăn",
        icon: UtensilsCrossed,
      },
    ],
  },
  {
    title: "AN TOÀN & BÁO CÁO",
    items: [
      {
        to: "/kitchen/inspections",
        label: "Kiểm thực 3 bước",
        icon: ClipboardCheck,
      },
      { to: "/kitchen/samples", label: "Lưu mẫu 24 giờ", icon: FlaskConical },
      {
        to: "/kitchen/reports",
        label: "Báo cáo vận hành",
        icon: FileBarChart2,
      },
      {
        to: "/kitchen/gross-weight",
        label: "Dự trù nguyên liệu mua",
        icon: Calculator,
      },
    ],
  },
];

export const KitchenPortalLayout: React.FC = () => {
  useLanguage();
  const { user } = useAuthStore();
  const schoolBranding = useSchoolBranding();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);

  const retentionHours = schoolBranding.operationalSettings?.foodRetentionHours || 24;

  const dynamicGroups = React.useMemo(() => {
    return groups.map((g) => ({
      ...g,
      items: g.items.map((it) =>
        it.to === "/kitchen/samples"
          ? { ...it, label: `Lưu mẫu ${retentionHours} giờ` }
          : it,
      ),
    }));
  }, [retentionHours]);

  const current =
    dynamicGroups
      .flatMap((group) => group.items)
      .find((item) => item.to === location.pathname)?.label || "Bếp bán trú";
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);
  return (
    <div className="kitchen-portal">
      {open && (
        <button
          className="kp-sidebar-backdrop"
          aria-label={translateText("Đóng menu bếp")}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`kp-sidebar ${open ? "open" : ""}`}
        aria-label={translateText("Thanh điều hướng bếp")}
        id="kitchen-sidebar"
      >
        <NavLink to="/kitchen" className="kp-logo">
          <span className="overflow-hidden">
            {schoolBranding.logoUrl ? (
              <img
                src={schoolBranding.logoUrl}
                alt={schoolBranding.name}
                className="w-full h-full object-cover rounded-[13px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <ChefHat size={28} />
            )}
          </span>
          <div className="overflow-hidden">
            <strong className="truncate max-w-[145px]" title={schoolBranding.name}>
              {schoolBranding.name || translateText("KidMeal")}
            </strong>
            <small>{translateText("BẾP BÁN TRÚ")}</small>
          </div>
        </NavLink>
        <button
          className="kp-sidebar-close kp-button icon"
          aria-label={translateText("Đóng menu")}
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <nav>
          {dynamicGroups.map((group) => (
            <div className="kp-nav-group" key={group.title}>
              <p>{translateText(group.title)}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item && item.end}
                  className={({ isActive }) =>
                    `kp-nav-link ${isActive ? "active" : ""}`
                  }
                >
                  <item.icon size={18} />
                  <span>{translateText(item.label)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="kp-sidebar-footer">
          <ShieldCheck size={18} />
          <span>{translateText("Chuẩn bị chu đáo")}<br />
            <b>{translateText("An toàn mỗi bữa ăn")}</b>
          </span>
        </div>
      </aside>
      <div className="kp-workspace">
        <header className="kp-topbar">
          <div className="kp-breadcrumb">
            <button
              className="kp-menu-toggle kp-button icon"
              aria-label={translateText("Mở menu bếp")}
              aria-expanded={open}
              aria-controls="kitchen-sidebar"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>{translateText("Bếp bán trú ")}<i>/</i> <strong>{translateText(current)}</strong>
            </span>
          </div>
          <div className="kp-topbar-actions">
            <UserHeaderDropdown customSubtitle="Nhân viên bếp" />
          </div>
        </header>
        <div className="kp-content">
          <Outlet />
        </div>
      </div>
      <UserProfileModal isOpen={profile} onClose={() => setProfile(false)} />
    </div>
  );
};
