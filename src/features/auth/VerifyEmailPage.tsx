import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resendVerification, verifyEmail } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/AuthLayout';
import {
  applyServerFieldErrors,
  AuthErrorAlert,
} from '@/features/auth/authFormHelpers';
import { getApiError } from '@/lib/api';
import { getPendingInviteToken } from '@/lib/pendingInvite';
import { useAuthStore } from '@/stores/authStore';

const verifyEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Informe o código numérico de 6 dígitos.'),
});

type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: searchParams.get('email') ?? '',
      code: '',
    },
  });

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (values: VerifyEmailFormValues) => {
    setFormError(null);
    try {
      const response = await verifyEmail({
        email: values.email.trim(),
        code: values.code.trim(),
      });

      setSession(response.accessToken, response.user);
      toast.success('E-mail verificado com sucesso!');

      const pendingInvite =
        searchParams.get('inviteToken')?.trim() || getPendingInviteToken();
      if (pendingInvite) {
        navigate(`/invite/${encodeURIComponent(pendingInvite)}`, { replace: true });
        return;
      }

      navigate('/app/my-tasks', { replace: true });
    } catch (err) {
      const apiErr = getApiError(err);
      applyServerFieldErrors(apiErr.fieldErrors, setError, ['email', 'code']);
      setFormError(apiErr.detail ?? 'Código de verificação inválido ou expirado.');
    }
  };

  const handleResend = async () => {
    const emailValue = getValues('email').trim();
    const parsedEmail = z.string().email().safeParse(emailValue);
    if (!parsedEmail.success) {
      setError('email', {
        type: 'manual',
        message: 'Informe um e-mail válido para reenviar o código.',
      });
      return;
    }

    setFormError(null);
    setIsResending(true);
    try {
      await resendVerification({ email: emailValue });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('Novo código de verificação enviado para o seu e-mail.');
    } catch (err) {
      const apiErr = getApiError(err);
      setFormError(apiErr.detail ?? 'Não foi possível reenviar o código.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verificar e-mail"
      description="Digite o código de 6 dígitos enviado para o seu e-mail para ativar sua conta."
    >
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
        <MailCheck className="h-4 w-4 shrink-0 text-brand-coral" aria-hidden="true" />
        <span>Verifique também a caixa de spam caso não encontre a mensagem.</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthErrorAlert message={formError} />

        <div className="space-y-1.5">
          <Label htmlFor="verify-email">E-mail</Label>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'verify-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <p id="verify-email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="verify-code">Código de verificação</Label>
          <Input
            id="verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="tracking-[0.25em] font-mono text-center text-base"
            aria-invalid={Boolean(errors.code)}
            aria-describedby={errors.code ? 'verify-code-error' : undefined}
            {...register('code')}
          />
          {errors.code ? (
            <p id="verify-code-error" className="text-xs text-destructive">
              {errors.code.message}
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
              Verificando...
            </>
          ) : (
            'Verificar e-mail'
          )}
        </Button>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
          >
            {isResending
              ? 'Reenviando...'
              : cooldown > 0
                ? `Reenviar código (${cooldown}s)`
                : 'Reenviar código'}
          </Button>

          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
