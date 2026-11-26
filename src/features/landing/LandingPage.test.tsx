import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('setsAriaPressedOnWorkspacePreviewModeButtonsAndTogglesOnClick', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    const kanbanButton = screen.getByRole('button', { name: /^kanban$/i });
    const listButton = screen.getByRole('button', { name: /^lista$/i });

    expect(kanbanButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(listButton);

    expect(kanbanButton).toHaveAttribute('aria-pressed', 'false');
    expect(listButton).toHaveAttribute('aria-pressed', 'true');
  });
});
