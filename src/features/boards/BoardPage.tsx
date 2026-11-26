import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoardDetailQuery } from '@/features/boards/api';
import {
  BoardFilterBar,
  DEFAULT_BOARD_FILTERS,
  filterBoardTasks,
  hasActiveBoardFilters,
  type BoardFilters,
} from '@/features/boards/BoardFilterBar';
import { BoardHeader } from '@/features/boards/BoardHeader';
import { BoardKanbanView } from '@/features/boards/BoardKanbanView';
import { BoardListView } from '@/features/boards/BoardListView';
import { BoardSettingsDialog } from '@/features/boards/BoardSettingsDialog';
import { useBoardRealtime } from '@/features/boards/useBoardRealtime';
import { ShareBoardModal } from '@/features/invites/ShareBoardModal';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';
import { getApiError } from '@/lib/api';
import type { BoardView } from '@/types/api';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const detailQuery = useBoardDetailQuery(boardId);
  const detail = detailQuery.data;

  useBoardRealtime(boardId, Boolean(detail));

  const [viewOverrideState, setViewOverrideState] = useState<{
    boardId: string | undefined;
    view: BoardView;
  } | null>(null);
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_BOARD_FILTERS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const viewOverride =
    viewOverrideState && viewOverrideState.boardId === boardId
      ? viewOverrideState.view
      : null;

  useEffect(() => {
    setViewOverrideState(null);
    setFilters(DEFAULT_BOARD_FILTERS);
    setSettingsOpen(false);
    setShareOpen(false);
  }, [boardId]);

  const selectedTaskId = searchParams.get('task');

  const selectedTask = useMemo(() => {
    if (!detail || !selectedTaskId) {
      return null;
    }
    return detail.tasks.find((task) => task.id === selectedTaskId) ?? null;
  }, [detail, selectedTaskId]);

  useEffect(() => {
    if (detail && selectedTaskId && !selectedTask) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('task');
          return next;
        },
        { replace: true },
      );
    }
  }, [detail, selectedTaskId, selectedTask, setSearchParams]);

  useEffect(() => {
    if (!detail) {
      return;
    }
    setFilters((prev) => {
      const invalidAssignee =
        prev.assigneeId !== 'ALL' &&
        prev.assigneeId !== 'UNASSIGNED' &&
        !detail.members.some((member) => member.userId === prev.assigneeId);
      const invalidTag =
        prev.tagId !== 'ALL' &&
        !detail.tags.some((tag) => tag.id === prev.tagId);

      if (!invalidAssignee && !invalidTag) {
        return prev;
      }

      return {
        ...prev,
        assigneeId: invalidAssignee ? 'ALL' : prev.assigneeId,
        tagId: invalidTag ? 'ALL' : prev.tagId,
      };
    });
  }, [detail]);

  const filteredTasks = useMemo(() => {
    if (!detail) {
      return [];
    }
    return filterBoardTasks(detail.tasks, filters);
  }, [detail, filters]);

  const handleSelectTask = (taskId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('task', taskId);
        return next;
      },
      { replace: false },
    );
  };

  const handleDrawerOpenChange = (open: boolean) => {
    if (!open && selectedTaskId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('task');
          return next;
        },
        { replace: true },
      );
    }
  };

  const handleOpenShare = () => {
    setShareOpen(true);
  };

  if (detailQuery.isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 sm:p-6" aria-label="Carregando quadro">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    const message = detailQuery.error
      ? getApiError(detailQuery.error).detail ??
        'Não foi possível carregar este quadro.'
      : 'Quadro não encontrado.';

    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center space-y-4">
            <AlertCircle
              className="mx-auto h-10 w-10 text-destructive"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-foreground">
                Erro ao abrir quadro
              </h1>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void detailQuery.refetch()}
              >
                Tentar novamente
              </Button>
              <Button asChild variant="coral">
                <Link to="/app/my-tasks">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Voltar para Minhas Tarefas
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEdit = detail.myRole === 'OWNER' || detail.myRole === 'EDITOR';
  const isOwner = detail.myRole === 'OWNER';
  const activeView = viewOverride ?? detail.board.defaultView;
  const filtersActive = hasActiveBoardFilters(filters);

  return (
    <div
      className="flex flex-1 flex-col min-h-0"
      data-share-open={shareOpen ? 'true' : 'false'}
    >
      <BoardHeader
        detail={detail}
        activeView={activeView}
        onChangeView={(view) => setViewOverrideState({ boardId, view })}
        onOpenShare={handleOpenShare}
        onOpenSettings={() => setSettingsOpen(true)}
        canEdit={canEdit}
      />

      <BoardFilterBar
        filters={filters}
        onChange={setFilters}
        members={detail.members}
        tags={detail.tags}
      />

      {activeView === 'LIST' ? (
        <BoardListView
          boardId={detail.board.id}
          columns={detail.columns}
          tasks={filteredTasks}
          tags={detail.tags}
          members={detail.members}
          canEdit={canEdit}
          onSelectTask={handleSelectTask}
          filtersActive={filtersActive}
        />
      ) : (
        <BoardKanbanView
          detail={detail}
          filteredTasks={filteredTasks}
          canEdit={canEdit}
          onSelectTask={handleSelectTask}
          filtersActive={filtersActive}
        />
      )}

      <TaskDrawer
        open={Boolean(selectedTask)}
        onOpenChange={handleDrawerOpenChange}
        boardId={detail.board.id}
        task={selectedTask}
        columns={detail.columns}
        tags={detail.tags}
        members={detail.members}
        canEdit={canEdit}
      />

      <BoardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        detail={detail}
        canEdit={canEdit}
        isOwner={isOwner}
      />

      <ShareBoardModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        detail={detail}
      />
    </div>
  );
}
