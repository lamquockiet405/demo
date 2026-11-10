import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Activity,
  Flame,
  HelpCircle,
} from 'lucide-react';
import { WeeklyMenu, SubmitMenuPayload } from '../api/weekly-menus.api';
import { useAuthStore } from '../../../core/stores/auth.store';

interface SubmitMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  menu: WeeklyMenu | null;
  onSubmit: (id: string, payload: SubmitMenuPayload) => Promise<void>;
  detectedViolations?: Array<{ ruleCode: string; message: string; severity?: string }>;
}

const COMMITMENT_ITEMS = [
  {
    code: 'COMMIT_TT28_NUTRITION',
    title: 'Định mức dinh dưỡng theo Thông tư 28/2016/TT-BGDĐT',
    desc: 'Cam kết năng lượng trung bình ngày (Kcal) và tỷ lệ cân đối P:L:G đáp ứng đúng khuyến nghị theo nhóm tuổi học sinh.',
  },
  {
    code: 'COMMIT_QD1246_SAFETY',
    title: 'An toàn VSTP & Kiểm thực 3 bước theo QĐ 1246/QĐ-BYT',
    desc: 'Cam kết tuân thủ quy trình kiểm thực 3 bước, lưu mẫu thức ăn tối thiểu 24 giờ và nguồn gốc thực phẩm rõ ràng.',
  },
  {
    code: 'COMMIT_ALLERGEN_SAFETY',
    title: 'Kiểm soát dị ứng học đường & Suất ăn thay thế',
    desc: 'Đã rà soát danh sách học sinh dị ứng (Hải sản, Trứng, Đậu phộng...), chuẩn bị sẵn thực đơn thay thế an toàn.',
  },
  {
    code: 'COMMIT_PROFESSIONAL_RESP',
    title: 'Trách nhiệm giải trình chuyên môn trước Ban Giám Hiệu',
    desc: 'Chuyên viên Dinh dưỡng chịu trách nhiệm chuyên môn hoàn toàn về định lượng dinh dưỡng và nội dung giải trình can thiệp.',
  },
];

export const SubmitMenuModal: React.FC<SubmitMenuModalProps> = ({
  isOpen,
  onClose,
  menu,
  onSubmit,
  detectedViolations = [],
}) => {
  useLanguage();
  const { user } = useAuthStore();

  const [selectedCommitments, setSelectedCommitments] = useState<string[]>([
    'COMMIT_TT28_NUTRITION',
    'COMMIT_QD1246_SAFETY',
    'COMMIT_ALLERGEN_SAFETY',
    'COMMIT_PROFESSIONAL_RESP',
  ]);
  const [overrideJustification, setOverrideJustification] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Nhận diện cảnh báo vi phạm
  const warnings = useMemo(() => {
    return detectedViolations.filter((v) => v.severity !== 'INFO');
  }, [detectedViolations]);

  const hasWarnings = warnings.length > 0;

  if (!isOpen || !menu || typeof document === 'undefined') return null;

  const isAllCommitmentsChecked = COMMITMENT_ITEMS.every((item) =>
    selectedCommitments.includes(item.code),
  );

  const toggleCommitment = (code: string) => {
    if (selectedCommitments.includes(code)) {
      setSelectedCommitments(selectedCommitments.filter((c) => c !== code));
    } else {
      setSelectedCommitments([...selectedCommitments, code]);
    }
  };

  const handleSelectAllCommitments = () => {
    if (isAllCommitmentsChecked) {
      setSelectedCommitments([]);
    } else {
      setSelectedCommitments(COMMITMENT_ITEMS.map((item) => item.code));
    }
  };

  const isFormValid =
    isAllCommitmentsChecked &&
    (!hasWarnings || overrideJustification.trim().length >= 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAllCommitmentsChecked) {
      setError('Vui lòng tích xác nhận đầy đủ 4 điều khoản cam kết trách nhiệm chuyên môn.');
      return;
    }

    if (hasWarnings && overrideJustification.trim().length < 10) {
      setError(
        'Thực đơn có cảnh báo quy tắc. Vui lòng nhập lý do giải trình chuyên môn (tối thiểu 10 ký tự).'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: SubmitMenuPayload = {
        commitmentSigned: true,
        commitmentItems: selectedCommitments,
        commitmentText:
          'Tôi cam kết thực đơn tuân thủ đầy đủ định mức Thông tư 28/2016/TT-BGDĐT và an toàn vệ sinh thực phẩm theo Quyết định 1246/QĐ-BYT.',
        overrideJustification: overrideJustification.trim() || undefined,
        violationsSnapshot: warnings,
      };

      await onSubmit(menu.id, payload);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi nộp thực đơn phê duyệt.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4">
      {/* Nền mờ Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        onClick={onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 overflow-hidden z-10 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{translateText("Gửi Duyệt Thực Đơn Kèm Cam Kết Chuyên Môn")}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {menu.title} • {translateText(menu.targetAgeGroup === 'NHA_TRE' ? 'Nhóm Nhà trẻ (18-36T)' : 'Nhóm Mẫu giáo (3-5T)')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 py-4 space-y-4 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-medium">{translateText(error)}</span>
            </div>
          )}

          {/* 1. Pre-flight Audit Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1.5 text-slate-900">
                <Activity className="w-4 h-4 text-teal-600" />{translateText("Đối soát tiền kiểm định mức (TT 28/2016/TT-BGDĐT)")}</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">{translateText("Sẵn sàng gửi BGH")}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-500" />{translateText(" Năng lượng TB")}</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {menu.dailyAverageCalories || 0} <span className="text-[10px] font-normal text-slate-500">{translateText("Kcal")}</span>
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">{translateText("Chất đạm (P)")}</div>
                <div className="text-sm font-bold text-indigo-700 mt-0.5">
                  {menu.dailyAverageProteinG || 0} <span className="text-[10px] font-normal text-slate-500">{translateText("g")}</span>
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">{translateText("Chất béo (L)")}</div>
                <div className="text-sm font-bold text-amber-700 mt-0.5">
                  {menu.dailyAverageFatG || 0} <span className="text-[10px] font-normal text-slate-500">{translateText("g")}</span>
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">{translateText("Bột đường (G)")}</div>
                <div className="text-sm font-bold text-emerald-700 mt-0.5">
                  {menu.dailyAverageCarbG || 0} <span className="text-[10px] font-normal text-slate-500">{translateText("g")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Override Justification Area (Nếu có cảnh báo hoặc nhập thêm ghi chú) */}
          {hasWarnings ? (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">{translateText("Phát hiện ")}{warnings.length}{translateText(" cảnh báo quy tắc cần giải trình can thiệp")}</h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">{translateText("Hệ thống yêu cầu Chuyên viên Dinh dưỡng giải trình lý do chuyên môn trước khi Ban Giám Hiệu xem xét phê duyệt.")}</p>
                </div>
              </div>

              {/* Danh sách cảnh báo */}
              <div className="space-y-1.5 pl-7">
                {warnings.map((w, idx) => (
                  <div key={idx} className="text-xs text-amber-800 bg-white/80 p-2 rounded-xl border border-amber-200/70 flex items-center justify-between">
                    <span className="font-medium">• {translateText(w.message)}</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      {w.ruleCode || translateText('CẢNH BÁO')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Ô giải trình bắt buộc */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>{translateText("Giải trình chuyên môn của Chuyên viên Dinh dưỡng ")}<span className="text-rose-600">*</span>
                  </span>
                  <span className="text-[10px] font-normal text-amber-700">
                    {overrideJustification.trim().length}{translateText(" / 10 ký tự tối thiểu")}</span>
                </label>
                <textarea
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  rows={3}
                  placeholder={translateText("Ví dụ: Bổ sung món canh rau củ tươi luân phiên từ nguồn VietGAP nhằm tăng cường vitamin A và chất xơ trong tuần...")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{translateText("Thực đơn đạt chuẩn 100% quy tắc nhóm thực phẩm & khoảng cách món.")}</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium">{translateText("Không có vi phạm")}</span>
            </div>
          )}

          {/* 3. Nutritionist Professional Commitment Checkboxes */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-teal-600" />{translateText("Bản cam kết trách nhiệm chuyên môn (Bắt buộc)")}</label>
              <button
                type="button"
                onClick={handleSelectAllCommitments}
                className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 transition"
              >
                {translateText(isAllCommitmentsChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả điều khoản')}
              </button>
            </div>

            <div className="space-y-2">
              {COMMITMENT_ITEMS.map((item) => {
                const checked = selectedCommitments.includes(item.code);
                return (
                  <div
                    key={item.code}
                    onClick={() => toggleCommitment(item.code)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      checked
                        ? 'bg-teal-50/50 border-teal-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 w-4 h-4 text-teal-600 rounded-md border-slate-300 focus:ring-teal-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        {translateText(item.title)}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                        {translateText(item.desc)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Digital Signature Footer Notice */}
          <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
            <div>
              <span className="text-slate-400">{translateText("Người nộp duyệt:")}</span>{' '}
              <span className="font-semibold text-slate-800">
                {user?.fullName || translateText('Chuyên viên Dinh dưỡng')}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">{translateText("Thời gian: ")}{translateText(new Date().toLocaleTimeString(getLocale()))} {translateText(new Date().toLocaleDateString(getLocale()))}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
          >{translateText("Quay lại chỉnh sửa")}</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 ${
              isFormValid && !isSubmitting
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-500/20 active:scale-98 cursor-pointer'
                : 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{translateText("Đang gửi Ban Giám Hiệu...")}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{translateText("Ký số & Gửi Ban Giám Hiệu phê duyệt")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
