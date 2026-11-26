import axios, {
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type { AuthResponse, ProblemDetail } from '@/types/api';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  'http://localhost:8080';

const AUTH_ENDPOINTS = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/register',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/logout',
] as const;

function isAuthEndpoint(url?: string): boolean {
  if (!url) {
    return false;
  }
  const cleanPath = url.split('?')[0];
  return AUTH_ENDPOINTS.some(
    (endpoint) => cleanPath === endpoint || cleanPath.endsWith(endpoint),
  );
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (isAuthEndpoint(config.url)) {
    return config;
  }

  const token = useAuthStore.getState().accessToken;
  if (token) {
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = AxiosHeaders.from(config.headers);
      config.headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

/**
 * Performs a single-flight access token refresh using the HttpOnly refresh cookie.
 * Concurrent callers share the in-flight request; failures clear the auth session.
 */
export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { data } = await api.post<AuthResponse>('/api/v1/auth/refresh');
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return data.accessToken;
    } catch (error) {
      useAuthStore.getState().clearSession();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;
    if (
      !originalRequest ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const newAccessToken = await refreshAccessToken();
    if (originalRequest.headers instanceof AxiosHeaders) {
      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    } else {
      originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    }

    return api(originalRequest);
  },
);

export function getApiError(err: unknown): ProblemDetail {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return {
        status: 0,
        title: 'Erro de conexão',
        detail:
          'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      };
    }

    const status = err.response.status;
    const data = err.response.data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      return {
        type: typeof record.type === 'string' ? record.type : undefined,
        title: typeof record.title === 'string' ? record.title : undefined,
        status: typeof record.status === 'number' ? record.status : status,
        detail:
          typeof record.detail === 'string'
            ? record.detail
            : 'Não foi possível concluir a solicitação.',
        code: typeof record.code === 'string' ? record.code : undefined,
        fieldErrors:
          record.fieldErrors && typeof record.fieldErrors === 'object'
            ? (record.fieldErrors as Record<string, string>)
            : undefined,
      };
    }

    return {
      status,
      detail: err.message || 'Ocorreu um erro na requisição.',
    };
  }

  return {
    status: 0,
    title: 'Erro inesperado',
    detail:
      err instanceof Error
        ? err.message
        : 'Ocorreu um erro inesperado. Tente novamente.',
  };
}
