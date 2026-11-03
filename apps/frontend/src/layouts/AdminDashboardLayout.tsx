import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Refrigerator,
  GraduationCap,
  Users2,
  Coffee,
  FileCheck2,
  PackageOpen,
  ShieldCheck,
  ShieldAlert,
  CircleDollarSign,
  Settings,
  Headphones,
  MoreVertical,
  ChevronDown,
  Bell,
  UtensilsCrossed,
  Scale,
  Activity,
  Star,
  MessageSquareText,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { UserProfileModal } from '../features/auth/components/UserProfileModal';
import { ParentEvaluationsPage } from '../features/parent-evaluations/ParentEvaluationsPage';
import { BghMealPortionsOverviewPage } from '../features/attendance/pages/BghMealPortionsOverviewPage';
import { SnackRosterPage } from '../features/attendance/SnackRosterPage';
import { useAuthStore } from '../core/stores/auth.store';
import { tenantApi, TenantProfile } from '../core/api/tenant.api';

function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'BGH';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const AdminDashboardLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const canManageParents = (user?.roles || []).some(role =>
    ['SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'SCHOOL_MANAGEMENT'].includes(role.toUpperCase()),
  );
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState<string>(
    () => localStorage.getItem('school_name') || 'Hệ thống Bán trú KidMeal',
  );
  const [schoolLogo, setSchoolLogo] = useState<string>('');
  const [schoolPhone, setSchoolPhone] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    tenantApi
      .getProfile()
      .then((profile) => {
        if (!mounted || !profile) return;
        if (profile.name) {
          setSchoolName(profile.name);
          localStorage.setItem('school_name', profile.name);
        }
        setSchoolLogo(profile.branding?.logoUrl || '');
        setSchoolPhone(profile.phone || '');
      })
      .catch(() => {
        // Giữ nguyên giá trị từ localStorage nếu chưa tải được
      });

    const handleTenantUpdated = (e: Event) => {
      const detail = (e as CustomEvent<TenantProfile>).detail;
      if (detail) {
        if (detail.name) setSchoolName(detail.name);
        setSchoolLogo(detail.branding?.logoUrl || '');
        setSchoolPhone(detail.phone || '');
      }
    };
    window.addEventListener('tenant-profile-updated', handleTenantUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('tenant-profile-updated', handleTenantUpdated);
    };
  }, []);

  // Danh mục menu Ban Giám Hiệu
  const navItems = [
    { label: 'Dashboard Tổng quan', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Chỉ huy Dinh dưỡng & Thể trạng', path: '/nutrition-physical-dashboard', icon: Activity },
    { label: 'Cảnh báo an toàn trẻ (UC93)', path: '/child-alerts', icon: ShieldAlert },
    { label: 'Báo cáo Vận hành Bữa ăn (UC94)', path: '/meal-operations-report', icon: UtensilsCrossed },
    { label: 'Quản trị Lớp học', path: '/classes', icon: GraduationCap },
    { label: 'Theo dõi thể lực WHO', path: '/growth', icon: Scale },
    { label: 'Điều phối cảnh báo thể trạng (UC85)', path: '/growth-notifications', icon: Bell },
    { label: 'Nhân sự & Bếp', path: '/staff', icon: Users2 },
    ...(canManageParents ? [{ label: 'Tài khoản phụ huynh', path: '/parents', icon: Users2 }] : []),
    { label: 'Kế hoạch suất ăn bán trú', path: '/children', icon: ClipboardCheck },
    { label: 'Phục vụ ăn xế (Roster)', path: '/snack-roster', icon: Coffee },
    { label: 'Bé kén ăn & Tư vấn dinh dưỡng', path: '/picky-eating', icon: Sparkles },
    { label: 'Ý kiến & Đánh giá PH', path: '/services', icon: MessageSquareText },
    { label: 'Phê duyệt thực đơn', path: '/menu-approval', icon: FileCheck2 },
    { label: 'Kho & Dinh dưỡng', path: '/inventory', icon: PackageOpen },
    { label: 'Tuân thủ ATTP & Kiểm thực (UC95)', path: '/food-safety', icon: ShieldCheck },
    { label: 'Sổ kiểm thực 3 bước', path: '/food-safety', icon: ShieldCheck },
    { label: 'Sổ lưu mẫu 24h', path: '/food-safety/samples', icon: Refrigerator },
    { label: 'Nhật ký kiểm toán', path: '/audit-logs', icon: ShieldAlert },
    { label: 'Báo cáo tài chính & Ăn sáng (UC96)', path: '/snack-revenue-report', icon: CircleDollarSign },
    { label: 'Đánh giá Phụ huynh & CSAT (UC97)', path: '/parent-evaluation-report', icon: Star },
    { label: 'Cài đặt trường học', path: '/settings', icon: Settings },
  ];

  const getBreadcrumbTitle = () => {
    if (location.pathname.startsWith('/nutrition-physical')) return 'Chỉ huy Dinh dưỡng & Thể trạng (UC92)';
    if (location.pathname.startsWith('/child-alerts')) return 'Tổng hợp Cảnh báo Trẻ em (UC93)';
    if (location.pathname.startsWith('/meal-operations')) return 'Báo Cáo Vận Hành Bữa Ăn & Bán Trú (UC94)';
    if (location.pathname.startsWith('/growth-notifications')) return 'Điều Phối Thông Báo Bất Thường Thể Trạng (UC85)';
    if (location.pathname.startsWith('/growth')) return 'Theo dõi Thể lực & Tăng trưởng Trẻ (WHO 2006)';
    if (location.pathname.startsWith('/menu-approval')) return 'Phê duyệt & Công bố thực đơn tuần';
    if (location.pathname.startsWith('/classes')) return 'Quản trị Lớp học & Học sinh';
    if (location.pathname.startsWith('/staff')) return 'Quản trị Nhân sự & Tài khoản Bếp';
    if (location.pathname.startsWith('/parents')) return 'Quản lý Tài khoản Phụ huynh';
    if (location.pathname.startsWith('/services')) return 'Dịch vụ Bán trú & Suất ăn sáng';
    if (location.pathname.startsWith('/children')) return 'Kế hoạch Suất ăn & Điểm danh Bán trú';
    if (location.pathname.startsWith('/snack-roster')) return 'Danh sách Phục vụ Suất ăn Xế (Snack Service Roster)';
    if (location.pathname.startsWith('/services')) return 'Ý kiến & Đánh giá của Phụ huynh';
    if (location.pathname.startsWith('/inventory')) return 'Kho nguyên liệu & Tiêu chuẩn dinh dưỡng';
    if (location.pathname.startsWith('/food-safety')) return 'Báo Cáo Tuân Thủ An Toàn Thực Phẩm (UC95)';
    if (location.pathname.startsWith('/audit-logs')) return 'Nhật ký Kiểm toán & Truy vết Dữ liệu Nhạy cảm (Audit Logs)';
    if (location.pathname.startsWith('/parent-evaluation'))
      return 'Báo Cáo Tổng Hợp Đánh Giá Phụ Huynh & CSAT (UC97)';
    if (location.pathname.startsWith('/snack-revenue') || location.pathname.startsWith('/finances'))
      return 'Báo Cáo Doanh Thu Dịch Vụ Suất Ăn Sáng (UC96)';
    if (location.pathname.startsWith('/settings') || location.pathname.startsWith('/tenant/settings'))
      return 'Cài đặt thông tin Trường mầm non';
    if (location.pathname.startsWith('/dashboard')) return 'Dashboard Tổng quan';
    return 'Cài đặt hệ thống & Quản trị tài khoản';
  };

  const userInitials = getInitials(user?.fullName);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans antialiased text-slate-800">
      {/* 1. Sidebar Trái */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shadow-xs z-30">
        <div>
          {/* Header Sidebar: KidMeal BGH & Tên trường thực tế */}
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 shadow-inner shrink-0 overflow-hidden">
              {schoolLogo ? (
                <img src={schoolLogo} alt={schoolName} className="w-full h-full object-contain p-1" />
              ) : (
                <UtensilsCrossed className="w-5 h-5" />
              )}
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-slate-900 tracking-tight">KidMeal BGH</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate" title={schoolName}>
                {schoolName}
              </p>
            </div>
          </div>

          {/* Tag Cổng Ban Giám Hiệu */}
          <div className="px-4 pt-3.5 pb-1">
            <div className="bg-teal-50/80 border border-teal-200/60 rounded-full py-1 px-3 flex items-center gap-2 text-[11px] font-bold text-teal-800">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
              <span>CỔNG BAN GIÁM HIỆU</span>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <nav className="px-3 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/settings'
                  ? location.pathname === '/settings' ||
                    location.pathname === '/tenant/settings' ||
                    location.pathname === '/'
                  : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
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
              <p className="text-[10px] text-slate-400 leading-tight">Hotline Nhà trường</p>
              <p className="text-xs font-bold text-teal-800 tracking-tight truncate">
                {schoolPhone || 'Chưa cập nhật'}
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
                  {user?.fullName || user?.email || 'Ban Giám Hiệu'}
                </p>
                <p className="text-[10px] text-slate-400">Hiệu trưởng / Quản lý</p>
              </div>
            </div>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              title="Xem & Cập nhật hồ sơ cá nhân"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between z-20">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <UtensilsCrossed className="w-4 h-4 text-teal-600" />
            <span className="hover:text-slate-800 cursor-pointer">{schoolName}</span>
            <span>›</span>
            <span className="text-slate-900 font-semibold">{getBreadcrumbTitle()}</span>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-4">
            {/* Học kỳ Selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition">
              <span>📅 Năm học 2025 - 2026</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              </button>
            </div>

            {/* User Profile Pill */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition"
            >
              <div className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold text-[10px] flex items-center justify-center">
                {userInitials}
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-slate-800 block leading-tight">
                  {user?.fullName || user?.email || 'Ban Giám Hiệu'}
                </span>
                <span className="text-[10px] text-teal-700 font-medium block">
                  BGH Mầm non
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* Scrollable Page Container */}
        <main className="flex-1 overflow-y-auto p-8">
          {location.pathname === '/services' ? <ParentEvaluationsPage /> : location.pathname === '/children' ? <BghMealPortionsOverviewPage /> : location.pathname === '/snack-roster' ? <SnackRosterPage /> : <Outlet />}
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
