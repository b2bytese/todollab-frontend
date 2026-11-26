import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { boardKeys, useBoardDetailQuery } from '@/features/boards/api';
import { BoardKanbanView } from '@/features/boards/BoardKanbanView';
import { BoardPage } from '@/features/boards/BoardPage';
import { KanbanCard } from '@/features/boards/KanbanCard';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { BoardDetail, BoardRole, TaskItem, TaskPriority, UserProfile } from '@/types/api';

const setActivatorNodeRefSpy = vi.fn();
let forcedTaskDraggingId: string | null = null;

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>();
  return {
    ...actual,
    useSortable: (args: Parameters<typeof actual.useSortable>[0]) => {
      const result = actual.useSortable(args);
      return {
        ...result,
        isDragging:
          forcedTaskDraggingId !== null && args.id === forcedTaskDraggingId
            ? true
            : result.isDragging,
        setActivatorNodeRef: (node: HTMLElement | null) => {
          setActivatorNodeRefSpy(args.id, node);
          result.setActivatorNodeRef(node);
        },
      };
    },
  };
});

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

function RealQueryBoardKanbanHarness({
  boardId,
  initialDetail,
  canEdit,
  onSelectTask,
}: {
  boardId: string;
  initialDetail: BoardDetail;
  canEdit: boolean;
  onSelectTask: (taskId: string) => void;
}) {
  const { data } = useBoardDetailQuery(boardId);
  const detail = data ?? initialDetail;

  return (
    <BoardKanbanView
      detail={detail}
      filteredTasks={detail.tasks}
      canEdit={canEdit}
      onSelectTask={onSelectTask}
    />
  );
}

function CacheOnlyBoardKanbanHarness({
  boardId,
  initialDetail,
  canEdit,
  onSelectTask,
}: {
  boardId: string;
  initialDetail: BoardDetail;
  canEdit: boolean;
  onSelectTask: (taskId: string) => void;
}) {
  const { data } = useQuery<BoardDetail>({
    queryKey: boardKeys.detail(boardId),
    queryFn: () => initialDetail,
    enabled: false,
  });
  const detail = data ?? initialDetail;

  return (
    <BoardKanbanView
      detail={detail}
      filteredTasks={detail.tasks}
      canEdit={canEdit}
      onSelectTask={onSelectTask}
    />
  );
}

function ReactiveBoardKanbanHarness({
  boardId,
  initialDetail,
  canEdit,
  onSelectTask,
  useRealQuery = false,
}: {
  boardId: string;
  initialDetail: BoardDetail;
  canEdit: boolean;
  onSelectTask: (taskId: string) => void;
  useRealQuery?: boolean;
}) {
  if (useRealQuery) {
    return (
      <RealQueryBoardKanbanHarness
        boardId={boardId}
        initialDetail={initialDetail}
        canEdit={canEdit}
        onSelectTask={onSelectTask}
      />
    );
  }
  return (
    <CacheOnlyBoardKanbanHarness
      boardId={boardId}
      initialDetail={initialDetail}
      canEdit={canEdit}
      onSelectTask={onSelectTask}
    />
  );
}

function renderKanbanView({
  detail = createBoardDetail('OWNER'),
  canEdit = true,
  onSelectTask = vi.fn(),
  useRealQuery = false,
}: {
  detail?: BoardDetail;
  canEdit?: boolean;
  onSelectTask?: (taskId: string) => void;
  useRealQuery?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        ...(useRealQuery ? { staleTime: 60_000 } : {}),
      },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(boardKeys.detail(detail.board.id), detail);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <ReactiveBoardKanbanHarness
          boardId={detail.board.id}
          initialDetail={detail}
          canEdit={canEdit}
          onSelectTask={onSelectTask}
          useRealQuery={useRealQuery}
        />
      </ThemeProvider>
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
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
    setActivatorNodeRefSpy.mockClear();
    forcedTaskDraggingId = null;
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

  it('twoRapidTaskMovesOutOfOrderResponseKeepsLatestColumnAndDefersInvalidation', async () => {
    const detail = createBoardDetail('OWNER');
    let serverDetail = structuredClone(detail);
    const pendingGets: Array<() => void> = [];

    const pendingMoves: {
      targetColumnId: string;
      position: number;
      resolve: (task: TaskItem) => void;
    }[] = [];

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';

      if (method === 'get' && url === '/api/v1/boards/board-1') {
        return new Promise((resolve) => {
          pendingGets.push(() => {
            resolve({
              status: 200,
              statusText: 'OK',
              headers: new AxiosHeaders(),
              config,
              data: serverDetail,
            });
          });
        });
      }

      if (
        method === 'patch' &&
        url === '/api/v1/boards/board-1/tasks/task-1/move'
      ) {
        const body = (
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
        ) as { targetColumnId: string; position: number };

        return new Promise((resolve) => {
          pendingMoves.push({
            targetColumnId: body.targetColumnId,
            position: body.position,
            resolve: (movedTask) => {
              resolve({
                status: 200,
                statusText: 'OK',
                headers: new AxiosHeaders(),
                config,
                data: {
                  task: movedTask,
                  rebalanced: false,
                  columnPositions: [
                    { id: movedTask.id, position: movedTask.position },
                  ],
                },
              });
            },
          });
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
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
        if (testId === 'kanban-card-task-1') {
          const inDoing = Boolean(
            this.closest('[data-testid="kanban-column-col-doing"]'),
          );
          return inDoing
            ? new DOMRect(330, 60, 280, 80)
            : new DOMRect(10, 60, 280, 80);
        }
        if (testId === 'kanban-card-task-2') {
          return new DOMRect(650, 60, 280, 80);
        }
        return new DOMRect(0, 0, 0, 0);
      });

    const { queryClient } = renderKanbanView({
      detail,
      canEdit: true,
      useRealQuery: true,
    });

    // 1st move: col-todo -> col-doing
    const task1Initial = screen.getByTestId('kanban-card-task-1');
    fireEvent.pointerDown(task1Initial, {
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
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(document, {
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(pendingMoves).toHaveLength(1);
    });
    expect(pendingMoves[0].targetColumnId).toBe('col-doing');
    expect(
      within(screen.getByTestId('kanban-column-col-doing')).getByTestId(
        'kanban-card-task-1',
      ),
    ).toBeInTheDocument();

    // 2nd move before 1st resolves: col-doing -> col-done
    const task1InDoing = screen.getByTestId('kanban-card-task-1');
    fireEvent.pointerDown(task1InDoing, {
      button: 0,
      buttons: 1,
      clientX: 350,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, {
      clientX: 360,
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
      expect(pendingMoves).toHaveLength(2);
    });
    expect(pendingMoves[1].targetColumnId).toBe('col-done');
    expect(
      within(screen.getByTestId('kanban-column-col-done')).getByTestId(
        'kanban-card-task-1',
      ),
    ).toBeInTheDocument();

    const baseTask1 = detail.tasks[0];
    const doneTask1: TaskItem = {
      ...baseTask1,
      columnId: 'col-done',
      position: pendingMoves[1].position,
      completed: true,
      completedAt: '2026-11-26T12:00:00Z',
    };
    const staleDoingTask1: TaskItem = {
      ...baseTask1,
      columnId: 'col-doing',
      position: pendingMoves[0].position,
      completed: false,
      completedAt: null,
    };

    // Server final state reflects latest move (col-done)
    serverDetail = {
      ...serverDetail,
      tasks: serverDetail.tasks.map((t) => (t.id === 'task-1' ? doneTask1 : t)),
    };

    // Resolve 2nd request FIRST
    await act(async () => {
      pendingMoves[1].resolve(doneTask1);
      await Promise.resolve();
    });

    // Should still be in col-done and NOT trigger refetch while 1st request is in flight
    expect(
      within(screen.getByTestId('kanban-column-col-done')).getByTestId(
        'kanban-card-task-1',
      ),
    ).toBeInTheDocument();
    expect(pendingGets).toHaveLength(0);

    // Resolve 1st (stale) request SECOND, while GET refetch remains deferred
    await act(async () => {
      pendingMoves[0].resolve(staleDoingTask1);
      await Promise.resolve();
    });

    // Invalidation is queued now that all moves settled, but GET has NOT resolved yet
    await waitFor(() => {
      expect(pendingGets).toHaveLength(1);
    });
    // Cache and DOM must STILL hold col-done (never reverted by stale onSuccess) BEFORE GET resolves
    expect(
      queryClient
        .getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.tasks.find((t) => t.id === 'task-1')?.columnId,
    ).toBe('col-done');
    expect(
      within(screen.getByTestId('kanban-column-col-done')).getByTestId(
        'kanban-card-task-1',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('kanban-column-col-doing')).queryByTestId(
        'kanban-card-task-1',
      ),
    ).not.toBeInTheDocument();

    // Now resolve the deferred GET
    await act(async () => {
      pendingGets[0]();
      await Promise.resolve();
    });
    expect(
      within(screen.getByTestId('kanban-column-col-done')).getByTestId(
        'kanban-card-task-1',
      ),
    ).toBeInTheDocument();

    rectSpy.mockRestore();
  });

  it('dragOverUpdatesVerticalPreviewIndexWithinTargetColumn', async () => {
    const baseDetail = createBoardDetail('OWNER');
    const taskA: TaskItem = {
      ...baseDetail.tasks[0],
      id: 'task-a',
      columnId: 'col-doing',
      title: 'Card A',
      position: 1000,
    };
    const taskB: TaskItem = {
      ...baseDetail.tasks[0],
      id: 'task-b',
      columnId: 'col-doing',
      title: 'Card B',
      position: 2000,
    };
    const detail: BoardDetail = {
      ...baseDetail,
      tasks: [...baseDetail.tasks, taskA, taskB],
    };

    const moveCalls: { targetColumnId: string; position: number }[] = [];
    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/boards/board-1/tasks/task-1/move'
      ) {
        const body = (
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
        ) as { targetColumnId: string; position: number };
        moveCalls.push(body);
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            task: {
              ...baseDetail.tasks[0],
              columnId: body.targetColumnId,
              position: body.position,
            },
            rebalanced: false,
            columnPositions: [{ id: 'task-1', position: body.position }],
          },
        };
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
        if (testId === 'kanban-card-task-a') {
          return new DOMRect(330, 60, 280, 80);
        }
        if (testId === 'kanban-card-task-b') {
          return new DOMRect(330, 160, 280, 80);
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
        if (this.className.includes('w-72')) {
          return new DOMRect(10, 60, 280, 80);
        }
        return new DOMRect(0, 0, 0, 0);
      });

    renderKanbanView({ detail, canEdit: true });

    const getDoingOrder = () =>
      within(screen.getByTestId('kanban-column-col-doing'))
        .getAllByTestId(/^kanban-card-task-/)
        .map((el) => el.getAttribute('data-testid'));

    expect(getDoingOrder()).toEqual(['kanban-card-task-a', 'kanban-card-task-b']);

    const task1Card = screen.getByTestId('kanban-card-task-1');
    fireEvent.pointerDown(task1Card, {
      button: 0,
      buttons: 1,
      clientX: 150,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, {
      clientX: 160,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    // Move onto top half of Card A in col-doing -> preview at index 0
    fireEvent.pointerMove(document, {
      clientX: 400,
      clientY: 75,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(getDoingOrder()).toEqual([
      'kanban-card-task-1',
      'kanban-card-task-a',
      'kanban-card-task-b',
    ]);

    // Move vertically down over bottom half of Card B in col-doing -> preview index updates to 2
    fireEvent.pointerMove(document, {
      clientX: 400,
      clientY: 225,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(getDoingOrder()).toEqual([
      'kanban-card-task-a',
      'kanban-card-task-b',
      'kanban-card-task-1',
    ]);

    // Move vertically up over bottom half of Card A -> preview index updates to 1 (between A and B)
    fireEvent.pointerMove(document, {
      clientX: 400,
      clientY: 125,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(getDoingOrder()).toEqual([
      'kanban-card-task-a',
      'kanban-card-task-1',
      'kanban-card-task-b',
    ]);

    fireEvent.pointerUp(document, {
      clientX: 400,
      clientY: 125,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(moveCalls).toHaveLength(1);
    });
    expect(moveCalls[0]).toEqual({
      targetColumnId: 'col-doing',
      position: 1500,
    });

    rectSpy.mockRestore();
  });

  it('moveColumnMutationUpdatesCacheOptimisticallyAndRollsBackOnError', async () => {
    const detail = createBoardDetail('OWNER');
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    let rejectColumnMove!: (err: unknown) => void;
    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/boards/board-1/columns/col-todo/move'
      ) {
        return new Promise((_resolve, reject) => {
          rejectColumnMove = () =>
            reject(
              makeAxiosError(500, config, {
                status: 500,
                detail: 'Falha ao mover coluna',
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

    const { queryClient } = renderKanbanView({ detail, canEdit: true });

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

    // React Query cache itself must be updated optimistically
    await waitFor(() => {
      const cached = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail('board-1'),
      );
      expect(cached?.columns.map((c) => c.id)).toEqual([
        'col-doing',
        'col-done',
        'col-todo',
      ]);
    });

    // Reject -> React Query cache rolls back cleanly
    rejectColumnMove(new Error('500'));

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith('Falha ao mover coluna');
      const cached = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail('board-1'),
      );
      expect(cached?.columns.map((c) => c.id)).toEqual([
        'col-todo',
        'col-doing',
        'col-done',
      ]);
    });

    rectSpy.mockRestore();
  });

  it('kanbanCardHandlesUnknownPriorityAttachesActivatorRefAndIgnoresPostDragClick', async () => {
    const user = userEvent.setup();
    const detail = createBoardDetail('OWNER');
    const taskWithUnknownPriority: TaskItem = {
      ...detail.tasks[0],
      priority: 'CRITICAL' as TaskPriority,
    };
    const onSelectTask = vi.fn();

    function SingleCardHarness() {
      const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
      );
      return (
        <DndContext sensors={sensors}>
          <SortableContext
            items={[`task:${taskWithUnknownPriority.id}`]}
            strategy={verticalListSortingStrategy}
          >
            <KanbanCard
              task={taskWithUnknownPriority}
              tagsById={new Map(detail.tags.map((t) => [t.id, t]))}
              membersByUserId={new Map(detail.members.map((m) => [m.userId, m]))}
              canEdit={true}
              onSelectTask={onSelectTask}
            />
          </SortableContext>
        </DndContext>
      );
    }

    render(<SingleCardHarness />);

    // Unknown priority safely falls back instead of throwing TypeError
    const card = screen.getByTestId('kanban-card-task-1');
    expect(within(card).getByText('CRITICAL')).toBeInTheDocument();

    // setActivatorNodeRef is wired to the drag handle button
    const dragHandle = screen.getByRole('button', {
      name: /arrastar tarefa corrigir login oauth/i,
    });
    expect(setActivatorNodeRefSpy).toHaveBeenCalledWith('task:task-1', dragHandle);

    // Drag > 6px and release -> synthetic click right after pointerUp must be ignored
    fireEvent.pointerDown(card, {
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, {
      clientX: 70,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(document, {
      clientX: 70,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    });

    // Immediate synthetic clicks on both card container and title button must not trigger selection
    fireEvent.click(card);
    fireEvent.click(within(card).getByRole('button', { name: 'Corrigir login OAuth' }));
    expect(onSelectTask).not.toHaveBeenCalled();

    // After @dnd-kit's 50ms click-suppression window and KanbanCard tick, normal click opens the task
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    await user.click(
      within(card).getByRole('button', { name: 'Corrigir login OAuth' }),
    );
    expect(onSelectTask).toHaveBeenCalledTimes(1);
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
  });

  it('kanbanCardWasDraggingRefBlocksImmediateSyntheticClickAfterIsDraggingEnds', async () => {
    const detail = createBoardDetail('OWNER');
    const task = detail.tasks[0];
    const onSelectTask = vi.fn();

    function ControlledCardHarness() {
      const sensors = useSensors();
      return (
        <DndContext sensors={sensors}>
          <SortableContext
            items={[`task:${task.id}`]}
            strategy={verticalListSortingStrategy}
          >
            <KanbanCard
              task={task}
              tagsById={new Map(detail.tags.map((t) => [t.id, t]))}
              membersByUserId={new Map(detail.members.map((m) => [m.userId, m]))}
              canEdit={true}
              onSelectTask={onSelectTask}
            />
          </SortableContext>
        </DndContext>
      );
    }

    forcedTaskDraggingId = 'task:task-1';
    const { rerender } = render(<ControlledCardHarness />);

    forcedTaskDraggingId = null;
    rerender(<ControlledCardHarness />);

    const card = screen.getByTestId('kanban-card-task-1');
    const titleButton = within(card).getByRole('button', {
      name: 'Corrigir login OAuth',
    });

    // Immediately after isDragging flips false, both card and title clicks are ignored
    fireEvent.click(card);
    fireEvent.click(titleButton);
    expect(onSelectTask).not.toHaveBeenCalled();

    // After next tick (setTimeout 0), normal click works again
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(titleButton);
    expect(onSelectTask).toHaveBeenCalledTimes(1);
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
  });

  it('twoRapidColumnMovesOutOfOrderResponseKeepsLatestOrderAndDefersInvalidation', async () => {
    const detail = createBoardDetail('OWNER');
    const pendingColumnMoves: {
      columnId: string;
      position: number;
      resolve: (columns: BoardDetail['columns']) => void;
    }[] = [];
    const pendingGets: Array<() => void> = [];

    const latestOrderCols: BoardDetail['columns'] = [
      { ...detail.columns[1], position: 2000 },
      { ...detail.columns[2], position: 3000 },
      { ...detail.columns[0], position: 4000 },
    ];
    // Suppose 2nd move moves col-doing to the end (pos 5000) -> [col-done, col-todo, col-doing]
    const finalOrderCols: BoardDetail['columns'] = [
      { ...detail.columns[2], position: 3000 },
      { ...detail.columns[0], position: 4000 },
      { ...detail.columns[1], position: 5000 },
    ];
    const serverDetail: BoardDetail = { ...detail, columns: finalOrderCols };

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';

      if (method === 'get' && url === '/api/v1/boards/board-1') {
        return new Promise((resolve) => {
          pendingGets.push(() => {
            resolve({
              status: 200,
              statusText: 'OK',
              headers: new AxiosHeaders(),
              config,
              data: serverDetail,
            });
          });
        });
      }

      const match = url.match(/^\/api\/v1\/boards\/board-1\/columns\/([^/]+)\/move$/);
      if (method === 'patch' && match) {
        const body = (
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
        ) as { position: number };

        return new Promise((resolve) => {
          pendingColumnMoves.push({
            columnId: match[1],
            position: body.position,
            resolve: (columns) => {
              resolve({
                status: 200,
                statusText: 'OK',
                headers: new AxiosHeaders(),
                config,
                data: columns,
              });
            },
          });
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    };

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const testId = this.getAttribute('data-testid');
        const colIds = ['col-todo', 'col-doing', 'col-done'];
        for (const id of colIds) {
          if (testId === `kanban-column-${id}`) {
            const cols = Array.from(
              document.querySelectorAll('[data-testid^="kanban-column-col-"]'),
            );
            const idx = cols.indexOf(this);
            return new DOMRect(Math.max(0, idx) * 320, 0, 300, 500);
          }
        }
        return new DOMRect(0, 0, 0, 0);
      });

    const { queryClient } = renderKanbanView({
      detail,
      canEdit: true,
      useRealQuery: true,
    });

    // Move 1: col-todo to end (col-done) -> [col-doing, col-done, col-todo]
    const todoHandle = screen.getByRole('button', { name: /mover coluna a fazer/i });
    fireEvent.pointerDown(todoHandle, {
      button: 0,
      buttons: 1,
      clientX: 30,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { clientX: 40, clientY: 20, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(document, { clientX: 760, clientY: 20, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(document, { clientX: 760, clientY: 20, pointerId: 1, pointerType: 'mouse' });

    await waitFor(() => {
      expect(pendingColumnMoves).toHaveLength(1);
    });

    // Move 2 before Move 1 resolves: col-doing (now at x=0) to end (x=760) -> [col-done, col-todo, col-doing]
    const doingHandle = screen.getByRole('button', { name: /mover coluna em andamento/i });
    fireEvent.pointerDown(doingHandle, {
      button: 0,
      buttons: 1,
      clientX: 30,
      clientY: 20,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { clientX: 40, clientY: 20, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(document, { clientX: 760, clientY: 20, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(document, { clientX: 760, clientY: 20, pointerId: 1, pointerType: 'mouse' });

    await waitFor(() => {
      expect(pendingColumnMoves).toHaveLength(2);
    });

    // Resolve 2nd move FIRST
    await act(async () => {
      pendingColumnMoves[1].resolve(finalOrderCols);
      await Promise.resolve();
    });
    expect(
      queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'))?.columns.map((c) => c.id),
    ).toEqual(['col-done', 'col-todo', 'col-doing']);
    expect(pendingGets).toHaveLength(0);

    // Resolve 1st (stale) move SECOND, while GET refetch remains deferred
    await act(async () => {
      pendingColumnMoves[0].resolve(latestOrderCols);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(pendingGets).toHaveLength(1);
    });
    // Cache and DOM must STILL hold [col-done, col-todo, col-doing] BEFORE GET resolves
    expect(
      queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'))?.columns.map((c) => c.id),
    ).toEqual(['col-done', 'col-todo', 'col-doing']);
    expect(
      screen.getAllByRole('region').map((el) => el.getAttribute('aria-label')),
    ).toEqual(['Concluído', 'A fazer', 'Em andamento']);

    // Resolve deferred GET
    await act(async () => {
      pendingGets[0]();
      await Promise.resolve();
    });

    rectSpy.mockRestore();
  });

  it('staleFailedTaskMoveDoesNotRollBackNewerTaskMove', async () => {
    const detail = createBoardDetail('OWNER');
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');
    const pendingGets: Array<() => void> = [];
    const pendingMoves: {
      position: number;
      resolve: (task: TaskItem) => void;
      reject: (detailMsg: string) => void;
    }[] = [];

    const doneTask1: TaskItem = {
      ...detail.tasks[0],
      columnId: 'col-done',
      position: 2000,
      completed: true,
      completedAt: '2026-11-26T12:00:00Z',
    };
    const serverDetail: BoardDetail = {
      ...detail,
      tasks: detail.tasks.map((t) => (t.id === 'task-1' ? doneTask1 : t)),
    };

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';

      if (method === 'get' && url === '/api/v1/boards/board-1') {
        return new Promise((resolve) => {
          pendingGets.push(() => {
            resolve({
              status: 200,
              statusText: 'OK',
              headers: new AxiosHeaders(),
              config,
              data: serverDetail,
            });
          });
        });
      }

      if (
        method === 'patch' &&
        url === '/api/v1/boards/board-1/tasks/task-1/move'
      ) {
        const body = (
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
        ) as { targetColumnId: string; position: number };

        return new Promise((resolve, reject) => {
          pendingMoves.push({
            position: body.position,
            resolve: (movedTask) => {
              resolve({
                status: 200,
                statusText: 'OK',
                headers: new AxiosHeaders(),
                config,
                data: {
                  task: movedTask,
                  rebalanced: false,
                  columnPositions: [
                    { id: movedTask.id, position: movedTask.position },
                  ],
                },
              });
            },
            reject: (detailMsg) => {
              reject(makeAxiosError(500, config, { status: 500, detail: detailMsg }));
            },
          });
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
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
        if (testId === 'kanban-card-task-1') {
          const inDoing = Boolean(
            this.closest('[data-testid="kanban-column-col-doing"]'),
          );
          return inDoing
            ? new DOMRect(330, 60, 280, 80)
            : new DOMRect(10, 60, 280, 80);
        }
        if (testId === 'kanban-card-task-2') {
          return new DOMRect(650, 60, 280, 80);
        }
        return new DOMRect(0, 0, 0, 0);
      });

    const { queryClient } = renderKanbanView({
      detail,
      canEdit: true,
      useRealQuery: true,
    });

    // Move 1: col-todo -> col-doing
    fireEvent.pointerDown(screen.getByTestId('kanban-card-task-1'), {
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 100, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 300, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 300, pointerId: 1, pointerType: 'mouse' });

    await waitFor(() => {
      expect(pendingMoves).toHaveLength(1);
    });

    // Move 2: col-doing -> col-done
    fireEvent.pointerDown(screen.getByTestId('kanban-card-task-1'), {
      button: 0,
      buttons: 1,
      clientX: 350,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { clientX: 360, clientY: 100, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(document, { clientX: 700, clientY: 300, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(document, { clientX: 700, clientY: 300, pointerId: 1, pointerType: 'mouse' });

    await waitFor(() => {
      expect(pendingMoves).toHaveLength(2);
    });

    // Move 2 succeeds FIRST
    await act(async () => {
      pendingMoves[1].resolve({ ...doneTask1, position: pendingMoves[1].position });
      await Promise.resolve();
    });
    expect(pendingGets).toHaveLength(0);

    // Move 1 fails SECOND -> must NOT roll back Move 2 in cache/DOM before GET resolves
    await act(async () => {
      pendingMoves[0].reject('Falha na primeira movimentação');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith('Falha na primeira movimentação');
      expect(pendingGets).toHaveLength(1);
    });
    expect(
      queryClient
        .getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.tasks.find((t) => t.id === 'task-1')?.columnId,
    ).toBe('col-done');
    expect(
      within(screen.getByTestId('kanban-column-col-done')).getByTestId(
        'kanban-card-task-1',
      ),
    ).toBeInTheDocument();

    await act(async () => {
      pendingGets[0]();
      await Promise.resolve();
    });

    rectSpy.mockRestore();
  });

  it('concurrentDifferentTaskMovesRollbackOnlyFailedTaskWithoutClobberingSucceededTask', async () => {
    const baseDetail = createBoardDetail('OWNER');
    const taskB: TaskItem = {
      ...baseDetail.tasks[0],
      id: 'task-b',
      columnId: 'col-todo',
      title: 'Tarefa B concorrente',
      position: 2000,
    };
    const detail: BoardDetail = {
      ...baseDetail,
      tasks: [...baseDetail.tasks, taskB],
    };

    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');
    const pendingGets: Array<() => void> = [];
    const pendingByTaskId = new Map<
      string,
      {
        position: number;
        resolve: (movedTask: TaskItem) => void;
        reject: (msg: string) => void;
      }
    >();

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';

      if (method === 'get' && url === '/api/v1/boards/board-1') {
        return new Promise((resolve) => {
          pendingGets.push(() => {
            resolve({
              status: 200,
              statusText: 'OK',
              headers: new AxiosHeaders(),
              config,
              data: detail,
            });
          });
        });
      }

      const match = url.match(/^\/api\/v1\/boards\/board-1\/tasks\/([^/]+)\/move$/);
      if (method === 'patch' && match) {
        const body = (
          typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
        ) as { targetColumnId: string; position: number };

        return new Promise((resolve, reject) => {
          pendingByTaskId.set(match[1], {
            position: body.position,
            resolve: (movedTask) => {
              resolve({
                status: 200,
                statusText: 'OK',
                headers: new AxiosHeaders(),
                config,
                data: {
                  task: movedTask,
                  rebalanced: false,
                  columnPositions: [
                    { id: movedTask.id, position: movedTask.position },
                  ],
                },
              });
            },
            reject: (msg) => {
              reject(makeAxiosError(500, config, { status: 500, detail: msg }));
            },
          });
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
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
        if (testId === 'kanban-card-task-b') {
          return new DOMRect(10, 160, 280, 80);
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

    const { queryClient } = renderKanbanView({
      detail,
      canEdit: true,
      useRealQuery: true,
    });

    // Move task-1 -> col-doing
    fireEvent.pointerDown(screen.getByTestId('kanban-card-task-1'), {
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 100, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 300, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 300, pointerId: 1, pointerType: 'mouse' });

    await waitFor(() => {
      expect(pendingByTaskId.has('task-1')).toBe(true);
    });

    // Concurrently move task-b -> col-done
    fireEvent.pointerDown(screen.getByTestId('kanban-card-task-b'), {
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 200,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 200, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(document, { clientX: 700, clientY: 300, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(document, { clientX: 700, clientY: 300, pointerId: 1, pointerType: 'mouse' });

    await waitFor(() => {
      expect(pendingByTaskId.has('task-b')).toBe(true);
    });

    // task-b succeeds FIRST -> moved to col-done
    const taskBMoved: TaskItem = {
      ...taskB,
      columnId: 'col-done',
      position: pendingByTaskId.get('task-b')!.position,
      completed: true,
      completedAt: '2026-11-26T12:00:00Z',
    };
    await act(async () => {
      pendingByTaskId.get('task-b')!.resolve(taskBMoved);
      await Promise.resolve();
    });
    expect(pendingGets).toHaveLength(0);

    // task-1 fails SECOND -> must restore ONLY task-1 to col-todo without clobbering task-b in col-done (BEFORE GET resolves)
    await act(async () => {
      pendingByTaskId.get('task-1')!.reject('Falha em task-1');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith('Falha em task-1');
      expect(pendingGets).toHaveLength(1);
    });

    const cachedTasks = queryClient.getQueryData<BoardDetail>(
      boardKeys.detail('board-1'),
    )?.tasks;
    expect(cachedTasks?.find((t) => t.id === 'task-1')?.columnId).toBe('col-todo');
    expect(cachedTasks?.find((t) => t.id === 'task-b')?.columnId).toBe('col-done');
    expect(
      within(screen.getByTestId('kanban-column-col-todo')).getByTestId(
        'kanban-card-task-1',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('kanban-column-col-done')).getByTestId(
        'kanban-card-task-b',
      ),
    ).toBeInTheDocument();

    await act(async () => {
      pendingGets[0]();
      await Promise.resolve();
    });

    rectSpy.mockRestore();
  });
});
