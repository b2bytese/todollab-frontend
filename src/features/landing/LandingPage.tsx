import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Kanban,
  Layers,
  ListChecks,
  Radio,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLogo } from '@/components/common/AppLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const VALUE_PILLARS = [
  {
    icon: Layers,
    title: 'Minhas Tarefas unificadas',
    description:
      'Visualize tudo o que está sob sua responsabilidade em Atrasadas, Hoje, Próximas e Sem data sem pular de quadro em quadro.',
  },
  {
    icon: Kanban,
    title: 'Kanban e Lista no mesmo quadro',
    description:
      'Alterne em um clique entre colunas com arrastar e soltar e visão em lista rápida para revisar prioridades, tags e subtarefas.',
  },
  {
    icon: Radio,
    title: 'Colaboração em tempo real',
    description:
      'Convide por e-mail ou link com controle de papéis (Proprietário, Editor e Visualizador) e acompanhe atualizações instantaneamente.',
  },
] as const;

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
            aria-pressed={previewMode === 'KANBAN'}
            onClick={() => setPreviewMode('KANBAN')}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
              previewMode === 'KANBAN'
                ? 'bg-brand-navy text-white dark:bg-brand-coral'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Kanban
          </button>
          <button
            type="button"
            aria-pressed={previewMode === 'LIST'}
            onClick={() => setPreviewMode('LIST')}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
              previewMode === 'LIST'
                ? 'bg-brand-navy text-white dark:bg-brand-coral'
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

export function LandingPage() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
            <AppLogo />
          </Link>

          <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#recursos" className="transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="#colaboracao" className="transition-colors hover:text-foreground">
              Como funciona
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            {isAuthenticated ? (
              <>
                {user ? (
                  <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground">
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
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button asChild variant="coral" size="sm">
                  <Link to="/signup">Criar conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/70 bg-surface/60">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-coral/12 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-navy/10 dark:bg-brand-coral/10 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:px-8">
            <div className="space-y-6 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-semibold text-foreground shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-brand-coral" aria-hidden="true" />
                Kanban, Lista e Tempo Real em um só lugar
              </div>

              <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl leading-[1.1]">
                Menos ruído.{' '}
                <span className="text-brand-coral">Mais entregas</span> em equipe.
              </h1>

              <p className="max-w-xl text-base text-muted-foreground leading-relaxed sm:text-lg">
                O Todollab centraliza seus quadros pessoais e compartilhados com
                visão em Kanban ou Lista, prazos consolidados em Minhas Tarefas e
                sincronização instantânea para toda a equipe.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {isAuthenticated ? (
                  <Button asChild variant="default" size="lg">
                    <Link to="/app/my-tasks">
                      Ir para Minhas Tarefas
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="default" size="lg">
                    <Link to="/signup">
                      Começar gratuitamente
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}

                <Button asChild variant="outline" size="lg">
                  <a href="#recursos">Explorar recursos</a>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-brand-coral" aria-hidden="true" />
                  Prazos agrupados por prioridade
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-brand-coral" aria-hidden="true" />
                  Convites por e-mail ou link direto
                </span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <WorkspacePreview />
            </div>
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-2 mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-coral">
              Produtividade sem atrito
            </p>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Projetado para equipes rápidas e organizadas
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Da caixa de entrada pessoal ao quadro compartilhado do projeto, cada
              interação responde de imediato.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {VALUE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-xs transition-colors hover:border-brand-coral/40 space-y-3"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy text-white dark:bg-brand-coral/20 dark:text-brand-coral">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="colaboracao" className="border-t border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-brand-navy text-white p-8 sm:p-10 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-brand-coral/25 blur-3xl"
              />
              <div className="relative space-y-2 max-w-xl">
                <h2 className="font-heading text-2xl font-bold tracking-tight">
                  Pronto para tirar seus projetos do papel?
                </h2>
                <p className="text-sm text-white/80 leading-relaxed">
                  Crie seu primeiro quadro em segundos, personalize cores e ícones e
                  convide seu time com controle total de permissões.
                </p>
              </div>
              <div className="relative shrink-0">
                {isAuthenticated ? (
                  <Button asChild variant="coral" size="lg">
                    <Link to="/app/my-tasks">
                      Acessar meu painel
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="coral" size="lg">
                    <Link to="/signup">
                      Criar conta grátis
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <AppLogo />
          <p className="text-xs text-muted-foreground">
            Todollab · Gestão colaborativa de tarefas em tempo real
          </p>
        </div>
      </footer>
    </div>
  );
}
