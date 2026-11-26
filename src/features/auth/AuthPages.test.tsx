import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
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

function LoginLocationProbe() {
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string; search?: string } } | null;
  return (
    <div data-testid="login-from-state">
      {state?.from ? `${state.from.pathname ?? ''}${state.from.search ?? ''}` : 'none'}
    </div>
  );
}

function renderAuthRoutes(initialEntry: string) {
  return render(
    <ThemeProvider defaultTheme="light">
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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

  it('encodes pending inviteToken when VerifyEmailPage redirects to /invite/:token', async () => {
    setPendingInviteToken('a/b?c=1');

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
      expect(screen.getByTestId('location-echo')).toHaveTextContent('/invite/a%2Fb%3Fc%3D1');
      expect(screen.getByTestId('invite-page')).toHaveTextContent('Invite a/b?c=1');
    });
  });

  it('submits ForgotPasswordPage and navigates to /reset-password with encoded email', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/forgot-password') {
        capturedBody =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: null,
        };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    const user = userEvent.setup();
    renderAuthRoutes('/forgot-password');

    await user.type(screen.getByLabelText(/e-mail/i), 'ana+test@example.com');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo')).toHaveTextContent(
        '/reset-password?email=ana%2Btest%40example.com',
      );
    });
    expect(capturedBody).toEqual({ email: 'ana+test@example.com' });
    expect(screen.getByLabelText(/e-mail/i)).toHaveValue('ana+test@example.com');
  });

  it('submits ResetPasswordPage and navigates to /login on success', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const longPassword = 'A'.repeat(128);

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/reset-password') {
        capturedBody =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: null,
        };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    const user = userEvent.setup();
    renderAuthRoutes('/reset-password?email=ana@example.com');

    await user.type(screen.getByLabelText(/código de verificação/i), '654321');
    await user.type(screen.getByLabelText(/^nova senha$/i), longPassword);
    await user.type(screen.getByLabelText(/confirmar nova senha/i), longPassword);
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo')).toHaveTextContent('/login');
    });
    expect(capturedBody).toEqual({
      email: 'ana@example.com',
      code: '654321',
      newPassword: longPassword,
    });
  });

  it('handles SignupPage when emailVerificationRequired is false and joinedBoardId is null', async () => {
    const longPassword = 'B'.repeat(128);

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/register') {
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: {
            user: mockUser,
            accessToken: 'direct-jwt-token',
            joinedBoardId: null,
            emailVerificationRequired: false,
          },
        };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    const user = userEvent.setup();
    renderAuthRoutes('/signup');

    await user.type(screen.getByLabelText(/nome completo/i), 'Ana Silva');
    await user.type(screen.getByLabelText(/e-mail/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), longPassword);
    await user.type(screen.getByLabelText(/confirmar senha/i), longPassword);
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByTestId('my-tasks-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('location-echo')).toHaveTextContent('/app/my-tasks');
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().accessToken).toBe('direct-jwt-token');
  });

  it('RequireAuth redirects unauthenticated user to /login preserving state.from', () => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });

    render(
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={['/app/boards/board-77?tab=list']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/app/boards/:boardId" element={<BoardDestination />} />
            </Route>
            <Route path="/login" element={<LoginLocationProbe />} />
          </Routes>
          <LocationEcho />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('location-echo')).toHaveTextContent('/login');
    expect(screen.getByTestId('login-from-state')).toHaveTextContent(
      '/app/boards/board-77?tab=list',
    );
  });

  it('GuestOnly redirects authenticated user with inviteToken directly to /invite/:token', () => {
    useAuthStore.setState({
      accessToken: 'jwt-active',
      user: mockUser,
      status: 'authenticated',
    });

    render(
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={['/login?inviteToken=a/b?c=1']}>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>
            <Route path="/invite/:token" element={<InviteDestination />} />
            <Route path="/app/my-tasks" element={<div data-testid="my-tasks-page">My Tasks</div>} />
          </Routes>
          <LocationEcho />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('location-echo')).toHaveTextContent('/invite/a%2Fb%3Fc%3D1');
    expect(screen.getByTestId('invite-page')).toHaveTextContent('Invite a/b?c=1');
  });

  it('links form field errors via aria-describedby on auth inputs', async () => {
    const user = userEvent.setup();

    const loginView = renderAuthRoutes('/login');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/e-mail/i)).toHaveAccessibleDescription(
        'Informe seu e-mail.',
      );
      expect(screen.getByLabelText(/^senha$/i)).toHaveAccessibleDescription(
        'Informe sua senha.',
      );
    });
    loginView.unmount();

    const signupView = renderAuthRoutes('/signup');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/nome completo/i)).toHaveAccessibleDescription(
        'O nome deve ter pelo menos 2 caracteres.',
      );
      expect(screen.getByLabelText(/e-mail/i)).toHaveAccessibleDescription(
        'Informe seu e-mail.',
      );
      expect(screen.getByLabelText(/^senha$/i)).toHaveAccessibleDescription(
        'A senha deve ter pelo menos 8 caracteres.',
      );
      expect(screen.getByLabelText(/confirmar senha/i)).toHaveAccessibleDescription(
        'Confirme sua senha.',
      );
    });
    signupView.unmount();

    const verifyView = renderAuthRoutes('/verify-email');
    await user.click(screen.getByRole('button', { name: /verificar e-mail/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/e-mail/i)).toHaveAccessibleDescription(
        'Informe seu e-mail.',
      );
      expect(screen.getByLabelText(/código de verificação/i)).toHaveAccessibleDescription(
        'Informe o código numérico de 6 dígitos.',
      );
    });
    verifyView.unmount();

    const forgotView = renderAuthRoutes('/forgot-password');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/e-mail/i)).toHaveAccessibleDescription(
        'Informe seu e-mail.',
      );
    });
    forgotView.unmount();

    const resetView = renderAuthRoutes('/reset-password');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/e-mail/i)).toHaveAccessibleDescription(
        'Informe seu e-mail.',
      );
      expect(screen.getByLabelText(/código de verificação/i)).toHaveAccessibleDescription(
        'Informe o código numérico de 6 dígitos.',
      );
      expect(screen.getByLabelText(/^nova senha$/i)).toHaveAccessibleDescription(
        'A nova senha deve ter pelo menos 8 caracteres.',
      );
      expect(screen.getByLabelText(/confirmar nova senha/i)).toHaveAccessibleDescription(
        'Confirme a nova senha.',
      );
    });
    resetView.unmount();
  });
});
