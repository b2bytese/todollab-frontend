import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/AuthLayout';
import {
  applyServerFieldErrors,
  AuthErrorAlert,
  PasswordInput,
} from '@/features/auth/authFormHelpers';
import { getApiError } from '@/lib/api';
import {
  getPendingInviteToken,
  setPendingInviteToken,
  shouldAutoAcceptPendingInvite,
} from '@/lib/pendingInvite';
import { useAuthStore } from '@/stores/authStore';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LocationState {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);

  const urlInviteToken = searchParams.get('inviteToken')?.trim() || null;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: searchParams.get('email') ?? '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      const response = await login({
        email: values.email.trim(),
        password: values.password,
      });

      setSession(response.accessToken, response.user);
      toast.success(`Bem-vindo(a) de volta, ${response.user.name}!`);

      const inviteToken = urlInviteToken || getPendingInviteToken();
      if (inviteToken) {
        navigate(`/invite/${encodeURIComponent(inviteToken)}`, { replace: true });
        return;
      }

      const from = (location.state as LocationState | null)?.from;
      const target = from?.pathname
        ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
        : '/app/my-tasks';
      navigate(target, { replace: true });
    } catch (err) {
      const apiErr = getApiError(err);
      if (apiErr.status === 403 && apiErr.code === 'EMAIL_NOT_VERIFIED') {
        if (urlInviteToken) {
          setPendingInviteToken(urlInviteToken, {
            autoAccept: shouldAutoAcceptPendingInvite(urlInviteToken),
          });
        }
        toast.info('Confirme seu e-mail antes de entrar.');
        navigate(
          `/verify-email?email=${encodeURIComponent(values.email.trim())}`,
          { replace: true },
        );
        return;
      }

      applyServerFieldErrors(apiErr.fieldErrors, setError, ['email', 'password']);
      setFormError(apiErr.detail ?? 'Não foi possível entrar na sua conta.');
    }
  };

  const signupLink = urlInviteToken
    ? `/signup?inviteToken=${encodeURIComponent(urlInviteToken)}`
    : '/signup';

  return (
    <AuthLayout
      title="Entrar na sua conta"
      description="Acesse seus quadros, tarefas e atualizações da equipe."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthErrorAlert message={formError} />

        <div className="space-y-1.5">
          <Label htmlFor="login-email">E-mail</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <p id="login-email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Senha</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-brand-coral hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? (
            <p id="login-password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="coral"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground pt-2">
          Ainda não tem uma conta?{' '}
          <Link to={signupLink} className="font-medium text-foreground hover:text-brand-coral underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
