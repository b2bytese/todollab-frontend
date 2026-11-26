import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@todollab.dev',
  avatarColor: '#0c2439',
  createdAt: '2026-11-25T10:00:00Z',
};

function makeAxiosError(
  status: number,
  config: InternalAxiosRequestConfig,
  data?: unknown,
): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    {
      status,
      statusText: status === 401 ? 'Unauthorized' : 'Error',
      headers: new AxiosHeaders(),
      config,
      data: data ?? { status, detail: 'Unauthorized' },
    },
  );
}

describe('api single-flight refresh interceptor', () => {
  let originalAdapter: AxiosAdapter | typeof api.defaults.adapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('threeConcurrent401sTriggerOnlyOneRefreshAndReplayAll', async () => {
    useAuthStore.getState().setSession('expired-token', mockUser);

    let refreshCalls = 0;
    const retriedAuthHeaders: string[] = [];

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            accessToken: 'fresh-token',
            user: mockUser,
          },
        };
      }

      const authHeader =
        config.headers instanceof AxiosHeaders
          ? (config.headers.get('Authorization') as string | undefined)
          : (config.headers as Record<string, string | undefined>)?.Authorization;

      if (authHeader === 'Bearer fresh-token') {
        retriedAuthHeaders.push(authHeader);
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: { ok: true, url: config.url },
        };
      }

      throw makeAxiosError(401, config);
    };

    const [r1, r2, r3] = await Promise.all([
      api.get('/api/v1/tasks/1'),
      api.get('/api/v1/tasks/2'),
      api.get('/api/v1/tasks/3'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(r1.data).toEqual({ ok: true, url: '/api/v1/tasks/1' });
    expect(r2.data).toEqual({ ok: true, url: '/api/v1/tasks/2' });
    expect(r3.data).toEqual({ ok: true, url: '/api/v1/tasks/3' });
    expect(retriedAuthHeaders).toEqual([
      'Bearer fresh-token',
      'Bearer fresh-token',
      'Bearer fresh-token',
    ]);
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('failedRefreshClearsSessionWithoutInfiniteLoop', async () => {
    useAuthStore.getState().setSession('expired-token', mockUser);

    let refreshCalls = 0;

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshCalls += 1;
      }
      throw makeAxiosError(401, config);
    };

    await expect(api.get('/api/v1/tasks/1')).rejects.toThrow();

    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
