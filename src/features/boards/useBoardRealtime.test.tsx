import type { Client } from '@stomp/stompjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardKeys } from '@/features/boards/api';
import {
  applyBoardEventToCache,
  useBoardRealtime,
} from '@/features/boards/useBoardRealtime';
import * as stompClientModule from '@/lib/stompClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  Board,
  BoardColumn,
  BoardDetail,
  BoardEvent,
  BoardMember,
  BoardTag,
  TaskItem,
  TaskMoveResponse,
} from '@/types/api';

function createInitialDetail(): BoardDetail {
  return {
    board: {
      id: 'board-1',
      name: 'Produto V1',
      description: 'Quadro principal',
      color: '#0C2439',
      icon: 'rocket',
      defaultView: 'KANBAN',
      ownerId: 'user-1',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-25T10:00:00Z',
    },
    myRole: 'EDITOR',
    isFavorite: false,
    columns: [
      {
        id: 'col-1',
        boardId: 'board-1',
        name: 'A fazer',
        position: 1000,
        isDoneColumn: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
      {
        id: 'col-2',
        boardId: 'board-1',
        name: 'Concluído',
        position: 2000,
        isDoneColumn: true,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        boardId: 'board-1',
        columnId: 'col-1',
        title: 'Tarefa existente',
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
    tags: [],
    members: [
      {
        id: 'mem-1',
        userId: 'user-1',
        name: 'Ana Silva',
        email: 'ana@example.com',
        avatarColor: '#0C2439',
        role: 'OWNER',
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
  };
}

describe('useBoardRealtime / applyBoardEventToCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reconcilesTaskCreatedAndTaskMovedIntoBoardCache', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(boardKeys.detail('board-1'), createInitialDetail());

    const createdTask: TaskItem = {
      id: 'task-2',
      boardId: 'board-1',
      columnId: 'col-1',
      title: 'Nova tarefa em tempo real',
      description: 'Criada por outro membro',
      priority: 'HIGH',
      dueDate: null,
      assigneeId: 'user-2',
      completed: false,
      completedAt: null,
      position: 2000,
      createdById: 'user-1',
      subtasks: [],
      tagIds: [],
      createdAt: '2026-11-25T11:00:00Z',
      updatedAt: '2026-11-25T11:00:00Z',
    };

    const createEvent: BoardEvent<TaskItem> = {
      type: 'TASK_CREATED',
      boardId: 'board-1',
      actorId: 'user-1',
      timestamp: '2026-11-25T11:00:00Z',
      payload: createdTask,
    };

    applyBoardEventToCache(queryClient, createEvent, 'user-2');

    let cached = queryClient.getQueryData<BoardDetail>(
      boardKeys.detail('board-1'),
    );
    expect(cached?.tasks).toHaveLength(2);
    expect(cached?.tasks.find((t) => t.id === 'task-2')?.columnId).toBe('col-1');

    const movedTask: TaskItem = {
      ...createdTask,
      columnId: 'col-2',
      position: 500,
      completed: true,
      completedAt: '2026-11-25T11:05:00Z',
      updatedAt: '2026-11-25T11:05:00Z',
    };

    const moveEvent: BoardEvent<TaskMoveResponse> = {
      type: 'TASK_MOVED',
      boardId: 'board-1',
      actorId: 'user-1',
      timestamp: '2026-11-25T11:05:00Z',
      payload: {
        task: movedTask,
        rebalanced: false,
        columnPositions: [{ id: 'task-2', position: 500 }],
      },
    };

    applyBoardEventToCache(queryClient, moveEvent, 'user-2');

    cached = queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'));
    const updatedTask = cached?.tasks.find((t) => t.id === 'task-2');
    expect(updatedTask?.columnId).toBe('col-2');
    expect(updatedTask?.position).toBe(500);
    expect(updatedTask?.completed).toBe(true);
  });

  it('boardDeletedAndSelfRemovalMemberChangedToastAndRedirectToMyTasks', () => {
    const toastInfoSpy = vi.spyOn(toast, 'info').mockImplementation(() => '');
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Case 1: BOARD_DELETED
    queryClient.setQueryData(boardKeys.detail('board-1'), createInitialDetail());
    const onRedirectDeleted = vi.fn();

    applyBoardEventToCache(
      queryClient,
      {
        type: 'BOARD_DELETED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T12:00:00Z',
        payload: { boardId: 'board-1' },
      },
      'user-2',
      { onRedirectToMyTasks: onRedirectDeleted },
    );

    expect(toastInfoSpy).toHaveBeenCalledTimes(1);
    expect(onRedirectDeleted).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: boardKeys.all });
    expect(
      queryClient.getQueryData(boardKeys.detail('board-1')),
    ).toBeUndefined();

    // Case 2: MEMBER_CHANGED with removedUserId === currentUser.id
    queryClient.setQueryData(boardKeys.detail('board-1'), createInitialDetail());
    const onRedirectRemoved = vi.fn();

    applyBoardEventToCache(
      queryClient,
      {
        type: 'MEMBER_CHANGED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T12:05:00Z',
        payload: {
          action: 'REMOVED',
          removedUserId: 'user-2',
        },
      },
      'user-2',
      { onRedirectToMyTasks: onRedirectRemoved },
    );

    expect(toastInfoSpy).toHaveBeenCalledTimes(2);
    expect(onRedirectRemoved).toHaveBeenCalledTimes(1);
    expect(
      queryClient.getQueryData(boardKeys.detail('board-1')),
    ).toBeUndefined();
  });

  it('handlesBoardUpdatedColumnEventsTaskUpdatedWithSubtasksAndTaskDeleted', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(boardKeys.detail('board-1'), createInitialDetail());

    // BOARD_UPDATED
    const updatedBoard: Board = {
      ...createInitialDetail().board,
      name: 'Produto V1 Renomeado',
      color: '#FF4B4B',
    };
    applyBoardEventToCache(
      queryClient,
      {
        type: 'BOARD_UPDATED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T13:00:00Z',
        payload: updatedBoard,
      },
      'user-2',
    );
    expect(
      queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'))?.board
        .name,
    ).toBe('Produto V1 Renomeado');

    // COLUMN_CREATED
    const newColumn: BoardColumn = {
      id: 'col-3',
      boardId: 'board-1',
      name: 'Em revisão',
      position: 1500,
      isDoneColumn: false,
      createdAt: '2026-11-25T13:01:00Z',
      updatedAt: '2026-11-25T13:01:00Z',
    };
    applyBoardEventToCache(
      queryClient,
      {
        type: 'COLUMN_CREATED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T13:01:00Z',
        payload: newColumn,
      },
      'user-2',
    );
    expect(
      queryClient
        .getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.columns.map((c) => c.id),
    ).toEqual(['col-1', 'col-3', 'col-2']);

    // COLUMN_UPDATED
    applyBoardEventToCache(
      queryClient,
      {
        type: 'COLUMN_UPDATED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T13:02:00Z',
        payload: { ...newColumn, name: 'QA / Revisão' },
      },
      'user-2',
    );
    expect(
      queryClient
        .getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.columns.find((c) => c.id === 'col-3')?.name,
    ).toBe('QA / Revisão');

    // TASK_UPDATED (including subtasks changes)
    const updatedTask: TaskItem = {
      ...createInitialDetail().tasks[0],
      title: 'Tarefa atualizada com subtarefas',
      subtasks: [
        {
          id: 'sub-1',
          taskId: 'task-1',
          title: 'Revisar testes',
          done: true,
          position: 1000,
          createdAt: '2026-11-25T13:03:00Z',
        },
      ],
    };
    applyBoardEventToCache(
      queryClient,
      {
        type: 'TASK_UPDATED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T13:03:00Z',
        payload: updatedTask,
      },
      'user-2',
    );
    const taskAfterUpdate = queryClient
      .getQueryData<BoardDetail>(boardKeys.detail('board-1'))
      ?.tasks.find((t) => t.id === 'task-1');
    expect(taskAfterUpdate?.title).toBe('Tarefa atualizada com subtarefas');
    expect(taskAfterUpdate?.subtasks).toHaveLength(1);
    expect(taskAfterUpdate?.subtasks[0].done).toBe(true);

    // COLUMN_DELETED (deleteTasks: false with targetColumnId invalidates detail)
    applyBoardEventToCache(
      queryClient,
      {
        type: 'COLUMN_DELETED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T13:04:00Z',
        payload: {
          columnId: 'col-3',
          targetColumnId: 'col-1',
          deleteTasks: false,
        },
      },
      'user-2',
    );
    expect(
      queryClient
        .getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.columns.map((c) => c.id),
    ).toEqual(['col-1', 'col-2']);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: boardKeys.detail('board-1'),
    });

    // TASK_DELETED
    applyBoardEventToCache(
      queryClient,
      {
        type: 'TASK_DELETED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T13:05:00Z',
        payload: { taskId: 'task-1' },
      },
      'user-2',
    );
    expect(
      queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'))?.tasks,
    ).toHaveLength(0);

    // COLUMN_DELETED with deleteTasks: true removes tasks in that column
    const taskInCol2: TaskItem = {
      ...createInitialDetail().tasks[0],
      id: 'task-in-col-2',
      columnId: 'col-2',
    };
    queryClient.setQueryData<BoardDetail>(boardKeys.detail('board-1'), (prev) =>
      prev ? { ...prev, tasks: [taskInCol2] } : prev,
    );
    applyBoardEventToCache(
      queryClient,
      {
        type: 'COLUMN_DELETED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T13:06:00Z',
        payload: { columnId: 'col-2', deleteTasks: true },
      },
      'user-2',
    );
    const afterCol2Delete = queryClient.getQueryData<BoardDetail>(
      boardKeys.detail('board-1'),
    );
    expect(afterCol2Delete?.columns.map((c) => c.id)).toEqual(['col-1']);
    expect(afterCol2Delete?.tasks).toHaveLength(0);
  });

  it('handlesTagChangedAndNonSelfMemberChangedBranches', () => {
    const queryClient = new QueryClient();
    const initial = createInitialDetail();
    initial.tasks[0].tagIds = ['tag-1'];
    initial.tasks[0].assigneeId = 'user-3';
    queryClient.setQueryData(boardKeys.detail('board-1'), initial);

    // TAG_CHANGED CREATED
    const createdTag: BoardTag = {
      id: 'tag-1',
      boardId: 'board-1',
      name: 'Backend',
      color: '#2563EB',
    };
    applyBoardEventToCache(
      queryClient,
      {
        type: 'TAG_CHANGED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T14:00:00Z',
        payload: { action: 'CREATED', tag: createdTag },
      },
      'user-2',
    );
    expect(
      queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'))?.tags,
    ).toEqual([createdTag]);

    // TAG_CHANGED UPDATED
    const updatedTag: BoardTag = { ...createdTag, name: 'API' };
    applyBoardEventToCache(
      queryClient,
      {
        type: 'TAG_CHANGED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T14:01:00Z',
        payload: { action: 'UPDATED', tag: updatedTag },
      },
      'user-2',
    );
    expect(
      queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.tags[0].name,
    ).toBe('API');

    // TAG_CHANGED DELETED strips tagId from tasks
    applyBoardEventToCache(
      queryClient,
      {
        type: 'TAG_CHANGED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T14:02:00Z',
        payload: { action: 'DELETED', tagId: 'tag-1' },
      },
      'user-2',
    );
    const afterTagDelete = queryClient.getQueryData<BoardDetail>(
      boardKeys.detail('board-1'),
    );
    expect(afterTagDelete?.tags).toEqual([]);
    expect(afterTagDelete?.tasks[0].tagIds).toEqual([]);

    // MEMBER_CHANGED JOINED
    const joinedMember: BoardMember = {
      id: 'mem-3',
      userId: 'user-3',
      name: 'Carla Dias',
      email: 'carla@example.com',
      avatarColor: '#0D9488',
      role: 'VIEWER',
      joinedAt: '2026-11-25T14:03:00Z',
    };
    const onRedirect = vi.fn();
    applyBoardEventToCache(
      queryClient,
      {
        type: 'MEMBER_CHANGED',
        boardId: 'board-1',
        actorId: 'user-3',
        timestamp: '2026-11-25T14:03:00Z',
        payload: { action: 'JOINED', member: joinedMember },
      },
      'user-2',
      { onRedirectToMyTasks: onRedirect },
    );
    expect(
      queryClient
        .getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.members.map((m) => m.userId),
    ).toEqual(['user-1', 'user-2', 'user-3']);

    // MEMBER_CHANGED ROLE_UPDATED for current user updates myRole
    applyBoardEventToCache(
      queryClient,
      {
        type: 'MEMBER_CHANGED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T14:04:00Z',
        payload: {
          action: 'ROLE_UPDATED',
          member: { ...initial.members[1], role: 'VIEWER' },
        },
      },
      'user-2',
      { onRedirectToMyTasks: onRedirect },
    );
    expect(
      queryClient.getQueryData<BoardDetail>(boardKeys.detail('board-1'))
        ?.myRole,
    ).toBe('VIEWER');

    // MEMBER_CHANGED REMOVED for another member clears their task assignee without redirecting
    applyBoardEventToCache(
      queryClient,
      {
        type: 'MEMBER_CHANGED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T14:05:00Z',
        payload: { action: 'REMOVED', removedUserId: 'user-3' },
      },
      'user-2',
      { onRedirectToMyTasks: onRedirect },
    );
    const afterOtherRemoved = queryClient.getQueryData<BoardDetail>(
      boardKeys.detail('board-1'),
    );
    expect(afterOtherRemoved?.members.map((m) => m.userId)).toEqual([
      'user-1',
      'user-2',
    ]);
    expect(afterOtherRemoved?.tasks[0].assigneeId).toBeNull();
    expect(onRedirect).not.toHaveBeenCalled();

    // MEMBER_CHANGED OWNERSHIP_TRANSFERRED updates ownerId and myRole
    const transferredMembers: BoardMember[] = [
      { ...initial.members[0], role: 'EDITOR' },
      { ...initial.members[1], role: 'OWNER' },
    ];
    applyBoardEventToCache(
      queryClient,
      {
        type: 'MEMBER_CHANGED',
        boardId: 'board-1',
        actorId: 'user-1',
        timestamp: '2026-11-25T14:06:00Z',
        payload: {
          action: 'OWNERSHIP_TRANSFERRED',
          newOwnerId: 'user-2',
          members: transferredMembers,
        },
      },
      'user-2',
      { onRedirectToMyTasks: onRedirect },
    );
    const afterTransfer = queryClient.getQueryData<BoardDetail>(
      boardKeys.detail('board-1'),
    );
    expect(afterTransfer?.board.ownerId).toBe('user-2');
    expect(afterTransfer?.myRole).toBe('OWNER');
    expect(onRedirect).not.toHaveBeenCalled();
  });

  it('skipsStompClientCreationWhenEnabledIsFalseAndDeactivatesWhenDisabled', () => {
    const activate = vi.fn();
    const deactivate = vi.fn().mockResolvedValue(undefined);
    const createSpy = vi
      .spyOn(stompClientModule, 'createBoardStompClient')
      .mockReturnValue({
        activate,
        deactivate,
      } as unknown as Client);

    useAuthStore.setState({
      accessToken: 'valid-token',
      user: {
        id: 'user-2',
        name: 'Bruno Costa',
        email: 'bruno@example.com',
        avatarColor: '#FF4B4B',
        createdAt: '2026-11-21T10:00:00Z',
      },
      status: 'authenticated',
    });

    const queryClient = new QueryClient();

    function TestHarness({
      boardId,
      enabled,
    }: {
      boardId?: string;
      enabled: boolean;
    }) {
      useBoardRealtime(boardId, enabled);
      return null;
    }

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TestHarness boardId="board-1" enabled={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(createSpy).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TestHarness boardId="board-1" enabled={true} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledTimes(1);

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TestHarness boardId="board-1" enabled={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(deactivate).toHaveBeenCalledTimes(1);
  });
});
