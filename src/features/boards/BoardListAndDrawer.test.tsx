import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { boardKeys } from '@/features/boards/api';
import * as BoardListViewModule from '@/features/boards/BoardListView';
import { BoardPage } from '@/features/boards/BoardPage';
import { TaskTagsPopover } from '@/features/tasks/TaskTagsPopover';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { BoardDetail, BoardRole, BoardTag, UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatarColor: '#0C2439',
  createdAt: '2026-11-25T10:00:00Z',
};

function createBoardDetail(myRole: BoardRole = 'OWNER'): BoardDetail {
  return {
    board: {
      id: 'board-1',
      name: 'Produto V1',
      description: 'Quadro principal de entregas',
      color: '#0C2439',
      icon: 'rocket',
      defaultView: 'LIST',
      ownerId: 'user-1',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-25T10:00:00Z',
    },
    myRole,
    isFavorite: false,
    columns: [
      {
        id: 'col-todo',
        boardId: 'board-1',
        name: 'A fazer',
        position: 1000,
        isDoneColumn: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
      {
        id: 'col-done',
        boardId: 'board-1',
        name: 'Concluído',
        position: 2000,
        isDoneColumn: true,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
    ],
    tags: [
      {
        id: 'tag-bug',
        boardId: 'board-1',
        name: 'Bug',
        color: '#FF4B4B',
      },
      {
        id: 'tag-ui',
        boardId: 'board-1',
        name: 'UI',
        color: '#2563EB',
      },
    ],
    members: [
      {
        id: 'mem-1',
        userId: 'user-1',
        name: 'Ana Silva',
        email: 'ana@example.com',
        avatarColor: '#0C2439',
        role: myRole,
        joinedAt: '2026-11-20T10:00:00Z',
      },
      {
        id: 'mem-2',
        userId: 'user-2',
        name: 'Bruno Costa',
        email: 'bruno@example.com',
        avatarColor: '#FF4B4B',
        role: 'EDITOR',
        joinedAt: '2026-11-21T10:00:00Z',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        boardId: 'board-1',
        columnId: 'col-todo',
        title: 'Corrigir login OAuth',
        description: 'Verificar refresh token no callback',
        priority: 'URGENT',
        dueDate: '2026-11-28',
        assigneeId: 'user-1',
        completed: false,
        completedAt: null,
        position: 1000,
        createdById: 'user-1',
        subtasks: [
          {
            id: 'sub-1',
            taskId: 'task-1',
            title: 'Validar token expirado',
            done: false,
            position: 1000,
            createdAt: '2026-11-25T10:00:00Z',
          },
        ],
        tagIds: ['tag-bug'],
        createdAt: '2026-11-25T10:00:00Z',
        updatedAt: '2026-11-25T10:00:00Z',
      },
      {
        id: 'task-2',
        boardId: 'board-1',
        columnId: 'col-todo',
        title: 'Refinar layout da barra lateral',
        description: 'Ajustar espaçamento em telas menores',
        priority: 'LOW',
        dueDate: null,
        assigneeId: 'user-2',
        completed: false,
        completedAt: null,
        position: 2000,
        createdById: 'user-1',
        subtasks: [],
        tagIds: ['tag-ui'],
        createdAt: '2026-11-25T10:10:00Z',
        updatedAt: '2026-11-25T10:10:00Z',
      },
      {
        id: 'task-3',
        boardId: 'board-1',
        columnId: 'col-done',
        title: 'Publicar documentação inicial',
        description: null,
        priority: 'MEDIUM',
        dueDate: null,
        assigneeId: null,
        completed: true,
        completedAt: '2026-11-24T12:00:00Z',
        position: 1000,
        createdById: 'user-1',
        subtasks: [],
        tagIds: [],
        createdAt: '2026-11-24T10:00:00Z',
        updatedAt: '2026-11-24T12:00:00Z',
      },
    ],
  };
}

function makeAxiosError(
  status: number,
  config: InternalAxiosRequestConfig,
  data: unknown,
) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    config,
    undefined,
    {
      status,
      statusText: 'Server Error',
      headers: new AxiosHeaders(),
      config,
      data,
    },
  );
}

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      {`${location.pathname}${location.search}`}
    </div>
  );
}

function renderBoardPage(initialEntry = '/app/boards/board-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/app/boards/:boardId" element={<BoardPage />} />
          </Routes>
          <LocationDisplay />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

describe('BoardPage List View & TaskDrawer', () => {
  let originalAdapter: AxiosAdapter | typeof api.defaults.adapter;

  beforeAll(() => {
    if (typeof Element !== 'undefined') {
      if (!Element.prototype.hasPointerCapture) {
        Element.prototype.hasPointerCapture = () => false;
      }
      if (!Element.prototype.setPointerCapture) {
        Element.prototype.setPointerCapture = () => {};
      }
      if (!Element.prototype.releasePointerCapture) {
        Element.prototype.releasePointerCapture = () => {};
      }
      if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = () => {};
      }
    }
  });

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
    vi.restoreAllMocks();
  });

  it('viewerSeesReadOnlyBadgeAndCannotMutateOrToggleTasks', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('VIEWER');

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'get' && config.url === '/api/v1/boards/board-1') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Produto V1')).toBeInTheDocument();
    });

    expect(screen.getByText('Somente leitura')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adicionar tarefa/i })).not.toBeInTheDocument();

    const firstCheckbox = screen.getByRole('checkbox', {
      name: /marcar corrigir login oauth como concluída/i,
    });
    expect(firstCheckbox).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /corrigir login oauth/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/título da tarefa/i)).toBeDisabled();
    expect(within(dialog).getByLabelText(/descrição/i)).toBeDisabled();
    expect(within(dialog).getByLabelText(/data de entrega/i)).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: /excluir tarefa/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/nova subtarefa/i)).not.toBeInTheDocument();
  });

  it('toggleCompleteUpdatesOptimisticallyAndRollsBackOnError', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('EDITOR');
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    let rejectToggle!: (err: unknown) => void;
    let toggleCalled = false;

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'get' && config.url === '/api/v1/boards/board-1') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/boards/board-1/tasks/task-1/toggle-complete'
      ) {
        toggleCalled = true;
        return new Promise((_resolve, reject) => {
          rejectToggle = () =>
            reject(
              makeAxiosError(500, config, {
                status: 500,
                detail: 'Erro ao concluir tarefa',
              }),
            );
        });
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    });

    const checkboxBefore = screen.getByRole('checkbox', {
      name: /marcar corrigir login oauth como concluída/i,
    });
    expect(checkboxBefore).not.toBeChecked();

    await user.click(checkboxBefore);

    await waitFor(() => {
      expect(toggleCalled).toBe(true);
      const optimisticCheckbox = screen.getByRole('checkbox', {
        name: /reabrir corrigir login oauth/i,
      });
      expect(optimisticCheckbox).toBeChecked();
    });

    const doneRegion = screen.getByRole('region', { name: /concluído/i });
    expect(within(doneRegion).getByText('Corrigir login OAuth')).toBeInTheDocument();

    rejectToggle(new Error('500'));

    await waitFor(() => {
      const revertedCheckbox = screen.getByRole('checkbox', {
        name: /marcar corrigir login oauth como concluída/i,
      });
      expect(revertedCheckbox).not.toBeChecked();
      expect(toastErrorSpy).toHaveBeenCalledWith('Erro ao concluir tarefa');
    });

    const todoRegion = screen.getByRole('region', { name: /a fazer/i });
    expect(within(todoRegion).getByText('Corrigir login OAuth')).toBeInTheDocument();
  });

  it('filterBarFiltersTasksBySearchAssigneePriorityTagAndHideCompleted', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');
    let fetchCount = 0;

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'get' && config.url === '/api/v1/boards/board-1') {
        fetchCount += 1;
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    });

    expect(screen.getByText('Refinar layout da barra lateral')).toBeInTheDocument();
    expect(screen.getByText('Publicar documentação inicial')).toBeInTheDocument();

    // Hide completed
    await user.click(screen.getByRole('checkbox', { name: /ocultar concluídas/i }));
    expect(screen.queryByText('Publicar documentação inicial')).not.toBeInTheDocument();
    expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    expect(screen.getByText('Refinar layout da barra lateral')).toBeInTheDocument();

    // Search
    const searchInput = screen.getByLabelText(/buscar tarefas/i);
    await user.type(searchInput, 'OAuth');
    expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    expect(screen.queryByText('Refinar layout da barra lateral')).not.toBeInTheDocument();

    await user.clear(searchInput);

    // Filter by assignee (Bruno Costa)
    await user.click(screen.getByLabelText(/filtrar por responsável/i));
    await user.click(await screen.findByRole('option', { name: 'Bruno Costa' }));
    expect(screen.getByText('Refinar layout da barra lateral')).toBeInTheDocument();
    expect(screen.queryByText('Corrigir login OAuth')).not.toBeInTheDocument();

    // Reset assignee to all
    await user.click(screen.getByLabelText(/filtrar por responsável/i));
    await user.click(await screen.findByRole('option', { name: /todos responsáveis/i }));

    // Filter by priority (Urgente)
    await user.click(screen.getByLabelText(/filtrar por prioridade/i));
    await user.click(await screen.findByRole('option', { name: 'Urgente' }));
    expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    expect(screen.queryByText('Refinar layout da barra lateral')).not.toBeInTheDocument();

    // Reset priority
    await user.click(screen.getByLabelText(/filtrar por prioridade/i));
    await user.click(await screen.findByRole('option', { name: /todas prioridades/i }));

    // Filter by tag (UI)
    await user.click(screen.getByLabelText(/filtrar por etiqueta/i));
    await user.click(await screen.findByRole('option', { name: 'UI' }));
    expect(screen.getByText('Refinar layout da barra lateral')).toBeInTheDocument();
    expect(screen.queryByText('Corrigir login OAuth')).not.toBeInTheDocument();

    expect(fetchCount).toBe(1);
  });

  it('taskDrawerEditsFieldsAndManagesSubtasks', async () => {
    const user = userEvent.setup();
    let detail = createBoardDetail('OWNER');
    const requests: { method: string; url: string; data: unknown }[] = [];

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';
      const data =
        typeof config.data === 'string' && config.data.length > 0
          ? JSON.parse(config.data)
          : config.data;

      if (method === 'get' && url === '/api/v1/boards/board-1') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }

      requests.push({ method, url, data });

      if (method === 'patch' && url === '/api/v1/boards/board-1/tasks/task-1') {
        const patch = data as {
          title?: string;
          clearDueDate?: boolean;
          clearAssignee?: boolean;
        };
        detail = {
          ...detail,
          tasks: detail.tasks.map((t) =>
            t.id === 'task-1'
              ? {
                  ...t,
                  title: patch.title ?? t.title,
                  dueDate: patch.clearDueDate ? null : t.dueDate,
                  assigneeId: patch.clearAssignee ? null : t.assigneeId,
                }
              : t,
          ),
        };
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail.tasks[0],
        };
      }

      if (method === 'post' && url === '/api/v1/boards/board-1/tasks/task-1/subtasks') {
        const payload = data as { title: string };
        const created = {
          id: 'sub-2',
          taskId: 'task-1',
          title: payload.title,
          done: false,
          position: 2000,
          createdAt: '2026-11-25T11:00:00Z',
        };
        detail = {
          ...detail,
          tasks: detail.tasks.map((t) =>
            t.id === 'task-1' ? { ...t, subtasks: [...t.subtasks, created] } : t,
          ),
        };
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: created,
        };
      }

      if (
        method === 'patch' &&
        url === '/api/v1/boards/board-1/tasks/task-1/subtasks/sub-1'
      ) {
        const payload = data as { done?: boolean; title?: string };
        let updatedSubtask = detail.tasks[0].subtasks[0];
        detail = {
          ...detail,
          tasks: detail.tasks.map((t) =>
            t.id === 'task-1'
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) => {
                    if (s.id === 'sub-1') {
                      updatedSubtask = {
                        ...s,
                        done: payload.done ?? s.done,
                        title: payload.title ?? s.title,
                      };
                      return updatedSubtask;
                    }
                    return s;
                  }),
                }
              : t,
          ),
        };
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: updatedSubtask,
        };
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    };

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /corrigir login oauth/i }));

    const dialog = await screen.findByRole('dialog');

    // Edit title and blur
    const titleInput = within(dialog).getByLabelText(/título da tarefa/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Corrigir login OAuth v2');
    await user.tab();

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'patch' &&
            r.url === '/api/v1/boards/board-1/tasks/task-1' &&
            (r.data as { title?: string }).title === 'Corrigir login OAuth v2',
        ),
      ).toBe(true);
    });

    // Clear due date
    await user.click(within(dialog).getByRole('button', { name: /limpar data/i }));
    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'patch' &&
            r.url === '/api/v1/boards/board-1/tasks/task-1' &&
            (r.data as { clearDueDate?: boolean }).clearDueDate === true,
        ),
      ).toBe(true);
    });

    // Add subtask
    const subtaskInput = within(dialog).getByLabelText(/nova subtarefa/i);
    await user.type(subtaskInput, 'Adicionar teste de callback');
    await user.click(within(dialog).getByRole('button', { name: /^adicionar$/i }));

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'post' &&
            r.url === '/api/v1/boards/board-1/tasks/task-1/subtasks' &&
            (r.data as { title: string }).title === 'Adicionar teste de callback',
        ),
      ).toBe(true);
      expect(
        within(dialog).getByText('Adicionar teste de callback'),
      ).toBeInTheDocument();
    });

    // Toggle existing subtask
    const subCheckbox = within(dialog).getByRole('checkbox', {
      name: /marcar subtarefa validar token expirado como concluída/i,
    });
    await user.click(subCheckbox);

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'patch' &&
            r.url === '/api/v1/boards/board-1/tasks/task-1/subtasks/sub-1' &&
            (r.data as { done?: boolean }).done === true,
        ),
      ).toBe(true);
      expect(
        within(dialog).getByRole('checkbox', {
          name: /reabrir subtarefa validar token expirado/i,
        }),
      ).toBeChecked();
    });
  });

  it('createTaskFailurePreservesDraftAndEmitsNoUnhandledRejection', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('EDITOR');
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');
    const unhandledRejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      api.defaults.adapter = async (config) => {
        const method = config.method?.toLowerCase() ?? 'get';
        const url = config.url ?? '';
        if (method === 'get' && url === '/api/v1/boards/board-1') {
          return {
            status: 200,
            statusText: 'OK',
            headers: new AxiosHeaders(),
            config,
            data: detail,
          };
        }
        if (method === 'post' && url === '/api/v1/boards/board-1/tasks') {
          throw makeAxiosError(500, config, {
            status: 500,
            detail: 'Falha ao criar tarefa',
          });
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      };

      renderBoardPage();

      await waitFor(() => {
        expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
      });

      const todoRegion = screen.getByRole('region', { name: /a fazer/i });
      await user.click(
        within(todoRegion).getByRole('button', { name: /adicionar tarefa/i }),
      );

      const input = within(todoRegion).getByLabelText(/nova tarefa em a fazer/i);
      await user.type(input, 'Nova tarefa com erro');
      await user.click(
        within(todoRegion).getByRole('button', { name: /^adicionar$/i }),
      );

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalledWith('Falha ao criar tarefa');
      });

      // Allow any microtasks to flush before asserting no unhandled rejection occurred
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(unhandledRejections).toHaveLength(0);
      expect(
        within(todoRegion).getByLabelText(/nova tarefa em a fazer/i),
      ).toHaveValue('Nova tarefa com erro');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('boardPageOpensDirectlyInKanbanWithoutFlashingBoardListView', async () => {
    const detail = createBoardDetail('OWNER');
    detail.board.defaultView = 'KANBAN';
    const listViewSpy = vi.spyOn(BoardListViewModule, 'BoardListView');

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'get' &&
        config.url === '/api/v1/boards/board-1'
      ) {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Produto V1')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-card-task-1')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /kanban/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(listViewSpy).not.toHaveBeenCalled();
  });

  it('boardPageClearsTaskQueryParamWhenSelectedTaskIsRemovedRemotely', async () => {
    const detail = createBoardDetail('OWNER');

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'get' &&
        config.url === '/api/v1/boards/board-1'
      ) {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    const { queryClient } = renderBoardPage('/app/boards/board-1?task=task-1');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/título da tarefa/i)).toHaveValue(
      'Corrigir login OAuth',
    );
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/app/boards/board-1?task=task-1',
    );

    act(() => {
      queryClient.setQueryData<BoardDetail>(boardKeys.detail('board-1'), {
        ...detail,
        tasks: detail.tasks.filter((t) => t.id !== 'task-1'),
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/app/boards/board-1',
      );
      expect(screen.getByTestId('location-display').textContent).toBe(
        '/app/boards/board-1',
      );
    });
  });

  it('boardPageResetsAssigneeAndTagFiltersWhenMemberOrTagDisappears', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'get' &&
        config.url === '/api/v1/boards/board-1'
      ) {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    const { queryClient } = renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/filtrar por responsável/i));
    await user.click(await screen.findByRole('option', { name: 'Bruno Costa' }));
    await user.click(screen.getByLabelText(/filtrar por etiqueta/i));
    await user.click(await screen.findByRole('option', { name: 'UI' }));

    expect(screen.getByText('Refinar layout da barra lateral')).toBeInTheDocument();
    expect(screen.queryByText('Corrigir login OAuth')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /limpar filtros/i }),
    ).toBeInTheDocument();

    act(() => {
      queryClient.setQueryData<BoardDetail>(boardKeys.detail('board-1'), {
        ...detail,
        members: detail.members.filter((m) => m.userId !== 'user-2'),
        tags: detail.tags.filter((t) => t.id !== 'tag-ui'),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
      expect(
        screen.getByText('Refinar layout da barra lateral'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /limpar filtros/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('taskDrawerFlushesPendingTitleAndDescriptionOnCloseWithoutPriorBlurAndSupportsDelete', async () => {
    const user = userEvent.setup();
    let detail = createBoardDetail('OWNER');
    const requests: { method: string; url: string; data: unknown }[] = [];

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';
      const data =
        typeof config.data === 'string' && config.data.length > 0
          ? JSON.parse(config.data)
          : config.data;

      if (method === 'get' && url === '/api/v1/boards/board-1') {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail,
        };
      }

      requests.push({ method, url, data });

      if (method === 'patch' && url === '/api/v1/boards/board-1/tasks/task-1') {
        const patch = data as { title?: string; description?: string | null };
        detail = {
          ...detail,
          tasks: detail.tasks.map((t) =>
            t.id === 'task-1'
              ? {
                  ...t,
                  title: patch.title ?? t.title,
                  description:
                    patch.description !== undefined
                      ? patch.description
                      : t.description,
                }
              : t,
          ),
        };
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail.tasks[0],
        };
      }

      if (method === 'delete' && url === '/api/v1/boards/board-1/tasks/task-1') {
        detail = {
          ...detail,
          tasks: detail.tasks.filter((t) => t.id !== 'task-1'),
        };
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: null,
        };
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    };

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    });

    // 1. Edit title and press Escape immediately without prior blur
    await user.click(screen.getByRole('button', { name: /corrigir login oauth/i }));
    let dialog = await screen.findByRole('dialog');
    const titleInput = within(dialog).getByLabelText(/título da tarefa/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Título salvo ao fechar{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        requests.some(
          (r) =>
            r.method === 'patch' &&
            r.url === '/api/v1/boards/board-1/tasks/task-1' &&
            (r.data as { title?: string }).title === 'Título salvo ao fechar',
        ),
      ).toBe(true);
    });

    // 2. Reopen, edit description, and press Escape without prior blur
    await user.click(
      screen.getByRole('button', { name: /título salvo ao fechar/i }),
    );
    dialog = await screen.findByRole('dialog');
    const descInput = within(dialog).getByLabelText(/descrição/i);
    await user.clear(descInput);
    await user.type(descInput, 'Descrição salva ao fechar{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        requests.some(
          (r) =>
            r.method === 'patch' &&
            r.url === '/api/v1/boards/board-1/tasks/task-1' &&
            (r.data as { description?: string | null }).description ===
              'Descrição salva ao fechar',
        ),
      ).toBe(true);
    });

    // 3. Reopen and delete via ConfirmDialog
    await user.click(
      screen.getByRole('button', { name: /título salvo ao fechar/i }),
    );
    dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: /excluir tarefa/i }),
    );

    const confirmDialog = await screen.findByRole('dialog', {
      name: /excluir tarefa\?/i,
    });
    expect(
      requests.some((r) => r.method === 'delete'),
    ).toBe(false);

    await user.click(
      within(confirmDialog).getByRole('button', { name: /^excluir$/i }),
    );

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'delete' &&
            r.url === '/api/v1/boards/board-1/tasks/task-1',
        ),
      ).toBe(true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Título salvo ao fechar'),
      ).not.toBeInTheDocument();
    });
  });

  it('taskTagsPopoverCreatesEditsDeletesTagsAndUsesLatestSelectedTagIdsOnCreate', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');
    const onChangeCalls: string[][] = [];

    let resolveCreateTag!: (tag: BoardTag) => void;
    const requests: { method: string; url: string; data: unknown }[] = [];

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';
      const data =
        typeof config.data === 'string' && config.data.length > 0
          ? JSON.parse(config.data)
          : config.data;

      requests.push({ method, url, data });

      if (method === 'post' && url === '/api/v1/boards/board-1/tags') {
        const payload = data as { name: string; color: string };
        return new Promise((resolve) => {
          resolveCreateTag = (tag: BoardTag) =>
            resolve({
              status: 201,
              statusText: 'Created',
              headers: new AxiosHeaders(),
              config,
              data: tag ?? {
                id: 'tag-new',
                boardId: 'board-1',
                name: payload.name,
                color: payload.color,
              },
            });
        });
      }

      if (method === 'patch' && url === '/api/v1/boards/board-1/tags/tag-ui') {
        const payload = data as { name?: string; color?: string };
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            id: 'tag-ui',
            boardId: 'board-1',
            name: payload.name ?? 'UI',
            color: payload.color ?? '#2563EB',
          },
        };
      }

      if (method === 'delete' && url === '/api/v1/boards/board-1/tags/tag-ui') {
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: null,
        };
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(boardKeys.detail('board-1'), detail);

    function Harness() {
      const { data } = useQuery<BoardDetail>({
        queryKey: boardKeys.detail('board-1'),
        queryFn: () => detail,
        enabled: false,
      });
      const current = data ?? detail;
      const task = current.tasks[0];

      return (
        <TaskTagsPopover
          boardId="board-1"
          boardTags={current.tags}
          selectedTagIds={task.tagIds}
          canEdit
          onChangeTagIds={(nextTagIds) => {
            onChangeCalls.push(nextTagIds);
            queryClient.setQueryData<BoardDetail>(
              boardKeys.detail('board-1'),
              (prev) =>
                prev
                  ? {
                      ...prev,
                      tasks: prev.tasks.map((t) =>
                        t.id === task.id ? { ...t, tagIds: nextTagIds } : t,
                      ),
                    }
                  : prev,
            );
          }}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <Harness />
        </ThemeProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /gerenciar etiquetas/i }));

    // 1. Start creating a tag while selectedTagIds is ['tag-bug']
    await user.type(screen.getByLabelText(/nome da nova etiqueta/i), 'Backend');
    await user.click(screen.getByRole('button', { name: /criar etiqueta/i }));

    await waitFor(() => {
      expect(typeof resolveCreateTag).toBe('function');
    });

    // While createTag is in-flight, toggle 'UI' tag on -> selectedTagIds becomes ['tag-bug', 'tag-ui']
    await user.click(screen.getByRole('button', { name: 'UI' }));
    expect(onChangeCalls[onChangeCalls.length - 1]).toEqual([
      'tag-bug',
      'tag-ui',
    ]);

    // Now resolve createTag -> must use latest selectedTagIds ['tag-bug', 'tag-ui'] + 'tag-backend'
    act(() => {
      resolveCreateTag({
        id: 'tag-backend',
        boardId: 'board-1',
        name: 'Backend',
        color: '#FF4B4B',
      });
    });

    await waitFor(() => {
      expect(onChangeCalls[onChangeCalls.length - 1]).toEqual([
        'tag-bug',
        'tag-ui',
        'tag-backend',
      ]);
      expect(screen.getByRole('button', { name: 'Backend' })).toBeInTheDocument();
    });

    // 2. Edit 'UI' tag inline (name + color)
    await user.click(screen.getByRole('button', { name: /editar etiqueta ui/i }));
    const editInput = screen.getByLabelText(/editar nome da etiqueta ui/i);
    await user.clear(editInput);
    await user.type(editInput, 'Design');
    await user.click(
      screen.getByRole('button', { name: /editar cor da etiqueta #16A34A/i }),
    );
    await user.click(screen.getByRole('button', { name: /salvar etiqueta/i }));

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'patch' &&
            r.url === '/api/v1/boards/board-1/tags/tag-ui' &&
            (r.data as { name?: string; color?: string }).name === 'Design' &&
            (r.data as { name?: string; color?: string }).color === '#16A34A',
        ),
      ).toBe(true);
      expect(screen.getByRole('button', { name: 'Design' })).toBeInTheDocument();
    });

    // 3. Delete 'Design' tag
    await user.click(
      screen.getByRole('button', { name: /excluir etiqueta design/i }),
    );

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'delete' &&
            r.url === '/api/v1/boards/board-1/tags/tag-ui',
        ),
      ).toBe(true);
      expect(
        screen.queryByRole('button', { name: 'Design' }),
      ).not.toBeInTheDocument();
    });
  });
});
