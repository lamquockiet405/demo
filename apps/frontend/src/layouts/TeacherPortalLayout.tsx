import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  GraduationCap,
  Users,
  HeartPulse,
  ShieldAlert,
  Coffee,
  ClipboardList,
  MessageSquare,
  UtensilsCrossed,
  CalendarDays,
  AlertCircle,
  Activity,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { UserHeaderDropdown } from "../core/components/UserHeaderDropdown";
import "../features/kitchen/kitchen-portal.css";

const teacherGroups = [
  {
    title: "LỚP HỌC & HỒ SƠ",
    items: [
      {
        to: "/teacher/classes",
        label: "Lớp phụ trách",
        icon: GraduationCap,
      },
      {
        to: "/teacher/students",
        label: "Hồ sơ học sinh",
        icon: Users,
      },
      {
        to: "/teacher/nutrition-profiles",
        label: "Hồ sơ dinh dưỡng",
        icon: HeartPulse,
      },
      {
        to: "/teacher/allergies",
        label: "Chế độ ăn & dị ứng",
        icon: ShieldAlert,
      },
    ],
  },
  {
    title: "BỮA ĂN BÁN TRÚ",
    items: [
      {
        to: "/teacher/snack-roster",
        label: "Danh sách ăn phụ",
        icon: Coffee,
      },
      {
        to: "/teacher/portions",
        label: "Kế hoạch suất ăn",
        icon: ClipboardList,
      },
      {
        to: "/teacher/notes",
        label: "Ghi chú sau bữa ăn",
        icon: MessageSquare,
      },
      {
        to: "/teacher/meals",
        label: "Điểm danh & tình trạng ăn",
        icon: UtensilsCrossed,
      },
      {
        to: "/teacher/history",
        label: "Lịch sử ăn uống",
        icon: CalendarDays,
      },
      {
        to: "/teacher/picky-eating",
        label: "Theo dõi trẻ kén ăn",
        icon: AlertCircle,
      },
    ],
  },
  {
    title: "THỂ CHẤT",
    items: [
      {
        to: "/teacher/growth",
        label: "Chiều cao & cân nặng",
        icon: Activity,
      },
    ],
  },
];

export function TeacherPortalLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const current =
    teacherGroups
      .flatMap((g) => g.items)
      .find((item) => item.to === location.pathname)?.label || "Giáo viên phụ trách";

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <div className="kitchen-portal">
      {open && (
        <button
          className="kp-sidebar-backdrop"
          aria-label="Đóng menu giáo viên"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar matching Kitchen Portal layout */}
      <aside
        className={`kp-sidebar ${open ? "open" : ""}`}
        aria-label="Thanh điều hướng giáo viên"
        id="teacher-sidebar"
      >
        <NavLink to="/teacher/classes" className="kp-logo">
          <span>
            <GraduationCap size={28} />
          </span>
          <div>
            <strong>KidMeal</strong>
            <small>GIÁO VIÊN MẦM NON (3-6 TUỔI)</small>
          </div>
        </NavLink>

        <button
          className="kp-sidebar-close kp-button icon"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>

        <nav>
          {teacherGroups.map((group) => (
            <div className="kp-nav-group" key={group.title}>
              <p>{group.title}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `kp-nav-link ${isActive ? "active" : ""}`
                  }
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="kp-sidebar-footer">
          <ShieldCheck size={18} />
          <span>
            Đồng hành cùng trẻ
            <br />
            <b>Bữa ăn học đường an toàn</b>
          </span>
        </div>
      </aside>

      {/* Main Workspace matching Kitchen Portal */}
      <div className="kp-workspace">
        <header className="kp-topbar sticky top-0 z-40">
          <div className="kp-breadcrumb">
            <button
              className="kp-menu-toggle kp-button icon"
              aria-label="Mở menu giáo viên"
              aria-expanded={open}
              aria-controls="teacher-sidebar"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              Giáo viên phụ trách <i>/</i> <strong>{current}</strong>
            </span>
          </div>

          <div className="kp-topbar-actions ml-auto shrink-0">
            <UserHeaderDropdown customSubtitle="Giáo viên mầm non" />
          </div>
        </header>

        <main className="kp-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
