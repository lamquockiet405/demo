/**
 * JWT Parser & Expiration Utilities — Quản lý hạn dùng Access Token
 */

export function parseJwt(token: string | null): any | null {
  if (!token || token === 'undefined' || token === 'null') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string | null): boolean {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  // exp tính theo giây, Date.now() tính theo ms; buffer 5 giây
  return Date.now() >= payload.exp * 1000 - 5000;
}

export function getJwtRemainingTimeMs(token: string | null): number {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return 0;
  const remaining = payload.exp * 1000 - Date.now();
  return Math.max(0, remaining);
}

