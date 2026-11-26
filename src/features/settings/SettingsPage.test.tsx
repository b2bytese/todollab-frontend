import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { boardKeys } from '@/features/boards/api';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/api';

const mockUser: UserProfile = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatarColor: '#0C2439',
  createdAt: '2026-11-25T10:00:00Z',
};

function makeAxiosError(status: number, config: InternalAxiosRequestConfig, data: unknown) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    {
      status,
      statusText: 'Bad Request',
      headers: new AxiosHeaders(),
      config,
      data,
    },
  );
}

function renderSettingsPage(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

  return {
    queryClient: client,
    ...render(
      <QueryClientProvider client={client}>
        <ThemeProvider defaultTheme="light">
          <SettingsPage />
        </ThemeProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('SettingsPage', () => {
  let originalAdapter: AxiosAdapter | typeof api.defaults.adapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    useAuthStore.setState({
      accessToken: 'test-token',
      user: mockUser,
      status: 'authenticated',
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('updatesProfileNameAndAvatarColorAndSyncsAuthStore', async () => {
    const user = userEvent.setup();
    let capturedPayload: unknown = null;

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'patch' && config.url === '/api/v1/users/me') {
        capturedPayload =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        const payload = capturedPayload as { name: string; avatarColor: string };
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            ...mockUser,
            name: payload.name,
            avatarColor: payload.avatarColor,
          },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderSettingsPage();

    const nameInput = screen.getByLabelText(/nome completo/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Ana Clara');

    const coralColorButton = screen.getByRole('button', { name: /cor #FF4B4B/i });
    await user.click(coralColorButton);

    await user.click(screen.getByRole('button', { name: /salvar perfil/i }));

    await waitFor(() => {
      expect(capturedPayload).toEqual({
        name: 'Ana Clara',
        avatarColor: '#FF4B4B',
      });
    });

    expect(useAuthStore.getState().user).toEqual({
      ...mockUser,
      name: 'Ana Clara',
      avatarColor: '#FF4B4B',
    });
  });

  it('validatesPasswordConfirmationMatchAndSubmitsPasswordChange', async () => {
    const user = userEvent.setup();
    let passwordPatchCount = 0;
    let capturedPasswordPayload: unknown = null;

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/users/me/password'
      ) {
        passwordPatchCount += 1;
        capturedPasswordPayload =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return {
          status: 204,
          statusText: 'No Content',
          headers: new AxiosHeaders(),
          config,
          data: null,
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderSettingsPage();

    const currentPasswordInput = screen.getByLabelText(/senha atual/i);
    const newPasswordInput = screen.getByLabelText(/^nova senha$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirmar nova senha/i);

    await user.type(currentPasswordInput, 'SenhaAntiga123');
    await user.type(newPasswordInput, 'NovaSenha123');
    await user.type(confirmPasswordInput, 'Diferente123');

    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    expect(await screen.findByText(/as senhas não coincidem/i)).toBeInTheDocument();
    expect(passwordPatchCount).toBe(0);

    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, 'NovaSenha123');
    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    await waitFor(() => {
      expect(passwordPatchCount).toBe(1);
    });

    expect(capturedPasswordPayload).toEqual({
      currentPassword: 'SenhaAntiga123',
      newPassword: 'NovaSenha123',
    });

    await waitFor(() => {
      expect(currentPasswordInput).toHaveValue('');
      expect(newPasswordInput).toHaveValue('');
      expect(confirmPasswordInput).toHaveValue('');
    });
  });

  it('showsInlineErrorOnInvalidCurrentPasswordAndSwitchesTheme', async () => {
    const user = userEvent.setup();

    api.defaults.adapter = async (config) => {
      if (
        config.method?.toLowerCase() === 'patch' &&
        config.url === '/api/v1/users/me/password'
      ) {
        throw makeAxiosError(400, config, {
          status: 400,
          code: 'INVALID_CURRENT_PASSWORD',
          detail: 'Senha atual incorreta.',
        });
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderSettingsPage();

    await user.type(screen.getByLabelText(/senha atual/i), 'Errada123');
    await user.type(screen.getByLabelText(/^nova senha$/i), 'NovaSenha123');
    await user.type(screen.getByLabelText(/confirmar nova senha/i), 'NovaSenha123');
    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    expect(await screen.findByText(/senha atual incorreta/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /escuro/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(screen.getByRole('button', { name: /claro/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('invalidatesBoardQueriesInQueryClientWhenProfileIsSaved', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    api.defaults.adapter = async (config) => {
      if (config.method?.toLowerCase() === 'patch' && config.url === '/api/v1/users/me') {
        const payload = (
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data
        ) as { name: string; avatarColor: string };
        return {
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          data: {
            ...mockUser,
            name: payload.name,
            avatarColor: payload.avatarColor,
          },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };

    renderSettingsPage(queryClient);

    const nameInput = screen.getByLabelText(/nome completo/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Ana Atualizada');
    await user.click(screen.getByRole('button', { name: /salvar perfil/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: boardKeys.all });
    });
  });

  it('usesAccessibleHeadingHierarchyAndAriaAttributesOnValidationErrors', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /configurações/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /^perfil$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /^segurança$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /^aparência$/i }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/nome completo/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'A');
    await user.click(screen.getByRole('button', { name: /salvar perfil/i }));

    const nameError = await screen.findByText(/o nome deve ter pelo menos 2 caracteres/i);
    expect(nameError).toHaveAttribute('id');
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', nameError.id);

    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    const currentPasswordInput = screen.getByLabelText(/senha atual/i);
    const currentPasswordError = await screen.findByText(/informe sua senha atual/i);
    expect(currentPasswordError).toHaveAttribute('id');
    expect(currentPasswordInput).toHaveAttribute('aria-invalid', 'true');
    expect(currentPasswordInput).toHaveAttribute(
      'aria-describedby',
      currentPasswordError.id,
    );

    const newPasswordInput = screen.getByLabelText(/^nova senha$/i);
    const newPasswordError = screen.getByText(/a nova senha deve ter pelo menos 8 caracteres/i);
    expect(newPasswordError).toHaveAttribute('id');
    expect(newPasswordInput).toHaveAttribute('aria-invalid', 'true');
    expect(newPasswordInput).toHaveAttribute('aria-describedby', newPasswordError.id);

    const confirmPasswordInput = screen.getByLabelText(/confirmar nova senha/i);
    const confirmPasswordError = screen.getByText(/confirme a nova senha/i);
    expect(confirmPasswordError).toHaveAttribute('id');
    expect(confirmPasswordInput).toHaveAttribute('aria-invalid', 'true');
    expect(confirmPasswordInput).toHaveAttribute(
      'aria-describedby',
      confirmPasswordError.id,
    );
  });
});
