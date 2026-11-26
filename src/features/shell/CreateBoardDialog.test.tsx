import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateBoardDialog } from '@/features/shell/CreateBoardDialog';
import { api } from '@/lib/api';
import type { BoardDetail } from '@/types/api';

function BoardDestination() {
  const { boardId } = useParams();
  return <div data-testid="board-destination">Board {boardId}</div>;
}

function renderCreateBoardDialog(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    onOpenChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/my-tasks']}>
          <Routes>
            <Route
              path="/app/my-tasks"
              element={<CreateBoardDialog open onOpenChange={onOpenChange} />}
            />
            <Route path="/app/boards/:boardId" element={<BoardDestination />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('CreateBoardDialog', () => {
  let originalAdapter: AxiosAdapter | typeof api.defaults.adapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('showsAccessibleValidationErrorWithAriaAttributesWhenNameIsEmpty', async () => {
    const user = userEvent.setup();
    renderCreateBoardDialog();

    const nameInput = screen.getByLabelText(/nome do quadro/i);
    await user.click(screen.getByRole('button', { name: /criar quadro/i }));

    const errorMessage = await screen.findByText(/informe o nome do quadro/i);
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute('id');

    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', errorMessage.id);
  });

  it('createsBoardAndNavigatesToNewBoardRouteOnSuccess', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    let capturedPayload: unknown = null;

    const createdBoard: BoardDetail = {
      board: {
        id: 'board-new-1',
        name: 'Roadmap Q1',
        description: 'Metas do primeiro trimestre',
        color: '#0C2439',
        icon: 'kanban',
        defaultView: 'KANBAN',
        ownerId: 'user-1',
        createdAt: '2026-11-26T10:00:00Z',
        updatedAt: '2026-11-26T10:00:00Z',
      },
      myRole: 'OWNER',
      isFavorite: false,
      columns: [],
      tags: [],
      members: [],
      tasks: [],
    };

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'post' && config.url === '/api/v1/boards') {
        capturedPayload =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return {
          status: 201,
          statusText: 'Created',
          headers: new AxiosHeaders(),
          config,
          data: createdBoard,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderCreateBoardDialog(onOpenChange);

    await user.type(screen.getByLabelText(/nome do quadro/i), 'Roadmap Q1');
    await user.type(
      screen.getByLabelText(/descrição/i),
      'Metas do primeiro trimestre',
    );
    await user.click(screen.getByRole('button', { name: /criar quadro/i }));

    await waitFor(() => {
      expect(screen.getByTestId('board-destination')).toHaveTextContent(
        'Board board-new-1',
      );
    });

    expect(capturedPayload).toEqual({
      name: 'Roadmap Q1',
      description: 'Metas do primeiro trimestre',
      color: '#0C2439',
      icon: 'kanban',
      defaultView: 'KANBAN',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
