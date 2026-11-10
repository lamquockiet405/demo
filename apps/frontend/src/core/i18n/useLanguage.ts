import { useSyncExternalStore } from 'react';
import { getLanguage, getLocale, setLanguage, subscribeLanguage, t } from './language';

/** Subscribe without remounting forms or losing the current route and unsaved edits. */
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'vi' as const);
  return { language, locale: getLocale(), setLanguage, t };
}
