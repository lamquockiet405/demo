import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  Clock,
  User,
  Globe,
  FileText,
  Copy,
  Check,
  Tag,
  Laptop,
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
  const [copied, setCopied] = useState(false);

  if (!isOpen || !log) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">{translateText("Chi tiết Nhật ký Kiểm toán")}<span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-200/80 text-slate-700">
                  #{translateText(log.id)}
                </span>
              </h3>
              <p className="text-xs text-slate-500">{translateText("Lịch sử truy vết thao tác & dữ liệu nhạy cảm theo tiêu chuẩn an toàn")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title={translateText("Đóng")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />{translateText(" Tác nhân thực hiện")}</div>
              <div className="font-semibold text-slate-800">{log.userName || translateText('Tài khoản hệ thống')}</div>
              <div className="text-xs text-slate-500 font-mono">{log.userEmail || translateText('N/A')}</div>
              {log.userRole && (
                <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700">
                  {translateText(log.userRole)}
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />{translateText(" Hành động & Đối tượng")}</div>
              <div>
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${getActionBadgeColor(
                    log.action,
                  )}`}
                >
                  {translateText(log.action)}
                </span>
              </div>
              <div className="mt-1.5 text-xs text-slate-600">{translateText("Thực thể:")}{' '}
                <span className="font-semibold text-slate-800 font-mono">
                  {translateText(log.targetEntity || 'HỆ THỐNG')}
                </span>
                {log.targetId && (
                  <span className="ml-1 text-slate-500 font-mono">{translateText("(ID: #")}{translateText(log.targetId)})
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />{translateText(" Thời gian ghi nhận")}</div>
              <div className="font-semibold text-slate-800 font-mono">
                {translateText(formatTimestamp(log.createdAt))}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {translateText(log.createdAt)}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />{translateText(" Địa chỉ mạng & Thiết bị")}</div>
              <div className="font-semibold text-slate-800 font-mono">{translateText("IP: ")}{log.ipAddress || translateText('127.0.0.1 (Local)')}
              </div>
              {log.userAgent && (
                <div
                  className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1"
                  title={translateText(log.userAgent)}
                >
                  <Laptop className="w-3 h-3 shrink-0" />
                  <span className="truncate">{translateText(log.userAgent)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-600" />{translateText(" Dữ liệu Chi tiết & Dấu vết thay đổi (Audit Details)")}</label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />{translateText(" Đã sao chép")}</>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />{translateText(" Sao chép JSON")}</>
                )}
              </button>
            </div>

            <div className="relative rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto shadow-inner max-h-64">
              <pre className="whitespace-pre-wrap break-all leading-relaxed">
                {translateText(JSON.stringify(log.details, null, 2))}
              </pre>
            </div>
            <p className="text-[11px] text-slate-400 italic">{translateText("* Dữ liệu nhạy cảm (mật khẩu, secret token, mã OTP) đã được hệ thống tự động kiểm tra và che mờ (Data Masking) tuân thủ quy định CR-05.")}</p>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition shadow-xs"
          >{translateText("Đóng cửa sổ")}</button>
        </div>
      </div>
    </div>
  );
};

