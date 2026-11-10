import english from './locales/en.json';
import vietnamese from './locales/vi.json';

export type Language = 'vi' | 'en';
export const LANGUAGE_STORAGE_KEY = 'kidmeal.language';
const listeners = new Set<() => void>();
const validLanguage = (value: unknown): value is Language => value === 'vi' || value === 'en';

function savedLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return validLanguage(value) ? value : 'vi';
  } catch {
    return 'vi';
  }
}

let language: Language = savedLanguage();
export const getLanguage = (): Language => language;
export const getLocale = (): string => language === 'en' ? 'en-GB' : 'vi-VN';
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function updateDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.title = language === 'en'
    ? 'KidMeal – Preschool Meals & Nutrition'
    : 'KidMeal – Quản lý Bữa ăn & Dinh dưỡng Mầm non';
}

export function setLanguage(next: Language) {
  if (!validLanguage(next)) return;
  // Storage may be unavailable in private browsing; switching still works.
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* In-memory preference. */ }
  if (language === next) return;
  language = next;
  updateDocument();
  listeners.forEach(listener => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return;
    const next = validLanguage(event.newValue) ? event.newValue : 'vi';
    if (next === language) return;
    language = next;
    updateDocument();
    listeners.forEach(listener => listener());
  });
}
updateDocument();

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const dictionaries: Record<Language, Record<string, string>> = {
  en: Object.assign(Object.create(null), english),
  vi: Object.assign(Object.create(null), vietnamese),
};
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(english as Record<string, string>)
  .filter(([source]) => /\{\{\d+\}\}/.test(source))
  .sort(([a], [b]) => b.replace(/\{\{\d+\}\}/g, '').length - a.replace(/\{\{\d+\}\}/g, '').length)
  .map(([source, target]) => {
    const slots: string[] = [];
    const parts = source.split(/(\{\{\d+\}\})/g).map(part => {
      if (!/^\{\{\d+\}\}$/.test(part)) return escapeRegex(part);
      slots.push(part);
      return '([\\s\\S]*?)';
    });
    return { regex: new RegExp(`^${parts.join('')}$`), slots, target };
  });
const cache = new Map<string, string>();

/** Translate display text only. Values submitted to the API remain in their original form. */
export function t<T>(value: T): T {
  if (typeof value !== 'string' || !value.trim()) return value;
  const source = normalize(value);
  let translated = dictionaries[language][source];
  if (translated === undefined && language === 'en') {
    translated = cache.get(source);
    if (translated === undefined) {
      for (const pattern of patterns) {
        const match = pattern.regex.exec(source);
        if (!match) continue;
        const values = new Map(pattern.slots.map((slot, index) => [slot, match[index + 1]]));
        translated = pattern.target.replace(/\{\{\d+\}\}/g, slot => values.get(slot) ?? slot);
        break;
      }
      translated ??= source;
      if (cache.size >= 2000) cache.clear();
      cache.set(source, translated);
    }
  }
  if (translated === undefined || translated === source) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return (leading + translated + trailing) as T;
}
