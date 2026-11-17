import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { Trash2, X } from 'lucide-react';
import { StaffUser } from '../api/staff.api';

interface SoftDeleteConfirmModalProps {
  isOpen: boolean;
  staff: StaffUser | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Modal xác nhận xóa tài khoản nhân sự
 */
export const SoftDeleteConfirmModal: React.FC<SoftDeleteConfirmModalProps> = ({
  isOpen,
  staff,
  isLoading,
  onClose,
  onConfirm,
}) => {
  useLanguage();
  if (!isOpen || !staff) return null;

  return (
    <div className="fixed !m-0 inset-0 z-50 flex items-center justify-center p-4">
      {/* Nền làm mờ backdrop */}
      <div
        className="fixed !m-0 inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Hộp thoại thông báo */}
      <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{translateText("Xác nhận xóa tài khoản?")}</h3>
            <p className="text-xs text-slate-500 mt-1">{translateText("Bạn có chắc chắn muốn xóa tài khoản nhân sự này khỏi danh sách trường?")}</p>
          </div>
        </div>

        {/* Thông tin nhân sự */}
        <div className="my-5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            {staff.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{staff.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{staff.email}</p>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >{translateText("Hủy bỏ")}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition flex items-center gap-2"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>{translateText("Xác nhận xóa")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
