import React from 'react';
import {
  Smile,
  Meh,
  Frown,
  MessageSquare,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { MealEvaluationItem, PortionType } from '../types';

interface EvaluationTableProps {
  children: MealEvaluationItem[];
  selectedChildIds: string[];
  onToggleSelect: (childId: string) => void;
  onToggleSelectAll: () => void;
  onUpdatePortion: (childId: string, portion: PortionType) => void;
  onEditNote: (child: MealEvaluationItem) => void;
  onBatchMarkPortion: (portion: PortionType) => void;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
  };
  onPageChange: (page: number) => void;
}

export const EvaluationTable: React.FC<EvaluationTableProps> = ({
  children,
  selectedChildIds,
  onToggleSelect,
  onToggleSelectAll,
  onUpdatePortion,
  onEditNote,
  onBatchMarkPortion,
  pagination,
  onPageChange,
}) => {
  const isAllSelected = children.length > 0 && children.every((c) => selectedChildIds.includes(c.id));

  // Render Diet badge styling
  const renderMenuBadge = (badge?: MealEvaluationItem['menuBadge']) => {
    if (!badge || !badge.type) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200/80 whitespace-nowrap">
          Suất chuẩn
        </span>
      );
    }
    switch (badge.type) {
      case 'allergy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            {badge.label}
          </span>
        );
      case 'intolerance':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
            {badge.label}
          </span>
        );
      case 'special':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            {badge.label}
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
            {badge.label}
          </span>
        );
      case 'standard':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200/80 whitespace-nowrap">
            {badge.label}
          </span>
        );
    }
  };

  // Render Send status badge styling
  const renderSendStatus = (sendState?: MealEvaluationItem['sendState']) => {
    if (!sendState || !sendState.status) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          <Clock className="w-3 h-3 text-amber-600" />
          Chờ gửi Bếp
        </span>
      );
    }
    if (sendState.status === 'SENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {sendState.label || 'Đã gửi Bếp'}
        </span>
      );
    }
    if (sendState.status === 'ABSENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
          Nghỉ học
        </span>
      );
    }
    if (sendState.status === 'URGENT_PARENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          {sendState.label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        <Clock className="w-3 h-3 text-amber-600" />
        {sendState.label || 'Chờ gửi Bếp'}
      </span>
    );
  };

  return (
    <div className="px-6 py-2 w-full">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Section Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-5 bg-teal-600 rounded-full"></span>
            <h2 className="text-base font-bold text-slate-800">
              Danh sách học sinh đánh giá bữa ăn
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              Hiển thị {children.length}/{pagination.totalItems} bé đại diện
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Tự động lưu sau mỗi thay đổi</span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-4 min-w-[200px]">Học sinh</th>
                <th className="py-3 px-4 min-w-[220px]">Thực đơn của bé</th>
                <th className="py-3 px-4 min-w-[380px] text-center">Mức độ ăn của bé (5 Mức độ)</th>
                <th className="py-3 px-4 min-w-[170px] text-center">Nước/Sữa uống thêm</th>
                <th className="py-3 px-3 w-20 text-center">Ghi chú của cô</th>
                <th className="py-3 px-4 min-w-[150px] text-center">Trạng thái gửi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {children.map((child, index) => {
                const isSelected = selectedChildIds.includes(child.id);
                const stt = (pagination.currentPage - 1) * pagination.limit + index + 1;
                const formattedStt = stt.toString().padStart(2, '0');

                // Color tint for avatar
                const avatarColors = [
                  'bg-teal-100 text-teal-800 border-teal-200',
                  'bg-sky-100 text-sky-800 border-sky-200',
                  'bg-amber-100 text-amber-800 border-amber-200',
                  'bg-rose-100 text-rose-800 border-rose-200',
                  'bg-indigo-100 text-indigo-800 border-indigo-200',
                  'bg-emerald-100 text-emerald-800 border-emerald-200',
                  'bg-purple-100 text-purple-800 border-purple-200',
                ];
                const avatarColor = avatarColors[index % avatarColors.length];

                return (
                  <tr
                    key={child.id}
                    className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-teal-50/30' : ''
                      } ${child.isAbsent ? 'opacity-60 bg-slate-50/50' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(child.id)}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </td>

                    {/* STT */}
                    <td className="py-3.5 px-3 text-center font-bold text-slate-400">
                      {formattedStt}
                    </td>

                    {/* Student Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border shadow-xs ${avatarColor}`}
                        >
                          {child.avatarLetter}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-tight">
                            {child.fullName}
                          </p>
                          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                            {child.studentCode} • {child.genderAgeText}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Menu Info */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div>{renderMenuBadge(child.menuBadge)}</div>
                        <p className="text-[11px] text-slate-600 font-medium line-clamp-1">
                          {child.menuDetail}
                        </p>
                      </div>
                    </td>

                    {/* Portion Consumed Buttons (3 Options) */}
                    <td className="py-3.5 px-4">
                      {child.isAbsent ? (
                        <div className="text-center">
                          <span className="text-xs font-bold text-slate-400 italic">
                            Bé nghỉ học (Không ăn)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {/* 1. Ăn hết 100% */}
                          <button
                            type="button"
                            onClick={() => onUpdatePortion(child.id, 'ALL')}
                            title="Ăn hết 100% suất"
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shadow-xs ${child.portionConsumed === 'ALL'
                              ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-600/30'
                              : 'bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700'
                              }`}
                          >
                            <Smile className="w-3.5 h-3.5" />
                            <span>Ăn hết</span>
                          </button>

                          {/* 2. Ăn nhiều 75% */}
                          <button
                            type="button"
                            onClick={() => onUpdatePortion(child.id, 'MOST')}
                            title="Ăn nhiều (~75% suất)"
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shadow-xs ${child.portionConsumed === 'MOST'
                              ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-600/30'
                              : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                              }`}
                          >
                            <Smile className="w-3.5 h-3.5" />
                            <span>Ăn nhiều</span>
                          </button>

                          {/* 3. Một nửa 50% */}
                          <button
                            type="button"
                            onClick={() => onUpdatePortion(child.id, 'HALF')}
                            title="Ăn một nửa (50% suất)"
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shadow-xs ${child.portionConsumed === 'HALF'
                              ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-600/30'
                              : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                              }`}
                          >
                            <Meh className="w-3.5 h-3.5" />
                            <span>Một nửa</span>
                          </button>

                          {/* 4. Ăn ít 25% */}
                          <button
                            type="button"
                            onClick={() => onUpdatePortion(child.id, 'LITTLE')}
                            title="Ăn ít (~25% suất)"
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shadow-xs ${child.portionConsumed === 'LITTLE'
                              ? 'bg-orange-600 text-white shadow-sm ring-2 ring-orange-600/30'
                              : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                              }`}
                          >
                            <Frown className="w-3.5 h-3.5" />
                            <span>Ăn ít</span>
                          </button>

                          {/* 5. Bỏ ăn 0% */}
                          <button
                            type="button"
                            onClick={() => onUpdatePortion(child.id, 'NONE')}
                            title="Bỏ ăn / Từ chối (0%)"
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shadow-xs ${child.portionConsumed === 'NONE'
                              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30'
                              : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                          >
                            <Frown className="w-3.5 h-3.5" />
                            <span>Bỏ ăn</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Water/Milk Intake */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onEditNote(child)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 transition shadow-xs"
                      >
                        <span>{child.waterIntake || '200ml Nước ấm'}</span>
                      </button>
                    </td>

                    {/* Teacher Notes */}
                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => onEditNote(child)}
                        className={`p-2 rounded-xl border transition ${child.teacherNote
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                        title={child.teacherNote || 'Thêm ghi chú của cô'}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </td>

                    {/* Send Status */}
                    <td className="py-3.5 px-4 text-center">
                      {renderSendStatus(child.sendState)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Bulk Actions & Pagination */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/60">
          {/* Left Bulk Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-slate-600">
              Đã chọn: <strong className="text-slate-900">{selectedChildIds.length}</strong> học sinh
            </span>
            <button
              onClick={() => onBatchMarkPortion('ALL')}
              disabled={selectedChildIds.length === 0}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-teal-200 bg-white hover:bg-teal-50 text-teal-700 shadow-xs transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Ăn hết (100%)
            </button>
            <button
              onClick={() => onBatchMarkPortion('MOST')}
              disabled={selectedChildIds.length === 0}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-sky-700 shadow-xs transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Ăn nhiều (75%)
            </button>
            <button
              onClick={() => onBatchMarkPortion('HALF')}
              disabled={selectedChildIds.length === 0}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-amber-200 bg-white hover:bg-amber-50 text-amber-700 shadow-xs transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Một nửa (50%)
            </button>
            <button
              onClick={() => onBatchMarkPortion('LITTLE')}
              disabled={selectedChildIds.length === 0}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-orange-200 bg-white hover:bg-orange-50 text-orange-700 shadow-xs transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Ăn ít (25%)
            </button>
            <button
              onClick={() => onBatchMarkPortion('NONE')}
              disabled={selectedChildIds.length === 0}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 shadow-xs transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Bỏ ăn (0%)
            </button>
          </div>

          {/* Right Pagination */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-2">
              Trang {pagination.currentPage} / {pagination.totalPages} (Hiển thị {children.length}/{pagination.totalItems} bé)
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(1)}
                disabled={pagination.currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition ${p === pagination.currentPage
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(pagination.totalPages)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
