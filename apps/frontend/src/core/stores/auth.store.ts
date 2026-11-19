import { create } from 'zustand';
import { isJwtExpired, getJwtRemainingTimeMs } from '../utils/jwt';
import { fetchCurrentUser } from '../api/auth.api';
import { refreshAccessToken, authTokensChangedEvent, authSessionExpiredEvent } from '../api/axios';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  tenantId: string;
}

export interface TenantInfo {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedTenantId: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setTenantId: (tenantId: string) => void;
  logout: () => void;
  hydrate: () => void;
  refreshProfile: () => Promise<void>;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const validToken = (token: string | null): token is string =>
  !!token && token !== 'undefined' && token !== 'null';
const anonymous = {
  user: null, accessToken: null, refreshToken: null,
  selectedTenantId: null, isAuthenticated: false,
};

function clearRefreshTimer() {
  if (refreshTimer !== null) clearTimeout(refreshTimer);
  refreshTimer = null;
}

async function renewSession() {
  try {
    await refreshAccessToken();
  } catch {
    // An outage must not destroy a renewable session. Retry when online or after a short delay.
    if (useAuthStore.getState().isAuthenticated) {
      clearRefreshTimer();
      refreshTimer = setTimeout(() => { void renewSession(); }, 30000);
    }
  }
}

function scheduleRefresh(token: string) {
  clearRefreshTimer();
  const refreshToken = localStorage.getItem('refresh_token');
  const aheadMs = validToken(refreshToken) ? 60000 : 0;
  const delay = Math.max(0, getJwtRemainingTimeMs(token) - aheadMs);
  refreshTimer = setTimeout(() => { void renewSession(); }, Math.min(delay, 2147483647));
}

function readStoredSession() {
  if (typeof window === 'undefined') return anonymous;
  const accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');
  const userJson = localStorage.getItem('auth_user');
  if (!validToken(accessToken) || !userJson) return anonymous;
  const canRefresh = validToken(refreshToken) && !isJwtExpired(refreshToken);
  if (isJwtExpired(accessToken) && !canRefresh) {
    for (const key of ['access_token', 'refresh_token', 'auth_user']) localStorage.removeItem(key);
    return anonymous;
  }
  try {
    const user = JSON.parse(userJson) as AuthUser;
    if (!user?.id) return anonymous;
    return {
      user, accessToken, refreshToken,
      selectedTenantId: localStorage.getItem('tenant_id') || user.tenantId || '1',
      isAuthenticated: true,
    };
  } catch {
    localStorage.removeItem('auth_user');
    return anonymous;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...readStoredSession(),

  refreshProfile: async () => {
    const startedForUser = get().user;
    if (!startedForUser || !get().accessToken) return;
    try {
      const profile = await fetchCurrentUser();
      const current = get().user;
      if (!current || current.id !== startedForUser.id || String(profile.id) !== current.id) return;
      const updated = { ...current, fullName: profile.fullName, phone: profile.phone, avatarUrl: profile.avatarUrl };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      set({ user: updated });
    } catch {
      // Keep the existing session when a profile refresh is temporarily unavailable.
    }
  },

  refreshProfile: async () => {
    const startedForUser = get().user;
    if (!startedForUser || !get().accessToken) return;
    try {
      const profile = await fetchCurrentUser();
      const current = get().user;
      if (!current || current.id !== startedForUser.id || String(profile.id) !== current.id) return;
      const updated = { ...current, fullName: profile.fullName, phone: profile.phone, avatarUrl: profile.avatarUrl };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      set({ user: updated });
    } catch {
      // Keep the existing session when a profile refresh is temporarily unavailable.
    }
  },

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('tenant_id', user.tenantId);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, accessToken, refreshToken, selectedTenantId: user.tenantId, isAuthenticated: true });
    scheduleRefresh(accessToken);
  },

  setTenantId: selectedTenantId => {
    localStorage.setItem('tenant_id', selectedTenantId);
    set({ selectedTenantId });
  },

  logout: () => {
    clearRefreshTimer();
    for (const key of ['access_token', 'refresh_token', 'tenant_id', 'auth_user']) localStorage.removeItem(key);
    set({ ...anonymous });
  },

  hydrate: () => {
    clearRefreshTimer();
    const session = readStoredSession();
    set(session);
    if (session.accessToken) scheduleRefresh(session.accessToken);
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener(authTokensChangedEvent, () => useAuthStore.getState().hydrate());
  window.addEventListener(authSessionExpiredEvent, () => useAuthStore.getState().logout());
  window.addEventListener('storage', event => {
    if (event.key === null || ['access_token', 'refresh_token', 'auth_user'].includes(event.key)) {
      useAuthStore.getState().hydrate();
    }
  });
  const resume = () => {
    const { isAuthenticated, accessToken } = useAuthStore.getState();
    if (document.visibilityState === 'visible' && isAuthenticated &&
        getJwtRemainingTimeMs(accessToken) <= 60000) void renewSession();
  };
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
}
