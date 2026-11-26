import { useMemo, useState, type FormEvent } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Loader2,
  Plus,
} from 'lucide-react';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PRIORITY_META } from '@/features/boards/BoardFilterBar';
import {
  useCreateTaskMutation,
  useToggleTaskCompleteMutation,
} from '@/features/tasks/api';
import { cn } from '@/lib/utils';
import type {
  BoardColumn,
  BoardMember,
  BoardTag,
  TaskItem,
} from '@/types/api';

function getLocalTodayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDueDate(dueDate: string): string {
  const parts = dueDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return dueDate;
  }
  const [year, month, day] = parts;
  const localDate = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(localDate);
}

export interface BoardListViewProps {
  boardId: string;
  columns: BoardColumn[];
  tasks: TaskItem[];
  tags: BoardTag[];
  members: BoardMember[];
  canEdit: boolean;
  onSelectTask: (taskId: string) => void;
  filtersActive?: boolean;
}

export function BoardListView({
  boardId,
  columns,
  tasks,
  tags,
  members,
  canEdit,
  onSelectTask,
  filtersActive = false,
}: BoardListViewProps) {
  const toggleCompleteMutation = useToggleTaskCompleteMutation(boardId);
  const createTaskMutation = useCreateTaskMutation(boardId);

  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [addingInColumnId, setAddingInColumnId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const todayIso = getLocalTodayIso();

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );

  const tagById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const tasksByColumn = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>();
    for (const col of sortedColumns) {
      grouped.set(col.id, []);
    }
    for (const task of tasks) {
      const bucket = grouped.get(task.columnId);
      if (bucket) {
        bucket.push(task);
      }
    }
    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => a.position - b.position);
    }
    return grouped;
  }, [sortedColumns, tasks]);

  const toggleColumnCollapsed = (columnId: string) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  const handleCreateTask = (
    event: FormEvent<HTMLFormElement>,
    columnId: string,
  ) => {
    event.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !canEdit || createTaskMutation.isPending) {
      return;
    }
    createTaskMutation.mutate(
      {
        columnId,
        title: trimmed,
      },
      {
        onSuccess: () => {
          setNewTaskTitle('');
          setAddingInColumnId(null);
        },
      },
    );
  };

  if (sortedColumns.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Este quadro ainda não possui colunas configuradas.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5">
      {sortedColumns.map((column) => {
        const columnTasks = tasksByColumn.get(column.id) ?? [];
        const isCollapsed = Boolean(collapsedColumns[column.id]);
        const isAddingHere = addingInColumnId === column.id;

        return (
          <section
            key={column.id}
            aria-label={column.name}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-secondary/40 px-4 py-2.5">
              <button
                type="button"
                onClick={() => toggleColumnCollapsed(column.id)}
                aria-expanded={!isCollapsed}
                className="flex items-center gap-2 text-left text-sm font-semibold text-foreground hover:text-brand-coral transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span>{column.name}</span>
                {column.isDoneColumn ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-label="Coluna de conclusão"
                  />
                ) : null}
                <Badge variant="secondary" className="text-[11px]">
                  {columnTasks.length}
                </Badge>
              </button>

              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCollapsedColumns((prev) => ({
                      ...prev,
                      [column.id]: false,
                    }));
                    setNewTaskTitle('');
                    setAddingInColumnId(column.id);
                  }}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Adicionar tarefa
                </Button>
              ) : null}
            </div>

            {!isCollapsed ? (
              <div className="divide-y divide-border/70">
                {columnTasks.length === 0 && !isAddingHere ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">
                    {filtersActive
                      ? 'Nenhuma tarefa corresponde aos filtros nesta coluna.'
                      : 'Nenhuma tarefa nesta coluna.'}
                  </p>
                ) : (
                  columnTasks.map((task) => {
                    const priorityMeta = PRIORITY_META[task.priority];
                    const assignee = task.assigneeId
                      ? memberByUserId.get(task.assigneeId)
                      : undefined;
                    const taskTags = task.tagIds
                      .map((id) => tagById.get(id))
                      .filter((t): t is BoardTag => Boolean(t));
                    const subtasksDone = task.subtasks.filter((s) => s.done).length;
                    const subtasksTotal = task.subtasks.length;
                    const isOverdue =
                      task.dueDate !== null &&
                      task.dueDate < todayIso &&
                      !task.completed;

                    return (
                      <div
                        key={task.id}
                        className="flex flex-col gap-2 px-4 py-2.5 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Checkbox
                            checked={task.completed}
                            disabled={!canEdit}
                            aria-label={
                              task.completed
                                ? `Reabrir ${task.title}`
                                : `Marcar ${task.title} como concluída`
                            }
                            onCheckedChange={() =>
                              toggleCompleteMutation.mutate(task)
                            }
                          />

                          <button
                            type="button"
                            onClick={() => onSelectTask(task.id)}
                            className={cn(
                              'min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors hover:text-brand-coral cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
                              task.completed
                                ? 'line-through text-muted-foreground'
                                : 'text-foreground',
                            )}
                          >
                            {task.title}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0 shrink-0">
                          {taskTags.map((tag) => (
                            <span
                              key={tag.id}
                              style={{
                                backgroundColor: `${tag.color}1F`,
                                color: tag.color,
                                borderColor: `${tag.color}40`,
                              }}
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                            >
                              {tag.name}
                            </span>
                          ))}

                          {subtasksTotal > 0 ? (
                            <span
                              title="Subtarefas concluídas"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                              {subtasksDone}/{subtasksTotal}
                            </span>
                          ) : null}

                          <Badge variant={priorityMeta.variant}>
                            {priorityMeta.label}
                          </Badge>

                          {task.dueDate ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
                                isOverdue
                                  ? 'border-brand-coral/35 bg-brand-coral/10 text-brand-coral'
                                  : 'border-border bg-background text-muted-foreground',
                              )}
                            >
                              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatDueDate(task.dueDate)}
                            </span>
                          ) : null}

                          {assignee ? (
                            <UserAvatar
                              name={assignee.name}
                              avatarColor={assignee.avatarColor}
                              size="xs"
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}

                {canEdit && isAddingHere ? (
                  <form
                    onSubmit={(e) => handleCreateTask(e, column.id)}
                    className="flex flex-wrap items-center gap-2 bg-secondary/20 px-4 py-2.5"
                  >
                    <Input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setAddingInColumnId(null);
                          setNewTaskTitle('');
                        }
                      }}
                      placeholder="Título da nova tarefa..."
                      aria-label={`Nova tarefa em ${column.name}`}
                      maxLength={200}
                      className="h-8 flex-1 min-w-[200px]"
                      disabled={createTaskMutation.isPending}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="coral"
                      className="h-8"
                      disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                    >
                      {createTaskMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        'Adicionar'
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => {
                        setAddingInColumnId(null);
                        setNewTaskTitle('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
