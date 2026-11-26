import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { MyTasksPage } from '@/features/dashboard/MyTasksPage';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type {
  AcceptInviteResponse,
  BoardSummary,
  MyTaskItem,
  PendingInvite,
  UserProfile,
} from '@/types/api';

function formatLocalDateOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const mockUser: UserProfile = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatarColor: '#0C2439',
  createdAt: '2026-11-25T10:00:00Z',
};

const sampleBoards: BoardSummary[] = [
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
];

function createSampleTasks(): MyTaskItem[] {
  return [
    {
      id: 't-overdue',
      boardId: 'b-1',
      boardName: 'Roadmap Q4',
      boardColor: '#0C2439',
      columnId: 'col-1',
      columnName: 'Em andamento',
      title: 'Corrigir bug de autenticação',
      priority: 'URGENT',
      dueDate: formatLocalDateOffset(-2),
      completed: false,
      subtasksTotal: 4,
      subtasksDone: 2,
    },
    {
      id: 't-today',
      boardId: 'b-1',
      boardName: 'Roadmap Q4',
      boardColor: '#0C2439',
      columnId: 'col-1',
      columnName: 'A fazer',
      title: 'Revisar PR do dashboard',
      priority: 'HIGH',
      dueDate: formatLocalDateOffset(0),
      completed: false,
      subtasksTotal: 0,
      subtasksDone: 0,
    },
    {
      id: 't-upcoming',
      boardId: 'b-2',
      boardName: 'Estudos',
      boardColor: '#2563EB',
      columnId: 'col-2',
      columnName: 'Backlog',
      title: 'Ler documentação do Vite',
      priority: 'MEDIUM',
      dueDate: formatLocalDateOffset(3),
      completed: false,
      subtasksTotal: 3,
      subtasksDone: 1,
    },
    {
      id: 't-nodate',
      boardId: 'b-2',
      boardName: 'Estudos',
      boardColor: '#2563EB',
      columnId: 'col-2',
      columnName: 'Ideias',
      title: 'Organizar anotações',
      priority: 'LOW',
      dueDate: null,
      completed: false,
      subtasksTotal: 0,
      subtasksDone: 0,
    },
    {
      id: 't-done-past',
      boardId: 'b-1',
      boardName: 'Roadmap Q4',
      boardColor: '#0C2439',
      columnId: 'col-3',
      columnName: 'Concluído',
      title: 'Configurar CI inicial',
      priority: 'LOW',
      dueDate: formatLocalDateOffset(-5),
      completed: true,
      subtasksTotal: 2,
      subtasksDone: 2,
    },
  ];
}

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

function BoardDestination() {
  const { boardId } = useParams();
  return <div data-testid="board-destination">Board {boardId}</div>;
}

function renderMyTasksPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={['/app/my-tasks']}>
          <Routes>
            <Route path="/app/my-tasks" element={<MyTasksPage />} />
            <Route path="/app/boards/:boardId" element={<BoardDestination />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('MyTasksPage', () => {
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

  it('bucketsTasksIntoAtrasadasHojeProximasAndSemData', async () => {
    const tasks = createSampleTasks();

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/users/me/tasks') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: tasks,
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
      if (config.url === '/api/v1/boards') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: sampleBoards,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderMyTasksPage();

    const overdueRegion = await screen.findByRole('region', { name: /atrasadas/i });
    expect(within(overdueRegion).getByText('Corrigir bug de autenticação')).toBeInTheDocument();
    expect(within(overdueRegion).getByText('2/4')).toBeInTheDocument();
    expect(within(overdueRegion).queryByText('Configurar CI inicial')).not.toBeInTheDocument();

    const todayRegion = screen.getByRole('region', { name: /hoje/i });
    expect(within(todayRegion).getByText('Revisar PR do dashboard')).toBeInTheDocument();

    const upcomingRegion = screen.getByRole('region', { name: /próximas/i });
    expect(within(upcomingRegion).getByText('Ler documentação do Vite')).toBeInTheDocument();

    const noDateRegion = screen.getByRole('region', { name: /sem data/i });
    expect(within(noDateRegion).getByText('Organizar anotações')).toBeInTheDocument();

    const taskLink = screen.getByRole('link', { name: 'Corrigir bug de autenticação' });
    expect(taskLink).toHaveAttribute('href', '/app/boards/b-1?task=t-overdue');

    const boardsRegion = screen.getByRole('region', { name: /acesso rápido aos quadros/i });
    const boardLinks = within(boardsRegion).getAllByRole('link');
    expect(boardLinks[0]).toHaveTextContent('Roadmap Q4');
    expect(boardLinks[1]).toHaveTextContent('Estudos');
  });

  it('acceptsInviteAndNavigatesToBoardAndDeclinesInviteUpdatingPendingInvites', async () => {
    const user = userEvent.setup();
    let invitesState = [...sampleInvites];
    const calledRequests: string[] = [];

    api.defaults.adapter = async (config) => {
      calledRequests.push(`${config.method?.toUpperCase()} ${config.url}`);

      if (config.url === '/api/v1/users/me/tasks') {
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
          data: invitesState,
        };
      }
      if (config.url === '/api/v1/boards') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: sampleBoards,
        };
      }
      if (config.method?.toLowerCase() === 'post' && config.url === '/api/v1/invites/tok-2/decline') {
        invitesState = invitesState.filter((item) => item.token !== 'tok-2');
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: null,
        };
      }
      if (config.method?.toLowerCase() === 'post' && config.url === '/api/v1/invites/tok-1/accept') {
        invitesState = invitesState.filter((item) => item.token !== 'tok-1');
        const response: AcceptInviteResponse = {
          boardId: 'b-99',
          role: 'EDITOR',
        };
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: response,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderMyTasksPage();

    await waitFor(() => {
      expect(screen.getByText('Lançamento V1')).toBeInTheDocument();
      expect(screen.getByText('Financeiro')).toBeInTheDocument();
    });

    const declineButtons = screen.getAllByRole('button', { name: /recusar/i });
    await user.click(declineButtons[1]);

    await waitFor(() => {
      expect(calledRequests).toContain('POST /api/v1/invites/tok-2/decline');
      expect(screen.queryByText('Financeiro')).not.toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /aceitar/i });
    await user.click(acceptButton);

    await waitFor(() => {
      expect(calledRequests).toContain('POST /api/v1/invites/tok-1/accept');
      expect(screen.getByTestId('board-destination')).toHaveTextContent('Board b-99');
    });
  });

  it('togglesTaskCompleteAndAppliesQuickFilters', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks();
    const toggleCalls: string[] = [];

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/users/me/tasks') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: tasks,
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
      if (config.url === '/api/v1/boards') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: sampleBoards,
        };
      }
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/boards/b-1/tasks/t-today/toggle-complete'
      ) {
        toggleCalls.push(config.url);
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: { id: 't-today', completed: true },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderMyTasksPage();

    await waitFor(() => {
      expect(screen.getByText('Revisar PR do dashboard')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^concluídas$/i }));
    expect(screen.getByText('Configurar CI inicial')).toBeInTheDocument();
    expect(screen.queryByText('Revisar PR do dashboard')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^pendentes$/i }));
    expect(screen.getByText('Revisar PR do dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Configurar CI inicial')).not.toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', {
      name: /marcar revisar pr do dashboard como concluída/i,
    });
    await user.click(checkbox);

    await waitFor(() => {
      expect(toggleCalls).toContain('/api/v1/boards/b-1/tasks/t-today/toggle-complete');
    });
  });

  it('rendersBoardsErrorStateWithRetryInsteadOfEmptyMessageWhenBoardsRequestFails', async () => {
    const user = userEvent.setup();
    let boardsAttempts = 0;

    api.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/users/me/tasks') {
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
      if (config.url === '/api/v1/boards') {
        boardsAttempts += 1;
        if (boardsAttempts === 1) {
          throw new AxiosError(
            'Internal Server Error',
            AxiosError.ERR_BAD_RESPONSE,
            config,
            undefined,
            {
              status: 500,
              statusText: 'Internal Server Error',
              headers: new AxiosHeaders(),
              config,
              data: { status: 500, detail: 'Falha ao buscar quadros.' },
            },
          );
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: sampleBoards,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderMyTasksPage();

    const boardsRegion = screen.getByRole('region', {
      name: /acesso rápido aos quadros/i,
    });

    await waitFor(() => {
      expect(
        within(boardsRegion).getByText('Falha ao buscar quadros.'),
      ).toBeInTheDocument();
    });
    expect(
      within(boardsRegion).queryByText(
        'Você ainda não participa de nenhum quadro',
      ),
    ).not.toBeInTheDocument();

    const retryButton = within(boardsRegion).getByRole('button', {
      name: /tentar novamente/i,
    });
    await user.click(retryButton);

    await waitFor(() => {
      expect(within(boardsRegion).getByText('Roadmap Q4')).toBeInTheDocument();
    });
    expect(boardsAttempts).toBe(2);
  });
});
