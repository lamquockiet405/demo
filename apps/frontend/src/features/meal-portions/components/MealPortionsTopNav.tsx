import React, { useState } from 'react';
import { Calendar, ChevronDown, Bell, GraduationCap, ChevronRight, User } from 'lucide-react';
import { useAuthStore } from '../../../core/stores/auth.store';
import { UserProfileModal } from '../../auth/components/UserProfileModal';

interface MealPortionsTopNavProps {
  weekNumber: number;
  schoolYear: string;
  formattedDateRange: string;
  onWeekChange?: (week: number) => void;
}

export const MealPortionsTopNav: React.FC<MealPortionsTopNavProps> = ({
  weekNumber,
  schoolYear,
  formattedDateRange,
  onWeekChange,
}) => {
  const { user } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Breadcrumb Left */}
      <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="text-teal-700 font-semibold hover:underline cursor-pointer">
          Bán trú KidMeal
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="hover:text-slate-700 cursor-pointer">Quản lý Thực đơn & Dinh dưỡng</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-bold">Công bố & Định lượng tuần</span>
      </nav>

      {/* Selectors & Profile Right */}
      <div className="flex items-center gap-3">
        {/* Week Selector Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold transition">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>Tuần {weekNumber} ({formattedDateRange})</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* School Year Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold transition">
            <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
            <span>{schoolYear}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"
          title="Thông báo hệ thống"
        >
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* User Avatar Circle */}
        <button
          type="button"
          onClick={() => setIsProfileModalOpen(true)}
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-400 p-0.5 shadow-sm cursor-pointer hover:scale-105 transition"
          title="Xem & Chỉnh sửa hồ sơ cá nhân"
        >
          <div className="w-full h-full rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs overflow-hidden">
            {(user as any)?.avatar ? (
              <img src={(user as any).avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'NT'}</span>
            )}
          </div>
        </button>
      </div>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </header>
  );
};
