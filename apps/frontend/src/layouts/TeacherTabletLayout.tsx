import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ClipboardCheck, UtensilsCrossed, AlertTriangle, User, Coffee } from 'lucide-react';
import { useAuthStore } from '../core/stores/auth.store';
import { UserProfileModal } from '../features/auth/components/UserProfileModal';

export const TeacherTabletLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-100 touch-pan-y select-none">
      {/* Tablet Topbar - Cỡ chữ to, nút bấm tối thiểu 48px */}
      <header className="h-18 bg-emerald-700 text-white px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <UtensilsCrossed className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ghi nhận Suất ăn Bán trú</h1>
            <p className="text-xs text-emerald-200">
              {user?.fullName ? `${user.fullName} phụ trách` : 'Cô Nguyễn Lan Anh phụ trách'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/attendance"
            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition ${
              location.pathname === '/attendance' ? 'bg-white text-emerald-800' : 'bg-emerald-800/60 text-white'
            }`}
          >
            <ClipboardCheck className="w-5 h-5" />
            Điểm danh suất ăn
          </Link>
          <Link
            to="/attendance/record"
            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition ${
              location.pathname === '/attendance/record' ? 'bg-white text-emerald-800' : 'bg-emerald-800/60 text-white'
            }`}
          >
            <AlertTriangle className="w-5 h-5 text-amber-300" />
            Trạng thái ăn & Dị ứng
          </Link>
          <Link
            to="/snack-roster"
            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition ${
              location.pathname === "/snack-roster" ? "bg-white text-emerald-800" : "bg-emerald-800/60 text-white"
            }`}
          >
            <Coffee className="w-5 h-5 text-amber-300" />
            Suất ăn xế
          </Link>

          {/* Profile & Avatar button */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-800/70 hover:bg-emerald-800 border border-emerald-600/60 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Hồ sơ cá nhân & Ảnh đại diện"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-bold text-white overflow-hidden text-xs">
              {(user as any)?.avatar ? (
                <img src={(user as any).avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <span className="hidden sm:inline">Hồ sơ</span>
          </button>
        </div>
      </header>

      {/* Main Tablet Touch Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};
