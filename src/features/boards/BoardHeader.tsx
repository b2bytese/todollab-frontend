import { Kanban, List, Settings, Share2, Star } from 'lucide-react';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToggleFavoriteBoardMutation } from '@/features/boards/api';
import { BoardIcon } from '@/features/boards/boardIcons';
import { cn } from '@/lib/utils';
import type { BoardDetail, BoardView } from '@/types/api';

export interface BoardHeaderProps {
  detail: BoardDetail;
  activeView: BoardView;
  onChangeView: (view: BoardView) => void;
  onOpenShare: () => void;
  onOpenSettings: () => void;
  canEdit: boolean;
  isOwner: boolean;
}

export function BoardHeader({
  detail,
  activeView,
  onChangeView,
  onOpenShare,
  onOpenSettings,
  canEdit,
}: BoardHeaderProps) {
  const toggleFavoriteMutation = useToggleFavoriteBoardMutation();
  const { board, isFavorite, members, myRole } = detail;

  const visibleMembers = members.slice(0, 4);
  const extraMembers = Math.max(0, members.length - visibleMembers.length);

  return (
    <header className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          style={{ backgroundColor: board.color || '#0C2439' }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
        >
          <BoardIcon name={board.icon} className="h-5 w-5" />
        </span>

        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {board.name}
            </h1>

            {myRole === 'VIEWER' ? (
              <Badge variant="secondary" className="font-medium">
                Somente leitura
              </Badge>
            ) : null}

            <button
              type="button"
              onClick={() =>
                toggleFavoriteMutation.mutate({
                  boardId: board.id,
                  isFavorite: !isFavorite,
                })
              }
              aria-label={
                isFavorite ? 'Remover dos favoritos' : 'Favoritar quadro'
              }
              aria-pressed={isFavorite}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  isFavorite && 'fill-amber-400 text-amber-400',
                )}
                aria-hidden="true"
              />
            </button>
          </div>

          {board.description ? (
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {board.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        {visibleMembers.length > 0 ? (
          <div
            className="flex items-center -space-x-2 mr-1"
            aria-label={`${members.length} membros no quadro`}
          >
            {visibleMembers.map((member) => (
              <UserAvatar
                key={member.userId}
                name={member.name}
                avatarColor={member.avatarColor}
                size="sm"
                className="ring-2 ring-card"
              />
            ))}
            {extraMembers > 0 ? (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground ring-2 ring-card">
                +{extraMembers}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          role="group"
          aria-label="Alternar visualização"
          className="inline-flex items-center rounded-lg border border-border bg-background p-0.5"
        >
          <button
            type="button"
            aria-pressed={activeView === 'LIST'}
            onClick={() => onChangeView('LIST')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeView === 'LIST'
                ? 'bg-brand-navy text-white dark:bg-brand-coral dark:text-brand-coral-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" />
            Lista
          </button>
          <button
            type="button"
            aria-pressed={activeView === 'KANBAN'}
            onClick={() => onChangeView('KANBAN')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeView === 'KANBAN'
                ? 'bg-brand-navy text-white dark:bg-brand-coral dark:text-brand-coral-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Kanban className="h-3.5 w-3.5" aria-hidden="true" />
            Kanban
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenShare}
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Compartilhar
        </Button>

        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            aria-label="Configurações do quadro"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Configurações</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
