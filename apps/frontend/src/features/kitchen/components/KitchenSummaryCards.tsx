import type { LucideIcon } from 'lucide-react';
import { t as translateText } from '../../../core/i18n/language';

export interface KitchenSummaryMetric {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
}

const tones = {
  accent: 'bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600',
};

export function KitchenSummaryCards({ metrics }: { metrics: KitchenSummaryMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-5 xl:grid-cols-4" aria-label={translateText('Thống kê tổng quan')}>
      {metrics.map(({ label, value, icon: Icon, tone = 'accent' }) => (
        <div key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className={`shrink-0 rounded-xl p-3 ${tones[tone]}`}><Icon size={22} aria-hidden="true" /></span>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{translateText(label)}</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value.toLocaleString('vi-VN')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
