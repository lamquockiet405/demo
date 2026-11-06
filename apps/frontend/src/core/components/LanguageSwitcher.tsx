import { Languages } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  return (
    <label className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs print:hidden ${className}`}>
      <Languages className="h-3.5 w-3.5 text-teal-700 shrink-0" aria-hidden="true" />
      <span className="sr-only">{language === 'vi' ? 'Ngôn ngữ' : 'Language'}</span>
      <select
        aria-label={language === 'vi' ? 'Ngôn ngữ' : 'Language'}
        value={language}
        onChange={event => setLanguage(event.target.value as 'vi' | 'en')}
        className="min-w-0 cursor-pointer rounded bg-transparent py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
      >
        <option value="vi" lang="vi">Tiếng Việt</option>
        <option value="en" lang="en">English</option>
      </select>
    </label>
  );
}
