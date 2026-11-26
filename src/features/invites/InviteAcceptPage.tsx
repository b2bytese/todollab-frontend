import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  LogIn,
  UserPlus,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLogo } from '@/components/common/AppLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BoardIcon } from '@/features/boards/boardIcons';
import {
  ROLE_LABELS,
  useAcceptInviteMutation,
  useDeclineInviteMutation,
  useInvitePreviewQuery,
} from '@/features/invites/api';
import { getApiError } from '@/lib/api';
import {
  clearPendingInviteToken,
  getPendingInviteToken,
  setPendingInviteToken,
  shouldAutoAcceptPendingInvite,
} from '@/lib/pendingInvite';
import { useAuthStore } from '@/stores/authStore';

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const authStatus = useAuthStore((s) => s.status);

  const previewQuery = useInvitePreviewQuery(token);
  const acceptMutation = useAcceptInviteMutation();
  const declineMutation = useDeclineInviteMutation();

  const [actionError, setActionError] = useState<string | null>(null);
  const autoAcceptTriggeredRef = useRef<string | null>(null);

  const preview = previewQuery.data;
  const { mutate: acceptMutate, isPending: isAcceptPending } = acceptMutation;

  useEffect(() => {
    if (!token) {
      return;
    }

    if (
      previewQuery.isError ||
      (preview && !preview.valid)
    ) {
      if (getPendingInviteToken() === token) {
        clearPendingInviteToken();
      }
      return;
    }

    if (
      authStatus === 'authenticated' &&
      preview?.valid &&
      shouldAutoAcceptPendingInvite(token) &&
      autoAcceptTriggeredRef.current !== token &&
      !isAcceptPending
    ) {
      autoAcceptTriggeredRef.current = token;
      clearPendingInviteToken();
      acceptMutate(token, {
        onSuccess: (res) => {
          toast.success(
            `Convite aceito! Bem-vindo ao quadro "${preview.boardName}".`,
          );
          navigate(`/app/boards/${res.boardId}`, { replace: true });
        },
        onError: (err) => {
          setActionError(
            getApiError(err).detail ?? 'Não foi possível aceitar o convite.',
          );
        },
      });
    }
  }, [
    acceptMutate,
    authStatus,
    isAcceptPending,
    navigate,
    preview,
    previewQuery.isError,
    token,
  ]);

  const handleAccept = () => {
    if (!token || acceptMutation.isPending) {
      return;
    }
    setActionError(null);
    acceptMutation.mutate(token, {
      onSuccess: (res) => {
        clearPendingInviteToken();
        toast.success(
          `Convite aceito! Bem-vindo ao quadro "${preview?.boardName ?? 'quadro'}".`,
        );
        navigate(`/app/boards/${res.boardId}`, { replace: true });
      },
      onError: (err) => {
        setActionError(
          getApiError(err).detail ?? 'Não foi possível aceitar o convite.',
        );
      },
    });
  };

  const handleDecline = () => {
    if (!token || declineMutation.isPending) {
      return;
    }
    setActionError(null);
    declineMutation.mutate(token, {
      onSuccess: () => {
        clearPendingInviteToken();
        toast.info('Convite recusado.');
        navigate('/app/my-tasks', { replace: true });
      },
      onError: (err) => {
        setActionError(
          getApiError(err).detail ?? 'Não foi possível recusar o convite.',
        );
      },
    });
  };

  const handleGoToSignup = () => {
    if (!token) {
      return;
    }
    setPendingInviteToken(token, { autoAccept: true });
    navigate(`/signup?inviteToken=${encodeURIComponent(token)}`);
  };

  const handleGoToLogin = () => {
    if (!token) {
      return;
    }
    setPendingInviteToken(token, { autoAccept: true });
    navigate(`/login?inviteToken=${encodeURIComponent(token)}`);
  };

  const fallbackRoute =
    authStatus === 'authenticated' ? '/app/my-tasks' : '/';
  const fallbackLabel =
    authStatus === 'authenticated'
      ? 'Ir para Minhas Tarefas'
      : 'Voltar para a página inicial';

  return (
    <div className="min-h-screen bg-surface text-foreground flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link to="/" aria-label="Todollab">
            <AppLogo />
          </Link>
        </div>

        {previewQuery.isLoading || authStatus === 'loading' ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2
                className="h-8 w-8 animate-spin text-brand-coral"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                Carregando detalhes do convite...
              </p>
            </CardContent>
          </Card>
        ) : previewQuery.isError || !preview || !preview.valid ? (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <CardTitle as="h1">Convite inválido ou expirado</CardTitle>
              <CardDescription>
                {preview?.reason ??
                  (previewQuery.error
                    ? getApiError(previewQuery.error).detail
                    : null) ??
                  'Este link de convite não é mais válido ou já foi utilizado.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild variant="coral">
                <Link to={fallbackRoute}>
                  {fallbackLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center space-y-3">
              <div className="flex justify-center">
                <span
                  style={{ backgroundColor: preview.boardColor || '#0C2439' }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm"
                >
                  <BoardIcon name={preview.boardIcon} className="h-7 w-7" />
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Convite para quadro
                </p>
                <CardTitle as="h1" className="text-xl">{preview.boardName}</CardTitle>
                <CardDescription>
                  <strong>{preview.inviterName}</strong> convidou você para
                  colaborar neste quadro como{' '}
                  <Badge variant="secondary" className="ml-1 align-middle">
                    {ROLE_LABELS[preview.role]}
                  </Badge>
                  .
                </CardDescription>
              </div>
              {preview.targetEmailMasked ? (
                <p className="text-xs text-muted-foreground">
                  Convite destinado a{' '}
                  <span className="font-medium text-foreground">
                    {preview.targetEmailMasked}
                  </span>
                </p>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-3">
              {actionError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {actionError}
                </div>
              ) : null}

              {authStatus === 'authenticated' ? (
                <div className="space-y-2.5">
                  <Button
                    type="button"
                    variant="coral"
                    size="lg"
                    className="w-full"
                    disabled={
                      acceptMutation.isPending || declineMutation.isPending
                    }
                    onClick={handleAccept}
                  >
                    {acceptMutation.isPending ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Entrando no quadro...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Aceitar convite
                      </>
                    )}
                  </Button>

                  {preview.type === 'EMAIL' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={
                        acceptMutation.isPending || declineMutation.isPending
                      }
                      onClick={handleDecline}
                    >
                      {declineMutation.isPending ? (
                        <>
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          Recusando...
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" aria-hidden="true" />
                          Recusar
                        </>
                      )}
                    </Button>
                  ) : null}

                  <div className="pt-1 text-center">
                    <Link
                      to="/app/my-tasks"
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    >
                      Voltar para Minhas Tarefas
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Button
                    type="button"
                    variant="coral"
                    size="lg"
                    className="w-full"
                    onClick={handleGoToSignup}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Criar conta e entrar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={handleGoToLogin}
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Já tenho conta — Entrar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
