import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import {
  X,
  ShieldAlert,
  Clock,
  User,
  Tag,
} from 'lucide-react';
import { AuditLogItem } from '../types/audit-log.types';

interface AuditLogDetailModalProps {
  log: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  useLanguage();

  if (!isOpen || !log) return null;

  const formatTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(getLocale(), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('REJECT')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('APPROVE') || act.includes('SUCCESS') || act.includes('CREATE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('OVERRIDE') || act.includes('ALLERGY') || act.includes('SECURITY')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-sky-50 text-sky-700 border-sky-200';
  };

  return (
    <div className="fixed !m-0 inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {translateText("Chi tiết Nhật ký Kiểm toán")}
                <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-200/80 text-slate-700">
                  #{translateText(log.id)}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {translateText("Lịch sử truy vết thao tác an toàn hệ thống")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
            title={translateText("Đóng")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Tác nhân */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {translateText("Tác nhân thực hiện")}
              </div>
              <div className="font-semibold text-slate-800">
                {log.userName || translateText('Tài khoản hệ thống')}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {log.userEmail || translateText('N/A')}
              </div>
              {log.userRole && (
                <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-200/80 text-slate-700">
                  {translateText(log.userRole)}
                </span>
              )}
            </div>

            {/* Hành động & Đối tượng */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                {translateText("Hành động & Đối tượng")}
              </div>
              <div>
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${getActionBadgeColor(
                    log.action,
                  )}`}
                >
                  {translateText(log.action)}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {translateText("Thực thể:")}{' '}
                <span className="font-semibold text-slate-800 font-mono">
                  {translateText(log.targetEntity || 'HỆ THỐNG')}
                </span>
                {log.targetId && (
                  <span className="ml-1 text-slate-500 font-mono">
                    (ID: #{translateText(log.targetId)})
                  </span>
                )}
              </div>
            </div>

            {/* Thời gian ghi nhận */}
            <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {translateText("Thời gian ghi nhận")}
              </div>
              <div className="font-semibold text-slate-800 font-mono text-xs">
                {translateText(formatTimestamp(log.createdAt))}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {translateText(log.createdAt)}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-slate-800 text-white hover:bg-slate-900 transition shadow-sm"
          >
            {translateText("Đóng cửa sổ")}
          </button>
        </div>
      </div>
    </div>
  );
};
