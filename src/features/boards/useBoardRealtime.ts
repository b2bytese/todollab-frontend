import { useEffect, useRef } from 'react';
import type { Client, IFrame } from '@stomp/stompjs';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { boardKeys } from '@/features/boards/api';
import { refreshAccessToken } from '@/lib/api';
import { createBoardStompClient } from '@/lib/stompClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  Board,
  BoardColumn,
  BoardDetail,
  BoardEvent,
  BoardMember,
  BoardSummary,
  BoardTag,
  TaskItem,
  TaskMoveResponse,
} from '@/types/api';

export interface ApplyBoardEventCallbacks {
  onRedirectToMyTasks?: () => void;
  notify?: (message: string) => void;
}

interface ColumnDeletedPayload {
  columnId: string;
  targetColumnId?: string | null;
  deleteTasks?: boolean;
}

interface ColumnReorderedColumnsPayload {
  columns: BoardColumn[];
}

interface TaskDeletedPayload {
  taskId: string;
}

interface TagChangedPayload {
  action?: 'CREATED' | 'UPDATED' | 'DELETED';
  tag?: BoardTag;
  tagId?: string;
}

interface MemberChangedPayload {
  action?: 'JOINED' | 'ROLE_UPDATED' | 'OWNERSHIP_TRANSFERRED' | 'REMOVED' | 'LEFT';
  member?: BoardMember;
  members?: BoardMember[];
  newOwnerId?: string;
  removedUserId?: string;
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const exists = items.some((item) => item.id === next.id);
  return exists
    ? items.map((item) => (item.id === next.id ? next : item))
    : [...items, next];
}

function applyTaskMoveToTasks(
  tasks: TaskItem[],
  moveResult: TaskMoveResponse,
): TaskItem[] {
  const withMoved = upsertById(tasks, moveResult.task);
  const positionMap = new Map(
    (moveResult.columnPositions ?? []).map((item) => [item.id, item.position]),
  );
  return withMoved.map((task) => {
    if (task.id === moveResult.task.id) {
      return moveResult.task;
    }
    const nextPos = positionMap.get(task.id);
    return nextPos !== undefined ? { ...task, position: nextPos } : task;
  });
}

function isTaskMoveResponse(payload: unknown): payload is TaskMoveResponse {
  return (
    Boolean(payload) &&
    typeof payload === 'object' &&
    'task' in (payload as Record<string, unknown>) &&
    Boolean((payload as TaskMoveResponse).task)
  );
}

function isTaskItem(payload: unknown): payload is TaskItem {
  return (
    Boolean(payload) &&
    typeof payload === 'object' &&
    'id' in (payload as Record<string, unknown>) &&
    'columnId' in (payload as Record<string, unknown>)
  );
}

/**
 * Synchronizes open/completed task counts in the cached boards list from the cached board detail.
 */
function syncBoardSummaryCounts(
  queryClient: QueryClient,
  boardId: string,
): void {
  const detail = queryClient.getQueryData<BoardDetail>(
    boardKeys.detail(boardId),
  );
  if (!detail) {
    return;
  }

  let openTasksCount = 0;
  let completedTasksCount = 0;
  for (const task of detail.tasks) {
    if (task.completed) {
      completedTasksCount += 1;
    } else {
      openTasksCount += 1;
    }
  }

  queryClient.setQueryData<BoardSummary[]>(boardKeys.all, (boards) => {
    if (!boards) {
      return boards;
    }
    return boards.map((board) =>
      board.id === boardId
        ? { ...board, openTasksCount, completedTasksCount }
        : board,
    );
  });
}

function taskInvolvesUser(
  previousTasks: TaskItem[] | undefined,
  taskId: string,
  nextAssigneeId: string | null | undefined,
  currentUserId: string | null | undefined,
): boolean {
  if (!currentUserId) {
    return false;
  }
  if (nextAssigneeId === currentUserId) {
    return true;
  }
  const previousTask = previousTasks?.find((t) => t.id === taskId);
  return previousTask?.assigneeId === currentUserId;
}

function isStompAuthError(errorText: string): boolean {
  return (
    errorText.includes('401') ||
    errorText.includes('unauth') ||
    errorText.includes('jwt') ||
    errorText.includes('token') ||
    errorText.includes('expired')
  );
}

function isStompForbiddenError(errorText: string): boolean {
  return (
    errorText.includes('403') ||
    errorText.includes('forbidden') ||
    errorText.includes('access denied') ||
    errorText.includes('accessdenied') ||
    errorText.includes('not a member')
  );
}

export function applyBoardEventToCache(
  queryClient: QueryClient,
  event: BoardEvent,
  currentUserId: string | null | undefined,
  callbacks?: ApplyBoardEventCallbacks,
): void {
  const notify = callbacks?.notify ?? ((msg: string) => toast.info(msg));
  const detailKey = boardKeys.detail(event.boardId);
  const isSelfActor = Boolean(
    currentUserId && event.actorId && event.actorId === currentUserId,
  );

  if (event.type === 'BOARD_DELETED') {
    queryClient.removeQueries({ queryKey: detailKey });
    void queryClient.invalidateQueries({ queryKey: boardKeys.all });
    void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
    if (!isSelfActor) {
      notify('Este quadro foi excluído.');
    }
    callbacks?.onRedirectToMyTasks?.();
    return;
  }

  if (event.type === 'MEMBER_CHANGED') {
    const payload = (event.payload ?? {}) as MemberChangedPayload;
    if (
      payload.removedUserId &&
      currentUserId &&
      payload.removedUserId === currentUserId
    ) {
      queryClient.removeQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
      if (!isSelfActor) {
        notify(
          payload.action === 'LEFT'
            ? 'Você saiu do quadro.'
            : 'Você foi removido deste quadro.',
        );
      }
      callbacks?.onRedirectToMyTasks?.();
      return;
    }

    queryClient.setQueryData<BoardDetail>(detailKey, (current) => {
      if (!current) {
        return current;
      }

      if (payload.removedUserId) {
        return {
          ...current,
          members: current.members.filter(
            (m) => m.userId !== payload.removedUserId,
          ),
          tasks: current.tasks.map((task) =>
            task.assigneeId === payload.removedUserId
              ? { ...task, assigneeId: null }
              : task,
          ),
        };
      }

      if (payload.action === 'JOINED' && payload.member) {
        const joined = payload.member;
        const exists = current.members.some((m) => m.userId === joined.userId);
        return {
          ...current,
          members: exists
            ? current.members.map((m) =>
                m.userId === joined.userId ? joined : m,
              )
            : [...current.members, joined],
        };
      }

      if (payload.action === 'ROLE_UPDATED' && payload.member) {
        const updated = payload.member;
        return {
          ...current,
          myRole:
            updated.userId === currentUserId ? updated.role : current.myRole,
          members: current.members.map((m) =>
            m.userId === updated.userId ? updated : m,
          ),
        };
      }

      if (
        payload.action === 'OWNERSHIP_TRANSFERRED' &&
        Array.isArray(payload.members)
      ) {
        const myUpdatedRole =
          payload.members.find((m) => m.userId === currentUserId)?.role ??
          current.myRole;
        return {
          ...current,
          board: {
            ...current.board,
            ownerId: payload.newOwnerId ?? current.board.ownerId,
          },
          myRole: myUpdatedRole,
          members: payload.members,
        };
      }

      return current;
    });

    void queryClient.invalidateQueries({ queryKey: boardKeys.all });
    return;
  }

  switch (event.type) {
    case 'BOARD_UPDATED': {
      const updatedBoard = event.payload as Board;
      queryClient.setQueryData<BoardDetail>(detailKey, (current) =>
        current ? { ...current, board: updatedBoard } : current,
      );
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
      break;
    }

    case 'COLUMN_CREATED':
    case 'COLUMN_UPDATED':
    case 'COLUMN_MOVED': {
      const column = event.payload as BoardColumn;
      queryClient.setQueryData<BoardDetail>(detailKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          columns: upsertById(current.columns, column).sort(
            (a, b) => a.position - b.position,
          ),
        };
      });
      if (event.type === 'COLUMN_UPDATED') {
        void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
      }
      break;
    }

    case 'COLUMN_DELETED': {
      const payload = (event.payload ?? {}) as ColumnDeletedPayload;
      queryClient.setQueryData<BoardDetail>(detailKey, (current) => {
        if (!current) return current;
        let nextTasks = current.tasks;
        if (payload.deleteTasks) {
          nextTasks = current.tasks.filter(
            (t) => t.columnId !== payload.columnId,
          );
        } else if (payload.targetColumnId) {
          const targetColumnId = payload.targetColumnId;
          nextTasks = current.tasks.map((t) =>
            t.columnId === payload.columnId
              ? { ...t, columnId: targetColumnId }
              : t,
          );
        }
        return {
          ...current,
          columns: current.columns.filter((c) => c.id !== payload.columnId),
          tasks: nextTasks,
        };
      });
      if (payload.targetColumnId) {
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
      syncBoardSummaryCounts(queryClient, event.boardId);
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
      break;
    }

    case 'COLUMN_REORDERED': {
      const payload = event.payload as
        | ColumnReorderedColumnsPayload
        | TaskMoveResponse;
      if (
        payload &&
        typeof payload === 'object' &&
        'columns' in payload &&
        Array.isArray(payload.columns)
      ) {
        const sortedColumns = [...payload.columns].sort(
          (a, b) => a.position - b.position,
        );
        queryClient.setQueryData<BoardDetail>(detailKey, (current) =>
          current ? { ...current, columns: sortedColumns } : current,
        );
      } else if (isTaskMoveResponse(payload)) {
        const previousTasks =
          queryClient.getQueryData<BoardDetail>(detailKey)?.tasks;
        const involvesUser = taskInvolvesUser(
          previousTasks,
          payload.task.id,
          payload.task.assigneeId,
          currentUserId,
        );
        queryClient.setQueryData<BoardDetail>(detailKey, (current) =>
          current
            ? {
                ...current,
                tasks: applyTaskMoveToTasks(current.tasks, payload),
              }
            : current,
        );
        syncBoardSummaryCounts(queryClient, event.boardId);
        if (involvesUser) {
          void queryClient.invalidateQueries({
            queryKey: boardKeys.myTasksRoot,
          });
        }
      } else {
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
      break;
    }

    case 'TASK_CREATED':
    case 'TASK_UPDATED': {
      const task = event.payload as TaskItem;
      const previousTasks =
        queryClient.getQueryData<BoardDetail>(detailKey)?.tasks;
      const involvesUser = taskInvolvesUser(
        previousTasks,
        task.id,
        task.assigneeId,
        currentUserId,
      );
      queryClient.setQueryData<BoardDetail>(detailKey, (current) =>
        current
          ? { ...current, tasks: upsertById(current.tasks, task) }
          : current,
      );
      syncBoardSummaryCounts(queryClient, event.boardId);
      if (involvesUser) {
        void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
      }
      break;
    }

    case 'TASK_MOVED': {
      const payload = event.payload;
      const movedTask = isTaskMoveResponse(payload)
        ? payload.task
        : isTaskItem(payload)
          ? payload
          : null;
      const previousTasks =
        queryClient.getQueryData<BoardDetail>(detailKey)?.tasks;
      const involvesUser = movedTask
        ? taskInvolvesUser(
            previousTasks,
            movedTask.id,
            movedTask.assigneeId,
            currentUserId,
          )
        : false;
      queryClient.setQueryData<BoardDetail>(detailKey, (current) => {
        if (!current) return current;
        if (isTaskMoveResponse(payload)) {
          return {
            ...current,
            tasks: applyTaskMoveToTasks(current.tasks, payload),
          };
        }
        if (isTaskItem(payload)) {
          return {
            ...current,
            tasks: upsertById(current.tasks, payload),
          };
        }
        return current;
      });
      syncBoardSummaryCounts(queryClient, event.boardId);
      if (involvesUser) {
        void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
      }
      break;
    }

    case 'TASK_DELETED': {
      const payload = (event.payload ?? {}) as TaskDeletedPayload;
      const previousTasks =
        queryClient.getQueryData<BoardDetail>(detailKey)?.tasks;
      const involvesUser = taskInvolvesUser(
        previousTasks,
        payload.taskId,
        null,
        currentUserId,
      );
      queryClient.setQueryData<BoardDetail>(detailKey, (current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.filter((t) => t.id !== payload.taskId),
            }
          : current,
      );
      syncBoardSummaryCounts(queryClient, event.boardId);
      if (involvesUser) {
        void queryClient.invalidateQueries({ queryKey: boardKeys.myTasksRoot });
      }
      break;
    }

    case 'TAG_CHANGED': {
      const payload = (event.payload ?? {}) as TagChangedPayload;
      queryClient.setQueryData<BoardDetail>(detailKey, (current) => {
        if (!current) return current;
        if (
          (payload.action === 'CREATED' || payload.action === 'UPDATED') &&
          payload.tag
        ) {
          return {
            ...current,
            tags: upsertById(current.tags, payload.tag),
          };
        }
        if (payload.action === 'DELETED' && payload.tagId) {
          return {
            ...current,
            tags: current.tags.filter((t) => t.id !== payload.tagId),
            tasks: current.tasks.map((task) => ({
              ...task,
              tagIds: task.tagIds.filter((id) => id !== payload.tagId),
            })),
          };
        }
        return current;
      });
      break;
    }
  }
}

export function useBoardRealtime(
  boardId: string | undefined,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const status = useAuthStore((s) => s.status);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const redirectedRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);

  useEffect(() => {
    redirectedRef.current = false;
    hasConnectedOnceRef.current = false;
  }, [boardId]);

  useEffect(() => {
    if (!boardId || !enabled || status !== 'authenticated') {
      return;
    }

    const redirectToMyTasks = () => {
      if (redirectedRef.current) {
        return;
      }
      redirectedRef.current = true;
      navigateRef.current('/app/my-tasks', { replace: true });
    };

    let client: Client | null = null;
    client = createBoardStompClient({
      boardId,
      getAccessToken: () => useAuthStore.getState().accessToken,
      refreshToken: refreshAccessToken,
      onEvent: (event) => {
        applyBoardEventToCache(queryClient, event, currentUserId, {
          onRedirectToMyTasks: redirectToMyTasks,
        });
      },
      onConnect: () => {
        if (!hasConnectedOnceRef.current) {
          hasConnectedOnceRef.current = true;
          return;
        }
        void queryClient.invalidateQueries({
          queryKey: boardKeys.detail(boardId),
        });
      },
      onStompError: (frame: IFrame) => {
        const errorText =
          `${frame.headers?.message ?? ''} ${frame.body ?? ''}`.toLowerCase();
        if (isStompAuthError(errorText)) {
          void refreshAccessToken().catch(() => {
            void client?.deactivate();
          });
          return;
        }
        if (isStompForbiddenError(errorText)) {
          void client?.deactivate();
          queryClient.removeQueries({ queryKey: boardKeys.detail(boardId) });
          void queryClient.invalidateQueries({ queryKey: boardKeys.all });
          void queryClient.invalidateQueries({
            queryKey: boardKeys.myTasksRoot,
          });
          redirectToMyTasks();
        }
      },
    });

    client.activate();

    return () => {
      void client?.deactivate();
    };
  }, [boardId, currentUserId, enabled, queryClient, status]);
}
