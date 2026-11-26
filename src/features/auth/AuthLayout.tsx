import type { ReactNode } from 'react';
import { CheckCircle2, Layers, Users } from 'lucide-react';
import { AppLogo } from '@/components/common/AppLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const HIGHLIGHTS = [
  {
    icon: Layers,
    text: 'Quadros em Kanban e lista para organizar projetos do seu jeito.',
  },
  {
    icon: Users,
    text: 'Colaboração em tempo real com convites diretos e controle de papéis.',
  },
  {
    icon: CheckCircle2,
    text: 'Visão unificada de Minhas Tarefas com prioridades, prazos e subtarefas.',
  },
];

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-surface text-foreground flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden bg-brand-navy text-white p-10 xl:p-14 flex-col justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-brand-coral/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-coral/15 blur-3xl"
        />

        <div className="relative z-10 inline-flex items-center gap-2.5">
          <img
            src="/logo.jpeg"
            alt="Todollab"
            className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/20 shadow-sm"
          />
          <span className="font-heading text-xl font-bold tracking-tight text-white">
            Todo<span className="text-brand-coral">llab</span>
          </span>
        </div>

        <div className="relative z-10 space-y-8 max-w-md">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              <span className="h-2 w-2 rounded-full bg-brand-coral" />
              Workspace colaborativo
            </span>
            <h2 className="font-heading text-3xl xl:text-4xl font-bold leading-tight tracking-tight text-white">
              Menos atrito, mais entregas no prazo.
            </h2>
            <p className="text-sm xl:text-base text-white/75 leading-relaxed">
              Centralize tarefas, acompanhe o progresso da equipe e receba atualizações instantâneas em cada quadro.
            </p>
          </div>

          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.text} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-coral ring-1 ring-white/10">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm text-white/85 leading-relaxed">{item.text}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/55">
          Todollab · Gestão colaborativa de tarefas
        </p>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen bg-background">
        <header className="flex items-center justify-between px-6 py-4 sm:px-8 border-b border-border/60 lg:border-b-0">
          <div className="lg:hidden">
            <AppLogo />
          </div>
          <div className="hidden lg:block" />
          <ThemeToggle />
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              ) : null}
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
