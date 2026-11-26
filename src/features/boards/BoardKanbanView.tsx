import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  boardKeys,
  useCreateColumnMutation,
  useDeleteColumnMutation,
  useMoveColumnMutation,
} from '@/features/boards/api';
import {
  ColumnDeleteDialog,
  type ColumnDeleteChoice,
} from '@/features/boards/ColumnDeleteDialog';
import { KanbanCardPreview } from '@/features/boards/KanbanCard';
import { KanbanColumn } from '@/features/boards/KanbanColumn';
import { useMoveTaskMutation } from '@/features/tasks/api';
import { calculateDropPosition } from '@/lib/fractionalIndex';
import type { BoardColumn, BoardDetail, TaskItem } from '@/types/api';

type ActiveDragState =
  | { type: 'task'; taskId: string }
  | { type: 'column'; columnId: string }
  | null;

interface DragOverTaskPreview {
  taskId: string;
  columnId: string;
  index: number;
}

export interface BoardKanbanViewProps {
  detail: BoardDetail;
  filteredTasks: TaskItem[];
  canEdit: boolean;
  onSelectTask: (taskId: string) => void;
  filtersActive?: boolean;
}

function isActiveCenterBelowOver(active: Active, over: Over): boolean {
  const translated = active.rect.current.translated;
  if (!translated) {
    return false;
  }
  const activeCenterY = translated.top + translated.height / 2;
  const overCenterY = over.rect.top + over.rect.height / 2;
  return activeCenterY > overCenterY;
}

function resolveOverColumnId(
  over: Over,
  previewTasks: readonly TaskItem[],
): string | undefined {
  const overType = over.data.current?.type;
  if (overType === 'task') {
    const overTaskId = (over.data.current?.task as TaskItem | undefined)?.id;
    return previewTasks.find((t) => t.id === overTaskId)?.columnId;
  }
  if (overType === 'column-drop') {
    return over.data.current?.columnId as string | undefined;
  }
  if (overType === 'column') {
    return (over.data.current?.column as BoardColumn | undefined)?.id;
  }
  return undefined;
}

function getTargetIndexInColumn(
  allColumnTasks: TaskItem[],
  visibleColumnTasks: TaskItem[],
  visibleTargetIndex: number,
): number {
  if (visibleColumnTasks.length === 0) {
    return allColumnTasks.length;
  }
  if (visibleTargetIndex <= 0) {
    const firstVisible = visibleColumnTasks[0];
    const idx = allColumnTasks.findIndex((t) => t.id === firstVisible.id);
    return idx >= 0 ? idx : 0;
  }
  if (visibleTargetIndex >= visibleColumnTasks.length) {
    const lastVisible = visibleColumnTasks[visibleColumnTasks.length - 1];
    const idx = allColumnTasks.findIndex((t) => t.id === lastVisible.id);
    return idx >= 0 ? idx + 1 : allColumnTasks.length;
  }
  const nextVisible = visibleColumnTasks[visibleTargetIndex];
  const idx = allColumnTasks.findIndex((t) => t.id === nextVisible.id);
  return idx >= 0 ? idx : allColumnTasks.length;
}

export function BoardKanbanView({
  detail,
  filteredTasks,
  canEdit,
  onSelectTask,
  filtersActive = false,
}: BoardKanbanViewProps) {
  const boardId = detail.board.id;
  const queryClient = useQueryClient();

  const moveTaskMutation = useMoveTaskMutation(boardId);
  const moveColumnMutation = useMoveColumnMutation(boardId);
  const createColumnMutation = useCreateColumnMutation(boardId);
  const deleteColumnMutation = useDeleteColumnMutation(boardId);

  const activeSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const emptySensors = useSensors();

  const [activeDrag, setActiveDrag] = useState<ActiveDragState>(null);
  const [dragOverPreview, setDragOverPreview] =
    useState<DragOverTaskPreview | null>(null);
  const [optimisticTasksById, setOptimisticTasksById] = useState<
    Record<string, TaskItem>
  >({});
  const [optimisticColumnPositions, setOptimisticColumnPositions] = useState<
    Record<string, number>
  >({});

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnIsDone, setNewColumnIsDone] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    column: BoardColumn;
    taskCount: number;
  } | null>(null);

  useEffect(() => {
    setActiveDrag(null);
    setDragOverPreview(null);
    setOptimisticTasksById({});
    setOptimisticColumnPositions({});
    setIsAddingColumn(false);
    setDeleteTarget(null);
  }, [boardId]);

  const sortedColumns = useMemo(() => {
    return detail.columns
      .map((col) =>
        optimisticColumnPositions[col.id] !== undefined
          ? { ...col, position: optimisticColumnPositions[col.id] }
          : col,
      )
      .sort((a, b) => a.position - b.position);
  }, [detail.columns, optimisticColumnPositions]);

  const columnsById = useMemo(
    () => new Map(sortedColumns.map((col) => [col.id, col])),
    [sortedColumns],
  );

  const tagsById = useMemo(
    () => new Map(detail.tags.map((tag) => [tag.id, tag])),
    [detail.tags],
  );

  const membersByUserId = useMemo(
    () => new Map(detail.members.map((member) => [member.userId, member])),
    [detail.members],
  );

  const baseAllTasks = useMemo(
    () =>
      detail.tasks.map((task) => optimisticTasksById[task.id] ?? task),
    [detail.tasks, optimisticTasksById],
  );

  const baseFilteredTasks = useMemo(
    () =>
      filteredTasks.map((task) => optimisticTasksById[task.id] ?? task),
    [filteredTasks, optimisticTasksById],
  );

  const previewFilteredTasks = useMemo(() => {
    if (!dragOverPreview) {
      return baseFilteredTasks;
    }
    return baseFilteredTasks.map((task) =>
      task.id === dragOverPreview.taskId
        ? { ...task, columnId: dragOverPreview.columnId }
        : task,
    );
  }, [baseFilteredTasks, dragOverPreview]);

  const visibleTasksByColumn = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>();
    for (const col of sortedColumns) {
      grouped.set(col.id, []);
    }
    for (const task of previewFilteredTasks) {
      if (dragOverPreview && task.id === dragOverPreview.taskId) {
        continue;
      }
      const bucket = grouped.get(task.columnId);
      if (bucket) {
        bucket.push(task);
      }
    }
    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => a.position - b.position);
    }
    if (dragOverPreview) {
      const movingTask = previewFilteredTasks.find(
        (t) => t.id === dragOverPreview.taskId,
      );
      const bucket = grouped.get(dragOverPreview.columnId);
      if (movingTask && bucket) {
        const clampedIndex = Math.max(
          0,
          Math.min(dragOverPreview.index, bucket.length),
        );
        bucket.splice(clampedIndex, 0, movingTask);
      }
    }
    return grouped;
  }, [sortedColumns, previewFilteredTasks, dragOverPreview]);

  const allTaskCountsByColumn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const col of sortedColumns) {
      counts.set(col.id, 0);
    }
    for (const task of baseAllTasks) {
      counts.set(task.columnId, (counts.get(task.columnId) ?? 0) + 1);
    }
    return counts;
  }, [sortedColumns, baseAllTasks]);

  const columnSortableIds = useMemo(
    () => sortedColumns.map((col) => `column:${col.id}`),
    [sortedColumns],
  );

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeType = args.active.data.current?.type;
    if (activeType === 'column') {
      const columnContainers = args.droppableContainers.filter(
        (container) => container.data.current?.type === 'column',
      );
      return closestCenter({
        ...args,
        droppableContainers: columnContainers,
      });
    }

    const taskContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === 'task',
    );
    const taskPointerCollisions = pointerWithin({
      ...args,
      droppableContainers: taskContainers,
    });
    if (taskPointerCollisions.length > 0) {
      return taskPointerCollisions;
    }

    const columnDropContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === 'column-drop',
    );
    const columnPointerCollisions = pointerWithin({
      ...args,
      droppableContainers: columnDropContainers,
    });
    if (columnPointerCollisions.length > 0) {
      return columnPointerCollisions;
    }

    return closestCorners({
      ...args,
      droppableContainers: [...taskContainers, ...columnDropContainers],
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) {
      return;
    }
    const data = event.active.data.current;
    if (data?.type === 'task' && data.task) {
      setActiveDrag({ type: 'task', taskId: (data.task as TaskItem).id });
      setDragOverPreview(null);
    } else if (data?.type === 'column' && data.column) {
      setActiveDrag({
        type: 'column',
        columnId: (data.column as BoardColumn).id,
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!canEdit) {
      return;
    }
    const { active, over } = event;
    if (!over || active.data.current?.type !== 'task') {
      return;
    }

    const activeTaskId = (active.data.current.task as TaskItem).id;
    const origTask = baseFilteredTasks.find((t) => t.id === activeTaskId);
    if (!origTask) {
      return;
    }

    const currentColumnId = dragOverPreview?.columnId ?? origTask.columnId;
    const overType = over.data.current?.type;
    const overColumnId = resolveOverColumnId(over, previewFilteredTasks);

    if (!overColumnId || overColumnId === currentColumnId) {
      return;
    }

    if (overColumnId === origTask.columnId) {
      setDragOverPreview(null);
      return;
    }

    const targetColTasks = (visibleTasksByColumn.get(overColumnId) ?? []).filter(
      (t) => t.id !== activeTaskId,
    );

    let insertIndex = targetColTasks.length;
    if (overType === 'task') {
      const overTaskId = (over.data.current?.task as TaskItem).id;
      const overIdx = targetColTasks.findIndex((t) => t.id === overTaskId);
      if (overIdx >= 0) {
        insertIndex = overIdx + (isActiveCenterBelowOver(active, over) ? 1 : 0);
      }
    }

    setDragOverPreview({
      taskId: activeTaskId,
      columnId: overColumnId,
      index: insertIndex,
    });
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
    setDragOverPreview(null);
  };

  const commitColumnMove = (active: Active, over: Over) => {
    const movingColumnId = (active.data.current?.column as BoardColumn).id;
    const overColumnId =
      (over.data.current?.column as BoardColumn | undefined)?.id ??
      (over.data.current?.columnId as string | undefined);

    if (!overColumnId || overColumnId === movingColumnId) {
      return;
    }

    const oldIndex = sortedColumns.findIndex((c) => c.id === movingColumnId);
    const overIndex = sortedColumns.findIndex((c) => c.id === overColumnId);
    if (oldIndex === -1 || overIndex === -1 || oldIndex === overIndex) {
      return;
    }

    const colsWithoutMoving = sortedColumns.filter(
      (c) => c.id !== movingColumnId,
    );
    const newPosition = calculateDropPosition(colsWithoutMoving, overIndex);

    setOptimisticColumnPositions((prev) => ({
      ...prev,
      [movingColumnId]: newPosition,
    }));

    moveColumnMutation.mutate(
      { columnId: movingColumnId, position: newPosition },
      {
        onSuccess: (updatedColumns) => {
          if (queryClient.getQueryData(boardKeys.detail(boardId))) {
            setOptimisticColumnPositions((prev) => {
              const next = { ...prev };
              delete next[movingColumnId];
              return next;
            });
            return;
          }
          const nextMap: Record<string, number> = {};
          for (const col of updatedColumns) {
            nextMap[col.id] = col.position;
          }
          setOptimisticColumnPositions(nextMap);
        },
        onError: () => {
          setOptimisticColumnPositions((prev) => {
            const next = { ...prev };
            delete next[movingColumnId];
            return next;
          });
        },
      },
    );
  };

  const commitTaskMove = (
    active: Active,
    over: Over,
    currentPreview: DragOverTaskPreview | null,
  ) => {
    const activeTaskId = (active.data.current?.task as TaskItem).id;
    const origTask = baseFilteredTasks.find((t) => t.id === activeTaskId);
    if (!origTask) {
      return;
    }

    const overType = over.data.current?.type;
    const overTaskId =
      overType === 'task' ? (over.data.current?.task as TaskItem).id : undefined;

    const targetColumnId =
      overTaskId === activeTaskId && currentPreview
        ? currentPreview.columnId
        : resolveOverColumnId(over, previewFilteredTasks);

    if (!targetColumnId) {
      return;
    }

    const visibleTargetTasksAll = baseFilteredTasks
      .filter((t) => t.columnId === targetColumnId)
      .sort((a, b) => a.position - b.position);

    const visibleTargetWithoutActive = visibleTargetTasksAll.filter(
      (t) => t.id !== activeTaskId,
    );

    let visibleTargetIndex = visibleTargetWithoutActive.length;

    if (targetColumnId === origTask.columnId) {
      const oldIndex = visibleTargetTasksAll.findIndex(
        (t) => t.id === activeTaskId,
      );
      if (overType === 'task' && overTaskId && overTaskId !== activeTaskId) {
        const overIndex = visibleTargetTasksAll.findIndex(
          (t) => t.id === overTaskId,
        );
        if (overIndex === -1 || overIndex === oldIndex) {
          return;
        }
        visibleTargetIndex = overIndex;
      } else if (oldIndex === visibleTargetTasksAll.length - 1) {
        return;
      }
    } else if (overType === 'task' && overTaskId) {
      if (overTaskId === activeTaskId) {
        visibleTargetIndex =
          currentPreview?.index ?? visibleTargetWithoutActive.length;
      } else {
        const overIdx = visibleTargetWithoutActive.findIndex(
          (t) => t.id === overTaskId,
        );
        if (overIdx >= 0) {
          visibleTargetIndex =
            overIdx + (isActiveCenterBelowOver(active, over) ? 1 : 0);
        }
      }
    }

    const allTargetWithoutActive = baseAllTasks
      .filter((t) => t.columnId === targetColumnId && t.id !== activeTaskId)
      .sort((a, b) => a.position - b.position);

    const effectiveIndex = getTargetIndexInColumn(
      allTargetWithoutActive,
      visibleTargetWithoutActive,
      visibleTargetIndex,
    );

    const newPosition = calculateDropPosition(
      allTargetWithoutActive,
      effectiveIndex,
    );

    if (
      targetColumnId === origTask.columnId &&
      newPosition === origTask.position
    ) {
      return;
    }

    const targetColumn = columnsById.get(targetColumnId);
    const now = new Date().toISOString();
    const nextCompleted = targetColumn
      ? targetColumn.isDoneColumn
      : origTask.completed;

    setOptimisticTasksById((prev) => ({
      ...prev,
      [origTask.id]: {
        ...origTask,
        columnId: targetColumnId,
        position: newPosition,
        completed: nextCompleted,
        completedAt: targetColumn
          ? nextCompleted
            ? (origTask.completedAt ?? now)
            : null
          : origTask.completedAt,
        updatedAt: now,
      },
    }));

    moveTaskMutation.mutate(
      {
        taskId: origTask.id,
        targetColumnId,
        position: newPosition,
      },
      {
        onSuccess: (moveResult) => {
          if (queryClient.getQueryData(boardKeys.detail(boardId))) {
            setOptimisticTasksById((prev) => {
              const next = { ...prev };
              delete next[origTask.id];
              return next;
            });
            return;
          }

          const positionMap = new Map(
            moveResult.columnPositions.map((p) => [p.id, p.position]),
          );
          setOptimisticTasksById((prev) => {
            const next: Record<string, TaskItem> = {
              ...prev,
              [moveResult.task.id]: moveResult.task,
            };
            for (const task of baseAllTasks) {
              if (task.id === moveResult.task.id) {
                continue;
              }
              const updatedPos = positionMap.get(task.id);
              if (updatedPos !== undefined) {
                next[task.id] = { ...task, position: updatedPos };
              }
            }
            return next;
          });
        },
        onError: () => {
          setOptimisticTasksById((prev) => {
            const next = { ...prev };
            delete next[origTask.id];
            return next;
          });
        },
      },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const currentPreview = dragOverPreview;
    setActiveDrag(null);
    setDragOverPreview(null);

    if (!canEdit || !event.over) {
      return;
    }

    const activeType = event.active.data.current?.type;
    if (activeType === 'column') {
      commitColumnMove(event.active, event.over);
      return;
    }
    if (activeType === 'task') {
      commitTaskMove(event.active, event.over, currentPreview);
    }
  };

  const handleCreateColumn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newColumnName.trim();
    if (!trimmed || !canEdit || createColumnMutation.isPending) {
      return;
    }
    createColumnMutation.mutate(
      {
        name: trimmed,
        isDoneColumn: newColumnIsDone,
      },
      {
        onSuccess: () => {
          setNewColumnName('');
          setNewColumnIsDone(false);
          setIsAddingColumn(false);
          toast.success('Coluna criada.');
        },
      },
    );
  };

  const handleConfirmEmptyDelete = () => {
    if (!deleteTarget) {
      return;
    }
    deleteColumnMutation.mutate(
      { columnId: deleteTarget.column.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          toast.success('Coluna removida.');
        },
      },
    );
  };

  const handleConfirmDeleteWithTasks = (choice: ColumnDeleteChoice) => {
    if (!deleteTarget) {
      return;
    }
    deleteColumnMutation.mutate(
      {
        columnId: deleteTarget.column.id,
        ...choice,
      },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          toast.success('Coluna removida.');
        },
      },
    );
  };

  const activeTaskOverlay =
    activeDrag?.type === 'task'
      ? baseFilteredTasks.find((t) => t.id === activeDrag.taskId) ?? null
      : null;

  const activeColumnOverlay =
    activeDrag?.type === 'column'
      ? columnsById.get(activeDrag.columnId) ?? null
      : null;

  const otherColumnsForDelete = useMemo(
    () =>
      deleteTarget
        ? sortedColumns.filter((c) => c.id !== deleteTarget.column.id)
        : [],
    [sortedColumns, deleteTarget],
  );

  return (
    <>
      <DndContext
        sensors={canEdit ? activeSensors : emptySensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 min-h-0 items-start gap-4 overflow-x-auto px-4 py-5 sm:px-6 snap-x snap-mandatory sm:snap-none scroll-smooth">
          {!canEdit && sortedColumns.length === 0 ? (
            <div className="w-full py-12 text-center text-sm text-muted-foreground">
              Este quadro ainda não possui colunas configuradas.
            </div>
          ) : null}

          <SortableContext
            items={columnSortableIds}
            strategy={horizontalListSortingStrategy}
          >
            {sortedColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                boardId={boardId}
                column={column}
                tasks={visibleTasksByColumn.get(column.id) ?? []}
                allColumnTaskCount={allTaskCountsByColumn.get(column.id) ?? 0}
                totalColumns={sortedColumns.length}
                tagsById={tagsById}
                membersByUserId={membersByUserId}
                canEdit={canEdit}
                filtersActive={filtersActive}
                onSelectTask={onSelectTask}
                onRequestDeleteColumn={(col, taskCount) =>
                  setDeleteTarget({ column: col, taskCount })
                }
              />
            ))}
          </SortableContext>

          {canEdit ? (
            <div className="w-[calc(100vw-2.5rem)] max-w-xs sm:w-72 shrink-0 snap-center sm:snap-align-none">
              {isAddingColumn ? (
                <form
                  onSubmit={handleCreateColumn}
                  className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-xs"
                >
                  <Input
                    autoFocus
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsAddingColumn(false);
                        setNewColumnName('');
                        setNewColumnIsDone(false);
                      }
                    }}
                    placeholder="Nome da coluna..."
                    aria-label="Nome da nova coluna"
                    maxLength={80}
                    disabled={createColumnMutation.isPending}
                  />

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="kanban-new-column-done"
                      checked={newColumnIsDone}
                      onCheckedChange={(checked) =>
                        setNewColumnIsDone(Boolean(checked))
                      }
                      disabled={createColumnMutation.isPending}
                    />
                    <Label
                      htmlFor="kanban-new-column-done"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Coluna de conclusão
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      variant="coral"
                      disabled={
                        !newColumnName.trim() || createColumnMutation.isPending
                      }
                    >
                      {createColumnMutation.isPending ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        'Criar coluna'
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAddingColumn(false);
                        setNewColumnName('');
                        setNewColumnIsDone(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingColumn(true)}
                  className="h-11 w-full justify-start gap-2 border-dashed bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nova coluna
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <DragOverlay>
          {activeTaskOverlay ? (
            <div className="w-72 sm:w-[298px]">
              <KanbanCardPreview
                task={activeTaskOverlay}
                tagsById={tagsById}
                membersByUserId={membersByUserId}
                canEdit={canEdit}
                isOverlay
              />
            </div>
          ) : activeColumnOverlay ? (
            <div className="w-72 sm:w-80 rounded-xl border border-brand-coral/50 bg-card/95 p-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {activeColumnOverlay.name}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  {(visibleTasksByColumn.get(activeColumnOverlay.id) ?? [])
                    .length}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        open={Boolean(deleteTarget && deleteTarget.taskCount === 0)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="Excluir coluna?"
        description={`Tem certeza que deseja excluir a coluna "${deleteTarget?.column.name ?? ''}"?`}
        confirmLabel="Excluir coluna"
        destructive
        loading={deleteColumnMutation.isPending}
        onConfirm={handleConfirmEmptyDelete}
      />

      <ColumnDeleteDialog
        open={Boolean(deleteTarget && deleteTarget.taskCount > 0)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        column={deleteTarget?.column ?? null}
        otherColumns={otherColumnsForDelete}
        taskCount={deleteTarget?.taskCount ?? 0}
        loading={deleteColumnMutation.isPending}
        onConfirm={handleConfirmDeleteWithTasks}
      />
    </>
  );
}
