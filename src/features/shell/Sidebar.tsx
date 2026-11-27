import {
  CheckSquare,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Star,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLogo } from '@/components/common/AppLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { logout } from '@/features/auth/api';
import {
  useBoardsQuery,
  usePendingInvitesQuery,
  useToggleFavoriteBoardMutation,
} from '@/features/boards/api';
import { BoardIcon } from '@/features/boards/boardIcons';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { BoardSummary } from '@/types/api';

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onOpenCreateBoard: () => void;
}

interface BoardSectionProps {
  title: string;
  boards: BoardSummary[];
  collapsed: boolean;
  emptyText?: string;
  onNavigate?: () => void;
  onToggleFavorite: (board: BoardSummary) => void;
}

function BoardSection({
  title,
  boards,
  collapsed,
  emptyText,
  onNavigate,
  onToggleFavorite,
}: BoardSectionProps) {
  return (
    <section aria-label={title} className="space-y-2">
      {!collapsed ? (
        <h2 className="mb-2 px-2.5 text-xs font-medium text-muted-foreground">
          {title}
        </h2>
      ) : null}

      {boards.length === 0 && !collapsed && emptyText ? (
        <p className="px-2.5 py-1 text-xs text-muted-foreground/80">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {boards.map((board) => (
            <li key={board.id} className="group relative flex items-center">
              <NavLink
                to={`/app/boards/${board.id}`}
                onClick={onNavigate}
                title={collapsed ? board.name : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                  )
                }
              >
                <span
                  style={{ backgroundColor: board.color || '#0C2439' }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white shadow-2xs"
                >
                  <BoardIcon name={board.icon} className="h-3.5 w-3.5" />
                </span>
                {!collapsed ? (
                  <span className="truncate flex-1 pr-6">{board.name}</span>
                ) : null}
              </NavLink>

              {!collapsed ? (
                <button
                  type="button"
                  aria-label={
                    board.isFavorite
                      ? `Remover ${board.name} dos favoritos`
                      : `Favoritar ${board.name}`
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleFavorite(board);
                  }}
                  className={cn(
                    'absolute right-1.5 rounded-md p-1 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    board.isFavorite
                      ? 'opacity-100 text-amber-500 hover:text-amber-600'
                      : 'opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Star
                    className={cn(
                      'h-3.5 w-3.5',
                      board.isFavorite && 'fill-current',
                    )}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  onOpenCreateBoard,
}: SidebarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const boardsQuery = useBoardsQuery();
  const pendingInvitesQuery = usePendingInvitesQuery();
  const toggleFavoriteMutation = useToggleFavoriteBoardMutation();

  const boards = boardsQuery.data ?? [];
  const favoriteBoards = boards.filter((board) => board.isFavorite);
  const ownedBoards = boards.filter((board) => board.myRole === 'OWNER');
  const sharedBoards = boards.filter((board) => board.myRole !== 'OWNER');
  const pendingInvitesCount = pendingInvitesQuery.data?.length ?? 0;

  const handleToggleFavorite = (board: BoardSummary) => {
    toggleFavoriteMutation.mutate({
      boardId: board.id,
      isFavorite: !board.isFavorite,
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Clear local session regardless of server logout response.
    } finally {
      clearSession();
      useUiStore.getState().setMobileSidebarOpen(false);
      toast.success('Sessão encerrada.');
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground select-none">
      <div
        className={cn(
          'flex h-14 items-center border-b border-border px-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <NavLink
          to="/app/my-tasks"
          onClick={onNavigate}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AppLogo compact={collapsed} showText={!collapsed} />
        </NavLink>

        {onToggleCollapse && !collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            aria-label="Recolher barra lateral"
            className="h-8 w-8 text-muted-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {onToggleCollapse && collapsed ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            aria-label="Expandir barra lateral"
            className="h-8 w-8 text-muted-foreground"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="p-3 space-y-1.5">
        <NavLink
          to="/app/my-tasks"
          onClick={onNavigate}
          title={collapsed ? 'Minhas Tarefas' : undefined}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-brand-navy text-white font-medium dark:bg-brand-coral dark:text-brand-coral-foreground'
                : 'text-foreground hover:bg-accent',
            )
          }
        >
          <CheckSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed ? (
            <span className="flex-1 truncate">Minhas Tarefas</span>
          ) : null}
          {pendingInvitesCount > 0 ? (
            <Badge
              variant="coral"
              aria-label={`${pendingInvitesCount} ${
                pendingInvitesCount === 1
                  ? 'convite pendente'
                  : 'convites pendentes'
              }`}
              className={cn(
                'px-1.5 py-0 text-[11px] leading-5',
                collapsed && 'absolute -right-0.5 -top-0.5 px-1 text-[10px] leading-4',
              )}
            >
              {pendingInvitesCount}
            </Badge>
          ) : null}
        </NavLink>

        <NavLink
          to="/app/settings"
          onClick={onNavigate}
          title={collapsed ? 'Configurações' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed ? <span className="truncate">Configurações</span> : null}
        </NavLink>

        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size={collapsed ? 'icon' : 'sm'}
            onClick={onOpenCreateBoard}
            aria-label="Novo Quadro"
            title={collapsed ? 'Novo Quadro' : undefined}
            className={cn(
              'w-full border-dashed border-border hover:border-brand-coral/60 hover:text-brand-coral',
              !collapsed && 'justify-start',
            )}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed ? <span>Novo Quadro</span> : null}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {boardsQuery.isLoading ? (
          <div className="space-y-2 px-1" aria-label="Carregando quadros">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ) : boardsQuery.isError ? (
          <div className="rounded-lg border border-border bg-surface p-2.5 text-center space-y-2">
            {!collapsed ? (
              <p className="text-xs text-muted-foreground">
                Erro ao carregar quadros.
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void boardsQuery.refetch()}
              className="w-full"
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {favoriteBoards.length > 0 ? (
              <BoardSection
                title="Favoritos"
                boards={favoriteBoards}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onToggleFavorite={handleToggleFavorite}
              />
            ) : null}

            <BoardSection
              title="Meus Quadros"
              boards={ownedBoards}
              collapsed={collapsed}
              emptyText="Nenhum quadro criado ainda."
              onNavigate={onNavigate}
              onToggleFavorite={handleToggleFavorite}
            />

            <BoardSection
              title="Compartilhados comigo"
              boards={sharedBoards}
              collapsed={collapsed}
              emptyText="Nenhum quadro compartilhado."
              onNavigate={onNavigate}
              onToggleFavorite={handleToggleFavorite}
            />
          </>
        )}
      </div>

      <Separator />

      <div
        className={cn(
          'p-3 flex items-center gap-2',
          collapsed ? 'flex-col justify-center' : 'justify-between',
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu do usuário"
              className={cn(
                'flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer min-w-0',
                !collapsed && 'flex-1',
              )}
            >
              <UserAvatar
                name={user?.name ?? 'Usuário'}
                avatarColor={user?.avatarColor}
                size="sm"
              />
              {!collapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {user?.name ?? 'Usuário'}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {user?.email ?? ''}
                    </p>
                  </div>
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-xs font-semibold text-foreground">
                {user?.name ?? 'Usuário'}
              </p>
              <p className="truncate text-[11px] font-normal text-muted-foreground">
                {user?.email ?? ''}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onNavigate?.();
                navigate('/app/settings');
              }}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void handleLogout()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle className="shrink-0" />
      </div>
    </div>
  );
}
