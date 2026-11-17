export function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesSearch(query: unknown, ...values: unknown[]): boolean {
  const term = normalizeSearch(query);
  if (!term) return true;
  return values.some(value => normalizeSearch(value).includes(term));
}
