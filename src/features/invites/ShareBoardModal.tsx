import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Crown,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ROLE_LABELS,
  useBoardInvitesQuery,
  useCreateEmailInviteMutation,
  useCreateLinkInviteMutation,
  useLeaveBoardMutation,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
  useTransferOwnershipMutation,
  useUpdateMemberRoleMutation,
} from '@/features/invites/api';
import { useAuthStore } from '@/stores/authStore';
import type { BoardDetail, BoardMember, BoardRole } from '@/types/api';

export interface ShareBoardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: BoardDetail;
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) {
    return 'Sem expiração';
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return 'Com expiração';
  }
  return `Expira em ${date.toLocaleDateString('pt-BR')}`;
}

export function ShareBoardModal({
  open,
  onOpenChange,
  detail,
}: ShareBoardModalProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const boardId = detail.board.id;
  const isOwner = detail.myRole === 'OWNER';

  const invitesQuery = useBoardInvitesQuery(boardId, open && isOwner);
  const createEmailInviteMutation = useCreateEmailInviteMutation(boardId);
  const createLinkInviteMutation = useCreateLinkInviteMutation(boardId);
  const revokeInviteMutation = useRevokeInviteMutation(boardId);
  const updateMemberRoleMutation = useUpdateMemberRoleMutation(boardId);
  const removeMemberMutation = useRemoveMemberMutation(boardId);
  const leaveBoardMutation = useLeaveBoardMutation(boardId);
  const transferOwnershipMutation = useTransferOwnershipMutation(boardId);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailRole, setInviteEmailRole] = useState<BoardRole>('EDITOR');

  const [linkRole, setLinkRole] = useState<BoardRole>('EDITOR');
  const [linkExpiresDays, setLinkExpiresDays] = useState('');
  const [linkMaxUses, setLinkMaxUses] = useState('');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const [memberToRemove, setMemberToRemove] = useState<BoardMember | null>(null);
  const [memberToTransfer, setMemberToTransfer] = useState<BoardMember | null>(
    null,
  );
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'email' | 'links'>(
    'members',
  );

  useEffect(() => {
    if (!open || !isOwner) {
      setActiveTab('members');
    }
  }, [open, isOwner]);

  const invites = invitesQuery.data ?? [];
  const emailInvites = invites.filter((inv) => inv.type === 'EMAIL');
  const linkInvites = invites.filter((inv) => inv.type === 'LINK');

  const handleSendEmailInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inviteEmail.trim();
    if (!trimmed || createEmailInviteMutation.isPending) {
      return;
    }
    createEmailInviteMutation.mutate(
      { email: trimmed, role: inviteEmailRole },
      {
        onSuccess: () => {
          setInviteEmail('');
          toast.success(`Convite enviado para ${trimmed}.`);
        },
      },
    );
  };

  const handleCreateLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createLinkInviteMutation.isPending) {
      return;
    }

    const parsedDays = linkExpiresDays.trim()
      ? Number.parseInt(linkExpiresDays.trim(), 10)
      : null;
    const parsedMaxUses = linkMaxUses.trim()
      ? Number.parseInt(linkMaxUses.trim(), 10)
      : null;

    if (
      parsedDays !== null &&
      (Number.isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365)
    ) {
      toast.error('A validade deve estar entre 1 e 365 dias.');
      return;
    }

    if (
      parsedMaxUses !== null &&
      (Number.isNaN(parsedMaxUses) || parsedMaxUses < 1)
    ) {
      toast.error('O limite de usos deve ser pelo menos 1.');
      return;
    }

    createLinkInviteMutation.mutate(
      {
        role: linkRole,
        expiresInDays: parsedDays,
        maxUses: parsedMaxUses,
      },
      {
        onSuccess: () => {
          setLinkExpiresDays('');
          setLinkMaxUses('');
          toast.success('Link de convite criado.');
        },
      },
    );
  };

  const handleCopyLink = async (inviteId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(inviteId);
      toast.success('Link copiado para a área de transferência.');
      window.setTimeout(() => {
        setCopiedInviteId((prev) => (prev === inviteId ? null : prev));
      }, 2000);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const handleConfirmRemoveMember = () => {
    if (!memberToRemove) {
      return;
    }
    removeMemberMutation.mutate(memberToRemove.userId, {
      onSuccess: () => {
        toast.success(`${memberToRemove.name} foi removido do quadro.`);
        setMemberToRemove(null);
      },
    });
  };

  const handleConfirmTransferOwnership = () => {
    if (!memberToTransfer) {
      return;
    }
    transferOwnershipMutation.mutate(memberToTransfer.userId, {
      onSuccess: () => {
        toast.success(
          `Propriedade transferida para ${memberToTransfer.name}.`,
        );
        setMemberToTransfer(null);
      },
    });
  };

  const handleConfirmLeaveBoard = () => {
    if (!currentUser) {
      return;
    }
    leaveBoardMutation.mutate(currentUser.id, {
      onSuccess: () => {
        setLeaveConfirmOpen(false);
        onOpenChange(false);
        toast.success('Você saiu do quadro.');
        navigate('/app/my-tasks', { replace: true });
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compartilhar quadro</DialogTitle>
            <DialogDescription>
              Gerencie os membros e os convites de acesso para &quot;
              {detail.board.name}&quot;.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={isOwner ? activeTab : 'members'}
            onValueChange={(value) =>
              setActiveTab(value as 'members' | 'email' | 'links')
            }
          >
            <TabsList
              className={
                isOwner
                  ? 'grid w-full grid-cols-3'
                  : 'grid w-full grid-cols-1'
              }
            >
              <TabsTrigger value="members">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Membros ({detail.members.length})
              </TabsTrigger>
              {isOwner ? (
                <TabsTrigger value="email">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Convidar por e-mail
                </TabsTrigger>
              ) : null}
              {isOwner ? (
                <TabsTrigger value="links">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Links de convite
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              <div className="space-y-2.5">
                {detail.members.map((member) => {
                  const isSelf = currentUser?.id === member.userId;
                  const canManageMember =
                    isOwner && !isSelf && member.role !== 'OWNER';

                  return (
                    <div
                      key={member.userId}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          name={member.name}
                          avatarColor={member.avatarColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-foreground">
                              {member.name}
                            </p>
                            {isSelf ? (
                              <span className="text-xs text-muted-foreground">
                                (você)
                              </span>
                            ) : null}
                            <Badge
                              variant={
                                member.role === 'OWNER' ? 'coral' : 'secondary'
                              }
                              className="text-[11px]"
                            >
                              {ROLE_LABELS[member.role]}
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      {canManageMember ? (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Select
                            value={member.role}
                            disabled={updateMemberRoleMutation.isPending}
                            onValueChange={(value) => {
                              updateMemberRoleMutation.mutate(
                                {
                                  userId: member.userId,
                                  role: value as BoardRole,
                                },
                                {
                                  onSuccess: () => {
                                    toast.success(
                                      `Papel de ${member.name} atualizado.`,
                                    );
                                  },
                                },
                              );
                            }}
                          >
                            <SelectTrigger
                              className="h-8 w-[132px] text-xs"
                              aria-label={`Papel de ${member.name}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EDITOR">Editor</SelectItem>
                              <SelectItem value="VIEWER">
                                Visualizador
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            title="Transferir propriedade"
                            onClick={() => setMemberToTransfer(member)}
                          >
                            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="hidden md:inline">
                              Transferir propriedade
                            </span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-muted-foreground hover:text-destructive"
                            aria-label={`Remover ${member.name}`}
                            onClick={() => setMemberToRemove(member)}
                          >
                            <UserMinus
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Remover
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {!isOwner && currentUser ? (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Sair do quadro
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Você perderá acesso às tarefas e atualizações deste quadro.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setLeaveConfirmOpen(true)}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sair do quadro
                  </Button>
                </div>
              ) : null}
            </TabsContent>

            {isOwner ? (
              <TabsContent value="email" className="space-y-4">
                <form
                  onSubmit={handleSendEmailInvite}
                  className="space-y-3 rounded-xl border border-border bg-background/60 p-3.5"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-email-input">
                        E-mail do convidado
                      </Label>
                      <Input
                        id="invite-email-input"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colega@empresa.com"
                        disabled={createEmailInviteMutation.isPending}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-email-role">Papel</Label>
                      <Select
                        value={inviteEmailRole}
                        onValueChange={(value) =>
                          setInviteEmailRole(value as BoardRole)
                        }
                      >
                        <SelectTrigger id="invite-email-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="coral"
                      size="sm"
                      disabled={
                        !inviteEmail.trim() || createEmailInviteMutation.isPending
                      }
                    >
                      {createEmailInviteMutation.isPending ? (
                        <>
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          Enviar convite
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Convites por e-mail pendentes
                  </h3>
                  {invitesQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Carregando convites...
                    </p>
                  ) : emailInvites.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum convite por e-mail pendente.
                    </p>
                  ) : (
                    emailInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {invite.email}
                            </p>
                            <Badge variant="secondary" className="text-[11px]">
                              {ROLE_LABELS[invite.role]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatExpiry(invite.expiresAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-destructive"
                          disabled={revokeInviteMutation.isPending}
                          onClick={() =>
                            revokeInviteMutation.mutate(invite.id, {
                              onSuccess: () => {
                                toast.success('Convite revogado.');
                              },
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Revogar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            ) : null}

            {isOwner ? (
              <TabsContent value="links" className="space-y-4">
                <form
                  onSubmit={handleCreateLink}
                  className="space-y-3 rounded-xl border border-border bg-background/60 p-3.5"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-link-role">Papel</Label>
                      <Select
                        value={linkRole}
                        onValueChange={(value) =>
                          setLinkRole(value as BoardRole)
                        }
                      >
                        <SelectTrigger id="invite-link-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-link-expires">
                        Validade (dias)
                      </Label>
                      <Input
                        id="invite-link-expires"
                        type="number"
                        min={1}
                        max={365}
                        placeholder="Sem expiração"
                        value={linkExpiresDays}
                        onChange={(e) => setLinkExpiresDays(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-link-max-uses">
                        Limite de usos
                      </Label>
                      <Input
                        id="invite-link-max-uses"
                        type="number"
                        min={1}
                        placeholder="Ilimitado"
                        value={linkMaxUses}
                        onChange={(e) => setLinkMaxUses(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="coral"
                      size="sm"
                      disabled={createLinkInviteMutation.isPending}
                    >
                      {createLinkInviteMutation.isPending ? (
                        <>
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Criar link
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Links ativos
                  </h3>
                  {invitesQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Carregando links...
                    </p>
                  ) : linkInvites.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum link de convite ativo.
                    </p>
                  ) : (
                    linkInvites.map((invite) => {
                      const isCopied = copiedInviteId === invite.id;
                      const usageLabel = `${invite.usesCount} / ${invite.maxUses ?? '∞'} usos`;

                      return (
                        <div
                          key={invite.id}
                          className="flex flex-col gap-2.5 rounded-xl border border-border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-[11px]">
                                {ROLE_LABELS[invite.role]}
                              </Badge>
                              <span className="text-xs font-medium text-foreground">
                                {usageLabel}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                • {formatExpiry(invite.expiresAt)}
                              </span>
                            </div>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {invite.inviteUrl}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() =>
                                void handleCopyLink(invite.id, invite.inviteUrl)
                              }
                            >
                              {isCopied ? (
                                <>
                                  <Check
                                    className="h-3.5 w-3.5 text-emerald-600"
                                    aria-hidden="true"
                                  />
                                  Copiado
                                </>
                              ) : (
                                <>
                                  <Copy
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Copiar URL
                                </>
                              )}
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground hover:text-destructive"
                              disabled={revokeInviteMutation.isPending}
                              onClick={() =>
                                revokeInviteMutation.mutate(invite.id, {
                                  onSuccess: () => {
                                    toast.success('Link revogado.');
                                  },
                                })
                              }
                            >
                              <Trash2
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Revogar
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setMemberToRemove(null);
          }
        }}
        title="Remover membro?"
        description={`Tem certeza que deseja remover ${memberToRemove?.name ?? 'este membro'} do quadro "${detail.board.name}"?`}
        confirmLabel="Remover"
        destructive
        loading={removeMemberMutation.isPending}
        onConfirm={handleConfirmRemoveMember}
      />

      <ConfirmDialog
        open={Boolean(memberToTransfer)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setMemberToTransfer(null);
          }
        }}
        title="Transferir propriedade?"
        description={`Você tornará ${memberToTransfer?.name ?? 'este membro'} o novo proprietário de "${detail.board.name}" e passará a ser Editor.`}
        confirmLabel="Transferir"
        loading={transferOwnershipMutation.isPending}
        onConfirm={handleConfirmTransferOwnership}
      />

      <ConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title="Sair do quadro?"
        description={`Tem certeza que deseja sair de "${detail.board.name}"? Você precisará de um novo convite para voltar.`}
        confirmLabel="Sair"
        destructive
        loading={leaveBoardMutation.isPending}
        onConfirm={handleConfirmLeaveBoard}
      />
    </>
  );
}
