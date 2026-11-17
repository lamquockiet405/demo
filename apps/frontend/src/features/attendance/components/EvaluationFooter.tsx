import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';

export const EvaluationFooter: React.FC = () => {
  useLanguage();
  return (
    <footer className="bg-white border-t border-slate-200 mt-8 py-5 px-6 text-xs text-slate-500 font-medium">
      <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div className="flex items-center gap-2">
          <span className="font-bold text-teal-700">{translateText("KidMeal")}</span>
          <span>{translateText("© 2026 Hệ thống Giám sát & Nuôi dưỡng Bán trú Chuẩn Mầm non.")}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-slate-500">
          <a href="#rules" className="hover:text-teal-700 transition">{translateText("Quy chuẩn VSATTP Bộ Giáo dục")}</a>
          <span className="text-slate-300">•</span>
          <a href="#sync" className="hover:text-teal-700 transition">{translateText("Đồng bộ LiveSync Bếp 1 chiều")}</a>
          <span className="text-slate-300">•</span>
          <span>{translateText("Hỗ trợ kỹ thuật: ")}<strong className="text-slate-700">1900 6868</strong>
          </span>
        </div>
      </div>
    </footer>
  );
};
