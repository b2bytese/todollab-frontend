import { afterEach, describe, expect, it } from 'vitest';
import { boardKeys } from '@/features/boards/api';
import {
  clearPendingInviteToken,
  getPendingInviteToken,
  setPendingInviteToken,
} from '@/lib/pendingInvite';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-a',
  name: 'Alice',
  email: 'alice@example.com',
  avatarColor: '#0C2439',
  createdAt: '2026-11-25T10:00:00Z',
};

describe('authStore', () => {
  afterEach(() => {
    clearPendingInviteToken();
    queryClient.clear();
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
  });

  it('clears TanStack Query cache when clearSession is called', () => {
    useAuthStore.getState().setSession('token-a', mockUser);
    queryClient.setQueryData(boardKeys.all, [{ id: 'board-a', name: 'Private A' }]);
    queryClient.setQueryData(boardKeys.myTasks(), [{ id: 'task-a' }]);
    queryClient.setQueryData(boardKeys.myInvites, [{ id: 'inv-a' }]);

    expect(queryClient.getQueryData(boardKeys.all)).toBeDefined();
    expect(queryClient.getQueryData(boardKeys.myTasks())).toBeDefined();
    expect(queryClient.getQueryData(boardKeys.myInvites)).toBeDefined();

    useAuthStore.getState().clearSession();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(queryClient.getQueryData(boardKeys.all)).toBeUndefined();
    expect(queryClient.getQueryData(boardKeys.myTasks())).toBeUndefined();
    expect(queryClient.getQueryData(boardKeys.myInvites)).toBeUndefined();
  });

  it('clears pending invite token and increments sessionVersion on clearSession', () => {
    setPendingInviteToken('inv-token-1');
    const prevVersion = useAuthStore.getState().sessionVersion;
    useAuthStore.getState().clearSession();
    expect(getPendingInviteToken()).toBeNull();
    expect(useAuthStore.getState().sessionVersion).toBe(prevVersion + 1);
  });
});
