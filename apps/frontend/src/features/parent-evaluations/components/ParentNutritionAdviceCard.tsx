import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  Utensils,
  Pill,
  Send,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { nutritionAdviceApi, PickyEatingAdvice } from '../../nutrition/api/nutritionAdviceApi';

interface ParentNutritionAdviceCardProps {
  childId?: string;
}

export const ParentNutritionAdviceCard: React.FC<ParentNutritionAdviceCardProps> = ({ childId }) => {
  useLanguage();
  const [advice, setAdvice] = useState<PickyEatingAdvice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('Gia đình đã nắm rõ hướng dẫn và sẽ phối hợp tăng cường dinh dưỡng cho bé tại nhà.');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchAdvice = async () => {
    try {
      setLoading(true);
      const res: any = await nutritionAdviceApi.getChildAdvice(childId);
      const list = res?.advices || (res?.advice ? [res.advice] : []);
      if (list && list.length > 0) {
        setAdvice(list[0]);
      } else {
        setAdvice(null);
      }
    } catch (err) {
      console.error('Lỗi khi tải tư vấn dinh dưỡng cho bé:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
  }, [childId]);

  const handleConfirm = async () => {
    if (!advice) return;
    try {
      setConfirming(true);
      const updated: any = await nutritionAdviceApi.confirmAdvice(advice.id, feedback);
      const adviceObj = updated?.advice || updated;
      setAdvice(adviceObj);
      setStatusMessage('Cảm ơn Quý phụ huynh! Nhà trường và chuyên gia dinh dưỡng đã nhận được xác nhận.');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      alert(translateText(err.message || 'Không thể gửi phản hồi, vui lòng thử lại.'));
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return null; // Tải ngầm mượt mà
  }

  if (!advice) {
    return null; // Bé ăn ngoan, không có cảnh báo kén ăn cần tư vấn
  }

  const isConfirmed = advice.status === 'PARENT_CONFIRMED';

  const severityBadge = () => {
    switch (advice.severityLevel) {
      case 'SEVERE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>{translateText("Kén ăn mức độ nặng")}</span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>{translateText("Biếng ăn mức độ vừa")}</span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-800 border border-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>{translateText("Cần lưu ý nhẹ")}</span>
        );
    }
  };

  return (
    <div className="mb-6 rounded-3xl bg-gradient-to-br from-amber-50/90 via-orange-50/60 to-rose-50/70 border-2 border-amber-300/80 shadow-md p-5 sm:p-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full">{translateText("Tư Vấn Dinh Dưỡng Bổ Sung Tại Nhà")}</span>
              {severityBadge()}
            </div>
            <h3 className="text-lg font-black text-slate-900 mt-1">
              {translateText(advice.adviceTitle)}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">{translateText("Từ: ")}<strong className="text-slate-800">{advice.createdBy?.fullName || translateText('Chuyên gia Dinh dưỡng & Giáo viên')}</strong>{translateText(" • Ngày tư vấn: ")}{translateText(advice.adviceDate)}
            </p>
          </div>
        </div>

        {isConfirmed ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs shrink-0 self-start sm:self-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Phụ huynh đã xác nhận")}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-amber-200/80 border border-amber-400 text-amber-900 font-bold text-xs shrink-0 self-start sm:self-center">
            <HeartHandshake className="w-4 h-4 text-amber-700" />
            <span>{translateText("Chờ phụ huynh phản hồi")}</span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cột 1 & 2: Triệu chứng & Phác đồ bổ sung */}
        <div className="lg:col-span-2 space-y-4">
          {/* Triệu chứng nhận diện */}
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1.5">{translateText("Dấu hiệu ghi nhận tại bữa ăn lớp:")}</span>
            <div className="flex flex-wrap gap-2">
              {advice.pickySymptoms.map((sym, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-white/90 border border-amber-200 rounded-xl text-xs font-semibold text-amber-950 shadow-2xs"
                >
                  ⚠️ {translateText(sym)}
                </span>
              ))}
            </div>
          </div>

          {/* Phác đồ bổ sung tại nhà */}
          <div className="bg-white/90 rounded-2xl p-4 border border-amber-200 shadow-2xs">
            <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Pill className="w-4 h-4 text-amber-600" />{translateText("Gợi ý chăm sóc và dinh dưỡng tại nhà")}</h4>
            <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-line">
              {advice.homeSupplementAdvice}
            </p>
          </div>
        </div>

        {/* Cột 3: Món ăn gợi ý */}
        <div className="space-y-4">
          {/* Món ăn gợi ý buổi tối */}
          <div className="bg-white/90 rounded-2xl p-4 border border-amber-200 shadow-2xs">
            <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Utensils className="w-4 h-4 text-emerald-600" />{translateText("Món ăn gợi ý cho bữa tối tại gia")}</h4>
            <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
              {advice.recommendedDishes.map((dish, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{translateText(dish)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation & Feedback Section */}
      <div className="mt-5 pt-4 border-t border-amber-200/80">
        {statusMessage && (
          <div className="mb-3 px-4 py-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{translateText(statusMessage)}</span>
          </div>
        )}

        {isConfirmed ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs">
            <div className="flex items-center gap-2 text-emerald-900 font-extrabold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{translateText("Phụ huynh đã xác nhận phối hợp vào: ")}{translateText(advice.parentConfirmedAt ? new Date(advice.parentConfirmedAt).toLocaleString(getLocale()) : 'Gần đây')}</span>
            </div>
            {advice.parentFeedback && (
              <p className="mt-1.5 text-slate-700 italic font-medium pl-6">
                “{advice.parentFeedback}”
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white/95 rounded-2xl p-4 border border-amber-300 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <span>{translateText("Phản hồi & Cam kết phối hợp từ gia đình:")}</span>
            </div>

            <textarea
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={translateText("Nhập ghi chú hoặc phản hồi của phụ huynh gửi nhà trường...")}
              className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-500">{translateText("Xác nhận giúp nhà trường và giáo viên theo dõi tiến triển ăn uống của bé sát sao hơn.")}</span>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{translateText("Đang gửi xác nhận...")}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{translateText("Đã Đọc & Xác Nhận Phối Hợp Cùng Nhà Trường")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

