import { useMemo, useState, type FormEvent } from 'react';
import { ListChecks, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  useCreateSubtaskMutation,
  useDeleteSubtaskMutation,
  useUpdateSubtaskMutation,
} from '@/features/tasks/api';
import { cn } from '@/lib/utils';
import type { SubtaskItem } from '@/types/api';

export interface TaskSubtasksSectionProps {
  boardId: string;
  taskId: string;
  subtasks: SubtaskItem[];
  canEdit: boolean;
}

export function TaskSubtasksSection({
  boardId,
  taskId,
  subtasks,
  canEdit,
}: TaskSubtasksSectionProps) {
  const [newTitle, setNewTitle] = useState('');
  const createSubtaskMutation = useCreateSubtaskMutation(boardId);
  const updateSubtaskMutation = useUpdateSubtaskMutation(boardId);
  const deleteSubtaskMutation = useDeleteSubtaskMutation(boardId);

  const sortedSubtasks = useMemo(
    () => [...subtasks].sort((a, b) => a.position - b.position),
    [subtasks],
  );

  const doneCount = sortedSubtasks.filter((s) => s.done).length;
  const totalCount = sortedSubtasks.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleAddSubtask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || !canEdit || createSubtaskMutation.isPending) {
      return;
    }
    createSubtaskMutation.mutate(
      { taskId, title: trimmed },
      {
        onSuccess: () => {
          setNewTitle('');
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span>Subtarefas</span>
        </div>
        {totalCount > 0 ? (
          <span className="text-xs font-medium text-muted-foreground">
            {doneCount}/{totalCount}
          </span>
        ) : null}
      </div>

      {totalCount > 0 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-brand-coral transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      ) : null}

      {sortedSubtasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma subtarefa cadastrada.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sortedSubtasks.map((subtask) => (
            <li
              key={subtask.id}
              className="group flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-1.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Checkbox
                  checked={subtask.done}
                  disabled={!canEdit}
                  aria-label={
                    subtask.done
                      ? `Reabrir subtarefa ${subtask.title}`
                      : `Marcar subtarefa ${subtask.title} como concluída`
                  }
                  onCheckedChange={() =>
                    updateSubtaskMutation.mutate({
                      taskId,
                      subtaskId: subtask.id,
                      payload: { done: !subtask.done },
                    })
                  }
                />
                <span
                  className={cn(
                    'truncate text-sm',
                    subtask.done
                      ? 'line-through text-muted-foreground'
                      : 'text-foreground',
                  )}
                >
                  {subtask.title}
                </span>
              </div>

              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remover subtarefa ${subtask.title}`}
                  onClick={() =>
                    deleteSubtaskMutation.mutate({
                      taskId,
                      subtaskId: subtask.id,
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form
          onSubmit={handleAddSubtask}
          className="flex items-center gap-2"
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nova subtarefa..."
            aria-label="Nova subtarefa"
            maxLength={200}
            className="h-8 text-sm"
            disabled={createSubtaskMutation.isPending}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            disabled={!newTitle.trim() || createSubtaskMutation.isPending}
          >
            {createSubtaskMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              'Adicionar'
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
