import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getApiError } from '@/lib/api';
import type {
  Board,
  BoardColumn,
  BoardDetail,
  BoardSummary,
  BoardView,
  PendingInvite,
} from '@/types/api';

export const boardKeys = {
  all: ['boards'] as const,
  detail: (boardId: string) => ['boards', boardId] as const,
  invites: (boardId: string) => ['boards', boardId, 'invites'] as const,
  myTasksRoot: ['my-tasks'] as const,
  myTasks: (filters?: Record<string, string | boolean | undefined>) =>
    ['my-tasks', filters ?? {}] as const,
  myInvites: ['my-invites'] as const,
};

export interface CreateBoardPayload {
  name: string;
  description?: string | null;
  color: string;
  icon: string;
  defaultView: BoardView;
}

export interface UpdateBoardPayload {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string;
  defaultView?: BoardView;
}

export interface CreateColumnPayload {
  name: string;
  isDoneColumn?: boolean;
}

export interface UpdateColumnPayload {
  name?: string;
  isDoneColumn?: boolean;
}

export interface MoveColumnPayload {
  position: number;
}

export interface DeleteColumnPayload {
  columnId: string;
  targetColumnId?: string;
  deleteTasks?: boolean;
}

export async function fetchBoards(): Promise<BoardSummary[]> {
  const { data } = await api.get<BoardSummary[]>('/api/v1/boards');
  return data;
}

export async function fetchBoardDetail(boardId: string): Promise<BoardDetail> {
  const { data } = await api.get<BoardDetail>(`/api/v1/boards/${boardId}`);
  return data;
}

export async function fetchPendingInvites(): Promise<PendingInvite[]> {
  const { data } = await api.get<PendingInvite[]>('/api/v1/users/me/invites');
  return data;
}

export async function createBoard(
  payload: CreateBoardPayload,
): Promise<BoardDetail> {
  const { data } = await api.post<BoardDetail>('/api/v1/boards', payload);
  return data;
}

export async function updateBoard(
  boardId: string,
  payload: UpdateBoardPayload,
): Promise<Board> {
  const { data } = await api.patch<Board>(`/api/v1/boards/${boardId}`, payload);
  return data;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await api.delete(`/api/v1/boards/${boardId}`);
}

export async function toggleFavoriteBoard({
  boardId,
  isFavorite,
}: {
  boardId: string;
  isFavorite: boolean;
}): Promise<void> {
  await api.patch(`/api/v1/boards/${boardId}/favorite`, { isFavorite });
}

export async function createColumn(
  boardId: string,
  payload: CreateColumnPayload,
): Promise<BoardColumn> {
  const { data } = await api.post<BoardColumn>(
    `/api/v1/boards/${boardId}/columns`,
    payload,
  );
  return data;
}

export async function updateColumn(
  boardId: string,
  columnId: string,
  payload: UpdateColumnPayload,
): Promise<BoardColumn> {
  const { data } = await api.patch<BoardColumn>(
    `/api/v1/boards/${boardId}/columns/${columnId}`,
    payload,
  );
  return data;
}

export async function moveColumn(
  boardId: string,
  columnId: string,
  payload: MoveColumnPayload,
): Promise<BoardColumn[]> {
  const { data } = await api.patch<BoardColumn[]>(
    `/api/v1/boards/${boardId}/columns/${columnId}/move`,
    payload,
  );
  return data;
}

export async function deleteColumn(
  boardId: string,
  { columnId, targetColumnId, deleteTasks }: DeleteColumnPayload,
): Promise<void> {
  await api.delete(`/api/v1/boards/${boardId}/columns/${columnId}`, {
    params: {
      ...(targetColumnId ? { targetColumnId } : {}),
      ...(deleteTasks ? { deleteTasks: true } : {}),
    },
  });
}

export function useBoardsQuery() {
  return useQuery({
    queryKey: boardKeys.all,
    queryFn: fetchBoards,
  });
}

export function useBoardDetailQuery(boardId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.detail(boardId ?? ''),
    queryFn: () => fetchBoardDetail(boardId!),
    enabled: Boolean(boardId),
  });
}

export function usePendingInvitesQuery() {
  return useQuery({
    queryKey: boardKeys.myInvites,
    queryFn: fetchPendingInvites,
  });
}

export function useCreateBoardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBoard,
    onSuccess: (created) => {
      queryClient.setQueryData(boardKeys.detail(created.board.id), created);
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

export function useUpdateBoardMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateBoardPayload) => updateBoard(boardId, payload),
    onSuccess: (updatedBoard) => {
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previous,
          board: updatedBoard,
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar o quadro.',
      );
    },
  });
}

export function useDeleteBoardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: (_data, boardId) => {
      queryClient.removeQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível excluir o quadro.',
      );
    },
  });
}

export function useToggleFavoriteBoardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleFavoriteBoard,
    onMutate: async ({ boardId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.all });
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });

      const previousBoards = queryClient.getQueryData<BoardSummary[]>(boardKeys.all);
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );

      if (previousBoards) {
        queryClient.setQueryData<BoardSummary[]>(
          boardKeys.all,
          previousBoards.map((board) =>
            board.id === boardId ? { ...board, isFavorite } : board,
          ),
        );
      }

      if (previousDetail) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          isFavorite,
        });
      }

      return { previousBoards, previousDetail };
    },
    onError: (err, { boardId }, context) => {
      if (context?.previousBoards) {
        queryClient.setQueryData(boardKeys.all, context.previousBoards);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(boardKeys.detail(boardId), context.previousDetail);
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar os favoritos.',
      );
    },
    onSettled: (_data, _err, { boardId }) => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

export function useCreateColumnMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateColumnPayload) => createColumn(boardId, payload),
    onSuccess: (created) => {
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previous,
          columns: [...previous.columns, created].sort(
            (a, b) => a.position - b.position,
          ),
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível criar a coluna.',
      );
    },
  });
}

export function useUpdateColumnMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      columnId,
      payload,
    }: {
      columnId: string;
      payload: UpdateColumnPayload;
    }) => updateColumn(boardId, columnId, payload),
    onSuccess: (updated) => {
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previous,
          columns: previous.columns.map((col) =>
            col.id === updated.id ? updated : col,
          ),
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar a coluna.',
      );
    },
  });
}

export function useMoveColumnMutation(boardId: string) {
  const queryClient = useQueryClient();
  const colMoveSeqRef = useRef(0);
  const inFlightRef = useRef(0);

  return useMutation({
    mutationFn: ({
      columnId,
      position,
    }: {
      columnId: string;
      position: number;
    }) => moveColumn(boardId, columnId, { position }),
    onMutate: async ({ columnId, position }) => {
      inFlightRef.current += 1;
      colMoveSeqRef.current += 1;
      const seq = colMoveSeqRef.current;

      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      const previousColumns = previousDetail?.columns;

      if (previousDetail && colMoveSeqRef.current === seq) {
        const nextColumns = previousDetail.columns
          .map((col) => (col.id === columnId ? { ...col, position } : col))
          .sort((a, b) => a.position - b.position);
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          columns: nextColumns,
        });
      }

      return { previousColumns, seq };
    },
    onError: (err, _variables, context) => {
      const previousColumns = context?.previousColumns;
      if (previousColumns && colMoveSeqRef.current === context?.seq) {
        const current = queryClient.getQueryData<BoardDetail>(
          boardKeys.detail(boardId),
        );
        if (current) {
          queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
            ...current,
            columns: previousColumns,
          });
        }
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível mover a coluna.',
      );
    },
    onSuccess: (columns, _variables, context) => {
      if (colMoveSeqRef.current !== context?.seq) {
        return;
      }
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previous,
          columns,
        });
      }
    },
    onSettled: () => {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) {
        void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      }
    },
  });
}

export function useDeleteColumnMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DeleteColumnPayload) => deleteColumn(boardId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível excluir a coluna.',
      );
    },
  });
}
