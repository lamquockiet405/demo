import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';

export const PortalFooter: React.FC = () => {
  useLanguage();
  return (
    <footer className="border-t border-slate-200 bg-white py-4 text-slate-500 text-[11px] font-medium">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-center text-center">
        <div>{translateText("© 2026 KidMeal Mầm Non. Hệ thống Dinh dưỡng & Chăm sóc Bán trú.")}</div>
      </div>
    </footer>
  );
};
