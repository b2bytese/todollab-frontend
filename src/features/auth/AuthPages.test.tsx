import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { api } from '@/lib/api';
import {
  clearPendingInviteToken,
  getPendingInviteToken,
  setPendingInviteToken,
} from '@/lib/pendingInvite';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatarColor: '#0c2439',
  createdAt: '2026-11-25T10:00:00Z',
};

function makeAxiosError(status: number, config: InternalAxiosRequestConfig, data: unknown) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    {
      status,
      statusText: 'Error',
      headers: new AxiosHeaders(),
      config,
      data,
    },
  );
}

function BoardDestination() {
  const { boardId } = useParams();
  return <div data-testid="board-page">Board {boardId}</div>;
}

function InviteDestination() {
  const { token } = useParams();
  return <div data-testid="invite-page">Invite {token}</div>;
}

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
}

function renderAuthRoutes(initialEntry: string) {
  return render(
    <ThemeProvider defaultTheme="light">
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/app/boards/:boardId" element={<BoardDestination />} />
          <Route path="/invite/:token" element={<InviteDestination />} />
          <Route path="/app/my-tasks" element={<div data-testid="my-tasks-page">My Tasks</div>} />
        </Routes>
        <LocationEcho />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('AuthPages', () => {
  let originalAdapter: AxiosAdapter | typeof api.defaults.adapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    clearPendingInviteToken();
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    clearPendingInviteToken();
  });

  it('loginWithUnverifiedEmailRedirectsToVerifyEmail', async () => {
    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/login') {
        throw makeAxiosError(403, config, {
          status: 403,
          code: 'EMAIL_NOT_VERIFIED',
          detail: 'Confirme seu e-mail antes de fazer login.',
        });
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    const user = userEvent.setup();
    renderAuthRoutes('/login');

    await user.type(screen.getByLabelText(/e-mail/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo')).toHaveTextContent(
        '/verify-email?email=ana%40example.com',
      );
    });
    expect(screen.getByLabelText(/e-mail/i)).toHaveValue('ana@example.com');
  });

  it('signupWithMatchingEmailInviteAutoAuthenticatesAndNavigatesToJoinedBoard', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/register') {
        capturedBody =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: {
            user: mockUser,
            accessToken: 'new-jwt-token',
            joinedBoardId: 'board-42',
            emailVerificationRequired: false,
          },
        };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    const user = userEvent.setup();
    renderAuthRoutes('/signup?inviteToken=tok-invite-123');

    await user.type(screen.getByLabelText(/nome/i), 'Ana Silva');
    await user.type(screen.getByLabelText(/e-mail/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByTestId('board-page')).toHaveTextContent('Board board-42');
    });

    expect(capturedBody).toMatchObject({
      name: 'Ana Silva',
      email: 'ana@example.com',
      password: 'Password123!',
      inviteToken: 'tok-invite-123',
    });
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().accessToken).toBe('new-jwt-token');
    expect(getPendingInviteToken()).toBeNull();
  });

  it('verifyEmailWithPendingLinkInviteRedirectsToInviteAcceptPage', async () => {
    setPendingInviteToken('link-token-999');

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/verify-email') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            accessToken: 'verified-jwt',
            user: mockUser,
          },
        };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    const user = userEvent.setup();
    renderAuthRoutes('/verify-email?email=ana@example.com');

    await user.type(screen.getByLabelText(/código/i), '123456');
    await user.click(screen.getByRole('button', { name: /verificar e-mail/i }));

    await waitFor(() => {
      expect(screen.getByTestId('invite-page')).toHaveTextContent('Invite link-token-999');
    });
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().accessToken).toBe('verified-jwt');
  });
});
