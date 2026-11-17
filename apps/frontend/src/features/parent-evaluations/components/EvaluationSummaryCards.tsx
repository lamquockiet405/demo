import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { Star, Smile, Clock, CheckCircle2 } from 'lucide-react';
import { ParentEvaluationSummaryStats } from '../types';

interface EvaluationSummaryCardsProps {
  stats?: ParentEvaluationSummaryStats;
}

export const EvaluationSummaryCards: React.FC<EvaluationSummaryCardsProps> = ({ stats }) => {
  useLanguage();
  const avgRating = stats?.avgRating != null ? Number(stats.avgRating).toFixed(1) : '4.9';
  const positiveRate = stats?.positiveRate != null ? Number(stats.positiveRate).toFixed(1) : '100.0';
  const pendingCount = stats?.pendingCount ?? 0;
  const respondedCount = stats?.respondedCount ?? 0;
  const totalCount = stats?.totalCount ?? 0;
  const pendingClasses = stats?.pendingClassesCount ?? 0;
  const avgResponseTime = stats?.avgResponseTime || '2.4 giờ';

  const cards = [
    {
      title: 'Điểm hài lòng trung bình',
      value: avgRating,
      unit: '/ 5.0',
      hasStar: true,
      badge: '+0.2',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
      subText: `${totalCount} lượt đánh giá thực`,
      icon: Star,
      iconClass: 'bg-teal-50 text-teal-600 border-teal-100',
      valueClass: 'text-slate-900',
    },
    {
      title: 'Tỷ lệ khen ngợi tích cực',
      value: `${positiveRate}%`,
      unit: 'Đạt chuẩn',
      hasStar: false,
      badge: 'Tích cực',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
      subText: 'Món ăn ngon, rau tươi sạch',
      icon: Smile,
      iconClass: 'bg-amber-50 text-amber-600 border-amber-100',
      valueClass: 'text-slate-900',
    },
    {
      title: 'Đang chờ BGH phản hồi',
      value: pendingCount,
      unit: 'phản hồi',
      hasStar: false,
      badge: pendingCount > 0 ? 'Cần xử lý' : 'Đã hết',
      badgeClass: pendingCount > 0
        ? 'bg-rose-50 text-rose-700 border-rose-200/70'
        : 'bg-slate-50 text-slate-600 border-slate-200/70',
      subText: `${pendingClasses} lớp mầm non`,
      icon: Clock,
      iconClass: 'bg-rose-50 text-rose-600 border-rose-100',
      valueClass: pendingCount > 0 ? 'text-rose-600' : 'text-slate-900',
    },
    {
      title: 'Đã xử lý & giải đáp',
      value: respondedCount,
      unit: 'lượt',
      hasStar: false,
      badge: `Đạt ${positiveRate}%`,
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/70',
      subText: `TB giải đáp ${avgResponseTime}`,
      icon: CheckCircle2,
      iconClass: 'bg-blue-50 text-blue-600 border-blue-100',
      valueClass: 'text-slate-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div
            key={idx}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between h-36"
          >
            {/* Top Row: Title & Icon */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 truncate mr-2">
                {translateText(card.title)}
              </span>
              <div
                className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${card.iconClass}`}
              >
                <IconComponent className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Middle Row: Large Value & Unit */}
            <div className="flex items-baseline gap-1.5 my-auto">
              <span className={`text-3xl font-black tracking-tight ${card.valueClass}`}>
                {translateText(card.value)}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {translateText(card.unit)}
              </span>
              {card.hasStar && (
                <Star className="w-4 h-4 fill-amber-400 text-amber-400 ml-0.5" />
              )}
            </div>

            {/* Bottom Row: Badge & Description */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-lg font-bold text-[11px] border shrink-0 ${card.badgeClass}`}
              >
                {translateText(card.badge)}
              </span>
              <span className="text-slate-500 text-xs truncate">
                {translateText(card.subText)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
