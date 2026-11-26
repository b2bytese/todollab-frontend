import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/AuthLayout';
import {
  applyServerFieldErrors,
  AuthErrorAlert,
} from '@/features/auth/authFormHelpers';
import { getApiError } from '@/lib/api';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setFormError(null);
    const email = values.email.trim();
    try {
      await forgotPassword({ email });
      toast.success(
        'Se o e-mail estiver cadastrado, enviamos um código de recuperação.',
      );
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      const apiErr = getApiError(err);
      applyServerFieldErrors(apiErr.fieldErrors, setError, ['email']);
      setFormError(
        apiErr.detail ?? 'Não foi possível enviar o código de recuperação.',
      );
    }
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      description="Informe o e-mail da sua conta para receber um código de 6 dígitos."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthErrorAlert message={formError} />

        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">E-mail</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
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
              Enviando...
            </>
          ) : (
            'Enviar código'
          )}
        </Button>

        <div className="flex items-center justify-between text-sm pt-2">
          <Link
            to="/reset-password"
            className="font-medium text-brand-coral hover:underline"
          >
            Já tenho um código
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
