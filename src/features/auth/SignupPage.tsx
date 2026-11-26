import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { register as registerAccount } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/AuthLayout';
import {
  applyServerFieldErrors,
  AuthErrorAlert,
  PasswordInput,
} from '@/features/auth/authFormHelpers';
import { getApiError } from '@/lib/api';
import {
  clearPendingInviteToken,
  getPendingInviteToken,
  setPendingInviteToken,
  shouldAutoAcceptPendingInvite,
} from '@/lib/pendingInvite';
import { useAuthStore } from '@/stores/authStore';

const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(120, 'O nome deve ter no máximo 120 caracteres.'),
    email: z
      .string()
      .trim()
      .min(1, 'Informe seu e-mail.')
      .email('Informe um e-mail válido.')
      .max(255, 'O e-mail deve ter no máximo 255 caracteres.'),
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres.')
      .max(128, 'A senha deve ter no máximo 128 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);

  const urlInviteToken = searchParams.get('inviteToken')?.trim() || null;
  const inviteToken = urlInviteToken || getPendingInviteToken() || undefined;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: searchParams.get('email') ?? '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setFormError(null);
    try {
      const response = await registerAccount({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        inviteToken: inviteToken ?? null,
      });

      if (
        response.emailVerificationRequired === false &&
        response.accessToken
      ) {
        setSession(response.accessToken, response.user);
        clearPendingInviteToken();
        toast.success(`Bem-vindo(a) ao Todollab, ${response.user.name}!`);
        navigate(
          response.joinedBoardId
            ? `/app/boards/${response.joinedBoardId}`
            : '/app/my-tasks',
          { replace: true },
        );
        return;
      }

      if (inviteToken) {
        setPendingInviteToken(inviteToken, {
          autoAccept: shouldAutoAcceptPendingInvite(inviteToken),
        });
      }

      toast.success(
        'Conta criada! Enviamos um código de verificação para o seu e-mail.',
      );
      navigate(
        `/verify-email?email=${encodeURIComponent(values.email.trim())}`,
        { replace: true },
      );
    } catch (err) {
      const apiErr = getApiError(err);
      applyServerFieldErrors(apiErr.fieldErrors, setError, [
        'name',
        'email',
        'password',
      ]);
      setFormError(apiErr.detail ?? 'Não foi possível criar sua conta.');
    }
  };

  const loginLink = urlInviteToken
    ? `/login?inviteToken=${encodeURIComponent(urlInviteToken)}`
    : '/login';

  return (
    <AuthLayout
      title="Criar conta"
      description="Comece gratuitamente a organizar suas tarefas e colaborar em quadros."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthErrorAlert message={formError} />

        <div className="space-y-1.5">
          <Label htmlFor="signup-name">Nome completo</Label>
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            placeholder="Ana Silva"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
            {...register('name')}
          />
          {errors.name ? (
            <p id="signup-name-error" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-email">E-mail</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <p id="signup-email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Senha</Label>
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'signup-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? (
            <p id="signup-password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-confirm-password">Confirmar senha</Label>
          <PasswordInput
            id="signup-confirm-password"
            autoComplete="new-password"
            placeholder="Repita sua senha"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? 'signup-confirm-password-error' : undefined
            }
            {...register('confirmPassword')}
          />
          {errors.confirmPassword ? (
            <p
              id="signup-confirm-password-error"
              className="text-xs text-destructive"
            >
              {errors.confirmPassword.message}
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
              Criando conta...
            </>
          ) : (
            'Criar conta'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground pt-2">
          Já tem uma conta?{' '}
          <Link to={loginLink} className="font-medium text-foreground hover:text-brand-coral underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
