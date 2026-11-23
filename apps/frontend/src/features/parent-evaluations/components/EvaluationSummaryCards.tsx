import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { Star, MessageSquareText, Clock, CheckCircle2 } from 'lucide-react';
import { ParentEvaluationSummaryStats } from '../types';

interface EvaluationSummaryCardsProps {
  stats?: ParentEvaluationSummaryStats;
  activeStatus?: string;
  onSelectStatus?: (status: string) => void;
}

export const EvaluationSummaryCards: React.FC<EvaluationSummaryCardsProps> = ({
  stats,
  activeStatus = 'ALL',
  onSelectStatus,
}) => {
  useLanguage();
  const avgRating = stats?.avgRating != null ? Number(stats.avgRating).toFixed(1) : '—';
  const positiveRate = stats?.positiveRate != null ? `${Number(stats.positiveRate).toFixed(0)}%` : '—';
  const pendingCount = stats?.pendingCount ?? 0;
  const respondedCount = stats?.respondedCount ?? 0;
  const totalCount = stats?.totalCount ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: Tổng ý kiến */}
      <button
        type="button"
        onClick={() => onSelectStatus && onSelectStatus('ALL')}
        className={`text-left bg-white p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
          activeStatus === 'ALL'
            ? 'border-teal-500 ring-2 ring-teal-500/15 shadow-xs'
            : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
        }`}
      >
        <div className="min-w-0">
          <span className="text-xs font-semibold text-slate-500 block truncate">
            {translateText('Tổng ý kiến phụ huynh')}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="text-xs font-semibold text-slate-500">{translateText('đánh giá')}</span>
          </div>
          <span className="inline-block mt-1.5 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
            {translateText('Bấm để xem tất cả')}
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
          <MessageSquareText className="w-5 h-5" />
        </div>
      </button>

      {/* Card 2: Điểm hài lòng */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-slate-500 block truncate">
            {translateText('Điểm hài lòng trung bình')}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900">{avgRating}</span>
            <span className="text-xs font-bold text-slate-400">/ 5.0</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400 self-center" />
          </div>
          <span className="inline-block mt-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
            {positiveRate} {translateText('đánh giá tích cực')}
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-500 border border-amber-100 flex items-center justify-center shrink-0">
          <Star className="w-5 h-5 fill-amber-400" />
        </div>
      </div>

      {/* Card 3: Chờ BGH phản hồi */}
      <button
        type="button"
        onClick={() => onSelectStatus && onSelectStatus('PENDING')}
        className={`text-left bg-white p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
          activeStatus === 'PENDING'
            ? 'border-rose-500 ring-2 ring-rose-500/15 shadow-xs'
            : pendingCount > 0
              ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300 shadow-2xs'
              : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
        }`}
      >
        <div className="min-w-0">
          <span className="text-xs font-semibold text-slate-500 block truncate">
            {translateText('Chờ BGH phản hồi')}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-2xl font-black ${pendingCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {pendingCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">{translateText('ý kiến')}</span>
          </div>
          <span
            className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md ${
              pendingCount > 0
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {translateText(pendingCount > 0 ? 'Cần phản hồi ngay' : 'Đã giải quyết hết')}
          </span>
        </div>
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
            pendingCount > 0
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <Clock className="w-5 h-5" />
        </div>
      </button>

      {/* Card 4: Đã phản hồi */}
      <button
        type="button"
        onClick={() => onSelectStatus && onSelectStatus('RESPONDED')}
        className={`text-left bg-white p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
          activeStatus === 'RESPONDED'
            ? 'border-emerald-500 ring-2 ring-emerald-500/15 shadow-xs'
            : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
        }`}
      >
        <div className="min-w-0">
          <span className="text-xs font-semibold text-slate-500 block truncate">
            {translateText('Đã phản hồi phụ huynh')}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-emerald-700">{respondedCount}</span>
            <span className="text-xs font-semibold text-slate-500">{translateText('ý kiến')}</span>
          </div>
          <span className="inline-block mt-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            {translateText('Đã gửi thông báo')}
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </button>
    </div>
  );
};
