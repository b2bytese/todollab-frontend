import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { boardKeys } from '@/features/boards/api';
import { api, getApiError } from '@/lib/api';
import type {
  BoardDetail,
  BoardTag,
  SubtaskItem,
  TaskItem,
  TaskMoveResponse,
  TaskPriority,
} from '@/types/api';

export interface CreateTaskPayload {
  columnId?: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  tagIds?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  columnId?: string;
  priority?: TaskPriority;
  dueDate?: string;
  clearDueDate?: boolean;
  assigneeId?: string;
  clearAssignee?: boolean;
  tagIds?: string[];
}

export interface MoveTaskPayload {
  taskId: string;
  targetColumnId: string;
  position: number;
}

export interface CreateSubtaskPayload {
  taskId: string;
  title: string;
}

export interface UpdateSubtaskPayload {
  taskId: string;
  subtaskId: string;
  payload: {
    title?: string;
    done?: boolean;
    position?: number;
  };
}

export interface DeleteSubtaskPayload {
  taskId: string;
  subtaskId: string;
}

export interface CreateTagPayload {
  name: string;
  color: string;
}

export interface UpdateTagPayload {
  tagId: string;
  payload: {
    name?: string;
    color?: string;
  };
}

function getNextColumnPosition(
  tasks: TaskItem[],
  columnId: string,
  excludeTaskId?: string,
): number {
  let max = 0;
  for (const t of tasks) {
    if (t.columnId === columnId && t.id !== excludeTaskId && t.position > max) {
      max = t.position;
    }
  }
  return max + 1000;
}

function upsertTaskInDetail(detail: BoardDetail, task: TaskItem): BoardDetail {
  const exists = detail.tasks.some((t) => t.id === task.id);
  const nextTasks = exists
    ? detail.tasks.map((t) => (t.id === task.id ? task : t))
    : [...detail.tasks, task];
  return { ...detail, tasks: nextTasks };
}

export function useCreateTaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskPayload): Promise<TaskItem> => {
      const { data } = await api.post<TaskItem>(
        `/api/v1/boards/${boardId}/tasks`,
        payload,
      );
      return data;
    },
    onSuccess: (created) => {
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        queryClient.setQueryData<BoardDetail>(
          boardKeys.detail(boardId),
          upsertTaskInDetail(previous, created),
        );
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível criar a tarefa.',
      );
    },
  });
}

export function useUpdateTaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: UpdateTaskPayload;
    }): Promise<TaskItem> => {
      const { data } = await api.patch<TaskItem>(
        `/api/v1/boards/${boardId}/tasks/${taskId}`,
        payload,
      );
      return data;
    },
    onMutate: async ({ taskId, payload }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );

      if (previousDetail) {
        const now = new Date().toISOString();
        const nextTasks = previousDetail.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const nextColumnId = payload.columnId ?? task.columnId;
          const columnChanged = nextColumnId !== task.columnId;
          const targetCol = columnChanged
            ? previousDetail.columns.find((c) => c.id === nextColumnId)
            : undefined;
          const nextCompleted = targetCol
            ? targetCol.isDoneColumn
            : task.completed;

          return {
            ...task,
            title: payload.title !== undefined ? payload.title : task.title,
            description:
              payload.description !== undefined
                ? payload.description
                : task.description,
            columnId: nextColumnId,
            position: columnChanged
              ? getNextColumnPosition(previousDetail.tasks, nextColumnId, taskId)
              : task.position,
            completed: nextCompleted,
            completedAt: targetCol
              ? nextCompleted
                ? (task.completedAt ?? now)
                : null
              : task.completedAt,
            priority:
              payload.priority !== undefined ? payload.priority : task.priority,
            dueDate: payload.clearDueDate
              ? null
              : payload.dueDate !== undefined
                ? payload.dueDate
                : task.dueDate,
            assigneeId: payload.clearAssignee
              ? null
              : payload.assigneeId !== undefined
                ? payload.assigneeId
                : task.assigneeId,
            tagIds: payload.tagIds !== undefined ? payload.tagIds : task.tagIds,
            updatedAt: now,
          };
        });

        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          tasks: nextTasks,
        });
      }

      return { previousDetail };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          boardKeys.detail(boardId),
          context.previousDetail,
        );
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar a tarefa.',
      );
    },
    onSuccess: (updated) => {
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        queryClient.setQueryData<BoardDetail>(
          boardKeys.detail(boardId),
          upsertTaskInDetail(current, updated),
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
  });
}

export function useToggleTaskCompleteMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: TaskItem): Promise<TaskItem> => {
      const { data } = await api.patch<TaskItem>(
        `/api/v1/boards/${boardId}/tasks/${task.id}/toggle-complete`,
      );
      return data;
    },
    onMutate: async (targetTask) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );

      if (previousDetail) {
        const sortedColumns = [...previousDetail.columns].sort(
          (a, b) => a.position - b.position,
        );
        const currentColumn = sortedColumns.find(
          (c) => c.id === targetTask.columnId,
        );
        const nextCompleted = !targetTask.completed;
        const now = new Date().toISOString();

        let nextColumnId = targetTask.columnId;
        let nextPosition = targetTask.position;

        if (nextCompleted && !currentColumn?.isDoneColumn) {
          const doneColumn = sortedColumns.find((c) => c.isDoneColumn);
          if (doneColumn) {
            nextColumnId = doneColumn.id;
            nextPosition = getNextColumnPosition(
              previousDetail.tasks,
              doneColumn.id,
              targetTask.id,
            );
          }
        } else if (!nextCompleted && currentColumn?.isDoneColumn) {
          const openColumn = sortedColumns.find((c) => !c.isDoneColumn);
          if (openColumn) {
            nextColumnId = openColumn.id;
            nextPosition = getNextColumnPosition(
              previousDetail.tasks,
              openColumn.id,
              targetTask.id,
            );
          }
        }

        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          tasks: previousDetail.tasks.map((task) =>
            task.id === targetTask.id
              ? {
                  ...task,
                  completed: nextCompleted,
                  completedAt: nextCompleted ? now : null,
                  columnId: nextColumnId,
                  position: nextPosition,
                  updatedAt: now,
                }
              : task,
          ),
        });
      }

      return { previousDetail };
    },
    onError: (err, _task, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          boardKeys.detail(boardId),
          context.previousDetail,
        );
      }
      toast.error(
        getApiError(err).detail ??
          'Não foi possível atualizar o status da tarefa.',
      );
    },
    onSuccess: (updated) => {
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        queryClient.setQueryData<BoardDetail>(
          boardKeys.detail(boardId),
          upsertTaskInDetail(current, updated),
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
  });
}

export function useMoveTaskMutation(boardId: string) {
  const queryClient = useQueryClient();
  const taskMoveSeqRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef(0);

  return useMutation({
    mutationFn: async ({
      taskId,
      targetColumnId,
      position,
    }: MoveTaskPayload): Promise<TaskMoveResponse> => {
      const { data } = await api.patch<TaskMoveResponse>(
        `/api/v1/boards/${boardId}/tasks/${taskId}/move`,
        { targetColumnId, position },
      );
      return data;
    },
    onMutate: async ({ taskId, targetColumnId, position }) => {
      inFlightRef.current += 1;
      const seq = (taskMoveSeqRef.current.get(taskId) ?? 0) + 1;
      taskMoveSeqRef.current.set(taskId, seq);

      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );

      if (previousDetail && taskMoveSeqRef.current.get(taskId) === seq) {
        const targetColumn = previousDetail.columns.find(
          (c) => c.id === targetColumnId,
        );
        const now = new Date().toISOString();
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          tasks: previousDetail.tasks.map((task) => {
            if (task.id !== taskId) {
              return task;
            }
            const completed = targetColumn
              ? targetColumn.isDoneColumn
              : task.completed;
            return {
              ...task,
              columnId: targetColumnId,
              position,
              completed,
              completedAt: targetColumn
                ? completed
                  ? (task.completedAt ?? now)
                  : null
                : task.completedAt,
              updatedAt: now,
            };
          }),
        });
      }

      return { previousDetail, seq, taskId };
    },
    onError: (err, variables, context) => {
      if (
        context?.previousDetail &&
        taskMoveSeqRef.current.get(variables.taskId) === context.seq
      ) {
        queryClient.setQueryData(
          boardKeys.detail(boardId),
          context.previousDetail,
        );
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível mover a tarefa.',
      );
    },
    onSuccess: (moveResult, variables, context) => {
      if (taskMoveSeqRef.current.get(variables.taskId) !== context?.seq) {
        return;
      }
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        const positionMap = new Map(
          moveResult.columnPositions.map((item) => [item.id, item.position]),
        );
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id === moveResult.task.id) {
              return moveResult.task;
            }
            const nextPos = positionMap.get(task.id);
            return nextPos !== undefined ? { ...task, position: nextPos } : task;
          }),
        });
      }
    },
    onSettled: () => {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) {
        void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
        void queryClient.invalidateQueries({ queryKey: boardKeys.all, exact: true });
        void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
      }
    },
  });
}

export function useDeleteTaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string): Promise<void> => {
      await api.delete(`/api/v1/boards/${boardId}/tasks/${taskId}`);
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previousDetail) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          tasks: previousDetail.tasks.filter((t) => t.id !== taskId),
        });
      }
      return { previousDetail };
    },
    onError: (err, _taskId, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          boardKeys.detail(boardId),
          context.previousDetail,
        );
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível excluir a tarefa.',
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
  });
}

export function useCreateSubtaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      title,
    }: CreateSubtaskPayload): Promise<SubtaskItem> => {
      const { data } = await api.post<SubtaskItem>(
        `/api/v1/boards/${boardId}/tasks/${taskId}/subtasks`,
        { title },
      );
      return data;
    },
    onSuccess: (created, { taskId }) => {
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  subtasks: [...task.subtasks, created].sort(
                    (a, b) => a.position - b.position,
                  ),
                }
              : task,
          ),
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível criar a subtarefa.',
      );
    },
  });
}

export function useUpdateSubtaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      subtaskId,
      payload,
    }: UpdateSubtaskPayload): Promise<SubtaskItem> => {
      const { data } = await api.patch<SubtaskItem>(
        `/api/v1/boards/${boardId}/tasks/${taskId}/subtasks/${subtaskId}`,
        payload,
      );
      return data;
    },
    onMutate: async ({ taskId, subtaskId, payload }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );

      if (previousDetail) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          tasks: previousDetail.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  subtasks: task.subtasks.map((sub) =>
                    sub.id === subtaskId
                      ? {
                          ...sub,
                          title:
                            payload.title !== undefined
                              ? payload.title
                              : sub.title,
                          done:
                            payload.done !== undefined ? payload.done : sub.done,
                          position:
                            payload.position !== undefined
                              ? payload.position
                              : sub.position,
                        }
                      : sub,
                  ),
                }
              : task,
          ),
        });
      }

      return { previousDetail };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          boardKeys.detail(boardId),
          context.previousDetail,
        );
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar a subtarefa.',
      );
    },
    onSuccess: (updated, { taskId }) => {
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  subtasks: task.subtasks.map((sub) =>
                    sub.id === updated.id ? updated : sub,
                  ),
                }
              : task,
          ),
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
  });
}

export function useDeleteSubtaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      subtaskId,
    }: DeleteSubtaskPayload): Promise<void> => {
      await api.delete(
        `/api/v1/boards/${boardId}/tasks/${taskId}/subtasks/${subtaskId}`,
      );
    },
    onMutate: async ({ taskId, subtaskId }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const previousDetail = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );

      if (previousDetail) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previousDetail,
          tasks: previousDetail.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  subtasks: task.subtasks.filter((sub) => sub.id !== subtaskId),
                }
              : task,
          ),
        });
      }

      return { previousDetail };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          boardKeys.detail(boardId),
          context.previousDetail,
        );
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível remover a subtarefa.',
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
  });
}

export function useCreateTagMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTagPayload): Promise<BoardTag> => {
      const { data } = await api.post<BoardTag>(
        `/api/v1/boards/${boardId}/tags`,
        payload,
      );
      return data;
    },
    onSuccess: (created) => {
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        const exists = current.tags.some((t) => t.id === created.id);
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...current,
          tags: exists ? current.tags : [...current.tags, created],
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível criar a etiqueta.',
      );
    },
  });
}

export function useUpdateTagMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tagId,
      payload,
    }: UpdateTagPayload): Promise<BoardTag> => {
      const { data } = await api.patch<BoardTag>(
        `/api/v1/boards/${boardId}/tags/${tagId}`,
        payload,
      );
      return data;
    },
    onSuccess: (updated) => {
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...current,
          tags: current.tags.map((t) => (t.id === updated.id ? updated : t)),
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar a etiqueta.',
      );
    },
  });
}

export function useDeleteTagMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string): Promise<void> => {
      await api.delete(`/api/v1/boards/${boardId}/tags/${tagId}`);
    },
    onSuccess: (_data, tagId) => {
      const current = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (current) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...current,
          tags: current.tags.filter((t) => t.id !== tagId),
          tasks: current.tasks.map((task) => ({
            ...task,
            tagIds: task.tagIds.filter((id) => id !== tagId),
          })),
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível excluir a etiqueta.',
      );
    },
  });
}
