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
import { resetPassword } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/AuthLayout';
import {
  applyServerFieldErrors,
  AuthErrorAlert,
  PasswordInput,
} from '@/features/auth/authFormHelpers';
import { getApiError } from '@/lib/api';

const resetPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Informe seu e-mail.')
      .email('Informe um e-mail válido.'),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Informe o código numérico de 6 dígitos.'),
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

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: searchParams.get('email') ?? '',
      code: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setFormError(null);
    try {
      await resetPassword({
        email: values.email.trim(),
        code: values.code.trim(),
        newPassword: values.newPassword,
      });

      toast.success('Senha redefinida com sucesso! Entre com sua nova senha.');
      navigate('/login', { replace: true });
    } catch (err) {
      const apiErr = getApiError(err);
      applyServerFieldErrors(apiErr.fieldErrors, setError, [
        'email',
        'code',
        'newPassword',
      ]);
      setFormError(
        apiErr.detail ?? 'Não foi possível redefinir sua senha. Verifique o código.',
      );
    }
  };

  return (
    <AuthLayout
      title="Redefinir senha"
      description="Informe o código de 6 dígitos recebido por e-mail e escolha uma nova senha."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthErrorAlert message={formError} />

        <div className="space-y-1.5">
          <Label htmlFor="reset-email">E-mail</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'reset-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <p id="reset-email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-code">Código de verificação</Label>
          <Input
            id="reset-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="tracking-[0.25em] font-mono text-center text-base"
            aria-invalid={Boolean(errors.code)}
            aria-describedby={errors.code ? 'reset-code-error' : undefined}
            {...register('code')}
          />
          {errors.code ? (
            <p id="reset-code-error" className="text-xs text-destructive">
              {errors.code.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-password">Nova senha</Label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            aria-invalid={Boolean(errors.newPassword)}
            aria-describedby={
              errors.newPassword ? 'reset-password-error' : undefined
            }
            {...register('newPassword')}
          />
          {errors.newPassword ? (
            <p id="reset-password-error" className="text-xs text-destructive">
              {errors.newPassword.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm-password">Confirmar nova senha</Label>
          <PasswordInput
            id="reset-confirm-password"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            aria-invalid={Boolean(errors.confirmNewPassword)}
            aria-describedby={
              errors.confirmNewPassword
                ? 'reset-confirm-password-error'
                : undefined
            }
            {...register('confirmNewPassword')}
          />
          {errors.confirmNewPassword ? (
            <p
              id="reset-confirm-password-error"
              className="text-xs text-destructive"
            >
              {errors.confirmNewPassword.message}
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
              Redefinindo...
            </>
          ) : (
            'Redefinir senha'
          )}
        </Button>

        <div className="flex items-center justify-between text-sm pt-2">
          <Link
            to="/forgot-password"
            className="font-medium text-brand-coral hover:underline"
          >
            Solicitar novo código
          </Link>
          <Link
            to="/login"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
