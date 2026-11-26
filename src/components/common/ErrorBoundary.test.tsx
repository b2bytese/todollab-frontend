import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

function Boom(): ReactElement {
  throw new Error('Falha simulada de renderização');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rendersChildrenNormallyWhenNoErrorOccurs', () => {
    render(
      <ErrorBoundary>
        <div>Conteúdo saudável</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Conteúdo saudável')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rendersAccessibleFallbackAlertWithRecoveryActionsWhenChildThrows', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /recarregar página/i }),
    ).toBeInTheDocument();

    const homeLink = screen.getByRole('link', { name: /ir para o início/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
