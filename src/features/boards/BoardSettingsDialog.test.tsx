import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { BoardSettingsDialog } from '@/features/boards/BoardSettingsDialog';
import { api } from '@/lib/api';
import type { BoardDetail, BoardRole } from '@/types/api';

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
        id: 'col-empty',
        boardId: 'board-1',
        name: 'Vazia',
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
    tags: [],
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
    ],
    tasks: [
      {
        id: 'task-1',
        boardId: 'board-1',
        columnId: 'col-todo',
        title: 'Tarefa 1',
        description: null,
        priority: 'MEDIUM',
        dueDate: null,
        assigneeId: null,
        completed: false,
        completedAt: null,
        position: 1000,
        createdById: 'user-1',
        subtasks: [],
        tagIds: [],
        createdAt: '2026-11-25T10:00:00Z',
        updatedAt: '2026-11-25T10:00:00Z',
      },
    ],
  };
}

function renderSettingsDialog({
  open = true,
  onOpenChange = vi.fn(),
  detail = createBoardDetail('OWNER'),
  canEdit = true,
  isOwner = true,
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  detail?: BoardDetail;
  canEdit?: boolean;
  isOwner?: boolean;
  queryClient?: QueryClient;
} = {}) {
  const ui = (
    nextProps: {
      open?: boolean;
      detail?: BoardDetail;
      canEdit?: boolean;
      isOwner?: boolean;
    } = {},
  ) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={['/app/boards/board-1']}>
          <Routes>
            <Route
              path="/app/boards/:boardId"
              element={
                <BoardSettingsDialog
                  open={nextProps.open ?? open}
                  onOpenChange={onOpenChange}
                  detail={nextProps.detail ?? detail}
                  canEdit={nextProps.canEdit ?? canEdit}
                  isOwner={nextProps.isOwner ?? isOwner}
                />
              }
            />
            <Route path="/app/my-tasks" element={<div>Minhas Tarefas</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );

  const result = render(ui());
  return {
    ...result,
    queryClient,
    rerenderDialog: (nextProps: {
      open?: boolean;
      detail?: BoardDetail;
      canEdit?: boolean;
      isOwner?: boolean;
    }) => result.rerender(ui(nextProps)),
  };
}

describe('BoardSettingsDialog', () => {
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
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it('preservesDraftBoardNameWhenDetailUpdatesWhileOpenAndEnforcesMaxLength80', async () => {
    const user = userEvent.setup();
    const initialDetail = createBoardDetail('OWNER');
    const { rerenderDialog } = renderSettingsDialog({ detail: initialDetail });

    const nameInput = screen.getByLabelText(/nome do quadro/i);
    expect(nameInput).toHaveAttribute('maxLength', '80');

    await user.clear(nameInput);
    await user.type(nameInput, 'Meu Rascunho Local');

    const updatedDetail: BoardDetail = {
      ...initialDetail,
      board: {
        ...initialDetail.board,
        name: 'Nome Atualizado Remotamente',
        updatedAt: '2026-11-26T12:00:00Z',
      },
      columns: [
        ...initialDetail.columns,
        {
          id: 'col-extra',
          boardId: 'board-1',
          name: 'Nova coluna remota',
          position: 4000,
          isDoneColumn: false,
          createdAt: '2026-11-26T12:00:00Z',
          updatedAt: '2026-11-26T12:00:00Z',
        },
      ],
    };

    rerenderDialog({ detail: updatedDetail });

    expect(screen.getByLabelText(/nome do quadro/i)).toHaveValue(
      'Meu Rascunho Local',
    );
  });

  it('resetsActiveTabFromGeneralToColumnsWhenIsOwnerChangesToFalse', () => {
    const ownerDetail = createBoardDetail('OWNER');
    const { rerenderDialog } = renderSettingsDialog({
      detail: ownerDetail,
      canEdit: true,
      isOwner: true,
    });

    const generalTab = screen.getByRole('tab', { name: /geral/i });
    const columnsTab = screen.getByRole('tab', { name: /colunas/i });
    expect(generalTab).toHaveAttribute('aria-selected', 'true');
    expect(columnsTab).toHaveAttribute('aria-selected', 'false');

    rerenderDialog({
      detail: { ...ownerDetail, myRole: 'EDITOR' },
      canEdit: true,
      isOwner: false,
    });

    expect(screen.getByRole('tab', { name: /geral/i })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /colunas/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByLabelText(/nome da coluna a fazer/i),
    ).toBeInTheDocument();
  });

  it('requiresConfirmationBeforeDeletingEmptyColumnAndShowsToastOnConfirm', async () => {
    const user = userEvent.setup();
    const toastSuccessSpy = vi
      .spyOn(toast, 'success')
      .mockImplementation(() => '');
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
          data: null,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderSettingsDialog();

    await user.click(screen.getByRole('tab', { name: /colunas/i }));
    await user.click(
      screen.getByRole('button', { name: /excluir coluna vazia/i }),
    );

    expect(deleteCalls).toHaveLength(0);
    const confirmDialog = await screen.findByRole('dialog', {
      name: /excluir coluna\?/i,
    });
    expect(
      within(confirmDialog).getByText(/tem certeza que deseja excluir a coluna "vazia"/i),
    ).toBeInTheDocument();

    await user.click(
      within(confirmDialog).getByRole('button', { name: /excluir coluna/i }),
    );

    await waitFor(() => {
      expect(deleteCalls).toHaveLength(1);
    });
    expect(deleteCalls[0]).toEqual({
      url: '/api/v1/boards/board-1/columns/col-empty',
      params: {},
    });
    expect(toastSuccessSpy).toHaveBeenCalledWith('Coluna removida.');
  });

  it('restoresOriginalColumnNameWhenClearedAndBlurred', async () => {
    const user = userEvent.setup();
    const patchCalls: string[] = [];

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'patch') {
        patchCalls.push(config.url ?? '');
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderSettingsDialog();

    await user.click(screen.getByRole('tab', { name: /colunas/i }));
    const colInput = screen.getByLabelText(/nome da coluna a fazer/i);
    await user.clear(colInput);
    expect(colInput).toHaveValue('');

    await user.tab();

    expect(colInput).toHaveValue('A fazer');
    expect(patchCalls).toHaveLength(0);
  });

  it('usesColumnDeleteDialogForColumnWithTasksAndCalculateDropPositionForNonPositivePositions', async () => {
    const user = userEvent.setup();
    const toastSuccessSpy = vi
      .spyOn(toast, 'success')
      .mockImplementation(() => '');
    const detail = createBoardDetail('OWNER');
    detail.columns[0].position = 0;

    const requests: {
      method: string;
      url: string;
      params?: Record<string, unknown>;
      data?: unknown;
    }[] = [];

    api.defaults.adapter = async (config) => {
      const method = config.method?.toLowerCase() ?? 'get';
      const url = config.url ?? '';
      const data =
        typeof config.data === 'string' && config.data.length > 0
          ? JSON.parse(config.data)
          : config.data;
      requests.push({
        method,
        url,
        params: config.params as Record<string, unknown> | undefined,
        data,
      });

      if (method === 'patch' && url.endsWith('/move')) {
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: detail.columns,
        };
      }
      if (method === 'delete') {
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

    renderSettingsDialog({ detail });

    await user.click(screen.getByRole('tab', { name: /colunas/i }));

    // Moving "Vazia" (index 1) up past "A fazer" (position 0) must use position -1000
    await user.click(
      screen.getByRole('button', { name: /mover vazia para cima/i }),
    );

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'patch' &&
            r.url === '/api/v1/boards/board-1/columns/col-empty/move' &&
            (r.data as { position: number }).position === -1000,
        ),
      ).toBe(true);
    });

    // Deleting "A fazer" (has task-1) opens ColumnDeleteDialog with radio strategy
    await user.click(
      screen.getByRole('button', { name: /excluir coluna a fazer/i }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: /excluir coluna com tarefas/i,
    });
    expect(
      within(dialog).getByRole('radio', {
        name: /mover tarefas para outra coluna/i,
      }),
    ).toBeChecked();

    await user.click(
      within(dialog).getByRole('radio', {
        name: /excluir todas as tarefas da coluna/i,
      }),
    );
    await user.click(
      within(dialog).getByRole('button', { name: /excluir coluna/i }),
    );

    await waitFor(() => {
      expect(
        requests.some(
          (r) =>
            r.method === 'delete' &&
            r.url === '/api/v1/boards/board-1/columns/col-todo' &&
            r.params?.deleteTasks === true,
        ),
      ).toBe(true);
    });
    expect(toastSuccessSpy).toHaveBeenCalledWith('Coluna removida.');
  });
});
