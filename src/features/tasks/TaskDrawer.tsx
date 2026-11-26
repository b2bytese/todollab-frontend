import { useEffect, useRef, useState } from 'react';
import { Calendar, CheckCircle2, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  useDeleteTaskMutation,
  useToggleTaskCompleteMutation,
  useUpdateTaskMutation,
} from '@/features/tasks/api';
import { TaskSubtasksSection } from '@/features/tasks/TaskSubtasksSection';
import { TaskTagsPopover } from '@/features/tasks/TaskTagsPopover';
import { cn } from '@/lib/utils';
import type {
  BoardColumn,
  BoardMember,
  BoardTag,
  TaskItem,
  TaskPriority,
} from '@/types/api';

const UNASSIGNED_VALUE = '__UNASSIGNED__';

const PRIORITY_OPTIONS: readonly { value: TaskPriority; label: string }[] = [
  { value: 'URGENT', label: 'Urgente' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'LOW', label: 'Baixa' },
];

export interface TaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  task: TaskItem | null;
  columns: BoardColumn[];
  tags: BoardTag[];
  members: BoardMember[];
  canEdit: boolean;
}

export function TaskDrawer({
  open,
  onOpenChange,
  boardId,
  task,
  columns,
  tags,
  members,
  canEdit,
}: TaskDrawerProps) {
  const updateTaskMutation = useUpdateTaskMutation(boardId);
  const toggleCompleteMutation = useToggleTaskCompleteMutation(boardId);
  const deleteTaskMutation = useDeleteTaskMutation(boardId);

  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const lastSubmittedTitleRef = useRef<{ taskId: string; value: string } | null>(
    null,
  );
  const lastSubmittedDescriptionRef = useRef<{
    taskId: string;
    value: string;
  } | null>(null);

  const taskId = task?.id;
  const taskTitle = task?.title;
  const taskDescription = task?.description ?? '';
  const hasTask = Boolean(task);

  useEffect(() => {
    if (taskId !== undefined && taskTitle !== undefined) {
      setTitleDraft(taskTitle);
      setDescriptionDraft(taskDescription);
      lastSubmittedTitleRef.current = null;
      lastSubmittedDescriptionRef.current = null;
    }
  }, [taskId, taskTitle, taskDescription]);

  useEffect(() => {
    if (!hasTask && !deleteTaskMutation.isPending) {
      setConfirmDeleteOpen(false);
    }
  }, [hasTask, deleteTaskMutation.isPending]);

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  const handleTitleCommit = () => {
    if (!task || !canEdit) {
      return;
    }
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(task.title);
      return;
    }
    if (
      trimmed !== task.title &&
      !(
        lastSubmittedTitleRef.current?.taskId === task.id &&
        lastSubmittedTitleRef.current.value === trimmed
      )
    ) {
      lastSubmittedTitleRef.current = { taskId: task.id, value: trimmed };
      updateTaskMutation.mutate(
        {
          taskId: task.id,
          payload: { title: trimmed },
        },
        {
          onError: () => {
            if (lastSubmittedTitleRef.current?.taskId === task.id) {
              lastSubmittedTitleRef.current = null;
            }
          },
        },
      );
    }
  };

  const handleDescriptionCommit = () => {
    if (!task || !canEdit) {
      return;
    }
    const trimmed = descriptionDraft.trim();
    const current = task.description ?? '';
    if (
      trimmed !== current &&
      !(
        lastSubmittedDescriptionRef.current?.taskId === task.id &&
        lastSubmittedDescriptionRef.current.value === trimmed
      )
    ) {
      lastSubmittedDescriptionRef.current = { taskId: task.id, value: trimmed };
      updateTaskMutation.mutate(
        {
          taskId: task.id,
          payload: { description: trimmed || null },
        },
        {
          onError: () => {
            if (lastSubmittedDescriptionRef.current?.taskId === task.id) {
              lastSubmittedDescriptionRef.current = null;
            }
          },
        },
      );
    }
  };

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleTitleCommit();
      handleDescriptionCommit();
    }
    onOpenChange(nextOpen);
  };

  const handleConfirmDelete = () => {
    if (!task || !canEdit) {
      return;
    }
    deleteTaskMutation.mutate(task.id, {
      onSuccess: () => {
        setConfirmDeleteOpen(false);
        onOpenChange(false);
      },
    });
  };

  return (
    <>
      <Sheet open={open && Boolean(task)} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto gap-5 p-6"
        >
          {task ? (
            <>
              <SheetHeader className="pr-8">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={task.completed ? 'secondary' : 'outline'}
                    disabled={!canEdit}
                    onClick={() => toggleCompleteMutation.mutate(task)}
                    className={cn(
                      'h-8 gap-1.5',
                      task.completed &&
                        'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {task.completed ? 'Concluída' : 'Marcar como concluída'}
                  </Button>
                </div>
                <SheetTitle className="sr-only">Detalhes da tarefa</SheetTitle>
                <SheetDescription className="sr-only">
                  Visualize e edite os campos, etiquetas e subtarefas desta tarefa.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="drawer-task-title">Título da tarefa</Label>
                  <Input
                    id="drawer-task-title"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleTitleCommit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    disabled={!canEdit}
                    maxLength={200}
                    className="text-base font-semibold"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="drawer-task-column">Coluna</Label>
                    <Select
                      value={task.columnId}
                      disabled={!canEdit}
                      onValueChange={(columnId) => {
                        if (columnId !== task.columnId) {
                          updateTaskMutation.mutate({
                            taskId: task.id,
                            payload: { columnId },
                          });
                        }
                      }}
                    >
                      <SelectTrigger id="drawer-task-column">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedColumns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="drawer-task-priority">Prioridade</Label>
                    <Select
                      value={task.priority}
                      disabled={!canEdit}
                      onValueChange={(priority) => {
                        if (priority !== task.priority) {
                          updateTaskMutation.mutate({
                            taskId: task.id,
                            payload: { priority: priority as TaskPriority },
                          });
                        }
                      }}
                    >
                      <SelectTrigger id="drawer-task-priority">
                        <SelectValue placeholder="Selecione a prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="drawer-task-assignee">Responsável</Label>
                    <Select
                      value={task.assigneeId ?? UNASSIGNED_VALUE}
                      disabled={!canEdit}
                      onValueChange={(value) => {
                        if (value === UNASSIGNED_VALUE) {
                          if (task.assigneeId !== null) {
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              payload: { clearAssignee: true },
                            });
                          }
                          return;
                        }
                        if (value !== task.assigneeId) {
                          updateTaskMutation.mutate({
                            taskId: task.id,
                            payload: { assigneeId: value },
                          });
                        }
                      }}
                    >
                      <SelectTrigger id="drawer-task-assignee">
                        <SelectValue placeholder="Sem responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED_VALUE}>
                          Sem responsável
                        </SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.userId} value={member.userId}>
                            <span className="inline-flex items-center gap-2">
                              <UserAvatar
                                name={member.name}
                                avatarColor={member.avatarColor}
                                size="xs"
                              />
                              <span>{member.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="drawer-task-due-date">Data de entrega</Label>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <Calendar
                          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          id="drawer-task-due-date"
                          type="date"
                          value={task.dueDate ?? ''}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!next) {
                              if (task.dueDate !== null) {
                                updateTaskMutation.mutate({
                                  taskId: task.id,
                                  payload: { clearDueDate: true },
                                });
                              }
                            } else if (next !== task.dueDate) {
                              updateTaskMutation.mutate({
                                taskId: task.id,
                                payload: { dueDate: next },
                              });
                            }
                          }}
                          className="pl-8"
                        />
                      </div>
                      {canEdit && task.dueDate ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          aria-label="Limpar data"
                          title="Limpar data"
                          onClick={() =>
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              payload: { clearDueDate: true },
                            })
                          }
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Etiquetas</Label>
                  <TaskTagsPopover
                    boardId={boardId}
                    boardTags={tags}
                    selectedTagIds={task.tagIds}
                    canEdit={canEdit}
                    onChangeTagIds={(tagIds) =>
                      updateTaskMutation.mutate({
                        taskId: task.id,
                        payload: { tagIds },
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="drawer-task-description">Descrição</Label>
                  <Textarea
                    id="drawer-task-description"
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onBlur={handleDescriptionCommit}
                    disabled={!canEdit}
                    rows={4}
                    placeholder="Adicione detalhes, links ou critérios de aceite..."
                  />
                </div>

                <Separator />

                <TaskSubtasksSection
                  boardId={boardId}
                  taskId={task.id}
                  subtasks={task.subtasks}
                  canEdit={canEdit}
                />

                {canEdit ? (
                  <>
                    <Separator />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDeleteOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Excluir tarefa
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir tarefa?"
        description={
          task
            ? `Tem certeza que deseja excluir "${task.title}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteTaskMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
