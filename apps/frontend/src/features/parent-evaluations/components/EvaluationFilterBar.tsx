import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import {
  Search,
  ChevronDown,
  FileSpreadsheet,
  SlidersHorizontal,
  RotateCcw,
  LayoutGrid,
  Table2,
  X,
} from 'lucide-react';
import { ParentEvaluationSummaryStats } from '../types';

interface EvaluationFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusTab: string;
  onStatusTabChange: (status: string) => void;
  ratingFilter: number;
  onRatingChange: (rating: number) => void;
  mealFilter: string;
  onMealChange: (meal: string) => void;
  classFilter: string;
  onClassChange: (className: string) => void;
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  stats?: ParentEvaluationSummaryStats;
  onExport?: () => void;
  onOpenExportModal?: () => void;
  onOpenConfig?: () => void;
  viewMode?: 'CARD' | 'TABLE';
  onViewModeChange?: (mode: 'CARD' | 'TABLE') => void;
  onResetFilters?: () => void;
}

export const EvaluationFilterBar: React.FC<EvaluationFilterBarProps> = ({
  search,
  onSearchChange,
  statusTab,
  onStatusTabChange,
  ratingFilter,
  onRatingChange,
  mealFilter,
  onMealChange,
  classFilter,
  onClassChange,
  sortBy,
  onSortByChange,
  stats,
  onExport,
  onOpenExportModal,
  onOpenConfig,
  viewMode = 'CARD',
  onViewModeChange,
  onResetFilters,
}) => {
  useLanguage();

  const total = stats?.totalCount ?? 0;
  const pending = stats?.pendingCount ?? 0;
  const responded = stats?.respondedCount ?? 0;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusTab !== 'ALL' ||
    ratingFilter !== 0 ||
    mealFilter !== 'ALL' ||
    classFilter !== 'ALL' ||
    sortBy !== 'NEWEST';

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
      {/* Row 1: Status Tabs + View Mode Toggle + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Segmented Status Tabs */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 gap-1 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => onStatusTabChange('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{translateText('Tất cả')}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                statusTab === 'ALL'
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onStatusTabChange('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusTab === 'PENDING'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                statusTab === 'PENDING' ? 'bg-white' : 'bg-rose-500'
              }`}
            />
            <span>{translateText('Chưa phản hồi')}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                statusTab === 'PENDING'
                  ? 'bg-rose-700 text-white'
                  : pending > 0
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onStatusTabChange('RESPONDED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusTab === 'RESPONDED'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{translateText('Đã phản hồi')}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                statusTab === 'RESPONDED'
                  ? 'bg-teal-800 text-white'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {responded}
            </span>
          </button>
        </div>

        {/* Right Actions: Export Excel + Survey Config */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (onOpenExportModal) onOpenExportModal();
              else if (onExport) onExport();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>{translateText('Xuất báo cáo Excel')}</span>
          </button>

          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{translateText('Cấu hình khảo sát')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Compact Search + 4 Inline Selects */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 pt-2.5 border-t border-slate-100">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={translateText('Tìm tên phụ huynh, học sinh, lớp hoặc nội dung ý kiến...')}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Inline Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2">
          {/* Lớp học */}
          <div className="relative">
            <select
              aria-label={translateText('Lọc theo lớp học')}
              value={classFilter}
              onChange={(e) => onClassChange(e.target.value)}
              className="w-full lg:w-auto appearance-none pl-3 pr-7 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
            >
              <option value="ALL">{translateText('Tất cả các lớp')}</option>
              <option value="Lớp Mầm 1">{translateText('Lớp Mầm 1')}</option>
              <option value="Lớp Mầm 2">{translateText('Lớp Mầm 2')}</option>
              <option value="Lớp Chồi 1">{translateText('Lớp Chồi 1')}</option>
              <option value="Lớp Chồi 2">{translateText('Lớp Chồi 2')}</option>
              <option value="Lớp Lá 1">{translateText('Lớp Lá 1')}</option>
              <option value="Lớp Lá 2">{translateText('Lớp Lá 2')}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Số sao */}
          <div className="relative">
            <select
              aria-label={translateText('Lọc theo số sao')}
              value={ratingFilter}
              onChange={(e) => onRatingChange(Number(e.target.value))}
              className="w-full lg:w-auto appearance-none pl-3 pr-7 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
            >
              <option value={0}>{translateText('Tất cả mức sao')}</option>
              <option value={5}>{translateText('5 sao - Rất hài lòng')}</option>
              <option value={4}>{translateText('4 sao - Hài lòng')}</option>
              <option value={3}>{translateText('3 sao - Bình thường')}</option>
              <option value={2}>{translateText('2 sao - Cần lưu ý')}</option>
              <option value={1}>{translateText('1 sao - Không hài lòng')}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Bữa ăn */}
          <div className="relative">
            <select
              aria-label={translateText('Lọc theo bữa ăn')}
              value={mealFilter}
              onChange={(e) => onMealChange(e.target.value)}
              className="w-full lg:w-auto appearance-none pl-3 pr-7 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
            >
              <option value="ALL">{translateText('Tất cả bữa ăn')}</option>
              <option value="BREAKFAST">{translateText('Buổi sáng (09:00)')}</option>
              <option value="LUNCH">{translateText('Bữa trưa chính (11:00)')}</option>
              <option value="AFTERNOON_SNACK">{translateText('Buổi phụ (14:30)')}</option>
              <option value="LATE_SNACK">{translateText('Buổi chiều xế (17:00)')}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sắp xếp */}
          <div className="relative">
            <select
              aria-label={translateText('Sắp xếp theo')}
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="w-full lg:w-auto appearance-none pl-3 pr-7 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
            >
              <option value="NEWEST">{translateText('Mới nhất trước')}</option>
              <option value="OLDEST">{translateText('Cũ nhất trước')}</option>
              <option value="RATING_HIGH">{translateText('Điểm cao nhất')}</option>
              <option value="RATING_LOW">{translateText('Điểm thấp nhất')}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {hasActiveFilters && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap"
              title={translateText('Xóa tất cả điều kiện lọc')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{translateText('Đặt lại')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
