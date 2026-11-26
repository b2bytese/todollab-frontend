import {
  Client,
  ReconnectionTimeMode,
  type IFrame,
  type IMessage,
  type StompSubscription,
} from '@stomp/stompjs';
import { API_BASE_URL } from '@/lib/api';
import type { BoardEvent } from '@/types/api';

/**
 * Resolves the WebSocket broker URL from an explicit override or the API base URL.
 */
export function resolveWsBaseUrl(
  rawWsUrl?: string,
  apiBaseUrl = API_BASE_URL,
  isProd = import.meta.env.PROD,
): string {
  const trimmedWs = rawWsUrl?.trim();
  if (trimmedWs) {
    return trimmedWs;
  }

  const normalizedApi = apiBaseUrl.trim().replace(/\/+$/, '');
  if (/^https:\/\//i.test(normalizedApi)) {
    return `${normalizedApi.replace(/^https:\/\//i, 'wss://')}/ws`;
  }
  if (/^http:\/\//i.test(normalizedApi)) {
    return `${normalizedApi.replace(/^http:\/\//i, 'ws://')}/ws`;
  }
  if (/^wss?:\/\//i.test(normalizedApi)) {
    return normalizedApi.endsWith('/ws')
      ? normalizedApi
      : `${normalizedApi}/ws`;
  }

  if (isProd) {
    if (typeof window !== 'undefined' && window.location?.host) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws`;
    }
    return '/ws';
  }

  return 'ws://localhost:8080/ws';
}

export const WS_BASE_URL = resolveWsBaseUrl(
  import.meta.env.VITE_WS_URL as string | undefined,
);

export const INITIAL_RECONNECT_DELAY_MS = 1000;
export const MAX_RECONNECT_DELAY_MS = 30000;
const TOKEN_REFRESH_BUFFER_MS = 15000;

export function isJwtExpiringSoon(
  token: string | null,
  bufferMs = TOKEN_REFRESH_BUFFER_MS,
): boolean {
  if (!token) {
    return true;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof decoded.exp !== 'number') {
      return false;
    }
    return decoded.exp * 1000 - Date.now() <= bufferMs;
  } catch {
    return false;
  }
}

export interface CreateBoardStompClientOptions {
  boardId: string;
  getAccessToken: () => string | null;
  refreshToken: () => Promise<string>;
  onEvent: (event: BoardEvent) => void;
  onConnect?: () => void;
  onStompError?: (frame: IFrame) => void;
  onWebSocketClose?: (event: CloseEvent) => void;
}

export function createBoardStompClient({
  boardId,
  getAccessToken,
  refreshToken,
  onEvent,
  onConnect,
  onStompError,
  onWebSocketClose,
}: CreateBoardStompClientOptions): Client {
  let subscription: StompSubscription | null = null;

  const client = new Client({
    brokerURL: WS_BASE_URL,
    reconnectDelay: INITIAL_RECONNECT_DELAY_MS,
    maxReconnectDelay: MAX_RECONNECT_DELAY_MS,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    beforeConnect: async () => {
      let token = getAccessToken();
      if (!token || isJwtExpiringSoon(token)) {
        try {
          token = await refreshToken();
        } catch {
          token = getAccessToken();
        }
      }
      if (!token) {
        client.connectHeaders = {};
        void client.deactivate();
        return;
      }
      client.connectHeaders = { Authorization: `Bearer ${token}` };
    },
    onConnect: () => {
      subscription?.unsubscribe();
      subscription = client.subscribe(
        `/topic/boards/${boardId}`,
        (message: IMessage) => {
          try {
            const parsed = JSON.parse(message.body) as BoardEvent;
            onEvent(parsed);
          } catch {
            // Ignore malformed payloads
          }
        },
      );
      onConnect?.();
    },
    onDisconnect: () => {
      subscription = null;
    },
    onStompError: (frame) => {
      onStompError?.(frame);
    },
    onWebSocketClose: (event) => {
      subscription = null;
      onWebSocketClose?.(event);
    },
  });

  return client;
}
