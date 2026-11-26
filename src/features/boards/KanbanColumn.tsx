import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle2,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useUpdateColumnMutation } from '@/features/boards/api';
import { KanbanCard } from '@/features/boards/KanbanCard';
import { useCreateTaskMutation } from '@/features/tasks/api';
import { cn } from '@/lib/utils';
import type { BoardColumn, BoardMember, BoardTag, TaskItem } from '@/types/api';

export interface KanbanColumnProps {
  boardId: string;
  column: BoardColumn;
  tasks: TaskItem[];
  allColumnTaskCount: number;
  totalColumns: number;
  tagsById: Map<string, BoardTag>;
  membersByUserId: Map<string, BoardMember>;
  canEdit: boolean;
  filtersActive: boolean;
  onSelectTask: (taskId: string) => void;
  onRequestDeleteColumn: (column: BoardColumn, taskCount: number) => void;
}

export function KanbanColumn({
  boardId,
  column,
  tasks,
  allColumnTaskCount,
  totalColumns,
  tagsById,
  membersByUserId,
  canEdit,
  filtersActive,
  onSelectTask,
  onRequestDeleteColumn,
}: KanbanColumnProps) {
  const updateColumnMutation = useUpdateColumnMutation(boardId);
  const createTaskMutation = useCreateTaskMutation(boardId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(column.name);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const pendingRenameFocusRef = useRef(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
    }
  }, [isRenaming]);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column:${column.id}`,
    disabled: !canEdit,
    data: {
      type: 'column',
      column,
    },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column-drop:${column.id}`,
    disabled: !canEdit,
    data: {
      type: 'column-drop',
      columnId: column.id,
    },
  });

  const taskSortableIds = useMemo(
    () => tasks.map((task) => `task:${task.id}`),
    [tasks],
  );

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const commitRename = () => {
    const trimmed = renameDraft.trim();
    setIsRenaming(false);
    if (!trimmed || trimmed === column.name || !canEdit) {
      setRenameDraft(column.name);
      return;
    }
    updateColumnMutation.mutate({
      columnId: column.id,
      payload: { name: trimmed },
    });
  };

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !canEdit || createTaskMutation.isPending) {
      return;
    }
    createTaskMutation.mutate(
      {
        columnId: column.id,
        title: trimmed,
      },
      {
        onSuccess: () => {
          setNewTaskTitle('');
          setIsAddingTask(false);
        },
      },
    );
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      data-testid={`kanban-column-${column.id}`}
      aria-label={column.name}
      className={cn(
        'flex w-[calc(100vw-2.5rem)] max-w-xs sm:w-80 shrink-0 snap-center sm:snap-align-none flex-col max-h-full rounded-xl border border-border bg-secondary/30 shadow-xs transition-opacity',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            disabled={!canEdit}
            aria-label={`Mover coluna ${column.name}`}
            {...attributes}
            {...(canEdit ? listeners : {})}
            className={cn(
              'shrink-0 rounded p-1 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              canEdit
                ? 'hover:bg-accent hover:text-foreground cursor-grab active:cursor-grabbing'
                : 'opacity-40 cursor-not-allowed',
            )}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          {isRenaming && canEdit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitRename();
              }}
              className="min-w-0 flex-1"
            >
              <Input
                ref={renameInputRef}
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setRenameDraft(column.name);
                    setIsRenaming(false);
                  }
                }}
                aria-label={`Renomear coluna ${column.name}`}
                maxLength={80}
                className="h-7 px-2 text-sm font-semibold"
              />
            </form>
          ) : (
            <h2 className="truncate text-sm font-semibold text-foreground">
              {column.name}
            </h2>
          )}

          {column.isDoneColumn ? (
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-label="Coluna de conclusão"
            />
          ) : null}

          <Badge variant="secondary" className="shrink-0 text-[11px] px-2">
            {tasks.length}
          </Badge>
        </div>

        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Opções da coluna ${column.name}`}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(e) => {
                if (pendingRenameFocusRef.current) {
                  e.preventDefault();
                  pendingRenameFocusRef.current = false;
                  setRenameDraft(column.name);
                  setIsRenaming(true);
                  renameInputRef.current?.focus();
                }
              }}
            >
              <DropdownMenuItem
                onSelect={() => {
                  pendingRenameFocusRef.current = true;
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Renomear coluna
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  updateColumnMutation.mutate({
                    columnId: column.id,
                    payload: { isDoneColumn: !column.isDoneColumn },
                  })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {column.isDoneColumn
                  ? 'Desmarcar coluna de conclusão'
                  : 'Marcar como coluna de conclusão'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={totalColumns <= 1}
                onSelect={() =>
                  onRequestDeleteColumn(column, allColumnTaskCount)
                }
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div
        ref={setDroppableRef}
        data-testid={`kanban-column-drop-${column.id}`}
        className={cn(
          'flex-1 overflow-y-auto min-h-[112px] space-y-2.5 p-2.5 transition-colors',
          isOver && 'bg-brand-coral/5 ring-2 ring-inset ring-brand-coral/35',
        )}
      >
        <SortableContext
          items={taskSortableIds}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-editorial-border/40 dark:border-editorial-border/60 px-3 text-center text-xs text-muted-foreground">
              {filtersActive
                ? 'Nenhuma tarefa corresponde aos filtros.'
                : 'Arraste uma tarefa para cá ou crie uma nova.'}
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                tagsById={tagsById}
                membersByUserId={membersByUserId}
                canEdit={canEdit}
                onSelectTask={onSelectTask}
              />
            ))
          )}
        </SortableContext>
      </div>

      {canEdit ? (
        <div className="border-t border-border/70 p-2.5">
          {isAddingTask ? (
            <form onSubmit={handleCreateTask} className="space-y-2">
              <Input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                  }
                }}
                placeholder="Título da nova tarefa..."
                aria-label={`Nova tarefa em ${column.name}`}
                maxLength={200}
                className="h-8 bg-card"
                disabled={createTaskMutation.isPending}
              />
              <div className="flex items-center gap-1.5">
                <Button
                  type="submit"
                  size="sm"
                  variant="coral"
                  className="h-7 text-xs"
                  disabled={
                    !newTaskTitle.trim() || createTaskMutation.isPending
                  }
                >
                  {createTaskMutation.isPending ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    'Adicionar'
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setNewTaskTitle('');
                setIsAddingTask(true);
              }}
              className="w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Adicionar tarefa
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
