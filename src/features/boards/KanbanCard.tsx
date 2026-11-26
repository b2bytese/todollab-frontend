import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, GripVertical, ListChecks } from 'lucide-react';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_META } from '@/features/boards/BoardFilterBar';
import { cn } from '@/lib/utils';
import type { BoardMember, BoardTag, TaskItem } from '@/types/api';

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

export interface KanbanCardPreviewProps {
  task: TaskItem;
  tagsById: Map<string, BoardTag>;
  membersByUserId: Map<string, BoardMember>;
  canEdit: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  onSelectTask?: (taskId: string) => void;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export function KanbanCardPreview({
  task,
  tagsById,
  membersByUserId,
  canEdit,
  isDragging = false,
  isOverlay = false,
  onSelectTask,
  dragHandleProps,
}: KanbanCardPreviewProps) {
  const priorityMeta = PRIORITY_META[task.priority];
  const assignee = task.assigneeId
    ? membersByUserId.get(task.assigneeId)
    : undefined;
  const taskTags = task.tagIds
    .map((id) => tagsById.get(id))
    .filter((tag): tag is BoardTag => Boolean(tag));
  const visibleTags = taskTags.slice(0, 3);
  const extraTags = taskTags.slice(3);

  const subtasksDone = task.subtasks.filter((s) => s.done).length;
  const subtasksTotal = task.subtasks.length;

  const todayIso = getLocalTodayIso();
  const isOverdue =
    task.dueDate !== null && task.dueDate < todayIso && !task.completed;

  return (
    <div
      className={cn(
        'group rounded-xl border border-border bg-card p-3 shadow-xs transition-shadow select-none',
        canEdit && !isOverlay && 'cursor-grab active:cursor-grabbing',
        !isOverlay && 'hover:border-border/90 hover:shadow-sm',
        isDragging && 'opacity-40',
        isOverlay && 'shadow-xl ring-2 ring-brand-coral/50 rotate-[1.5deg] cursor-grabbing',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isDragging && onSelectTask) {
              onSelectTask(task.id);
            }
          }}
          className={cn(
            'min-w-0 flex-1 text-left text-sm font-medium leading-snug transition-colors hover:text-brand-coral cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
            task.completed
              ? 'line-through text-muted-foreground'
              : 'text-foreground',
          )}
        >
          {task.title}
        </button>

        <button
          type="button"
          disabled={!canEdit}
          aria-label={`Arrastar tarefa ${task.title}`}
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'shrink-0 rounded p-0.5 text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            canEdit
              ? 'hover:bg-accent hover:text-foreground cursor-grab active:cursor-grabbing'
              : 'opacity-40 cursor-not-allowed',
          )}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {visibleTags.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              style={{
                backgroundColor: `${tag.color}1F`,
                color: tag.color,
                borderColor: `${tag.color}40`,
              }}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
            >
              {tag.name}
            </span>
          ))}
          {extraTags.length > 0 ? (
            <span
              title={extraTags.map((t) => t.name).join(', ')}
              className="inline-flex items-center rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
            >
              +{extraTags.length}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={priorityMeta.variant} className="text-[11px] px-2 py-0">
            {priorityMeta.label}
          </Badge>

          {task.dueDate ? (
            <span
              data-testid="kanban-card-due-date"
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                isOverdue
                  ? 'border-brand-coral/35 bg-brand-coral/10 text-brand-coral'
                  : 'border-border bg-background text-muted-foreground',
              )}
            >
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {formatDueDate(task.dueDate)}
            </span>
          ) : null}

          {subtasksTotal > 0 ? (
            <span
              title="Subtarefas concluídas"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              <ListChecks className="h-3 w-3" aria-hidden="true" />
              {subtasksDone}/{subtasksTotal}
            </span>
          ) : null}
        </div>

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
}

export interface KanbanCardProps {
  task: TaskItem;
  tagsById: Map<string, BoardTag>;
  membersByUserId: Map<string, BoardMember>;
  canEdit: boolean;
  onSelectTask: (taskId: string) => void;
}

export function KanbanCard({
  task,
  tagsById,
  membersByUserId,
  canEdit,
  onSelectTask,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task:${task.id}`,
    disabled: !canEdit,
    data: {
      type: 'task',
      task,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`kanban-card-${task.id}`}
      data-completed={task.completed ? 'true' : 'false'}
      data-drag-disabled={canEdit ? 'false' : 'true'}
      onPointerDown={(event) => {
        if (canEdit) {
          const handler = listeners?.onPointerDown as
            | ((e: React.PointerEvent<HTMLDivElement>) => void)
            | undefined;
          handler?.(event);
        }
      }}
      onClick={() => {
        if (!isDragging) {
          onSelectTask(task.id);
        }
      }}
    >
      <KanbanCardPreview
        task={task}
        tagsById={tagsById}
        membersByUserId={membersByUserId}
        canEdit={canEdit}
        isDragging={isDragging}
        onSelectTask={onSelectTask}
        dragHandleProps={{
          ...attributes,
          onKeyDown: canEdit
            ? (event) => {
                const handler = listeners?.onKeyDown as
                  | ((e: React.KeyboardEvent<HTMLButtonElement>) => void)
                  | undefined;
                handler?.(event);
              }
            : undefined,
        }}
      />
    </div>
  );
}
