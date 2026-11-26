import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Monitor, Moon, Palette, Shield, Sun, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useTheme, type Theme } from '@/components/common/ThemeProvider';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  applyServerFieldErrors,
  AuthErrorAlert,
  PasswordInput,
} from '@/features/auth/authFormHelpers';
import { boardKeys } from '@/features/boards/api';
import { api, getApiError } from '@/lib/api';
import { AVATAR_COLORS } from '@/lib/avatarColors';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/api';

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  avatarColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Selecione uma cor de avatar válida.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe sua senha atual.'),
    newPassword: z
      .string()
      .min(8, 'A nova senha deve ter pelo menos 8 caracteres.')
      .max(128, 'A nova senha deve ter no máximo 128 caracteres.'),
    confirmNewPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmNewPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

const THEME_OPTIONS: readonly {
  value: Theme;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: 'light',
    label: 'Claro',
    description: 'Interface clara para ambientes iluminados.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Escuro',
    description: 'Contraste suave para reduzir o cansaço visual.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Sistema',
    description: 'Segue automaticamente a preferência do sistema.',
    icon: Monitor,
  },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { theme, setTheme } = useTheme();

  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      avatarColor: user?.avatarColor ?? AVATAR_COLORS[0],
    },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name,
        avatarColor: user.avatarColor,
      });
    }
  }, [user, profileForm]);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const watchedName = profileForm.watch('name');
  const watchedAvatarColor = profileForm.watch('avatarColor');

  const onSaveProfile = async (values: ProfileFormValues) => {
    setProfileError(null);
    try {
      const { data } = await api.patch<UserProfile>('/api/v1/users/me', {
        name: values.name.trim(),
        avatarColor: values.avatarColor,
      });
      updateUser(data);
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      toast.success('Perfil atualizado com sucesso!');
    } catch (err) {
      const problem = getApiError(err);
      applyServerFieldErrors(problem.fieldErrors, profileForm.setError, [
        'name',
        'avatarColor',
      ]);
      const message = problem.detail ?? 'Não foi possível atualizar o perfil.';
      setProfileError(message);
      toast.error(message);
    }
  };

  const onChangePassword = async (values: PasswordFormValues) => {
    setPasswordError(null);
    try {
      await api.patch('/api/v1/users/me/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.reset();
      toast.success('Senha alterada com sucesso!');
    } catch (err) {
      const problem = getApiError(err);
      if (problem.code === 'INVALID_CURRENT_PASSWORD') {
        const message = problem.detail ?? 'Senha atual incorreta.';
        passwordForm.setError('currentPassword', {
          type: 'server',
          message,
        });
        return;
      }
      applyServerFieldErrors(problem.fieldErrors, passwordForm.setError, [
        'currentPassword',
        'newPassword',
      ]);
      const message = problem.detail ?? 'Não foi possível alterar a senha.';
      setPasswordError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-3xl w-full mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seu perfil, segurança da conta e aparência do aplicativo.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-brand-coral" aria-hidden="true" />
            <CardTitle as="h2">Perfil</CardTitle>
          </div>
          <CardDescription>
            Atualize seu nome de exibição e a cor do seu avatar.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit(onSaveProfile)}
            className="space-y-5"
          >
            <AuthErrorAlert message={profileError} />

            <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
              <UserAvatar
                name={watchedName || user?.name || 'Usuário'}
                avatarColor={watchedAvatarColor}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {watchedName.trim() || user?.name || 'Seu nome'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? ''}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Nome completo</Label>
              <Input
                id="settings-name"
                placeholder="Seu nome completo"
                disabled={profileForm.formState.isSubmitting}
                aria-invalid={Boolean(profileForm.formState.errors.name)}
                aria-describedby={
                  profileForm.formState.errors.name
                    ? 'settings-name-error'
                    : undefined
                }
                {...profileForm.register('name')}
              />
              {profileForm.formState.errors.name ? (
                <p id="settings-name-error" className="text-xs text-destructive">
                  {profileForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Cor do avatar</Label>
              <div
                className="flex flex-wrap gap-2.5"
                role="group"
                aria-label="Cor do avatar"
                aria-describedby={
                  profileForm.formState.errors.avatarColor
                    ? 'settings-avatar-color-error'
                    : undefined
                }
              >
                {AVATAR_COLORS.map((color) => {
                  const active =
                    watchedAvatarColor.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Cor ${color}`}
                      aria-pressed={active}
                      onClick={() =>
                        profileForm.setValue('avatarColor', color, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      style={{ backgroundColor: color }}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        active
                          ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card'
                          : 'hover:scale-105',
                      )}
                    >
                      {active ? (
                        <Check className="h-4 w-4 text-white" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {profileForm.formState.errors.avatarColor ? (
                <p
                  id="settings-avatar-color-error"
                  className="text-xs text-destructive"
                >
                  {profileForm.formState.errors.avatarColor.message}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="coral"
                disabled={profileForm.formState.isSubmitting}
              >
                {profileForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Salvando...
                  </>
                ) : (
                  'Salvar perfil'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-coral" aria-hidden="true" />
            <CardTitle as="h2">Segurança</CardTitle>
          </div>
          <CardDescription>
            Altere sua senha para manter sua conta protegida.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="space-y-4"
          >
            <AuthErrorAlert message={passwordError} />

            <div className="space-y-1.5">
              <Label htmlFor="current-password">Senha atual</Label>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                placeholder="Digite sua senha atual"
                disabled={passwordForm.formState.isSubmitting}
                aria-invalid={Boolean(
                  passwordForm.formState.errors.currentPassword,
                )}
                aria-describedby={
                  passwordForm.formState.errors.currentPassword
                    ? 'current-password-error'
                    : undefined
                }
                {...passwordForm.register('currentPassword')}
              />
              {passwordForm.formState.errors.currentPassword ? (
                <p
                  id="current-password-error"
                  className="text-xs text-destructive"
                >
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nova senha</Label>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  disabled={passwordForm.formState.isSubmitting}
                  aria-invalid={Boolean(
                    passwordForm.formState.errors.newPassword,
                  )}
                  aria-describedby={
                    passwordForm.formState.errors.newPassword
                      ? 'new-password-error'
                      : undefined
                  }
                  {...passwordForm.register('newPassword')}
                />
                {passwordForm.formState.errors.newPassword ? (
                  <p id="new-password-error" className="text-xs text-destructive">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
                <PasswordInput
                  id="confirm-new-password"
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  disabled={passwordForm.formState.isSubmitting}
                  aria-invalid={Boolean(
                    passwordForm.formState.errors.confirmNewPassword,
                  )}
                  aria-describedby={
                    passwordForm.formState.errors.confirmNewPassword
                      ? 'confirm-new-password-error'
                      : undefined
                  }
                  {...passwordForm.register('confirmNewPassword')}
                />
                {passwordForm.formState.errors.confirmNewPassword ? (
                  <p
                    id="confirm-new-password-error"
                    className="text-xs text-destructive"
                  >
                    {passwordForm.formState.errors.confirmNewPassword.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={passwordForm.formState.isSubmitting}
              >
                {passwordForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Alterando...
                  </>
                ) : (
                  'Alterar senha'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-brand-coral" aria-hidden="true" />
            <CardTitle as="h2">Aparência</CardTitle>
          </div>
          <CardDescription>
            Escolha o tema de cores utilizado no Todollab.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Tema da interface">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-brand-coral bg-brand-coral/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        active ? 'text-brand-coral' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                    {option.label}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
