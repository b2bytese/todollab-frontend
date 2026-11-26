import { create } from 'zustand';
import { refreshAccessToken } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { UserProfile } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: UserProfile) => void;
  updateUser: (user: UserProfile) => void;
  clearSession: () => void;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  status: 'loading',

  setSession: (accessToken, user) =>
    set({
      accessToken,
      user,
      status: 'authenticated',
    }),

  updateUser: (user) => set({ user }),

  clearSession: () => {
    queryClient.clear();
    set({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
  },

  bootstrap: async () => {
    if (get().status === 'authenticated' && get().accessToken) {
      return;
    }
    try {
      await refreshAccessToken();
    } catch {
      if (get().status === 'loading') {
        get().clearSession();
      }
    }
  },
}));
