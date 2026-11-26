import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen bg-surface text-foreground flex items-center justify-center p-6"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Algo deu errado
              </h1>
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro inesperado ao renderizar esta página. Tente
                recarregar ou voltar para o início.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-1">
              <Button
                type="button"
                variant="coral"
                onClick={this.handleReload}
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Recarregar página
              </Button>
              <Button asChild variant="outline">
                <a href="/">
                  <Home className="h-4 w-4" aria-hidden="true" />
                  Ir para o início
                </a>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
