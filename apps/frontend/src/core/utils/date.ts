/**
 * Utility functions for standardizing date and time formatting across the KidMeal project (DD/MM/YYYY - Ngày/Tháng/Năm)
 */

/**
 * Format a date string, timestamp, or Date object into DD/MM/YYYY
 * Handles ISO strings (2026-11-22), date-only strings (2026-11-22), and Date instances
 */
export const formatDateDMY = (value?: string | number | Date | null): string => {
  if (!value) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    return `${d}/${m}/${y}`;
  }
  const str = String(value).trim();
  const iso = str.split('T')[0];
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(iso);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return str;
};

/**
 * Format a date and time string or Date object into DD/MM/YYYY HH:mm
 */
export const formatDateTimeDMY = (value?: string | number | Date | null): string => {
  if (!value) return '';
  const dateObj = value instanceof Date ? value : new Date(value);
  if (isNaN(dateObj.getTime())) return String(value);
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  const hr = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hr}:${min}`;
};

/**
 * Format date range: start - end (e.g. 17/11/2026 - 21/11/2026)
 */
export const formatDateRangeDMY = (start?: string | null, end?: string | null, separator: string = ' - '): string => {
  const s = formatDateDMY(start);
  const e = formatDateDMY(end);
  if (s && e) return `${s}${separator}${e}`;
  return s || e || '';
};
