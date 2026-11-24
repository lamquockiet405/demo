import { useLanguage } from '../../../core/i18n/useLanguage';
import { t as translateText } from '../../../core/i18n/language';
import React from 'react';

export const SnackRosterFooter: React.FC = () => {
  useLanguage();
  return (
    <footer className="mt-10 pt-6 border-t border-slate-200/80 text-xs text-slate-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left System Info */}
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          <span>{translateText("Hệ thống KidMeal • Quản trị dinh dưỡng khẩu phần học đường tiêu chuẩn Mầm Non")}</span>
        </div>
      </div>

      <div className="mt-4 text-center text-[11px] text-slate-400">{translateText("© 2026 KidMeal System. Dành riêng cho Nhân viên Cấp dưỡng & Ban Quản lý Bếp ăn Học đường.")}</div>
    </footer>
  );
};
