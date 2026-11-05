import axios, { InternalAxiosRequestConfig } from 'axios';
import { isJwtExpired } from '../utils/jwt';

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return '/api/v1';
};

export const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authTokensChangedEvent = 'kidmeal:auth-tokens-changed';
export const authSessionExpiredEvent = 'kidmeal:auth-session-expired';
let refreshPromise: Promise<string> | null = null;
const validToken = (token: string | null): token is string =>
  !!token && token !== 'undefined' && token !== 'null';
const publicAuthRequest = (url = '') =>
  /^\/auth\/(login|quick-login|refresh|tenants|forgot-password|verify-reset-otp|reset-password)(\?|$)/.test(url);

function expireSession() {
  for (const key of ['access_token', 'refresh_token', 'auth_user']) localStorage.removeItem(key);
  window.dispatchEvent(new Event(authSessionExpiredEvent));
}

// Timers and concurrent API requests share a single refresh operation.
export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('refresh_token');
  if (!validToken(refreshToken)) {
    expireSession();
    return Promise.reject(new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'));
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, {
        headers: { 'x-tenant-id': localStorage.getItem('tenant_id') || '1' },
        timeout: 15000,
      });
      // A logout or another login must win over an older in-flight refresh.
      if (localStorage.getItem('refresh_token') !== refreshToken) {
        const currentToken = localStorage.getItem('access_token');
        if (validToken(currentToken) && !isJwtExpired(currentToken)) return currentToken;
        throw new Error('Phiên đăng nhập đã thay đổi.');
      }
      const payload = response.data?.data || response.data;
      if (!validToken(payload?.accessToken) || isJwtExpired(payload.accessToken)) {
        throw new Error('Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
      }
      localStorage.setItem('access_token', payload.accessToken);
      if (validToken(payload.refreshToken)) localStorage.setItem('refresh_token', payload.refreshToken);
      window.dispatchEvent(new Event(authTokensChangedEvent));
      return payload.accessToken as string;
    } catch (error: any) {
      if (localStorage.getItem('refresh_token') === refreshToken &&
          [401, 403].includes(error.response?.status)) expireSession();
      // Network errors and server outages leave the refresh token available for retry.
      throw error;
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

// Request Interceptor: Tự động đính kèm Tenant ID và Access Token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Reused student/profile screens use the teacher API boundary in this portal.
    if (location.pathname.startsWith('/teacher') && config.url && /^\/(classes|children|growth|nutrition-advice|growth-notifications)(\/|\?|$)/.test(config.url)) {
      config.url='/teacher'+config.url;
    }
    // 1. Tenant ID từ LocalStorage hoặc Env (Mặc định 1: Trường Mầm non Hướng Dương)
    const tenantId = localStorage.getItem('tenant_id') || import.meta.env.VITE_DEFAULT_TENANT_ID || '1';
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    }

    // 2. JWT Access Token (bảo đảm không gửi chuỗi 'undefined' hoặc 'null')
    let token = localStorage.getItem('access_token');
    if (validToken(token) && isJwtExpired(token) && !publicAuthRequest(config.url)) {
      token = await refreshAccessToken();
    }
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => {
    // Tự động bóc tách Response Envelope { success: true, data: T, meta: ... } của NestJS TransformInterceptor
    if (
      response?.data &&
      typeof response.data === 'object' &&
      response.data.success === true &&
      response.data.data !== undefined
    ) {
      const payload = response.data.data;
      if (response.data.meta && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        payload.meta = response.data.meta;
      }
      response.data = payload;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry &&
        !publicAuthRequest(originalRequest.url) && validToken(localStorage.getItem('access_token'))) {
      originalRequest._retry = true;
      const currentToken = localStorage.getItem('access_token');
      const tokenAlreadyRenewed = validToken(currentToken) && !isJwtExpired(currentToken) &&
        originalRequest.headers.Authorization !== `Bearer ${currentToken}`;
      const token = tokenAlreadyRenewed ? currentToken : await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  },
);
