import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { BoardKanbanView } from '@/features/boards/BoardKanbanView';
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
      description: 'Quadro Kanban principal',
      color: '#0C2439',
      icon: 'rocket',
      defaultView: 'KANBAN',
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
        id: 'col-doing',
        boardId: 'board-1',
        name: 'Em andamento',
        position: 2000,
        isDoneColumn: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
      {
        id: 'col-done',
        boardId: 'board-1',
        name: 'Concluído',
        position: 3000,
        isDoneColumn: true,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
    ],
    tags: [
      { id: 'tag-1', boardId: 'board-1', name: 'Bug', color: '#FF4B4B' },
      { id: 'tag-2', boardId: 'board-1', name: 'UI', color: '#2563EB' },
      { id: 'tag-3', boardId: 'board-1', name: 'API', color: '#059669' },
      { id: 'tag-4', boardId: 'board-1', name: 'Backend', color: '#D97706' },
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
        dueDate: '2020-01-10',
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
            done: true,
            position: 1000,
            createdAt: '2026-11-25T10:00:00Z',
          },
          {
            id: 'sub-2',
            taskId: 'task-1',
            title: 'Atualizar cookie',
            done: false,
            position: 2000,
            createdAt: '2026-11-25T10:05:00Z',
          },
        ],
        tagIds: ['tag-1', 'tag-2', 'tag-3', 'tag-4'],
        createdAt: '2026-11-25T10:00:00Z',
        updatedAt: '2026-11-25T10:00:00Z',
      },
      {
        id: 'task-2',
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

function renderKanbanView({
  detail = createBoardDetail('OWNER'),
  canEdit = true,
  onSelectTask = vi.fn(),
}: {
  detail?: BoardDetail;
  canEdit?: boolean;
  onSelectTask?: (taskId: string) => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <BoardKanbanView
          detail={detail}
          filteredTasks={detail.tasks}
          canEdit={canEdit}
          onSelectTask={onSelectTask}
        />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('BoardKanbanView', () => {
  let originalAdapter: AxiosAdapter | typeof api.defaults.adapter;

  beforeAll(() => {
    if (typeof window !== 'undefined' && !window.PointerEvent) {
      class MockPointerEvent extends MouseEvent {
        pointerId: number;
        pointerType: string;
        isPrimary: boolean;

        constructor(type: string, params: PointerEventInit = {}) {
          super(type, params);
          this.pointerId = params.pointerId ?? 1;
          this.pointerType = params.pointerType ?? 'mouse';
          this.isPrimary = params.isPrimary ?? true;
        }
      }
      window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
    }

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

  it('viewerHidesMutationControlsAndMarksDragControlsDisabled', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('VIEWER');
    const onSelectTask = vi.fn();

    renderKanbanView({ detail, canEdit: false, onSelectTask });

    expect(
      screen.queryByRole('button', { name: /nova coluna/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /adicionar tarefa/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /opções da coluna/i }),
    ).not.toBeInTheDocument();

    const columnDragHandle = screen.getByRole('button', {
      name: /mover coluna a fazer/i,
    });
    expect(columnDragHandle).toBeDisabled();

    const cardDragHandle = screen.getByRole('button', {
      name: /arrastar tarefa corrigir login oauth/i,
    });
    expect(cardDragHandle).toBeDisabled();

    // Viewer can still click card title to open TaskDrawer
    await user.click(
      screen.getByRole('button', { name: 'Corrigir login OAuth' }),
    );
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
  });

  it('rendersCardMetadataTagsOverflowOverdueDueDateSubtasksAndAvatar', () => {
    renderKanbanView();

    const card = screen.getByTestId('kanban-card-task-1');
    expect(within(card).getByText('Corrigir login OAuth')).toBeInTheDocument();
    expect(within(card).getByText('Urgente')).toBeInTheDocument();
    expect(within(card).getByText('Bug')).toBeInTheDocument();
    expect(within(card).getByText('UI')).toBeInTheDocument();
    expect(within(card).getByText('API')).toBeInTheDocument();
    expect(within(card).queryByText('Backend')).not.toBeInTheDocument();
    expect(within(card).getByText('+1')).toBeInTheDocument();
    expect(within(card).getByText('1/2')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Ana Silva' })).toBeInTheDocument();

    const dueDateChip = within(card).getByTestId('kanban-card-due-date');
    expect(dueDateChip).toHaveClass('text-brand-coral');
  });

  it('deletingColumnWithTasksOpensColumnDeleteDialogAndPassesTargetColumnIdOrDeleteTasks', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');
    const deleteCalls: { url: string; params: Record<string, unknown> }[] = [];

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'delete') {
        deleteCalls.push({
          url: config.url ?? '',
          params: (config.params ?? {}) as Record<string, unknown>,
        });
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: undefined,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderKanbanView({ detail, canEdit: true });

    // Open menu on "A fazer" (has task-1) and click Excluir coluna
    await user.click(
      screen.getByRole('button', { name: /opções da coluna a fazer/i }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /excluir coluna/i }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/excluir coluna com tarefas/i),
    ).toBeInTheDocument();

    // Default choice is move tasks to first other column ("Em andamento")
    await user.click(
      within(dialog).getByRole('button', { name: /excluir coluna/i }),
    );

    await waitFor(() => {
      expect(deleteCalls).toHaveLength(1);
    });
    expect(deleteCalls[0]).toEqual({
      url: '/api/v1/boards/board-1/columns/col-todo',
      params: { targetColumnId: 'col-doing' },
    });

    // Now test choosing deleteTasks=true on "Concluído" (has task-2)
    await user.click(
      screen.getByRole('button', { name: /opções da coluna concluído/i }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /excluir coluna/i }));

    const dialog2 = await screen.findByRole('dialog');
    await user.click(
      within(dialog2).getByRole('radio', {
        name: /excluir todas as tarefas/i,
      }),
    );
    await user.click(
      within(dialog2).getByRole('button', { name: /excluir coluna/i }),
    );

    await waitFor(() => {
      expect(deleteCalls).toHaveLength(2);
    });
    expect(deleteCalls[1]).toEqual({
      url: '/api/v1/boards/board-1/columns/col-done',
      params: { deleteTasks: true },
    });
  });

  it('failedTaskMoveRollsBackOptimisticMoveAndDisplaysErrorToast', async () => {
    const detail = createBoardDetail('EDITOR');
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    let rejectMove!: (err: unknown) => void;
    let moveRequestUrl = '';
    let moveRequestBody: unknown = null;

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/boards/board-1/tasks/task-1/move'
      ) {
        moveRequestUrl = config.url;
        moveRequestBody =
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data;
        return new Promise((_resolve, reject) => {
          rejectMove = () =>
            reject(
              makeAxiosError(500, config, {
                status: 500,
                detail: 'Erro ao mover tarefa',
              }),
            );
        });
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const testId = this.getAttribute('data-testid');
        if (testId === 'kanban-column-col-todo') {
          return new DOMRect(0, 0, 300, 500);
        }
        if (testId === 'kanban-column-drop-col-todo') {
          return new DOMRect(0, 50, 300, 450);
        }
        if (testId === 'kanban-card-task-1') {
          return new DOMRect(10, 60, 280, 80);
        }
        if (testId === 'kanban-column-col-doing') {
          return new DOMRect(320, 0, 300, 500);
        }
        if (testId === 'kanban-column-drop-col-doing') {
          return new DOMRect(320, 50, 300, 450);
        }
        if (testId === 'kanban-column-col-done') {
          return new DOMRect(640, 0, 300, 500);
        }
        if (testId === 'kanban-column-drop-col-done') {
          return new DOMRect(640, 50, 300, 450);
        }
        if (testId === 'kanban-card-task-2') {
          return new DOMRect(650, 60, 280, 80);
        }
        return new DOMRect(0, 0, 0, 0);
      });

    renderKanbanView({ detail, canEdit: true });

    const todoCol = screen.getByTestId('kanban-column-col-todo');
    const doneCol = screen.getByTestId('kanban-column-col-done');

    expect(
      within(todoCol).getByText('Corrigir login OAuth'),
    ).toBeInTheDocument();
    expect(
      within(doneCol).queryByText('Corrigir login OAuth'),
    ).not.toBeInTheDocument();

    const task1Card = screen.getByTestId('kanban-card-task-1');

    // Drag task-1 (> 6px activation distance) into empty lower space of Concluído column
    fireEvent.pointerDown(task1Card, {
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, {
      clientX: 60,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, {
      clientX: 700,
      clientY: 300,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(document, {
      clientX: 700,
      clientY: 300,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(moveRequestUrl).toBe('/api/v1/boards/board-1/tasks/task-1/move');
    });
    expect(moveRequestBody).toEqual({
      targetColumnId: 'col-done',
      position: 2000,
    });

    // Optimistic state: moved to done column and marked completed
    const optimisticDoneCol = screen.getByTestId('kanban-column-col-done');
    expect(
      within(optimisticDoneCol).getByText('Corrigir login OAuth'),
    ).toBeInTheDocument();
    expect(
      within(optimisticDoneCol).getByTestId('kanban-card-task-1'),
    ).toHaveAttribute('data-completed', 'true');

    // Reject API call -> rolls back to todo column + shows error toast
    rejectMove(new Error('500'));

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith('Erro ao mover tarefa');
      expect(
        within(screen.getByTestId('kanban-column-col-todo')).getByText(
          'Corrigir login OAuth',
        ),
      ).toBeInTheDocument();
    });

    expect(
      within(screen.getByTestId('kanban-column-col-done')).queryByText(
        'Corrigir login OAuth',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('kanban-card-task-1')).toHaveAttribute(
      'data-completed',
      'false',
    );

    rectSpy.mockRestore();
  });

  it('deletingEmptyColumnOpensConfirmDialogAndDisablesDeleteWhenSingleColumnRemains', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');
    const deleteCalls: { url: string; params: Record<string, unknown> }[] = [];

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'delete') {
        deleteCalls.push({
          url: config.url ?? '',
          params: (config.params ?? {}) as Record<string, unknown>,
        });
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: undefined,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    const { rerender } = renderKanbanView({ detail, canEdit: true });

    // "Em andamento" (col-doing) has 0 tasks -> opens ConfirmDialog (not ColumnDeleteDialog)
    await user.click(
      screen.getByRole('button', { name: /opções da coluna em andamento/i }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /excluir coluna/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Excluir coluna?')).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: /excluir coluna/i }),
    );

    await waitFor(() => {
      expect(deleteCalls).toHaveLength(1);
    });
    expect(deleteCalls[0]).toEqual({
      url: '/api/v1/boards/board-1/columns/col-doing',
      params: {},
    });

    // When only 1 column remains, Excluir coluna menu item is disabled
    const singleColumnDetail: BoardDetail = {
      ...detail,
      columns: [detail.columns[0]],
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <BoardKanbanView
            detail={singleColumnDetail}
            filteredTasks={singleColumnDetail.tasks}
            canEdit={true}
            onSelectTask={vi.fn()}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: /opções da coluna a fazer/i }),
    );
    const disabledItem = await screen.findByRole('menuitem', {
      name: /excluir coluna/i,
    });
    expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('failedColumnMoveRollsBackOptimisticOrderAndDisplaysErrorToast', async () => {
    const detail = createBoardDetail('OWNER');
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    let rejectColumnMove!: (err: unknown) => void;
    let moveColumnUrl = '';
    let moveColumnBody: unknown = null;

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/boards/board-1/columns/col-todo/move'
      ) {
        moveColumnUrl = config.url;
        moveColumnBody =
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data;
        return new Promise((_resolve, reject) => {
          rejectColumnMove = () =>
            reject(
              makeAxiosError(500, config, {
                status: 500,
                detail: 'Erro ao reordenar coluna',
              }),
            );
        });
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const testId = this.getAttribute('data-testid');
        if (testId === 'kanban-column-col-todo') {
          return new DOMRect(0, 0, 300, 500);
        }
        if (testId === 'kanban-column-col-doing') {
          return new DOMRect(320, 0, 300, 500);
        }
        if (testId === 'kanban-column-col-done') {
          return new DOMRect(640, 0, 300, 500);
        }
        return new DOMRect(0, 0, 0, 0);
      });

    renderKanbanView({ detail, canEdit: true });

    const getColumnOrder = () =>
      screen
        .getAllByRole('region')
        .map((el) => el.getAttribute('aria-label'));

    expect(getColumnOrder()).toEqual(['A fazer', 'Em andamento', 'Concluído']);

    const todoHandle = screen.getByRole('button', {
      name: /mover coluna a fazer/i,
    });

    fireEvent.pointerDown(todoHandle, {
      button: 0,
      buttons: 1,
      clientX: 30,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, {
      clientX: 40,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, {
      clientX: 760,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(document, {
      clientX: 760,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(moveColumnUrl).toBe('/api/v1/boards/board-1/columns/col-todo/move');
    });
    expect(moveColumnBody).toEqual({ position: 4000 });

    // Optimistic column order updated
    expect(getColumnOrder()).toEqual(['Em andamento', 'Concluído', 'A fazer']);

    // Reject API call -> rolls back to original order + shows error toast
    rejectColumnMove(new Error('500'));

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith('Erro ao reordenar coluna');
      expect(getColumnOrder()).toEqual([
        'A fazer',
        'Em andamento',
        'Concluído',
      ]);
    });

    rectSpy.mockRestore();
  });

  it('quickAddTaskAndNewColumnWorkCleanlyWithoutUnhandledRejections', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');
    const onSelectTask = vi.fn();
    const requests: { method: string; url: string; data: unknown }[] = [];

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';
      const data =
        typeof config.data === 'string' && config.data.length > 0
          ? JSON.parse(config.data)
          : config.data;
      requests.push({ method, url, data });

      if (method === 'post' && url === '/api/v1/boards/board-1/tasks') {
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: {
            id: 'task-99',
            boardId: 'board-1',
            columnId: (data as { columnId: string }).columnId,
            title: (data as { title: string }).title,
            description: null,
            priority: 'MEDIUM',
            dueDate: null,
            assigneeId: null,
            completed: false,
            completedAt: null,
            position: 2000,
            createdById: 'user-1',
            subtasks: [],
            tagIds: [],
            createdAt: '2026-11-25T12:00:00Z',
            updatedAt: '2026-11-25T12:00:00Z',
          },
        };
      }
      if (method === 'post' && url === '/api/v1/boards/board-1/columns') {
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: {
            id: 'col-review',
            boardId: 'board-1',
            name: (data as { name: string }).name,
            position: 4000,
            isDoneColumn: Boolean((data as { isDoneColumn?: boolean }).isDoneColumn),
            createdAt: '2026-11-25T12:00:00Z',
            updatedAt: '2026-11-25T12:00:00Z',
          },
        };
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    };

    renderKanbanView({ detail, canEdit: true, onSelectTask });

    // Click card opens TaskDrawer without firing a move request
    await user.click(screen.getByRole('button', { name: 'Corrigir login OAuth' }));
    expect(onSelectTask).toHaveBeenCalledWith('task-1');

    // Quick-add task in "Em andamento"
    const doingCol = screen.getByTestId('kanban-column-col-doing');
    await user.click(
      within(doingCol).getByRole('button', { name: /adicionar tarefa/i }),
    );
    await user.type(
      within(doingCol).getByLabelText(/nova tarefa em em andamento/i),
      'Revisar PR do Kanban',
    );
    await user.click(
      within(doingCol).getByRole('button', { name: /^adicionar$/i }),
    );

    await waitFor(() => {
      expect(requests).toContainEqual({
        method: 'post',
        url: '/api/v1/boards/board-1/tasks',
        data: { columnId: 'col-doing', title: 'Revisar PR do Kanban' },
      });
    });

    // Quick-add column at right edge
    await user.click(screen.getByRole('button', { name: /nova coluna/i }));
    await user.type(screen.getByLabelText(/nome da nova coluna/i), 'Em revisão');
    await user.click(screen.getByRole('button', { name: /criar coluna/i }));

    await waitFor(() => {
      expect(requests).toContainEqual({
        method: 'post',
        url: '/api/v1/boards/board-1/columns',
        data: { name: 'Em revisão', isDoneColumn: false },
      });
    });
  });

  it('renamingColumnViaMenuKeepsInputFocusedAndSubmitsPatch', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');
    const patchCalls: { url: string; data: unknown }[] = [];

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';
      const data =
        typeof config.data === 'string' && config.data.length > 0
          ? JSON.parse(config.data)
          : config.data;

      if (
        method === 'patch' &&
        url === '/api/v1/boards/board-1/columns/col-todo'
      ) {
        patchCalls.push({ url, data });
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            ...detail.columns[0],
            name: (data as { name?: string }).name ?? detail.columns[0].name,
          },
        };
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    };

    renderKanbanView({ detail, canEdit: true });

    await user.click(
      screen.getByRole('button', { name: /opções da coluna a fazer/i }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: /renomear coluna/i }),
    );

    const renameInput = await screen.findByLabelText(/renomear coluna a fazer/i);
    expect(renameInput).toHaveFocus();

    await user.clear(renameInput);
    await user.type(renameInput, 'Backlog{Enter}');

    await waitFor(() => {
      expect(patchCalls).toContainEqual({
        url: '/api/v1/boards/board-1/columns/col-todo',
        data: { name: 'Backlog' },
      });
    });
  });

  it('boardPageRendersKanbanViewWhenDefaultViewIsKanban', async () => {
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

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <MemoryRouter initialEntries={['/app/boards/board-1']}>
            <Routes>
              <Route path="/app/boards/:boardId" element={<BoardPage />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('kanban-column-col-todo')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('kanban-view-placeholder')).not.toBeInTheDocument();
  });
});
