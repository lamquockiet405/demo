import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  SlidersHorizontal,
  BarChart3,
  MessageSquareHeart,
  Sparkles,
} from 'lucide-react';

interface EvaluationHeaderProps {
  onExport: () => void;
  onOpenConfig: () => void;
  onOpenExportModal?: () => void;
}

export const EvaluationHeader: React.FC<EvaluationHeaderProps> = ({
  onExport,
  onOpenConfig,
  onOpenExportModal,
}) => {
  useLanguage();
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-2xs">
          <MessageSquareHeart className="w-6 h-6 text-teal-700" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {translateText('Ý Kiến & Phản Hồi Suất Ăn Bán Trú')}
            </h1>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              {translateText('Chỉ số CSAT')}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {translateText('Lắng nghe phụ huynh, đo lường mức độ hài lòng và nâng cao chất lượng khẩu phần trường học')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/parent-evaluations/reports/summary')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold transition active:scale-98 cursor-pointer"
        >
          <BarChart3 className="w-4 h-4 text-amber-600" />
          <span>{translateText('Báo cáo CSAT chi tiết')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenExportModal || onExport}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-700/20 transition active:scale-98 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{translateText('Xuất báo cáo Excel')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenConfig}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-98 cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>{translateText('Cấu hình khảo sát')}</span>
        </button>
      </div>
    </div>
  );
};
