import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { Search, Filter, Calendar, Users, Utensils, AlertTriangle, CheckCircle, RotateCcw, RotateCw, Plus } from 'lucide-react';
import { CoordinationQueryParams } from '../types';

interface CoordinationFilterBarProps {
  filters: CoordinationQueryParams;
  onFilterChange: (newFilters: Partial<CoordinationQueryParams>) => void;
  onResetFilters: () => void;
  availableClasses: Array<{
    id: string;
    name: string;
    gradeLevel: string;
    totalStudents: number;
  }>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreateNote?: () => void;
}

export const CoordinationFilterBar: React.FC<CoordinationFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableClasses,
  onRefresh,
  isRefreshing,
  onCreateNote,
}) => {
  useLanguage();
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3.5">
      {/* Top Filter Row: Search & Class Picker */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder={translateText("Tìm theo tên bé, mã học sinh, nội dung dặn dò, giáo viên phụ trách...")}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Class Selector Dropdown & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <Users className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{translateText("Lớp:")}</span>
            <select
              value={filters.classId || ''}
              onChange={(e) => onFilterChange({ classId: e.target.value || undefined })}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">{translateText("Tất cả các lớp")}</option>
              {availableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.totalStudents}{translateText(" trẻ)")}</option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{translateText("Ngày:")}</span>
            <input
              type="date"
              value={filters.date || ''}
              onChange={(e) => onFilterChange({ date: e.target.value || undefined })}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title={translateText("Làm mới dữ liệu")}
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
              <span>{translateText("Làm mới")}</span>
            </button>
          )}

          {onCreateNote && (
            <button
              onClick={onCreateNote}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{translateText("Tạo Ghi Chú")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Filter Row: Session, Priority, Status, Type, and Reset */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
        <span className="text-slate-500 font-bold flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" />{translateText(" Bộ lọc nhanh:")}</span>

        {/* Bữa ăn */}
        <select
          value={filters.mealSession || 'ALL'}
          onChange={(e) => onFilterChange({ mealSession: e.target.value })}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer focus:outline-none"
        >
          <option value="ALL">{translateText("Tất cả bữa ăn")}</option>
          <option value="BREAKFAST">{translateText("Buổi sáng (09:00)")}</option>
          <option value="LUNCH">{translateText("Bữa trưa chính (11:00)")}</option>
          <option value="AFTERNOON_SNACK">{translateText("Buổi phụ (14:30)")}</option>
          <option value="LATE_SNACK">{translateText("Buổi chiều xế (17:00)")}</option>
          <option value="ALL_DAY">{translateText("Cả ngày")}</option>
        </select>

        {/* Mức độ ưu tiên */}
        <select
          value={filters.priority || 'ALL'}
          onChange={(e) => onFilterChange({ priority: e.target.value })}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer focus:outline-none"
        >
          <option value="ALL">{translateText("Tất cả mức ưu tiên")}</option>
          <option value="URGENT">{translateText("🚨 Khẩn cấp")}</option>
          <option value="HIGH">{translateText("⚠️ Quan trọng")}</option>
          <option value="NORMAL">{translateText("ℹ️ Tiêu chuẩn")}</option>
        </select>

        {/* Trạng thái xử lý */}
        <select
          value={filters.status || 'ALL'}
          onChange={(e) => onFilterChange({ status: e.target.value })}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer focus:outline-none"
        >
          <option value="ALL">{translateText("Tất cả trạng thái")}</option>
          <option value="PENDING">{translateText("⏳ Chờ tiếp nhận")}</option>
          <option value="ACKNOWLEDGED">{translateText("🍳 Bếp đã tiếp nhận")}</option>
          <option value="RESOLVED">{translateText("✅ Đã hoàn thành")}</option>
        </select>

        {/* Phân loại ghi chú */}
        <select
          value={filters.noteType || 'ALL'}
          onChange={(e) => onFilterChange({ noteType: e.target.value })}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer focus:outline-none"
        >
          <option value="ALL">{translateText("Tất cả loại ghi chú")}</option>
          <option value="ALLERGY_WARNING">{translateText("Cảnh báo dị ứng")}</option>
          <option value="SPECIAL_DIET">{translateText("Chế độ ăn riêng (Cháo mềm)")}</option>
          <option value="PORTION_ADJUSTMENT">{translateText("Điều chỉnh / Cắt suất")}</option>
          <option value="MEDICATION_FEEDING">{translateText("Uống thuốc sau ăn")}</option>
          <option value="KITCHEN_REQUEST">{translateText("Yêu cầu nhà bếp")}</option>
        </select>

        {/* Reset button */}
        {(filters.search || filters.classId || filters.mealSession !== 'ALL' || filters.priority !== 'ALL' || filters.status !== 'ALL' || filters.noteType !== 'ALL') && (
          <button
            onClick={onResetFilters}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold transition border border-rose-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{translateText("Xóa lọc")}</span>
          </button>
        )}
      </div>
    </div>
  );
};
