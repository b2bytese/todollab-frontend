import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { Sidebar } from '@/features/shell/Sidebar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { BoardSummary, PendingInvite, UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatarColor: '#0C2439',
  createdAt: '2026-11-25T10:00:00Z',
};

const sampleBoards: BoardSummary[] = [
  {
    id: 'b-1',
    name: 'Roadmap Q4',
    description: 'Planejamento trimestral',
    color: '#0C2439',
    icon: 'rocket',
    defaultView: 'KANBAN',
    myRole: 'OWNER',
    isFavorite: true,
    memberCount: 4,
    openTasksCount: 6,
    completedTasksCount: 2,
    membersPreview: [{ id: 'user-1', name: 'Ana Silva', avatarColor: '#0C2439' }],
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-25T10:00:00Z',
  },
  {
    id: 'b-2',
    name: 'Estudos',
    description: null,
    color: '#2563EB',
    icon: 'list-todo',
    defaultView: 'LIST',
    myRole: 'OWNER',
    isFavorite: false,
    memberCount: 1,
    openTasksCount: 3,
    completedTasksCount: 1,
    membersPreview: [{ id: 'user-1', name: 'Ana Silva', avatarColor: '#0C2439' }],
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-25T10:00:00Z',
  },
  {
    id: 'b-3',
    name: 'Design System',
    description: 'Componentes e tokens',
    color: '#FF4B4B',
    icon: 'sparkles',
    defaultView: 'KANBAN',
    myRole: 'EDITOR',
    isFavorite: false,
    memberCount: 3,
    openTasksCount: 5,
    completedTasksCount: 4,
    membersPreview: [{ id: 'user-2', name: 'Bruno Costa', avatarColor: '#FF4B4B' }],
    createdAt: '2026-11-21T10:00:00Z',
    updatedAt: '2026-11-25T10:00:00Z',
  },
  {
    id: 'b-4',
    name: 'Marketing',
    description: null,
    color: '#0D9488',
    icon: 'target',
    defaultView: 'LIST',
    myRole: 'VIEWER',
    isFavorite: true,
    memberCount: 2,
    openTasksCount: 2,
    completedTasksCount: 0,
    membersPreview: [{ id: 'user-3', name: 'Carla Dias', avatarColor: '#0D9488' }],
    createdAt: '2026-11-22T10:00:00Z',
    updatedAt: '2026-11-25T10:00:00Z',
  },
];

const sampleInvites: PendingInvite[] = [
  {
    id: 'inv-1',
    token: 'tok-1',
    boardId: 'b-99',
    boardName: 'Lançamento V1',
    boardColor: '#7C3AED',
    boardIcon: 'rocket',
    inviterName: 'Bruno Costa',
    role: 'EDITOR',
    expiresAt: null,
    createdAt: '2026-11-25T09:00:00Z',
  },
  {
    id: 'inv-2',
    token: 'tok-2',
    boardId: 'b-100',
    boardName: 'Financeiro',
    boardColor: '#D97706',
    boardIcon: 'briefcase',
    inviterName: 'Carla Dias',
    role: 'VIEWER',
    expiresAt: null,
    createdAt: '2026-11-25T09:30:00Z',
  },
];

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={['/app/my-tasks']}>
          <Sidebar onOpenCreateBoard={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('Sidebar', () => {
  let originalAdapter: AxiosAdapter | typeof api.defaults.adapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    useAuthStore.setState({
      accessToken: 'test-token',
      user: mockUser,
      status: 'authenticated',
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('groupsBoardsIntoFavoritesOwnedAndSharedAndDisplaysPendingInvitesBadge', async () => {
    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/boards') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: sampleBoards,
        };
      }
      if (config.url === '/api/v1/users/me/invites') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: sampleInvites,
        };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /favoritos/i })).toBeInTheDocument();
    });

    const favoritesRegion = screen.getByRole('region', { name: /favoritos/i });
    expect(within(favoritesRegion).getByText('Roadmap Q4')).toBeInTheDocument();
    expect(within(favoritesRegion).getByText('Marketing')).toBeInTheDocument();
    expect(within(favoritesRegion).queryByText('Estudos')).not.toBeInTheDocument();
    expect(within(favoritesRegion).queryByText('Design System')).not.toBeInTheDocument();

    const myBoardsRegion = screen.getByRole('region', { name: /meus quadros/i });
    expect(within(myBoardsRegion).getByText('Roadmap Q4')).toBeInTheDocument();
    expect(within(myBoardsRegion).getByText('Estudos')).toBeInTheDocument();
    expect(within(myBoardsRegion).queryByText('Design System')).not.toBeInTheDocument();
    expect(within(myBoardsRegion).queryByText('Marketing')).not.toBeInTheDocument();

    const sharedRegion = screen.getByRole('region', { name: /compartilhados comigo/i });
    expect(within(sharedRegion).getByText('Design System')).toBeInTheDocument();
    expect(within(sharedRegion).getByText('Marketing')).toBeInTheDocument();
    expect(within(sharedRegion).queryByText('Roadmap Q4')).not.toBeInTheDocument();
    expect(within(sharedRegion).queryByText('Estudos')).not.toBeInTheDocument();

    const inviteBadge = screen.getByLabelText(/2 convites pendentes/i);
    expect(inviteBadge).toHaveTextContent('2');
  });

  it('hidesFavoritesSectionAndInviteBadgeWhenEmpty', async () => {
    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/boards') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: [sampleBoards[1]],
        };
      }
      if (config.url === '/api/v1/users/me/invites') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: [],
        };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    };

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByText('Estudos')).toBeInTheDocument();
    });

    expect(screen.queryByRole('region', { name: /favoritos/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/convites pendentes/i)).not.toBeInTheDocument();
  });

  it('resetsMobileSidebarOpenOnLogout', async () => {
    const user = userEvent.setup();
    useUiStore.getState().setMobileSidebarOpen(true);

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/boards') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: [],
        };
      }
      if (config.url === '/api/v1/users/me/invites') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: [],
        };
      }
      if (config.url === '/api/v1/auth/logout') {
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

    renderSidebar();

    await user.click(screen.getByRole('button', { name: /menu do usuário/i }));
    await user.click(await screen.findByRole('menuitem', { name: /sair/i }));

    await waitFor(() => {
      expect(useUiStore.getState().mobileSidebarOpen).toBe(false);
      expect(useAuthStore.getState().status).toBe('unauthenticated');
    });
  });
});
