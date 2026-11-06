import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import {
  FileSpreadsheet,
  SlidersHorizontal,
  Bell,
  Calendar,
  MessageSquareHeart,
} from 'lucide-react';

interface EvaluationHeaderProps {
  onExport: () => void;
  onOpenConfig: () => void;
}

export const EvaluationHeader: React.FC<EvaluationHeaderProps> = ({
  onExport,
  onOpenConfig,
}) => {
  useLanguage();
  return (
    <div className="space-y-4">
      {/* Main Title & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shadow-xs">
              <MessageSquareHeart className="w-5 h-5 text-teal-600" />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">{translateText("Ý kiến & Đánh giá Suất ăn Bán trú")}</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 pl-11">{translateText("Tổng hợp phản hồi, mức độ hài lòng và lắng nghe ý kiến của Phụ huynh học sinh")}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl text-xs font-semibold shadow-sm transition active:scale-98"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Xuất báo cáo ý kiến (Excel)")}</span>
          </button>

          <button
            onClick={onOpenConfig}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-teal-600/30 transition active:scale-98"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{translateText("Cấu hình khảo sát định kỳ")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
