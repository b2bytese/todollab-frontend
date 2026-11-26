import { useState } from 'react';
import { Menu, Plus } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { AppLogo } from '@/components/common/AppLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { CreateBoardDialog } from '@/features/shell/CreateBoardDialog';
import { Sidebar } from '@/features/shell/Sidebar';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

export function AppShell() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileSidebarOpen = useUiStore((s) => s.mobileSidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);

  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface text-foreground">
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen shrink-0 border-r border-border bg-card transition-[width] duration-200',
          sidebarCollapsed ? 'w-[72px]' : 'w-68',
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onOpenCreateBoard={() => setCreateBoardOpen(true)}
        />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/95 px-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/app/my-tasks">
            <AppLogo />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="coral"
            size="icon"
            aria-label="Novo Quadro"
            onClick={() => setCreateBoardOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SheetDescription className="sr-only">
            Navegue entre Minhas Tarefas, seus quadros e configurações.
          </SheetDescription>
          <Sidebar
            onNavigate={() => setMobileSidebarOpen(false)}
            onOpenCreateBoard={() => {
              setMobileSidebarOpen(false);
              setCreateBoardOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>

      <CreateBoardDialog
        open={createBoardOpen}
        onOpenChange={setCreateBoardOpen}
      />
    </div>
  );
}
