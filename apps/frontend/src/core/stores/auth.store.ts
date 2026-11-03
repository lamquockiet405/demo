import { create } from 'zustand';
import { isJwtExpired, getJwtRemainingTimeMs } from '../utils/jwt';

/**
 * Auth User — dữ liệu user nhận từ API login response.
 */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  tenantId: string;
}

/**
 * Tenant — dữ liệu trường mầm non cho dropdown.
 */
export interface TenantInfo {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface AuthState {
  /** User hiện tại (null nếu chưa login) */
  user: AuthUser | null;
  /** JWT access token */
  accessToken: string | null;
  /** JWT refresh token */
  refreshToken: string | null;
  /** Tenant UUID đang chọn */
  selectedTenantId: string | null;
  /** Computed: user !== null */
  isAuthenticated: boolean;

  /** Lưu kết quả login vào state + localStorage */
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  /** Chọn tenant cho login */
  setTenantId: (tenantId: string) => void;
  /** Xóa toàn bộ auth state + localStorage */
  logout: () => void;
  /** Hydrate từ localStorage khi app khởi động */
  hydrate: () => void;
}

let autoLogoutTimer: any = null;

const scheduleAutoLogout = (token: string) => {
  if (autoLogoutTimer) {
    clearTimeout(autoLogoutTimer);
    autoLogoutTimer = null;
  }

  const remainingMs = getJwtRemainingTimeMs(token);
  if (remainingMs <= 0) {
    useAuthStore.getState().logout();
    window.location.href = '/home';
    return;
  }

  autoLogoutTimer = setTimeout(() => {
    console.warn('[AuthStore] Access token đã hết hạn, tự động đăng xuất về trang Home...');
    useAuthStore.getState().logout();
    window.location.href = '/home';
  }, remainingMs);
};

/**
 * Lấy trạng thái Auth ban đầu từ localStorage một cách đồng bộ
 * Đảm bảo ngay từ lần render đầu tiên đã xác định chính xác người dùng còn Access Token hay không.
 */
const getInitialAuthState = (): {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedTenantId: string | null;
  isAuthenticated: boolean;
} => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
      selectedTenantId: null,
      isAuthenticated: false,
    };
  }

  const accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');
  const tenantId = localStorage.getItem('tenant_id');
  const userJson = localStorage.getItem('auth_user');

  if (
    accessToken &&
    accessToken !== 'undefined' &&
    accessToken !== 'null' &&
    userJson
  ) {
    if (isJwtExpired(accessToken)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        selectedTenantId: null,
        isAuthenticated: false,
      };
    }

    try {
      const user = JSON.parse(userJson) as AuthUser;
      scheduleAutoLogout(accessToken);
      return {
        user,
        accessToken,
        refreshToken,
        selectedTenantId: tenantId || '1',
        isAuthenticated: true,
      };
    } catch {
      localStorage.removeItem('auth_user');
    }
  }

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    selectedTenantId: null,
    isAuthenticated: false,
  };
};

const initialState = getInitialAuthState();

/**
 * Zustand Auth Store — Quản lý trạng thái xác thực.
 * Tự động tính toán thời hạn Access Token và tự động đăng xuất về /home khi hết hạn.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: initialState.user,
  accessToken: initialState.accessToken,
  refreshToken: initialState.refreshToken,
  selectedTenantId: initialState.selectedTenantId,
  isAuthenticated: initialState.isAuthenticated,

  setAuth: (user, accessToken, refreshToken) => {
    // Persist vào localStorage
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('tenant_id', user.tenantId);
    localStorage.setItem('auth_user', JSON.stringify(user));

    set({
      user,
      accessToken,
      refreshToken,
      selectedTenantId: user.tenantId,
      isAuthenticated: true,
    });

    scheduleAutoLogout(accessToken);
  },

  setTenantId: (tenantId) => {
    localStorage.setItem('tenant_id', tenantId);
    set({ selectedTenantId: tenantId });
  },

  logout: () => {
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
      autoLogoutTimer = null;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('auth_user');

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      selectedTenantId: null,
      isAuthenticated: false,
    });
  },

  hydrate: () => {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const tenantId = localStorage.getItem('tenant_id');
    const userJson = localStorage.getItem('auth_user');

    if (
      accessToken &&
      accessToken !== 'undefined' &&
      accessToken !== 'null' &&
      userJson
    ) {
      // Nếu Access Token trong LocalStorage đã hết hạn thì tự động logout
      if (isJwtExpired(accessToken)) {
        console.warn('[AuthStore] Access token lưu trong LocalStorage đã hết hạn.');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_user');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          selectedTenantId: null,
          isAuthenticated: false,
        });
        return;
      }

      try {
        const user = JSON.parse(userJson) as AuthUser;
        set({
          user,
          accessToken,
          refreshToken,
          selectedTenantId: tenantId || '1',
          isAuthenticated: true,
        });

        scheduleAutoLogout(accessToken);
      } catch {
        localStorage.removeItem('auth_user');
      }
    } else if (accessToken === 'undefined' || accessToken === 'null') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
    }
  },
}));
