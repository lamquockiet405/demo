import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { Search, Calendar, Filter, RotateCcw, ChevronDown, Download, Printer } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
  gradeLevel: string;
  blockName: string;
}

interface SnackRosterFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  gradeLevel: string;
  onGradeLevelChange: (val: string) => void;
  classId: string;
  onClassIdChange: (val: string) => void;
  classes: ClassOption[];
  date: string;
  onDateChange: (val: string) => void;
  paymentStatus: string;
  onPaymentStatusChange: (val: string) => void;
  onApplyFilter: () => void;
  onResetFilter: () => void;
  onExport?: () => void;
  onPrint?: () => void;
}

export const SnackRosterFilterBar: React.FC<SnackRosterFilterBarProps> = ({
  search,
  onSearchChange,
  gradeLevel,
  onGradeLevelChange,
  classId,
  onClassIdChange,
  classes,
  date,
  onDateChange,
  paymentStatus,
  onPaymentStatusChange,
  onApplyFilter,
  onResetFilter,
  onExport,
  onPrint,
}) => {
  useLanguage();
  // Filter classes based on selected grade level
  const filteredClasses = classes.filter((c) => {
    if (!gradeLevel || gradeLevel === 'ALL') return true;
    return c.blockName === gradeLevel || c.gradeLevel === gradeLevel;
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
        {/* 1. Tìm kiếm học sinh */}
        <div className="min-w-0 xl:col-span-4">
          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">{translateText("Tìm kiếm học sinh")}</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={translateText("Tìm theo tên hoặc mã học sinh...")}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onApplyFilter()}
              className="w-full bg-[#f8fafc] focus:bg-white text-xs pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* 2. Lớp học */}
        <div className="min-w-0 xl:col-span-3">
          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">{translateText("Lớp học")}</label>
          <div className="relative">
            <select
              value={classId}
              onChange={(e) => onClassIdChange(e.target.value)}
              className="w-full appearance-none bg-[#f8fafc] focus:bg-white text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition text-slate-800 font-medium pr-8 cursor-pointer"
            >
              <option value="ALL">{translateText("Tất cả các lớp")}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 4. Ngày phục vụ */}
        <div className="min-w-0 xl:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">{translateText("Ngày phục vụ")}</label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full bg-[#f8fafc] focus:bg-white text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition text-slate-800 font-medium cursor-pointer"
            />
          </div>
        </div>

        {/* 5. Trạng thái phí */}
        <div className="min-w-0 xl:col-span-3">
          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">{translateText("Trạng thái phí")}</label>
          <div className="relative">
            <select
              value={paymentStatus}
              onChange={(e) => onPaymentStatusChange(e.target.value)}
              className="w-full appearance-none bg-[#f8fafc] focus:bg-white text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition text-slate-800 font-medium pr-8 cursor-pointer"
            >
              <option value="PAID">{translateText("Đã hoàn thành")}</option>
              <option value="ALL">{translateText("Tất cả trạng thái")}</option>
              <option value="UNPAID">{translateText("Chưa hoàn thành")}</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Action Buttons: Filter, Reset, Export & Print */}
        <div className="sm:col-span-2 xl:col-span-12 flex flex-wrap items-center gap-2">
          {/* Apply Filter Button */}
          <button
            onClick={onApplyFilter}
            className="p-2.5 bg-[#143d2c] hover:bg-[#0e2d20] text-white rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
            title={translateText("Áp dụng bộ lọc")}
          >
            <Filter className="w-4 h-4 fill-white text-white" />
          </button>

          {/* Reset Filter Button */}
          <button
            onClick={onResetFilter}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition active:scale-95 flex items-center justify-center cursor-pointer"
            title={translateText("Đặt lại bộ lọc")}
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
          </button>

          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>{translateText("Xuất danh sách")}</span>
            </button>
          )}

          {onPrint && (
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>{translateText("In danh sách")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
