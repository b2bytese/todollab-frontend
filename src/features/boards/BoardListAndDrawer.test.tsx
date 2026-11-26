import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { BoardPage } from '@/features/boards/BoardPage';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { BoardDetail, BoardRole, UserProfile } from '@/types/api';

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

function renderBoardPage(initialEntry = '/app/boards/board-1') {
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
            <Route path="/app/boards/:boardId" element={<BoardPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
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

  it('appliesDarkCoralForegroundToActiveViewButtonsInBoardSettingsDialog', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');

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
      throw new Error(`Unexpected request: ${method} ${url}`);
    };

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Corrigir login OAuth')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /configurações do quadro/i }),
    );
    const dialog = await screen.findByRole('dialog');
    const viewSection = within(dialog).getByText('Visualização padrão').parentElement!;

    const kanbanButton = within(viewSection).getByRole('button', { name: /^kanban$/i });
    const listButton = within(viewSection).getByRole('button', { name: /^lista$/i });

    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveClass('dark:bg-brand-coral', 'dark:text-brand-coral-foreground');
    expect(kanbanButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(kanbanButton);

    expect(kanbanButton).toHaveAttribute('aria-pressed', 'true');
    expect(kanbanButton).toHaveClass('dark:bg-brand-coral', 'dark:text-brand-coral-foreground');
    expect(listButton).toHaveAttribute('aria-pressed', 'false');
  });
});
