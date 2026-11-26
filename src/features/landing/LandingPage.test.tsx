import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { LandingPage } from '@/features/landing/LandingPage';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatarColor: '#0C2439',
  createdAt: '2026-11-25T10:00:00Z',
};

function renderLandingPage() {
  return render(
    <ThemeProvider defaultTheme="light">
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
  });

  it('rendersLoginAndSignupCtasWhenUnauthenticated', () => {
    renderLandingPage();

    const loginLink = screen.getByRole('link', { name: /^entrar$/i });
    const signupLink = screen.getByRole('link', { name: /^criar conta$/i });

    expect(loginLink).toHaveAttribute('href', '/login');
    expect(signupLink).toHaveAttribute('href', '/signup');
    expect(screen.queryByRole('link', { name: /abrir app/i })).not.toBeInTheDocument();
  });

  it('rendersOpenAppCtaToMyTasksWhenAuthenticated', () => {
    useAuthStore.setState({
      accessToken: 'valid-jwt-token',
      user: mockUser,
      status: 'authenticated',
    });

    renderLandingPage();

    const openAppLink = screen.getByRole('link', { name: /abrir app/i });
    expect(openAppLink).toHaveAttribute('href', '/app/my-tasks');
    expect(screen.queryByRole('link', { name: /^entrar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^criar conta$/i })).not.toBeInTheDocument();
  });

  it('switchesFeatureTabsAndUpdatesVisualPreview', () => {
    renderLandingPage();

    const tablist = screen.getByRole('tablist', { name: /recursos do todollab/i });
    const kanbanTab = within(tablist).getByRole('tab', { name: /^kanban$/i });
    const listaTab = within(tablist).getByRole('tab', { name: /^lista$/i });
    const myTasksTab = within(tablist).getByRole('tab', { name: /^minhas tarefas$/i });
    const colaboracaoTab = within(tablist).getByRole('tab', { name: /^colaboração$/i });

    expect(kanbanTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /visualize o progresso\./i })).toBeInTheDocument();

    fireEvent.click(listaTab);
    expect(listaTab).toHaveAttribute('aria-selected', 'true');
    expect(kanbanTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('heading', { name: /todas as tarefas, uma visão\./i })).toBeInTheDocument();
    expect(screen.getByText('Backlog do Produto')).toBeInTheDocument();

    fireEvent.click(myTasksTab);
    expect(myTasksTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /nunca perca o próximo passo\./i })).toBeInTheDocument();
    expect(screen.getByText('Atrasadas')).toBeInTheDocument();

    fireEvent.click(colaboracaoTab);
    expect(colaboracaoTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /sua equipe em sintonia\./i })).toBeInTheDocument();
    expect(screen.getByText('Equipe · 3 membros')).toBeInTheDocument();
  });

  it('togglesMobileNavigationMenuAndClosesOnLinkClick', () => {
    renderLandingPage();

    const menuButton = screen.getByRole('button', { name: /^menu$/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: /navegação mobile/i })).not.toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const mobileNav = screen.getByRole('navigation', { name: /navegação mobile/i });
    expect(mobileNav).toBeInTheDocument();

    fireEvent.click(within(mobileNav).getByRole('link', { name: /recursos/i }));
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: /navegação mobile/i })).not.toBeInTheDocument();
  });

  it('rendersDarkScopedEditorialHeaderAndB2byteSignatureInFooter', () => {
    const { container } = renderLandingPage();

    const header = container.querySelector('header');
    expect(header).toHaveClass('dark');

    const signatureLink = screen.getByRole('link', {
      name: /b2byte software engineering — produto proprietário do todollab/i,
    });
    expect(signatureLink).toHaveAttribute('href', 'https://b2byte.com/');
    expect(signatureLink).toHaveAttribute('target', '_blank');
    expect(signatureLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('rendersFooterAnchorLinksAsNativeAnchorsAndPreservesRouterAndExternalLinks', () => {
    const { container } = renderLandingPage();

    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();
    const scoped = within(footer!);

    const recursosLink = scoped.getByRole('link', { name: /^recursos$/i });
    const processoLink = scoped.getByRole('link', { name: /^como funciona$/i });

    expect(recursosLink).toHaveAttribute('href', '#recursos');
    expect(processoLink).toHaveAttribute('href', '#processo');
    expect(recursosLink).not.toHaveAttribute('target');
    expect(processoLink).not.toHaveAttribute('target');

    const recursosClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(recursosLink, recursosClick);
    expect(recursosClick.defaultPrevented).toBe(false);

    const processoClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(processoLink, processoClick);
    expect(processoClick.defaultPrevented).toBe(false);

    const loginLink = scoped.getByRole('link', { name: /^fazer login$/i });
    const signupLink = scoped.getByRole('link', { name: /^nova conta$/i });
    expect(loginLink).toHaveAttribute('href', '/login');
    expect(signupLink).toHaveAttribute('href', '/signup');
    expect(loginLink).not.toHaveAttribute('target');
    expect(signupLink).not.toHaveAttribute('target');

    const loginClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(loginLink, loginClick);
    expect(loginClick.defaultPrevented).toBe(true);

    const signupClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(signupLink, signupClick);
    expect(signupClick.defaultPrevented).toBe(true);

    const externalLink = scoped.getByRole('link', { name: /^b2byte ↗$/i });
    expect(externalLink).toHaveAttribute('href', 'https://b2byte.com/');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
