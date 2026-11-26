import {
  ReconnectionTimeMode,
  type IFrame,
  type IMessage,
  type StompSubscription,
} from '@stomp/stompjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INITIAL_RECONNECT_DELAY_MS,
  MAX_RECONNECT_DELAY_MS,
  createBoardStompClient,
  isJwtExpiringSoon,
  resolveWsBaseUrl,
} from '@/lib/stompClient';
import type { BoardEvent } from '@/types/api';

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.sig`;
}

describe('stompClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isJwtExpiringSoon', () => {
    it('returns true when token is null or expiring within buffer', () => {
      expect(isJwtExpiringSoon(null)).toBe(true);

      const expiredToken = makeJwt({ exp: Math.floor(Date.now() / 1000) - 5 });
      expect(isJwtExpiringSoon(expiredToken)).toBe(true);

      const expiringSoonToken = makeJwt({
        exp: Math.floor(Date.now() / 1000) + 10,
      });
      expect(isJwtExpiringSoon(expiringSoonToken)).toBe(true);
    });

    it('returns false for fresh token or non-JWT / missing exp tokens', () => {
      const freshToken = makeJwt({
        exp: Math.floor(Date.now() / 1000) + 300,
      });
      expect(isJwtExpiringSoon(freshToken)).toBe(false);

      expect(isJwtExpiringSoon('opaque-token')).toBe(false);
      expect(isJwtExpiringSoon(makeJwt({ sub: 'user-1' }))).toBe(false);
      expect(isJwtExpiringSoon('a.!!!invalid-base64!!!.c')).toBe(false);
    });
  });

  describe('createBoardStompClient', () => {
    it('configures native exponential backoff with 1s initial and 30s max delay', () => {
      const client = createBoardStompClient({
        boardId: 'board-1',
        getAccessToken: () => 'token',
        refreshToken: async () => 'refreshed',
        onEvent: vi.fn(),
      });

      expect(client.reconnectTimeMode).toBe(ReconnectionTimeMode.EXPONENTIAL);
      expect(client.reconnectDelay).toBe(INITIAL_RECONNECT_DELAY_MS);
      expect(client.reconnectDelay).toBe(1000);
      expect(client.maxReconnectDelay).toBe(MAX_RECONNECT_DELAY_MS);
      expect(client.maxReconnectDelay).toBe(30000);
    });

    it('clears stale subscription onWebSocketClose so reconnect does not unsubscribe closed handler', () => {
      const onEvent = vi.fn();
      const onConnect = vi.fn();
      const onWebSocketClose = vi.fn();

      const client = createBoardStompClient({
        boardId: 'board-42',
        getAccessToken: () => 'token',
        refreshToken: async () => 'refreshed',
        onEvent,
        onConnect,
        onWebSocketClose,
      });

      const firstUnsubscribe = vi.fn();
      const secondUnsubscribe = vi.fn();

      const subscribeSpy = vi
        .spyOn(client, 'subscribe')
        .mockImplementationOnce(() => ({
          id: 'sub-1',
          unsubscribe: firstUnsubscribe,
        }) as StompSubscription)
        .mockImplementationOnce(() => ({
          id: 'sub-2',
          unsubscribe: secondUnsubscribe,
        }) as StompSubscription);

      // Initial connect subscribes to the board topic
      client.onConnect({} as IFrame);
      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      expect(subscribeSpy).toHaveBeenCalledWith(
        '/topic/boards/board-42',
        expect.any(Function),
      );
      expect(onConnect).toHaveBeenCalledTimes(1);

      // Valid and malformed messages
      const sampleEvent: BoardEvent = {
        type: 'TASK_DELETED',
        boardId: 'board-42',
        actorId: 'user-1',
        timestamp: '2026-11-25T12:00:00Z',
        payload: { taskId: 'task-9' },
      };
      const messageCallback = subscribeSpy.mock.calls[0][1];
      messageCallback({ body: JSON.stringify(sampleEvent) } as IMessage);
      messageCallback({ body: '{not-valid-json' } as IMessage);
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(sampleEvent);

      // Socket closes -> stale subscription reference cleared
      const closeEvent = { code: 1006 } as CloseEvent;
      client.onWebSocketClose(closeEvent);
      expect(onWebSocketClose).toHaveBeenCalledWith(closeEvent);

      // Reconnect must NOT call unsubscribe() on the dead subscription
      client.onConnect({} as IFrame);
      expect(firstUnsubscribe).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledTimes(2);
      expect(onConnect).toHaveBeenCalledTimes(2);
    });

    it('refreshes expiring token in beforeConnect and sets Authorization connectHeaders', async () => {
      const expiringToken = makeJwt({
        exp: Math.floor(Date.now() / 1000) + 5,
      });
      const freshToken = makeJwt({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const refreshToken = vi.fn().mockResolvedValue(freshToken);
      let currentToken: string | null = expiringToken;

      const client = createBoardStompClient({
        boardId: 'board-1',
        getAccessToken: () => currentToken,
        refreshToken,
        onEvent: vi.fn(),
      });

      await client.beforeConnect(client);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(client.connectHeaders).toEqual({
        Authorization: `Bearer ${freshToken}`,
      });

      // When token is fresh, beforeConnect reuses it without calling refreshToken again
      currentToken = freshToken;
      await client.beforeConnect(client);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(client.connectHeaders).toEqual({
        Authorization: `Bearer ${freshToken}`,
      });
    });

    it('deactivates client in beforeConnect when token remains null after refresh failure', async () => {
      const refreshToken = vi
        .fn()
        .mockRejectedValue(new Error('Refresh failed'));
      const client = createBoardStompClient({
        boardId: 'board-1',
        getAccessToken: () => null,
        refreshToken,
        onEvent: vi.fn(),
      });
      client.connectHeaders = { Authorization: 'Bearer stale-token' };
      const deactivateSpy = vi
        .spyOn(client, 'deactivate')
        .mockResolvedValue(undefined);

      await client.beforeConnect(client);

      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(deactivateSpy).toHaveBeenCalledTimes(1);
      expect(client.connectHeaders).toEqual({});
      expect(client.connectHeaders).not.toHaveProperty('Authorization');
    });
  });

  describe('resolveWsBaseUrl', () => {
    it('derives ws/wss URL from API_BASE_URL when VITE_WS_URL is omitted', () => {
      expect(
        resolveWsBaseUrl(undefined, 'https://api.todollab.app', true),
      ).toBe('wss://api.todollab.app/ws');
      expect(
        resolveWsBaseUrl(undefined, 'https://api.todollab.app/', true),
      ).toBe('wss://api.todollab.app/ws');
      expect(resolveWsBaseUrl(undefined, 'http://localhost:8080', false)).toBe(
        'ws://localhost:8080/ws',
      );
    });

    it('uses trimmed VITE_WS_URL when provided and falls back safely when apiBaseUrl is empty', () => {
      expect(
        resolveWsBaseUrl(
          '  wss://ws.todollab.app/ws  ',
          'https://api.todollab.app',
          true,
        ),
      ).toBe('wss://ws.todollab.app/ws');
      expect(resolveWsBaseUrl(undefined, '', false)).toBe(
        'ws://localhost:8080/ws',
      );
      const expectedProto =
        window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      expect(resolveWsBaseUrl(undefined, '', true)).toBe(
        `${expectedProto}//${window.location.host}/ws`,
      );
    });
  });
});
