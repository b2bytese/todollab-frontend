import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  Kanban,
  ListChecks,
  Plus,
  Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { boardKeys, useBoardsQuery } from '@/features/boards/api';
import { BoardIcon } from '@/features/boards/boardIcons';
import { PendingInvitesCard } from '@/features/dashboard/PendingInvitesCard';
import { CreateBoardDialog } from '@/features/shell/CreateBoardDialog';
import { api, getApiError } from '@/lib/api';
import { formatLocalDueDate, getLocalTodayIso } from '@/lib/date';
import { getPriorityMeta } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import type { MyTaskItem, TaskPriority } from '@/types/api';

type StatusFilter = 'all' | 'pending' | 'completed';
type PriorityFilter = 'ALL' | TaskPriority;

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'completed', label: 'Concluídas' },
];

const PRIORITY_OPTIONS: readonly { value: PriorityFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas prioridades' },
  { value: 'URGENT', label: 'Urgente' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'LOW', label: 'Baixa' },
];

interface TaskBuckets {
  overdue: MyTaskItem[];
  today: MyTaskItem[];
  upcoming: MyTaskItem[];
  noDate: MyTaskItem[];
  completedPast: MyTaskItem[];
}

function bucketTasks(tasks: MyTaskItem[], todayIso: string): TaskBuckets {
  const buckets: TaskBuckets = {
    overdue: [],
    today: [],
    upcoming: [],
    noDate: [],
    completedPast: [],
  };

  for (const task of tasks) {
    if (task.dueDate === null) {
      buckets.noDate.push(task);
    } else if (task.dueDate < todayIso) {
      if (task.completed) {
        buckets.completedPast.push(task);
      } else {
        buckets.overdue.push(task);
      }
    } else if (task.dueDate === todayIso) {
      buckets.today.push(task);
    } else {
      buckets.upcoming.push(task);
    }
  }

  return buckets;
}

async function fetchMyTasks(): Promise<MyTaskItem[]> {
  const { data } = await api.get<MyTaskItem[]>('/api/v1/users/me/tasks');
  return data;
}

export function MyTasksPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const tasksQuery = useQuery({
    queryKey: boardKeys.myTasks(),
    queryFn: fetchMyTasks,
  });

  const boardsQuery = useBoardsQuery();

  const toggleCompleteMutation = useMutation({
    mutationFn: async (task: MyTaskItem) => {
      await api.patch(
        `/api/v1/boards/${task.boardId}/tasks/${task.id}/toggle-complete`,
      );
      return task;
    },
    onMutate: async (targetTask) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.myTasks() });
      const previous = queryClient.getQueryData<MyTaskItem[]>(boardKeys.myTasks());

      if (previous) {
        queryClient.setQueryData<MyTaskItem[]>(
          boardKeys.myTasks(),
          previous.map((item) =>
            item.id === targetTask.id
              ? { ...item, completed: !item.completed }
              : item,
          ),
        );
      }

      return { previous };
    },
    onError: (err, _task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKeys.myTasks(), context.previous);
      }
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar o status da tarefa.',
      );
    },
    onSettled: (_data, _err, task) => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({
        queryKey: boardKeys.detail(task.boardId),
      });
    },
  });

  const todayIso = getLocalTodayIso();

  const filteredTasks = useMemo(() => {
    const items = tasksQuery.data ?? [];
    return items.filter((task) => {
      if (statusFilter === 'pending' && task.completed) {
        return false;
      }
      if (statusFilter === 'completed' && !task.completed) {
        return false;
      }
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [tasksQuery.data, statusFilter, priorityFilter]);

  const buckets = useMemo(
    () => bucketTasks(filteredTasks, todayIso),
    [filteredTasks, todayIso],
  );

  const sortedBoards = useMemo(() => {
    const boards = boardsQuery.data ?? [];
    return [...boards].sort(
      (a, b) => Number(b.isFavorite) - Number(a.isFavorite),
    );
  }, [boardsQuery.data]);

  const firstName = user?.name.trim().split(/\s+/)[0] || 'você';

  const sections = [
    {
      id: 'overdue',
      title: 'Atrasadas',
      tasks: buckets.overdue,
      icon: AlertTriangle,
      titleClassName: 'text-brand-coral',
      badgeVariant: 'coral' as const,
    },
    {
      id: 'today',
      title: 'Hoje',
      tasks: buckets.today,
      icon: Clock,
      titleClassName: 'text-foreground',
      badgeVariant: 'default' as const,
    },
    {
      id: 'upcoming',
      title: 'Próximas',
      tasks: buckets.upcoming,
      icon: CalendarClock,
      titleClassName: 'text-foreground',
      badgeVariant: 'secondary' as const,
    },
    {
      id: 'noDate',
      title: 'Sem data',
      tasks: buckets.noDate,
      icon: Inbox,
      titleClassName: 'text-muted-foreground',
      badgeVariant: 'outline' as const,
    },
    ...(buckets.completedPast.length > 0
      ? [
          {
            id: 'completedPast',
            title: 'Concluídas anteriores',
            tasks: buckets.completedPast,
            icon: CheckCircle2,
            titleClassName: 'text-muted-foreground',
            badgeVariant: 'success' as const,
          },
        ]
      : []),
  ];

  const hasAnyVisibleTask = filteredTasks.length > 0;

  return (
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-6xl w-full mx-auto space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Minhas Tarefas
          </h1>
          <p className="text-sm text-muted-foreground">
            Olá, {firstName}. Acompanhe suas entregas e quadros em um só lugar.
          </p>
        </div>

        <Button
          type="button"
          variant="coral"
          onClick={() => setCreateBoardOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo Quadro
        </Button>
      </header>

      <PendingInvitesCard />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por status">
          {STATUS_OPTIONS.map((option) => {
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-brand-navy text-white dark:bg-brand-coral dark:text-brand-coral-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por prioridade">
          {PRIORITY_OPTIONS.map((option) => {
            const active = priorityFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setPriorityFilter(option.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-brand-coral bg-brand-coral/15 text-brand-coral'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="space-y-3" aria-label="Carregando tarefas">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : tasksQuery.isError ? (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <p className="text-sm font-medium text-destructive">
              {getApiError(tasksQuery.error).detail ??
                'Não foi possível carregar suas tarefas.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void tasksQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : !hasAnyVisibleTask ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <CheckCircle2
              className="mx-auto h-9 w-9 text-muted-foreground/60"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-foreground">
              Nenhuma tarefa encontrada
            </p>
            <p className="text-xs text-muted-foreground">
              Ajuste os filtros acima ou crie novas tarefas dentro de um quadro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            if (section.tasks.length === 0) {
              return null;
            }
            const SectionIcon = section.icon;

            return (
              <section
                key={section.id}
                aria-label={section.title}
                className="space-y-2.5"
              >
                <div className="flex items-center gap-2">
                  <SectionIcon
                    className={cn('h-4 w-4', section.titleClassName)}
                    aria-hidden="true"
                  />
                  <h2
                    className={cn(
                      'text-sm font-semibold tracking-tight',
                      section.titleClassName,
                    )}
                  >
                    {section.title}
                  </h2>
                  <Badge variant={section.badgeVariant} className="text-[11px]">
                    {section.tasks.length}
                  </Badge>
                </div>

                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  {section.tasks.map((task) => {
                    const isOverdue =
                      task.dueDate !== null &&
                      task.dueDate < todayIso &&
                      !task.completed;
                    const priorityMeta = getPriorityMeta(task.priority);

                    return (
                      <div
                        key={task.id}
                        className="flex flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <Checkbox
                            className="mt-0.5"
                            checked={task.completed}
                            aria-label={
                              task.completed
                                ? `Reabrir ${task.title}`
                                : `Marcar ${task.title} como concluída`
                            }
                            onCheckedChange={() =>
                              toggleCompleteMutation.mutate(task)
                            }
                          />

                          <div className="min-w-0 space-y-1">
                            <Link
                              to={`/app/boards/${task.boardId}?task=${task.id}`}
                              className={cn(
                                'block truncate text-sm font-medium transition-colors hover:text-brand-coral',
                                task.completed
                                  ? 'line-through text-muted-foreground'
                                  : 'text-foreground',
                              )}
                            >
                              {task.title}
                            </Link>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
                                <span
                                  aria-hidden="true"
                                  style={{
                                    backgroundColor: task.boardColor || '#0C2439',
                                  }}
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                />
                                {task.boardName}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{task.columnName}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0 shrink-0">
                          {task.subtasksTotal > 0 ? (
                            <span
                              title="Subtarefas concluídas"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                              {task.subtasksDone}/{task.subtasksTotal}
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
                              {formatLocalDueDate(task.dueDate)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section aria-label="Acesso rápido aos quadros" className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Kanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Acesso rápido aos quadros
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateBoardOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Novo Quadro
          </Button>
        </div>

        {boardsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ) : boardsQuery.isError ? (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-sm font-medium text-destructive">
                {getApiError(boardsQuery.error).detail ??
                  'Não foi possível carregar seus quadros.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void boardsQuery.refetch()}
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : sortedBoards.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">
                Você ainda não participa de nenhum quadro
              </p>
              <p className="text-xs text-muted-foreground">
                Crie seu primeiro quadro para começar a organizar tarefas com sua equipe.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedBoards.map((board) => (
              <Link
                key={board.id}
                to={`/app/boards/${board.id}`}
                className="group rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:border-brand-coral/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      style={{ backgroundColor: board.color || '#0C2439' }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-xs"
                    >
                      <BoardIcon name={board.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-brand-coral transition-colors">
                        {board.name}
                      </h3>
                      {board.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {board.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {board.isFavorite ? (
                    <Star
                      aria-label="Quadro favorito"
                      className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400"
                    />
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <strong className="font-semibold text-foreground">
                      {board.openTasksCount}
                    </strong>{' '}
                    abertas
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong className="font-semibold text-foreground">
                      {board.completedTasksCount}
                    </strong>{' '}
                    concluídas
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreateBoardDialog
        open={createBoardOpen}
        onOpenChange={setCreateBoardOpen}
      />
    </div>
  );
}
