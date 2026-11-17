import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import {
  UtensilsCrossed,
  ChefHat,
  ShieldCheck,
  Lock,
  CalendarDays,
  Sparkles,
  Info,
} from 'lucide-react';

interface AttendanceBottomSectionsProps {
  kitchen: {
    deadline: string;
    headChef: string;
    station: string;
    standardPortions: number;
    customTrays: number;
    snackUnits: number;
    isLocked: boolean;
    cutoffTime: string;
  };
  todayMenu: {
    week: number;
    lunchTime: string;
    lunchItems: string[];
    snackTime: string;
    snackItems: string[];
    estimatedCalories: number;
  };
  onLockKitchen: () => void;
  isLocking?: boolean;
}

export const AttendanceBottomSections: React.FC<AttendanceBottomSectionsProps> = ({
  kitchen,
  todayMenu,
  onLockKitchen,
  isLocking = false,
}) => {
  useLanguage();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Card: K-Kitchen Live Connection (Span 8) */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 flex flex-col justify-between space-y-6">
        <div>
          {/* Card Top Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">{translateText("Kết nối Trực tiếp Bếp Trung Tâm (K-Kitchen Live)")}</h3>
                <p className="text-xs text-slate-500 font-medium">{translateText("Bếp trưởng: ")}<strong className="text-slate-700">{translateText(kitchen.headChef)}</strong> • {translateText(kitchen.station)}
                </p>
              </div>
            </div>

            <div className="px-3.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">{translateText("Hạn chốt trưa: ")}{translateText(kitchen.deadline)}
            </div>
          </div>

          {/* 3 Metric Stat Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
            {/* Box 1: Cơm & Canh tiêu chuẩn */}
            <div className="bg-slate-50/90 border border-slate-200/70 p-4 rounded-2xl">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{translateText("Cơm & Canh tiêu chuẩn")}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-900">{kitchen.standardPortions}</span>
                <span className="text-xs font-bold text-slate-500">{translateText("khẩu phần")}</span>
              </div>
            </div>

            {/* Box 2: Chế độ riêng biệt */}
            <div className="bg-amber-50/60 border border-amber-200/60 p-4 rounded-2xl">
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">{translateText("Chế độ riêng biệt")}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-amber-700">
                  {translateText(String(kitchen.customTrays).padStart(2, '0'))}
                </span>
                <span className="text-xs font-bold text-amber-700">{translateText("khay dán nhãn")}</span>
              </div>
            </div>

            {/* Box 3: Bữa phụ xế */}
            <div className="bg-teal-50/60 border border-teal-200/60 p-4 rounded-2xl">
              <p className="text-[11px] font-bold text-teal-800 uppercase tracking-wide">{translateText("Bữa phụ xế (14:30)")}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-teal-700">{kitchen.snackUnits}</span>
                <span className="text-xs font-bold text-teal-700">{translateText("hũ sữa chua / sữa hạt")}</span>
              </div>
            </div>
          </div>

          {/* Explanatory Note */}
          <p className="text-xs text-slate-500 font-medium italic mt-4 leading-relaxed">{translateText("* Sau khi cô giáo bấm \"Khóa danh sách gửi Bếp\", số lượng suất ăn sẽ chính thức chuyển vào hệ thống cân đối thực phẩm và phân chia khay ăn an toàn vệ sinh của bếp một chiều.")}</p>
        </div>

        {/* Bottom Action & Security Seal */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
            <span>{translateText("Bảo mật dữ liệu dinh dưỡng trẻ em theo chuẩn ISO 22000:2018")}</span>
          </div>

          <button
            onClick={onLockKitchen}
            disabled={isLocking}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-xs text-white shadow-lg active:scale-95 transition ${
              kitchen.isLocked
                ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-500/30 cursor-pointer'
                : 'bg-teal-800 hover:bg-teal-900 ring-2 ring-teal-700/30 cursor-pointer'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>{translateText(kitchen.isLocked ? '✓ Đã khóa gửi Bếp (Bấm để Mở khóa điều chỉnh)' : 'Xác nhận & Khóa danh sách gửi Bếp')}</span>
          </button>
        </div>
      </div>

      {/* Right Card: Thực đơn hôm nay (Tuần 4) (Span 4) */}
      <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-black text-slate-900">{translateText("Thực đơn hôm nay")}</h3>
          </div>
          <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-bold">{translateText("Tuần ")}{todayMenu?.week ?? 10}
          </span>
        </div>

        {/* Menu Content */}
        <div className="space-y-4">
          {/* Lunch */}
          <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-sky-900">
              <span className="flex items-center gap-1.5">
                <span>🍲</span>{translateText(" Bữa Trưa (")}{translateText(todayMenu?.lunchTime || '10:45 - 11:30')})
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
              {(todayMenu?.lunchItems || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-sky-600 font-bold">•</span>
                  <span>{translateText(item)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Snack */}
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span className="flex items-center gap-1.5">
                <span>🍮</span>{translateText(" Bữa Xế (")}{translateText(todayMenu?.snackTime || '14:30 - 15:00')})
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
              {(todayMenu?.snackItems || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{translateText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Menu Footer Calories */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">{translateText("Calo ước tính: ")}<strong className="text-teal-700 font-black">{todayMenu.estimatedCalories}{translateText(" kcal/ngày")}</strong>
          </span>
          <button className="text-teal-700 hover:text-teal-800 font-bold hover:underline transition">{translateText("Xem chi tiết")}</button>
        </div>
      </div>
    </div>
  );
};
