import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from 'react';
import {
  Star,
  CornerDownRight,
  Send,
  Edit3,
  CheckCircle2,
  Clock,
  Calendar,
  Utensils,
  GraduationCap,
  X,
} from 'lucide-react';
import { ParentEvaluationItem } from '../types';

export const formatCleanClassName = (className?: string): string => {
  if (!className) return 'Lớp Mầm Non';
  return String(className).replace(/\s*\([^)]*\)/g, '').trim() || 'Lớp Mầm Non';
};

export const formatCleanMealTitle = (mealTitle?: string, mealType?: string): string => {
  const raw = (mealTitle || mealType || 'Bữa trưa dinh dưỡng')
    .replace(/MAU_GIAO/gi, 'Mẫu giáo')
    .replace(/NHA_TRE/gi, 'Nhà trẻ')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  if (raw === 'LUNCH' || raw === 'TRUA') return 'Bữa trưa chính (11:00)';
  if (raw === 'AFTERNOON_SNACK' || raw === 'XE') return 'Buổi phụ (14:30)';
  if (raw === 'LATE_SNACK') return 'Buổi chiều xế (17:00)';
  if (raw === 'BREAKFAST' || raw === 'MORNING_SNACK') return 'Buổi sáng (09:00)';
  return raw;
};

export const formatCleanDateTime = (dateStr?: string, timeLabel?: string): string => {
  let formattedDate = '';
  if (dateStr) {
    const clean = dateStr.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      formattedDate = clean.split('-').reverse().join('/');
    } else {
      formattedDate = clean;
    }
  }
  if (formattedDate && timeLabel && !timeLabel.includes('/')) {
    return `${formattedDate} · ${timeLabel}`;
  }
  return formattedDate || timeLabel || '';
};

interface EvaluationCardProps {
  item: ParentEvaluationItem;
  onRespond: (
    id: string,
    content: string,
    pushNotification: boolean,
  ) => Promise<void>;
  onPhotoClick?: (photo: { url: string; caption: string }) => void;
}

export const EvaluationCard: React.FC<EvaluationCardProps> = ({
  item,
  onRespond,
  onPhotoClick,
}) => {
  useLanguage();
  const isPending = item.status === 'PENDING' || !item.responseContent;
  const [isEditingReply, setIsEditingReply] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>(
    item.responseContent || '',
  );
  const [pushNotification, setPushNotification] = useState<boolean>(
    item.pushNotificationSent ?? true,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const getAvatarInfo = (name?: string) => {
    if (!name) return { initials: 'PH', bg: 'bg-teal-600' };
    const parts = name.trim().split(' ').filter(Boolean);
    const initials =
      parts.length >= 2
        ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();

    const colors = [
      'bg-teal-600',
      'bg-blue-600',
      'bg-indigo-600',
      'bg-violet-600',
      'bg-emerald-600',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bg = colors[hash % colors.length];

    return { initials, bg };
  };

  const avatar = getAvatarInfo(item.parentNameCustom);
  const cleanClass = formatCleanClassName(item.classNameCustom);
  const cleanMeal = formatCleanMealTitle(item.mealTitle, item.mealType);
  const cleanDateTime = formatCleanDateTime(item.feedbackDate, item.feedbackTimeLabel);

  const quickSuggestions = [
    {
      label: 'Cảm ơn phụ huynh',
      text: 'Kính gửi gia đình, Ban Giám Hiệu nhà trường xin chân thành cảm ơn ý kiến đóng góp quý báu của Quý Phụ huynh.',
    },
    {
      label: 'Đã điều chỉnh với tổ bếp',
      text: 'BGH đã trao đổi trực tiếp với Bếp trưởng để điều chỉnh định lượng và gia vị phù hợp, đảm bảo bữa ăn ngon miệng cho các con.',
    },
    {
      label: 'Đã kiểm tra khẩu phần',
      text: 'Bộ phận dinh dưỡng đã kiểm tra quy trình lưu mẫu và khẩu phần thực tế hôm nay để đảm bảo an toàn tuyệt đối cho các bé.',
    },
  ];

  const handleSelectSuggestion = (suggestionText: string) => {
    setResponseText((prev) => (prev ? `${prev} ${suggestionText}` : suggestionText));
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) return;
    setIsSubmitting(true);
    try {
      await onRespond(item.id, responseText.trim(), pushNotification);
      setIsEditingReply(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-xs overflow-hidden ${
        isPending
          ? 'border-rose-200 border-l-4 border-l-rose-500'
          : 'border-slate-200/90 border-l-4 border-l-teal-500'
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        {/* LEFT COLUMN (7 cols): Ý kiến đánh giá từ Phụ huynh */}
        <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div className="space-y-3">
            {/* Top row: Parent info + Star Rating */}
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${avatar.bg} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs`}
                >
                  {translateText(avatar.initials)}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">
                      {translateText(item.parentNameCustom || 'Phụ huynh')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-2.5 py-0.5 rounded-lg">
                      <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                      <span>
                        {item.childNameCustom} · {cleanClass}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 mt-1">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Utensils className="w-3 h-3 text-slate-400" />
                      <span>{translateText(cleanMeal)}</span>
                    </span>
                    {cleanDateTime && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{cleanDateTime}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Rating Pill & Status */}
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/80">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= item.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200 fill-slate-100'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="ml-1 text-xs font-black text-amber-900">
                    {item.rating.toFixed(1)}
                  </span>
                </div>

                {isPending ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl">
                    <Clock className="w-3 h-3" />
                    <span>{translateText('Chờ phản hồi')}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs rounded-xl">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{translateText('Đã phản hồi')}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Parent Feedback Content Quote Box */}
            <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-3.5">
              <p className="text-sm leading-relaxed text-slate-800 font-medium">
                “{item.content}”
              </p>
            </div>

            {/* Attached Photos (if any) */}
            {item.photoDetails && item.photoDetails.length > 0 && (
              <div className="flex items-center gap-2.5 pt-1">
                {item.photoDetails.map((ph, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => onPhotoClick && onPhotoClick(ph)}
                    className="group relative cursor-pointer rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:shadow-md transition"
                  >
                    <img
                      src={ph.url}
                      alt={translateText(ph.caption)}
                      className="w-16 h-16 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Phản hồi từ Ban Giám Hiệu */}
        <div className="lg:col-span-5 p-4 sm:p-5 bg-slate-50/40 flex flex-col justify-between">
          {isPending || isEditingReply ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    {translateText(
                      isPending
                        ? 'Phản hồi nhanh từ Ban Giám Hiệu'
                        : 'Chỉnh sửa nội dung phản hồi',
                    )}
                  </span>
                </span>
                {!isPending && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingReply(false);
                      setResponseText(item.responseContent || '');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{translateText('Hủy')}</span>
                  </button>
                )}
              </div>

              {/* 1-Click Quick Template Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug.text)}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-teal-800 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                  >
                    + {translateText(sug.label)}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder={translateText(
                  'Nhập phản hồi gửi tới phụ huynh hoặc bấm chọn mẫu câu bên trên...',
                )}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition leading-relaxed"
              />

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pushNotification}
                    onChange={(e) => setPushNotification(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 accent-teal-600 cursor-pointer"
                  />
                  <span>{translateText('Báo qua App Phụ huynh')}</span>
                </label>

                <button
                  type="button"
                  onClick={handleSubmitResponse}
                  disabled={isSubmitting || !responseText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {translateText(isSubmitting ? 'Đang gửi...' : 'Gửi phản hồi')}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-between bg-teal-50/50 border border-teal-200/70 rounded-xl p-3.5 space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-teal-900 flex items-center gap-1.5">
                    <CornerDownRight className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>{translateText('Phản hồi từ Ban Giám Hiệu')}</span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {item.respondedAt
                      ? new Date(item.respondedAt).toLocaleDateString(getLocale())
                      : ''}
                  </span>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  “{item.responseContent}”
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-teal-200/50">
                <span className="text-[11px] font-medium text-teal-700">
                  {translateText('Đã đồng bộ lên cổng phụ huynh')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setResponseText(item.responseContent || '');
                    setIsEditingReply(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 border border-teal-200 text-xs font-bold text-teal-800 transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{translateText('Sửa phản hồi')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
