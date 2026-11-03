export const ALLERGIES_CHANGED = 'kidmeal:allergies-changed';
export const ALLERGIES_STORAGE_KEY = 'kidmeal:allergies-updated-at';

export function notifyAllergyChange() {
  try { localStorage.setItem(ALLERGIES_STORAGE_KEY, String(Date.now())); } catch { /* Storage may be unavailable. */ }
  window.dispatchEvent(new Event(ALLERGIES_CHANGED));
}
