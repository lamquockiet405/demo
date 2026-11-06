import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';

export const PortalFooter: React.FC = () => {
  useLanguage();
  return (
    <footer className="border-t border-slate-200 bg-white py-5 text-slate-500 text-[11px] font-medium">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div>{translateText("© 2026 KidMeal Mầm Non. Hệ thống Dinh dưỡng & Chăm sóc Bán trú.")}</div>
        <div className="flex items-center gap-2">
          <span>{translateText("Phòng Y tế & Dinh dưỡng: ")}<strong className="text-slate-700">1900 6868</strong></span>
          <span>|</span>
          <span>{translateText("Giờ tiếp đón: 07:00 – 17:30")}</span>
        </div>
      </div>
    </footer>
  );
};
