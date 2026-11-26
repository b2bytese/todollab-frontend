import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { InviteAcceptPage } from '@/features/invites/InviteAcceptPage';
import { ShareBoardModal } from '@/features/invites/ShareBoardModal';
import { api } from '@/lib/api';
import {
  clearPendingInviteToken,
  getPendingInviteToken,
  setPendingInviteToken,
} from '@/lib/pendingInvite';
import { useAuthStore } from '@/stores/authStore';
import type { BoardDetail, BoardRole, InvitePreview, UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-2',
  name: 'Bruno Costa',
  email: 'bruno@example.com',
  avatarColor: '#FF4B4B',
  createdAt: '2026-11-25T10:00:00Z',
};

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      {`${location.pathname}${location.search}`}
    </div>
  );
}

function BoardDestination() {
  const { boardId } = useParams<{ boardId: string }>();
  return <div data-testid="board-destination">Board {boardId}</div>;
}

function createBoardDetail(myRole: BoardRole): BoardDetail {
  return {
    board: {
      id: 'board-1',
      name: 'Produto V1',
      description: 'Planejamento de lançamento',
      color: '#0C2439',
      icon: 'rocket',
      defaultView: 'KANBAN',
      ownerId: 'user-1',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-25T10:00:00Z',
    },
    myRole,
    isFavorite: false,
    columns: [],
    tasks: [],
    tags: [],
    members: [
      {
        id: 'mem-1',
        userId: 'user-1',
        name: 'Ana Silva',
        email: 'ana@example.com',
        avatarColor: '#0C2439',
        role: 'OWNER',
        joinedAt: '2026-11-20T10:00:00Z',
      },
      {
        id: 'mem-2',
        userId: 'user-2',
        name: 'Bruno Costa',
        email: 'bruno@example.com',
        avatarColor: '#FF4B4B',
        role: myRole,
        joinedAt: '2026-11-21T10:00:00Z',
      },
    ],
  };
}

function renderInviteRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/signup" element={<div data-testid="signup-page">Signup</div>} />
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route path="/app/boards/:boardId" element={<BoardDestination />} />
            <Route path="/app/my-tasks" element={<div data-testid="my-tasks-page">My Tasks</div>} />
          </Routes>
          <LocationDisplay />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function renderInviteWithLoginRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/app/boards/:boardId" element={<BoardDestination />} />
            <Route path="/app/my-tasks" element={<div data-testid="my-tasks-page">My Tasks</div>} />
            <Route path="*" element={<div data-testid="not-found-route">Not Found</div>} />
          </Routes>
          <LocationDisplay />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('InviteFlow', () => {
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
    vi.restoreAllMocks();
  });

  it('inviteAcceptPageLoggedOutPreservesTokenToSignup', async () => {
    const user = userEvent.setup();
    const preview: InvitePreview = {
      boardName: 'Roadmap Q4',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'EDITOR',
      type: 'LINK',
      targetEmailMasked: null,
      valid: true,
      reason: null,
    };

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'get' &&
        config.url === '/api/v1/invites/tok-abc-123/preview'
      ) {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteRoute('/invite/tok-abc-123');

    await waitFor(() => {
      expect(screen.getByText('Roadmap Q4')).toBeInTheDocument();
    });

    expect(screen.getByText(/Ana Silva/)).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /criar conta e entrar/i }),
    );

    expect(getPendingInviteToken()).toBe('tok-abc-123');
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/signup?inviteToken=tok-abc-123',
      );
    });
  });

  it('inviteAcceptPageLoggedInAcceptsAndNavigatesToBoard', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      accessToken: 'test-token',
      user: mockUser,
      status: 'authenticated',
    });
    vi.spyOn(toast, 'success').mockImplementation(() => '');

    const preview: InvitePreview = {
      boardName: 'Roadmap Q4',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'EDITOR',
      type: 'EMAIL',
      targetEmailMasked: 'b***@example.com',
      valid: true,
      reason: null,
    };

    let acceptCalled = false;

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (method === 'get' && config.url === '/api/v1/invites/tok-xyz-789/preview') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      if (method === 'post' && config.url === '/api/v1/invites/tok-xyz-789/accept') {
        acceptCalled = true;
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            boardId: 'board-99',
            role: 'EDITOR',
          },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteRoute('/invite/tok-xyz-789');

    await waitFor(() => {
      expect(screen.getByText('Roadmap Q4')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /aceitar convite/i }),
    );

    await waitFor(() => {
      expect(acceptCalled).toBe(true);
      expect(screen.getByTestId('board-destination')).toHaveTextContent(
        'Board board-99',
      );
    });
  });

  it('shareBoardModalHidesOwnerInviteTabsForEditorAndShowsLeaveAction', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      accessToken: 'test-token',
      user: mockUser,
      status: 'authenticated',
    });
    vi.spyOn(toast, 'success').mockImplementation(() => '');

    let leaveCalled = false;
    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (
        method === 'delete' &&
        config.url === '/api/v1/boards/board-1/members/user-2'
      ) {
        leaveCalled = true;
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: null,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const detail = createBoardDetail('EDITOR');

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <MemoryRouter initialEntries={['/app/boards/board-1']}>
            <Routes>
              <Route
                path="/app/boards/:boardId"
                element={
                  <ShareBoardModal
                    open
                    onOpenChange={() => {}}
                    detail={detail}
                  />
                }
              />
              <Route
                path="/app/my-tasks"
                element={<div data-testid="my-tasks-page">My Tasks</div>}
              />
            </Routes>
            <LocationDisplay />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('tab', { name: /membros/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /convidar por e-mail/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /links de convite/i }),
    ).not.toBeInTheDocument();

    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument();

    const leaveButton = screen.getByRole('button', { name: /sair do quadro/i });
    expect(leaveButton).toBeInTheDocument();
    await user.click(leaveButton);

    const confirmButton = await screen.findByRole('button', {
      name: /^sair$/i,
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(leaveCalled).toBe(true);
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/app/my-tasks',
      );
    });
  });

  it('does NOT auto-accept invite when arriving from /login?inviteToken=... without visiting InviteAcceptPage first', async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, 'success').mockImplementation(() => '');

    const preview: InvitePreview = {
      boardName: 'Roadmap Q4',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'EDITOR',
      type: 'LINK',
      targetEmailMasked: null,
      valid: true,
      reason: null,
    };

    let acceptCalls = 0;

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (method === 'post' && config.url === '/api/v1/auth/login') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            accessToken: 'login-jwt',
            user: mockUser,
          },
        };
      }
      if (method === 'get' && config.url === '/api/v1/invites/tok-injected/preview') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      if (method === 'post' && config.url === '/api/v1/invites/tok-injected/accept') {
        acceptCalls += 1;
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            boardId: 'board-99',
            role: 'EDITOR',
          },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteWithLoginRoute('/login?inviteToken=tok-injected');

    await user.type(screen.getByLabelText(/e-mail/i), 'bruno@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/invite/tok-injected');
      expect(screen.getByText('Roadmap Q4')).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /aceitar convite/i });
    expect(acceptButton).toBeInTheDocument();
    expect(acceptCalls).toBe(0);

    await user.click(acceptButton);

    await waitFor(() => {
      expect(acceptCalls).toBe(1);
      expect(screen.getByTestId('board-destination')).toHaveTextContent('Board board-99');
    });
  });

  it('auto-accepts invite when user started from InviteAcceptPage and returned after login', async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, 'success').mockImplementation(() => '');

    const preview: InvitePreview = {
      boardName: 'Roadmap Q4',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'EDITOR',
      type: 'LINK',
      targetEmailMasked: null,
      valid: true,
      reason: null,
    };

    let acceptCalls = 0;

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (method === 'get' && config.url === '/api/v1/invites/tok-legit/preview') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      if (method === 'post' && config.url === '/api/v1/auth/login') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            accessToken: 'login-jwt',
            user: mockUser,
          },
        };
      }
      if (method === 'post' && config.url === '/api/v1/invites/tok-legit/accept') {
        acceptCalls += 1;
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            boardId: 'board-77',
            role: 'EDITOR',
          },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteWithLoginRoute('/invite/tok-legit');

    await waitFor(() => {
      expect(screen.getByText('Roadmap Q4')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /já tenho conta — entrar/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/login?inviteToken=tok-legit',
      );
    });

    await user.type(screen.getByLabelText(/e-mail/i), 'bruno@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(acceptCalls).toBe(1);
      expect(screen.getByTestId('board-destination')).toHaveTextContent('Board board-77');
    });
    expect(getPendingInviteToken()).toBeNull();
  });

  it('treats legacy plain-string pending invite token in sessionStorage as autoAccept false', async () => {
    window.sessionStorage.setItem('todollab_pending_invite_token', 'tok-legacy');
    useAuthStore.setState({
      accessToken: 'test-token',
      user: mockUser,
      status: 'authenticated',
    });

    let acceptCalls = 0;
    const preview: InvitePreview = {
      boardName: 'Legacy Board',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'VIEWER',
      type: 'LINK',
      targetEmailMasked: null,
      valid: true,
      reason: null,
    };

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (method === 'get' && config.url === '/api/v1/invites/tok-legacy/preview') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      if (method === 'post' && config.url === '/api/v1/invites/tok-legacy/accept') {
        acceptCalls += 1;
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: { boardId: 'board-1', role: 'VIEWER' },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    expect(getPendingInviteToken()).toBe('tok-legacy');

    renderInviteRoute('/invite/tok-legacy');

    await waitFor(() => {
      expect(screen.getByText('Legacy Board')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /aceitar convite/i })).toBeInTheDocument();
    expect(acceptCalls).toBe(0);
  });

  it('encodes inviteToken safely in navigation URLs', async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, 'success').mockImplementation(() => '');

    const preview: InvitePreview = {
      boardName: 'Encoded Token Board',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'EDITOR',
      type: 'LINK',
      targetEmailMasked: null,
      valid: true,
      reason: null,
    };

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (method === 'post' && config.url === '/api/v1/auth/login') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            accessToken: 'login-jwt',
            user: mockUser,
          },
        };
      }
      if (
        method === 'get' &&
        config.url?.startsWith('/api/v1/invites/') &&
        config.url.endsWith('/preview')
      ) {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteWithLoginRoute('/login?inviteToken=a/b?c=1');

    await user.type(screen.getByLabelText(/e-mail/i), 'bruno@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/invite/a%2Fb%3Fc%3D1',
      );
      expect(screen.getByText('Encoded Token Board')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('not-found-route')).not.toBeInTheDocument();
  });

  it('renders expired/invalid invite state and clears pending invite token', async () => {
    setPendingInviteToken('tok-expired');

    const invalidPreview: InvitePreview = {
      boardName: '',
      boardColor: '',
      boardIcon: 'rocket',
      inviterName: '',
      role: 'VIEWER',
      type: 'LINK',
      targetEmailMasked: null,
      valid: false,
      reason: 'Convite expirado.',
    };

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'get' &&
        config.url === '/api/v1/invites/tok-expired/preview'
      ) {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: invalidPreview,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteRoute('/invite/tok-expired');

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: /convite inválido ou expirado/i,
    });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('Convite expirado.')).toBeInTheDocument();

    await waitFor(() => {
      expect(getPendingInviteToken()).toBeNull();
    });
  });

  it('does NOT auto-accept invite after signup verification when arriving at /signup?inviteToken=... directly', async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, 'success').mockImplementation(() => '');

    const preview: InvitePreview = {
      boardName: 'Direct Signup Board',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'EDITOR',
      type: 'LINK',
      targetEmailMasked: null,
      valid: true,
      reason: null,
    };

    let acceptCalls = 0;

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (method === 'post' && config.url === '/api/v1/auth/register') {
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: {
            user: mockUser,
            accessToken: null,
            joinedBoardId: null,
            emailVerificationRequired: true,
          },
        };
      }
      if (method === 'post' && config.url === '/api/v1/auth/verify-email') {
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
      if (method === 'get' && config.url === '/api/v1/invites/tok-direct-signup/preview') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      if (method === 'post' && config.url === '/api/v1/invites/tok-direct-signup/accept') {
        acceptCalls += 1;
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: { boardId: 'board-88', role: 'EDITOR' },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteWithLoginRoute('/signup?inviteToken=tok-direct-signup');

    await user.type(screen.getByLabelText(/nome completo/i), 'Bruno Costa');
    await user.type(screen.getByLabelText(/e-mail/i), 'bruno@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/verify-email');
    });

    await user.type(screen.getByLabelText(/código de verificação/i), '123456');
    await user.click(screen.getByRole('button', { name: /verificar e-mail/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/invite/tok-direct-signup',
      );
      expect(screen.getByText('Direct Signup Board')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /aceitar convite/i })).toBeInTheDocument();
    expect(acceptCalls).toBe(0);
  });

  it('auto-accepts invite after signup verification when started from InviteAcceptPage', async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, 'success').mockImplementation(() => '');

    const preview: InvitePreview = {
      boardName: 'Legit Signup Board',
      boardColor: '#0C2439',
      boardIcon: 'rocket',
      inviterName: 'Ana Silva',
      role: 'EDITOR',
      type: 'LINK',
      targetEmailMasked: null,
      valid: true,
      reason: null,
    };

    let acceptCalls = 0;

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase();
      if (method === 'get' && config.url === '/api/v1/invites/tok-legit-signup/preview') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: preview,
        };
      }
      if (method === 'post' && config.url === '/api/v1/auth/register') {
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: {
            user: mockUser,
            accessToken: null,
            joinedBoardId: null,
            emailVerificationRequired: true,
          },
        };
      }
      if (method === 'post' && config.url === '/api/v1/auth/verify-email') {
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
      if (method === 'post' && config.url === '/api/v1/invites/tok-legit-signup/accept') {
        acceptCalls += 1;
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: { boardId: 'board-55', role: 'EDITOR' },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderInviteWithLoginRoute('/invite/tok-legit-signup');

    await waitFor(() => {
      expect(screen.getByText('Legit Signup Board')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /criar conta e entrar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/signup?inviteToken=tok-legit-signup',
      );
    });

    await user.type(screen.getByLabelText(/nome completo/i), 'Bruno Costa');
    await user.type(screen.getByLabelText(/e-mail/i), 'bruno@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/verify-email');
    });

    await user.type(screen.getByLabelText(/código de verificação/i), '123456');
    await user.click(screen.getByRole('button', { name: /verificar e-mail/i }));

    await waitFor(() => {
      expect(acceptCalls).toBe(1);
      expect(screen.getByTestId('board-destination')).toHaveTextContent('Board board-55');
    });
  });
});
