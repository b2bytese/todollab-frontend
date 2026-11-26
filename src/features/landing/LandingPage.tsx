import { useState, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Kanban,
  ListChecks,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLogo } from '@/components/common/AppLogo';
import { B2byteSignature } from '@/components/common/B2byteSignature';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const PREVIEW_COLUMNS = [
  {
    title: 'A fazer',
    count: 2,
    done: false,
    tasks: [
      {
        title: 'Definir metas do trimestre',
        tag: 'Produto',
        tagColor: '#0C2439',
        priority: 'Alta',
        subtasks: '1/3',
        initials: 'AS',
        avatarColor: '#0C2439',
      },
      {
        title: 'Revisar convites da equipe',
        tag: 'Time',
        tagColor: '#7C3AED',
        priority: 'Média',
        subtasks: '0/2',
        initials: 'BC',
        avatarColor: '#FF4B4B',
      },
    ],
  },
  {
    title: 'Em andamento',
    count: 1,
    done: false,
    tasks: [
      {
        title: 'Publicar nova landing page',
        tag: 'Design',
        tagColor: '#FF4B4B',
        priority: 'Urgente',
        subtasks: '3/4',
        initials: 'CD',
        avatarColor: '#0D9488',
      },
    ],
  },
  {
    title: 'Concluído',
    count: 1,
    done: true,
    tasks: [
      {
        title: 'Configurar fluxo de e-mails',
        tag: 'Infra',
        tagColor: '#2563EB',
        priority: 'Concluída',
        subtasks: '2/2',
        initials: 'AS',
        avatarColor: '#0C2439',
      },
    ],
  },
] as const;

const FEATURE_TABS = [
  {
    id: 'kanban',
    label: 'Kanban',
    title: 'Visualize o progresso.',
    description:
      'Arraste tarefas entre etapas, organize prioridades e acompanhe o trabalho da equipe em um único quadro visual.',
    benefits: [
      'Arrastar e soltar intuitivo',
      'Prioridades visuais por cor',
      'Colaboração em tempo real',
    ],
  },
  {
    id: 'lista',
    label: 'Lista',
    title: 'Todas as tarefas, uma visão.',
    description:
      'Consulte suas entregas em uma lista organizada, filtre por prioridade e acompanhe subtarefas rapidamente.',
    benefits: [
      'Visão compacta e linear',
      'Filtros de prioridade rápidos',
      'Subtarefas integradas',
    ],
  },
  {
    id: 'my-tasks',
    label: 'Minhas Tarefas',
    title: 'Nunca perca o próximo passo.',
    description:
      'Visualize tudo o que é sua responsabilidade, agrupado por prazo — Hoje, Próximas e Sem data.',
    benefits: [
      'Atrasadas em destaque coral',
      'Agrupamento automático por prazo',
      'Acesso direto aos quadros',
    ],
  },
  {
    id: 'colaboracao',
    label: 'Colaboração',
    title: 'Sua equipe em sintonia.',
    description:
      'Convide membros por e-mail com papéis definidos (Proprietário, Editor, Visualizador) e sincronize em tempo real.',
    benefits: [
      'Convites por e-mail',
      'Controle de permissões',
      'Sincronização via WebSocket',
    ],
  },
] as const;
type TabId = 'kanban' | 'lista' | 'my-tasks' | 'colaboracao';

const HOW_IT_WORKS = [
  {
    num: '01.',
    title: 'Crie seu quadro',
    description:
      'Organize projetos em etapas que fazem sentido para você. Personalize cores e ícones.',
  },
  {
    num: '02.',
    title: 'Convide sua equipe',
    description:
      'Compartilhe quadros por e-mail com controle total de permissões por papel.',
  },
  {
    num: '03.',
    title: 'Acompanhe entregas',
    description:
      'Veja prioridades, prazos e progresso consolidados em um só lugar.',
  },
] as const;

const FOOTER_NAV = [
  {
    title: 'Produto',
    links: [
      { label: 'Recursos', href: '#recursos', external: false },
      { label: 'Como funciona', href: '#processo', external: false },
    ],
  },
  {
    title: 'Empresa',
    links: [{ label: 'B2byte ↗', href: 'https://b2byte.com/', external: true }],
  },
  {
    title: 'Acesso',
    links: [
      { label: 'Entrar', href: '/login', external: false },
      { label: 'Criar conta', href: '/signup', external: false },
    ],
  },
] as const;

const FOOTER_LINK_CLASS =
  'text-sm text-editorial-muted-fg hover:text-brand-coral transition-colors block mb-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral';

function WorkspacePreview() {
  const [previewMode, setPreviewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');

  return (
    <div className="relative rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white">
            <Kanban className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              Lançamento V1
            </p>
            <p className="text-[11px] text-muted-foreground">
              3 membros · Sincronizado agora
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setPreviewMode('KANBAN')}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
              previewMode === 'KANBAN'
                ? 'bg-brand-navy text-white dark:bg-brand-coral dark:text-brand-coral-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('LIST')}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
              previewMode === 'LIST'
                ? 'bg-brand-navy text-white dark:bg-brand-coral dark:text-brand-coral-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Lista
          </button>
        </div>
      </div>

      {previewMode === 'KANBAN' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-surface/50">
          {PREVIEW_COLUMNS.map((col) => (
            <div
              key={col.title}
              className="rounded-xl border border-border/80 bg-background/90 p-2.5 space-y-2.5"
            >
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  {col.done ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 text-emerald-500"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-brand-coral" />
                  )}
                  {col.title}
                </span>
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {col.count}
                </span>
              </div>

              <div className="space-y-2">
                {col.tasks.map((task) => (
                  <div
                    key={task.title}
                    className="rounded-lg border border-border bg-card p-2.5 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: task.tagColor }}
                      >
                        {task.tag}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {task.priority}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-xs font-medium leading-snug text-foreground',
                        col.done && 'line-through text-muted-foreground',
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ListChecks className="h-3 w-3" aria-hidden="true" />
                        {task.subtasks}
                      </span>
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                        style={{ backgroundColor: task.avatarColor }}
                      >
                        {task.initials}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border bg-background/90 p-3">
          {PREVIEW_COLUMNS.flatMap((col) =>
            col.tasks.map((task) => (
              <div
                key={task.title}
                className="flex items-center justify-between gap-3 py-2.5 px-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center',
                      col.done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-border',
                    )}
                  >
                    {col.done ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'truncate font-medium text-foreground',
                      col.done && 'line-through text-muted-foreground',
                    )}
                  >
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px] px-2 py-0">
                    {col.title}
                  </Badge>
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                    style={{ backgroundColor: task.avatarColor }}
                  >
                    {task.initials}
                  </span>
                </div>
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}

function FeatureTabVisual({ tabId }: { tabId: TabId }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-border bg-secondary/40 px-3 py-2 flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">
          {tabId === 'kanban' && 'Lançamento V1'}
          {tabId === 'lista' && 'Backlog do Produto'}
          {tabId === 'my-tasks' && 'Minhas Tarefas'}
          {tabId === 'colaboracao' && 'Equipe · 3 membros'}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          Sincronizado
        </span>
      </div>

      {/* Kanban visual */}
      {tabId === 'kanban' && (
        <div className="p-3 grid grid-cols-3 gap-2">
          {/* A fazer */}
          <div className="bg-secondary/40 rounded-lg p-2 min-w-0">
            <p className="text-[11px] font-semibold text-foreground mb-2">A fazer</p>
            <div className="bg-card border border-border rounded-md p-2 mb-1.5">
              <p className="text-[10px] text-muted-foreground">Produto</p>
              <p className="text-[11px] font-medium text-foreground break-words">Definir metas</p>
              <p className="text-[10px] text-muted-foreground">Alta</p>
            </div>
            <div className="bg-card border border-border rounded-md p-2 mb-1.5">
              <p className="text-[10px] text-muted-foreground">Time</p>
              <p className="text-[11px] font-medium text-foreground break-words">Revisar convites</p>
              <p className="text-[10px] text-muted-foreground">Média</p>
            </div>
          </div>
          {/* Em andamento */}
          <div className="bg-secondary/40 rounded-lg p-2 min-w-0">
            <p className="text-[11px] font-semibold text-foreground mb-2">Em andamento</p>
            <div className="bg-card border border-border rounded-md p-2 mb-1.5">
              <p className="text-[10px] text-muted-foreground">Design</p>
              <p className="text-[11px] font-medium text-foreground break-words">Publicar landing</p>
              <p className="text-[10px] text-muted-foreground">Urgente</p>
            </div>
          </div>
          {/* Concluído */}
          <div className="bg-secondary/40 rounded-lg p-2 min-w-0">
            <p className="text-[11px] font-semibold text-foreground mb-2">Concluído</p>
            <div className="bg-card border border-border rounded-md p-2 mb-1.5">
              <p className="text-[10px] text-muted-foreground">Infra</p>
              <p className="text-[11px] font-medium line-through text-muted-foreground break-words">
                Configurar e-mails
              </p>
              <p className="text-[10px] text-muted-foreground">Concluída</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista visual */}
      {tabId === 'lista' && (
        <div className="p-3 space-y-1.5">
          {[
            { title: 'Definir metas do trimestre', priority: 'Alta', done: false },
            { title: 'Revisar convites da equipe', priority: 'Média', done: false },
            { title: 'Publicar landing page', priority: 'Urgente', done: false },
            { title: 'Configurar fluxo de e-mails', priority: 'Concluída', done: true },
          ].map((task) => (
            <div
              key={task.title}
              className="flex items-center gap-2 py-1.5 px-1 min-w-0"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded border border-border" />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[11px] font-medium text-foreground',
                  task.done && 'line-through text-muted-foreground',
                )}
              >
                {task.title}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {task.priority}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* My Tasks visual */}
      {tabId === 'my-tasks' && (
        <div className="p-3 space-y-3">
          {[
            {
              label: 'Atrasadas',
              labelClass: 'text-brand-coral',
              tasks: ['Relatório Q3', 'Revisar PRs'],
            },
            {
              label: 'Hoje',
              labelClass: 'text-foreground',
              tasks: ['Reunião de equipe', 'Deploy staging'],
            },
            {
              label: 'Sem data',
              labelClass: 'text-muted-foreground',
              tasks: ['Documentar API', 'Atualizar dependências'],
            },
          ].map((group) => (
            <div key={group.label}>
              <p
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wider mb-1.5',
                  group.labelClass,
                )}
              >
                {group.label}
              </p>
              {group.tasks.map((task) => (
                <div key={task} className="flex items-center gap-2 py-1 min-w-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded border border-border" />
                  <span className="text-[11px] text-foreground truncate">{task}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Colaboração visual */}
      {tabId === 'colaboracao' && (
        <div className="p-3 space-y-2">
          {[
            {
              initials: 'AS',
              name: 'Ana Silva',
              role: 'Proprietária',
              avatarClass: 'bg-brand-navy text-white border border-border/40',
            },
            {
              initials: 'BC',
              name: 'Bruno Costa',
              role: 'Editor',
              avatarClass: 'bg-brand-coral text-brand-coral-foreground',
            },
            {
              initials: 'CD',
              name: 'Clara Dias',
              role: 'Visualizadora',
              avatarClass: 'bg-secondary text-secondary-foreground border border-border',
            },
          ].map((member) => (
            <div key={member.name} className="flex items-center gap-2.5 py-1 min-w-0">
              <span
                className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  member.avatarClass,
                )}
              >
                {member.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                {member.name}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {member.role}
              </Badge>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-2 text-[10px] text-muted-foreground border-t border-border">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-coral animate-pulse" />
            Sincronizado agora
          </div>
        </div>
      )}
    </div>
  );
}

export function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('kanban');
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = status === 'authenticated';

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const tabIds: TabId[] = FEATURE_TABS.map((t) => t.id);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabIds.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabIds.length) % tabIds.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabIds.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTabId = tabIds[nextIndex];
    setActiveTab(nextTabId);
    document.getElementById(`tab-${nextTabId}`)?.focus();
  };

  const handleScrollToTop = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Section 1 — Sticky Header */}
      <header className="dark sticky top-0 z-30 border-b border-editorial-border/60 bg-editorial-bg/95 text-editorial-fg backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6">
          <Link
            to="/"
            className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-editorial-bg"
          >
            <AppLogo />
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex gap-6 text-sm font-medium text-editorial-muted"
          >
            <a
              href="#recursos"
              className="hover:text-editorial-fg transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-editorial-bg"
            >
              Recursos
            </a>
            <a
              href="#processo"
              className="hover:text-editorial-fg transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-editorial-bg"
            >
              Como funciona
            </a>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <ThemeToggle className="h-8 w-8 sm:h-9 sm:w-9" />

            {/* Mobile hamburger */}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md md:hidden text-editorial-muted hover:text-editorial-fg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            {isAuthenticated ? (
              <>
                {user ? (
                  <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-editorial-border bg-editorial-surface px-2.5 py-1 text-xs font-medium text-editorial-fg">
                    <UserAvatar
                      name={user.name}
                      avatarColor={user.avatarColor}
                      size="xs"
                    />
                    <span className="max-w-[120px] truncate">{user.name}</span>
                  </div>
                ) : null}
                <Button asChild variant="coral" size="sm">
                  <Link to="/app/my-tasks">
                    Abrir App
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button asChild variant="coral" size="sm" className="px-2.5 sm:px-3">
                  <Link to="/signup">Criar conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <nav
            aria-label="Navegação mobile"
            className="absolute left-0 right-0 top-full bg-editorial-bg border-b border-editorial-border py-4 px-6 md:hidden z-20"
          >
            <a
              href="#recursos"
              className="block text-sm text-editorial-muted hover:text-editorial-fg transition-colors py-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setMobileNavOpen(false)}
            >
              Recursos
            </a>
            <a
              href="#processo"
              className="block text-sm text-editorial-muted hover:text-editorial-fg transition-colors py-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setMobileNavOpen(false)}
            >
              Como funciona
            </a>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* Section 2 — Hero */}
        <section className="dark relative overflow-hidden bg-editorial-bg">
          {/* Geometric decorator */}
          <div
            aria-hidden="true"
            className="absolute -top-40 -left-20 h-80 w-80 rounded-[80px] border-[60px] border-brand-coral/70 rotate-[-25deg] opacity-60 pointer-events-none"
          />
          {/* Coral glow */}
          <div
            aria-hidden="true"
            className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-coral/15 blur-3xl pointer-events-none"
          />

          <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 sm:py-24 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left col */}
              <div className="space-y-6 min-w-0">
                {/* Eyebrow pill */}
                <div className="inline-flex items-center gap-2 rounded-full border border-editorial-border bg-editorial-surface px-3.5 py-1 text-xs font-semibold text-editorial-muted">
                  Organize. Colabore. Entregue.
                </div>

                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-normal tracking-[-0.045em] leading-[0.98] text-editorial-fg">
                  Menos ruído.
                  <br />
                  Mais{' '}
                  <em className="text-brand-coral not-italic">entregas</em>
                  <br />
                  em equipe.
                </h1>

                <p className="max-w-xl text-base text-editorial-muted leading-relaxed sm:text-lg">
                  O Todollab centraliza seus quadros pessoais e compartilhados
                  com visão em Kanban ou Lista, prazos consolidados em Minhas
                  Tarefas e sincronização instantânea para toda a equipe.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {isAuthenticated ? (
                    <Button asChild variant="coral" size="lg">
                      <Link to="/app/my-tasks">
                        Ir para Minhas Tarefas
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="coral" size="lg">
                      <Link to="/signup">
                        Começar gratuitamente
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                  <a
                    href="#recursos"
                    className="inline-flex items-center gap-2 rounded-lg border border-editorial-border px-5 py-2.5 text-sm font-medium text-editorial-muted hover:text-editorial-fg hover:border-editorial-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-editorial-bg"
                  >
                    Explorar recursos
                  </a>
                </div>

                {/* Feature pills */}
                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <span className="text-editorial-muted text-xs flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Prazos agrupados
                  </span>
                  <span className="text-editorial-muted text-xs flex items-center gap-1.5">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Convites por e-mail
                  </span>
                </div>
              </div>

              {/* Right col — stage */}
              <div
                className="relative rounded-t-2xl border border-editorial-border overflow-hidden min-w-0"
                style={{
                  background:
                    'radial-gradient(ellipse at 70% 20%, color-mix(in srgb, var(--brand-coral) 44%, transparent), transparent 40%), repeating-linear-gradient(125deg, transparent 0 64px, color-mix(in srgb, var(--editorial-fg) 4%, transparent) 65px 66px), linear-gradient(125deg, var(--editorial-stage), var(--editorial-bg) 70%)',
                }}
              >
                <div className="p-6 pt-10 pb-0">
                  <WorkspacePreview />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Product Showcase */}
        <section id="recursos" className="bg-background border-t border-border">
          <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24 sm:px-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-coral">
              01 / O produto
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-normal tracking-[-0.04em] leading-[1.0] text-foreground mb-12 mt-3">
              O trabalho flui melhor
              <br />
              quando tudo se conecta.
            </h2>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left col — tabs + content */}
              <div className="min-w-0">
                {/* Tab switcher */}
                <div
                  role="tablist"
                  aria-label="Recursos do Todollab"
                  className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-secondary p-1.5 rounded-xl mb-8"
                >
                  {FEATURE_TABS.map((tab, index) => (
                    <button
                      key={tab.id}
                      id={`tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      aria-controls={`tabpanel-${tab.id}`}
                      tabIndex={activeTab === tab.id ? 0 : -1}
                      onClick={() => setActiveTab(tab.id as TabId)}
                      onKeyDown={(e) => handleTabKeyDown(e, index)}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        activeTab === tab.id
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content — keyed for remount animation */}
                {FEATURE_TABS.filter((t) => t.id === activeTab).map((tab) => (
                  <div
                    key={tab.id}
                    id={`tabpanel-${tab.id}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${tab.id}`}
                    className="[animation:fadeSlideIn_0.22s_ease]"
                  >
                    <h3 className="font-display text-3xl font-normal tracking-[-0.035em] text-foreground mb-3">
                      {tab.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed mb-5">
                      {tab.description}
                    </p>
                    <ul className="space-y-2">
                      {tab.benefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <CheckCircle2
                            className="h-4 w-4 text-brand-coral shrink-0"
                            aria-hidden="true"
                          />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="outline" size="sm" className="mt-6">
                      <Link to={isAuthenticated ? '/app/my-tasks' : '/signup'}>
                        {isAuthenticated
                          ? 'Acessar minhas tarefas'
                          : 'Experimentar grátis'}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>

              {/* Right col — visual */}
              <div className="min-w-0">
                <FeatureTabVisual tabId={activeTab} />
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 — How It Works */}
        <section id="processo" className="dark bg-editorial-bg text-editorial-fg">
          <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24 sm:px-6">
            <span className="text-brand-coral text-[11px] uppercase tracking-[0.15em] font-semibold">
              02 / Como funciona
            </span>

            {/* Split headline row */}
            <div className="grid md:grid-cols-2 gap-8 mb-16 items-end mt-4">
              <h2 className="font-display text-5xl sm:text-6xl font-normal tracking-[-0.045em] leading-[0.98] text-editorial-fg">
                Da ideia
                <br />
                à entrega.
              </h2>
              <p className="text-editorial-muted text-lg leading-relaxed max-w-sm">
                Um fluxo simples, sem ferramentas espalhadas e sem perder o
                contexto.
              </p>
            </div>

            {/* Steps grid */}
            <div className="grid md:grid-cols-3 border-t border-editorial-border">
              {HOW_IT_WORKS.map((step) => (
                <div
                  key={step.num}
                  className="pt-8 pb-8 last:pb-0 border-t first:border-t-0 border-editorial-border md:border-t-0 md:pb-0 md:border-l md:first:border-l-0 md:px-8 md:first:pl-0 md:last:pr-0"
                >
                  <div className="font-display text-5xl text-brand-coral mb-5">
                    {step.num}
                  </div>
                  <h3 className="text-editorial-fg text-xl font-semibold mb-2">
                    {step.title}
                  </h3>
                  <p className="text-editorial-muted leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5 — CTA */}
        <section className="border-t border-border bg-background">
          <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6">
            <div className="rounded-2xl bg-brand-navy text-white border border-transparent dark:border-editorial-border p-8 sm:p-10 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              {/* Glow */}
              <div
                aria-hidden="true"
                className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-brand-coral/20 blur-[60px] pointer-events-none"
              />
              {/* Left */}
              <div className="relative">
                <h2 className="font-display text-3xl sm:text-4xl font-normal tracking-[-0.04em] leading-[1.1] mb-3">
                  Pronto para tirar seus projetos do papel?
                </h2>
                <p className="text-sm text-white/80 leading-relaxed max-w-xl">
                  Crie seu primeiro quadro em segundos, personalize cores e
                  ícones e convide seu time com controle total de permissões.
                </p>
              </div>
              {/* Right */}
              <div className="relative shrink-0">
                <Button asChild variant="coral" size="lg">
                  <Link to={isAuthenticated ? '/app/my-tasks' : '/signup'}>
                    {isAuthenticated ? 'Acessar meu painel' : 'Criar conta grátis'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Section 6 — Editorial Footer */}
      <footer
        className="dark m-3 overflow-hidden rounded-2xl relative min-h-[600px] flex flex-col justify-between bg-editorial-bg"
        style={{
          backgroundImage:
            "url('/footer-art.svg'), linear-gradient(var(--editorial-bg), var(--editorial-bg))",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(90deg, color-mix(in srgb, var(--editorial-bg) 91%, transparent) 0%, color-mix(in srgb, var(--editorial-bg) 61%, transparent) 48%, color-mix(in srgb, var(--editorial-bg) 56%, transparent) 100%), linear-gradient(0deg, color-mix(in srgb, var(--editorial-bg) 85%, transparent), transparent 65%)',
          }}
        />

        {/* Content wrapper */}
        <div className="relative z-10 p-6 sm:p-14 flex flex-col justify-between flex-1">
          {/* Top grid */}
          <div className="grid md:grid-cols-2 gap-12 md:gap-20">
            {/* Left col — company */}
            <div>
              <AppLogo />
              <p className="text-editorial-muted mt-5 max-w-sm leading-relaxed">
                Menos ruído. Mais entregas em equipe.
                <br />
                Organize tarefas, conecte pessoas e transforme planos em
                resultados.
              </p>
              <div className="mt-10">
                <B2byteSignature />
              </div>
            </div>

            {/* Right col — action */}
            <div>
              <span className="text-brand-coral text-[11px] uppercase tracking-[0.15em] font-semibold">
                Comece hoje
              </span>
              <h3 className="font-display text-3xl sm:text-4xl font-normal tracking-[-0.04em] text-editorial-fg mt-2 mb-3">
                O trabalho pode fluir melhor.
              </h3>
              <p className="text-editorial-muted mb-7 leading-relaxed">
                Crie seu espaço de trabalho e comece a organizar suas entregas.
              </p>

              {/* Footer CTA bar */}
              <div className="flex items-center justify-between bg-editorial-paper text-editorial-surface rounded-xl p-3 max-w-md mb-10 gap-3">
                <span className="font-semibold pl-2 text-sm">
                  {isAuthenticated
                    ? 'Continuar no Todollab'
                    : 'Começar gratuitamente'}
                </span>
                <Link
                  to={isAuthenticated ? '/app/my-tasks' : '/signup'}
                  aria-label={
                    isAuthenticated
                      ? 'Continuar no Todollab'
                      : 'Começar gratuitamente'
                  }
                  className="bg-brand-coral text-brand-coral-foreground rounded-lg px-4 py-2 font-semibold text-sm flex-shrink-0 hover:bg-brand-coral/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
                >
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>

              {/* Nav grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {FOOTER_NAV.map((section) => {
                  // For the Acesso section: skip links that duplicate header CTAs to avoid
                  // duplicate role queries in tests. Use non-conflicting labels.
                  const links: ReadonlyArray<{
                    label: string;
                    href: string;
                    external: boolean;
                  }> =
                    section.title === 'Acesso'
                      ? isAuthenticated
                        ? [{ label: 'Meu painel', href: '/app/my-tasks', external: false }]
                        : [
                            { label: 'Fazer login', href: '/login', external: false },
                            { label: 'Nova conta', href: '/signup', external: false },
                          ]
                      : section.links;
                  return (
                    <div key={section.title}>
                      <h4 className="font-display text-sm text-editorial-fg uppercase tracking-[0.08em] mb-4">
                        {section.title}
                      </h4>
                      <ul>
                        {links.map((link) => (
                          <li key={link.label}>
                            {link.external ? (
                              <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={FOOTER_LINK_CLASS}
                              >
                                {link.label}
                              </a>
                            ) : link.href.startsWith('#') ? (
                              <a
                                href={link.href}
                                className={FOOTER_LINK_CLASS}
                              >
                                {link.label}
                              </a>
                            ) : (
                              <Link
                                to={link.href}
                                className={FOOTER_LINK_CLASS}
                              >
                                {link.label}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-editorial-border mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-editorial-muted">
            <span>© 2026 Todollab. Todos os direitos reservados.</span>
            <div className="flex items-center gap-6">
              <a
                href="https://b2byte.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-coral transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
              >
                B2byte Software Engineering ↗
              </a>
              <button
                type="button"
                onClick={handleScrollToTop}
                className="hover:text-brand-coral transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
              >
                Voltar ao topo ↑
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
