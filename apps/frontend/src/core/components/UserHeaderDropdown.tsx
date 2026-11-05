import React, { useState, useRef, useEffect, useLayoutEffect, useId } from "react";
import { createPortal } from 'react-dom';
import { useNavigate } from "react-router-dom";
import { User, ChevronDown, Settings, LogOut } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { UserProfileModal } from "../../features/auth/components/UserProfileModal";

interface UserHeaderDropdownProps {
  customRoleLabel?: string;
  customSubtitle?: string;
  className?: string;
}

export const UserHeaderDropdown: React.FC<UserHeaderDropdownProps> = ({
  customRoleLabel,
  customSubtitle,
  className = "",
}) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) { setPosition(null); return; }
    const place = () => {
      if (!triggerRef.current || !menuRef.current) return;
      const trigger = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(256, window.innerWidth - margin * 2);
      const height = menuRef.current.scrollHeight + 2;
      const below = Math.max(0, window.innerHeight - trigger.bottom - margin * 2);
      const above = Math.max(0, trigger.top - margin * 2);
      const openAbove = below < Math.min(height, 200) && above > below;
      const maxHeight = openAbove ? above : below;
      setPosition({
        left: Math.max(margin, Math.min(trigger.right - width, window.innerWidth - width - margin)),
        top: openAbove ? Math.max(margin, trigger.top - margin - Math.min(height, maxHeight)) : trigger.bottom + margin,
        maxHeight,
      });
    };
    place();
    const focusFrame = window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }));
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.cancelAnimationFrame(focusFrame); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [isOpen]);

  const getRoleInfo = () => {
    if (customRoleLabel && customSubtitle) {
      return {
        roleBadge: `Role: ${customRoleLabel.toUpperCase()}`,
        subtitle: customSubtitle,
      };
    }

    const roleList = Array.isArray(user?.roles)
      ? user.roles.map((r: any) =>
          (typeof r === "string" ? r : r?.code || "").toUpperCase(),
        )
      : [];

    if (
      roleList.includes("PRINCIPAL") ||
      roleList.includes("SCHOOL_MANAGER") ||
      roleList.includes("SCHOOL_MANAGEMENT")
    ) {
      return {
        roleBadge: "Role: PRINCIPAL",
        subtitle: customSubtitle || "Ban Giám Hiệu",
      };
    }
    if (roleList.includes("NUTRITIONIST")) {
      return {
        roleBadge: "Role: NUTRITIONIST",
        subtitle: customSubtitle || "Chuyên viên dinh dưỡng",
      };
    }
    if (roleList.includes("PARENT")) {
      return {
        roleBadge: "Role: PARENT",
        subtitle: customSubtitle || "Phụ huynh",
      };
    }
    if (roleList.includes("TEACHER")) {
      return {
        roleBadge: "Role: TEACHER",
        subtitle: customSubtitle || "Giáo viên",
      };
    }
    if (
      roleList.includes("KITCHEN_STAFF") ||
      roleList.includes("KITCHEN_MANAGER")
    ) {
      return {
        roleBadge: "Role: KITCHEN",
        subtitle: customSubtitle || "Nhân viên bếp",
      };
    }
    if (roleList.includes("SUPER_ADMIN")) {
      return {
        roleBadge: "Role: SUPER_ADMIN",
        subtitle: customSubtitle || "Quản trị viên",
      };
    }

    return {
      roleBadge: "Role: USER",
      subtitle: customSubtitle || "Người dùng",
    };
  };

  const { roleBadge, subtitle } = getRoleInfo();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setIsOpen(true); } }}
        className="flex items-center gap-2.5 p-1 rounded-2xl hover:bg-slate-100/80 transition cursor-pointer"
        aria-expanded={isOpen}
        aria-label={`Menu tài khoản ${user?.fullName || ''}`}
        aria-haspopup="menu"
        aria-controls={isOpen ? menuId : undefined}
      >
        <div className="w-9 h-9 rounded-full bg-[#0a3526] text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-emerald-500/20 overflow-hidden shrink-0">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user?.fullName || "Avatar"}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-5 h-5 text-emerald-200" />
          )}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold text-slate-900 leading-tight">
            {user?.fullName || "Tài khoản hệ thống"}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {subtitle}
          </p>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Card */}
      {isOpen && createPortal(
        <div ref={menuRef} id={menuId} role="menu" aria-label="Menu tài khoản"
          className="bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5"
          style={{ position: 'fixed', zIndex: 1000, width: 256, maxWidth: 'calc(100vw - 16px)', overflowY: 'auto',
            left: position?.left ?? 0, top: position?.top ?? 0, maxHeight: position?.maxHeight, visibility: position ? 'visible' : 'hidden' }}
          onKeyDown={event => {
            const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') || []);
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus();
            }
            if (event.key === 'Tab') setIsOpen(false);
          }}>
          {/* Header Info */}
          <div className="px-4 py-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs font-bold text-slate-900 truncate">
                {user?.fullName || "Tài khoản hệ thống"}
              </p>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {user?.email || ""}
            </p>
            <span className="inline-block mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {roleBadge}
            </span>
          </div>

          {/* Action 1: Settings / Profile */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              setIsProfileModalOpen(true);
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            Thông tin cá nhân & đổi mật khẩu
          </button>

          {/* Action 2: Logout */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              logout();
              navigate("/home");
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition border-t border-slate-100 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất hệ thống
          </button>
        </div>, document.body
      )}

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

