import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Mail, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { boardKeys, usePendingInvitesQuery } from '@/features/boards/api';
import { BoardIcon } from '@/features/boards/boardIcons';
import { api, getApiError } from '@/lib/api';
import type { AcceptInviteResponse, BoardRole, PendingInvite } from '@/types/api';

const ROLE_LABELS: Record<BoardRole, string> = {
  OWNER: 'Proprietário',
  EDITOR: 'Editor',
  VIEWER: 'Visualizador',
};

export function PendingInvitesCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: invites = [], isLoading } = usePendingInvitesQuery();
  const [pendingAction, setPendingAction] = useState<{
    token: string;
    type: 'accept' | 'decline';
  } | null>(null);

  const acceptMutation = useMutation({
    mutationFn: async (invite: PendingInvite) => {
      const { data } = await api.post<AcceptInviteResponse>(
        `/api/v1/invites/${invite.token}/accept`,
      );
      return { data, invite };
    },
    onMutate: (invite) => {
      setPendingAction({ token: invite.token, type: 'accept' });
    },
    onSuccess: ({ data, invite }) => {
      queryClient.setQueryData<PendingInvite[]>(boardKeys.myInvites, (prev) =>
        prev ? prev.filter((item) => item.token !== invite.token) : prev,
      );
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myInvites });
      toast.success(`Convite aceito! Bem-vindo ao quadro "${invite.boardName}".`);
      navigate(`/app/boards/${data.boardId}`);
    },
    onError: (err) => {
      toast.error(getApiError(err).detail ?? 'Não foi possível aceitar o convite.');
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (invite: PendingInvite) => {
      await api.post(`/api/v1/invites/${invite.token}/decline`);
      return invite;
    },
    onMutate: (invite) => {
      setPendingAction({ token: invite.token, type: 'decline' });
    },
    onSuccess: (invite) => {
      queryClient.setQueryData<PendingInvite[]>(boardKeys.myInvites, (prev) =>
        prev ? prev.filter((item) => item.token !== invite.token) : prev,
      );
      void queryClient.invalidateQueries({ queryKey: boardKeys.myInvites });
      toast.info(`Convite para "${invite.boardName}" recusado.`);
    },
    onError: (err) => {
      toast.error(getApiError(err).detail ?? 'Não foi possível recusar o convite.');
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  if (isLoading || invites.length === 0) {
    return null;
  }

  return (
    <section aria-label="Convites pendentes">
      <Card className="border-brand-coral/35 bg-gradient-to-r from-brand-coral/5 via-card to-card dark:from-brand-coral/10">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-coral/15 text-brand-coral">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-base">Convites pendentes</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Você recebeu {invites.length}{' '}
                  {invites.length === 1 ? 'convite para colaborar' : 'convites para colaborar'}.
                </p>
              </div>
            </div>
            <Badge variant="coral">{invites.length}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {invites.map((invite) => {
            const isBusy = pendingAction?.token === invite.token;
            const isAccepting = isBusy && pendingAction?.type === 'accept';
            const isDeclining = isBusy && pendingAction?.type === 'decline';

            return (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background/80 p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    style={{ backgroundColor: invite.boardColor || '#0C2439' }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-xs"
                  >
                    <BoardIcon name={invite.boardIcon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {invite.boardName}
                      </p>
                      <Badge variant="secondary" className="text-[11px]">
                        {ROLE_LABELS[invite.role]}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      Convidado por {invite.inviterName}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => declineMutation.mutate(invite)}
                  >
                    {isDeclining ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Recusar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="coral"
                    disabled={isBusy}
                    onClick={() => acceptMutation.mutate(invite)}
                  >
                    {isAccepting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Aceitar
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
