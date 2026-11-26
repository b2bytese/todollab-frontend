import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { boardKeys } from '@/features/boards/api';
import { api, getApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type {
  AcceptInviteResponse,
  BoardDetail,
  BoardInvite,
  BoardMember,
  BoardRole,
  InvitePreview,
} from '@/types/api';

export const ROLE_LABELS: Record<BoardRole, string> = {
  OWNER: 'Proprietário',
  EDITOR: 'Editor',
  VIEWER: 'Visualizador',
};

export const inviteKeys = {
  preview: (token: string) => ['invite-preview', token] as const,
};

export interface CreateEmailInvitePayload {
  email: string;
  role: BoardRole;
}

export interface CreateLinkInvitePayload {
  role: BoardRole;
  expiresInDays?: number | null;
  maxUses?: number | null;
}

export async function fetchBoardInvites(boardId: string): Promise<BoardInvite[]> {
  const { data } = await api.get<BoardInvite[]>(`/api/v1/boards/${boardId}/invites`);
  return data;
}

export async function createEmailInvite(
  boardId: string,
  payload: CreateEmailInvitePayload,
): Promise<BoardInvite> {
  const { data } = await api.post<BoardInvite>(
    `/api/v1/boards/${boardId}/invites/email`,
    payload,
  );
  return data;
}

export async function createLinkInvite(
  boardId: string,
  payload: CreateLinkInvitePayload,
): Promise<BoardInvite> {
  const { data } = await api.post<BoardInvite>(
    `/api/v1/boards/${boardId}/invites/link`,
    payload,
  );
  return data;
}

export async function revokeInvite(
  boardId: string,
  inviteId: string,
): Promise<void> {
  await api.delete(`/api/v1/boards/${boardId}/invites/${inviteId}`);
}

export async function updateMemberRole(
  boardId: string,
  userId: string,
  role: BoardRole,
): Promise<BoardMember> {
  const { data } = await api.patch<BoardMember>(
    `/api/v1/boards/${boardId}/members/${userId}`,
    { role },
  );
  return data;
}

export async function removeOrLeaveMember(
  boardId: string,
  userId: string,
): Promise<void> {
  await api.delete(`/api/v1/boards/${boardId}/members/${userId}`);
}

export async function transferOwnership(
  boardId: string,
  newOwnerId: string,
): Promise<BoardMember[]> {
  const { data } = await api.post<BoardMember[]>(
    `/api/v1/boards/${boardId}/transfer-ownership`,
    { newOwnerId },
  );
  return data;
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const { data } = await api.get<InvitePreview>(`/api/v1/invites/${token}/preview`);
  return data;
}

export async function acceptInvite(token: string): Promise<AcceptInviteResponse> {
  const { data } = await api.post<AcceptInviteResponse>(
    `/api/v1/invites/${token}/accept`,
  );
  return data;
}

export async function declineInvite(token: string): Promise<void> {
  await api.post(`/api/v1/invites/${token}/decline`);
}

export function useBoardInvitesQuery(boardId: string, enabled: boolean) {
  return useQuery({
    queryKey: boardKeys.invites(boardId),
    queryFn: () => fetchBoardInvites(boardId),
    enabled: Boolean(boardId) && enabled,
  });
}

export function useInvitePreviewQuery(token: string | undefined) {
  return useQuery({
    queryKey: inviteKeys.preview(token ?? ''),
    queryFn: () => fetchInvitePreview(token!),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useCreateEmailInviteMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEmailInvitePayload) =>
      createEmailInvite(boardId, payload),
    onSuccess: (created) => {
      queryClient.setQueryData<BoardInvite[]>(
        boardKeys.invites(boardId),
        (prev) => {
          if (!prev) return [created];
          const exists = prev.some((item) => item.id === created.id);
          return exists
            ? prev.map((item) => (item.id === created.id ? created : item))
            : [created, ...prev];
        },
      );
      void queryClient.invalidateQueries({ queryKey: boardKeys.invites(boardId) });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível enviar o convite por e-mail.',
      );
    },
  });
}

export function useCreateLinkInviteMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateLinkInvitePayload) =>
      createLinkInvite(boardId, payload),
    onSuccess: (created) => {
      queryClient.setQueryData<BoardInvite[]>(
        boardKeys.invites(boardId),
        (prev) => (prev ? [created, ...prev] : [created]),
      );
      void queryClient.invalidateQueries({ queryKey: boardKeys.invites(boardId) });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível criar o link de convite.',
      );
    },
  });
}

export function useRevokeInviteMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(boardId, inviteId),
    onSuccess: (_data, inviteId) => {
      queryClient.setQueryData<BoardInvite[]>(
        boardKeys.invites(boardId),
        (prev) => (prev ? prev.filter((item) => item.id !== inviteId) : prev),
      );
      void queryClient.invalidateQueries({ queryKey: boardKeys.invites(boardId) });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível revogar o convite.',
      );
    },
  });
}

export function useUpdateMemberRoleMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: BoardRole }) =>
      updateMemberRole(boardId, userId, role),
    onSuccess: (updatedMember) => {
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previous,
          members: previous.members.map((member) =>
            member.userId === updatedMember.userId ? updatedMember : member,
          ),
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível atualizar o papel do membro.',
      );
    },
  });
}

export function useRemoveMemberMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeOrLeaveMember(boardId, userId),
    onSuccess: (_data, removedUserId) => {
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previous,
          members: previous.members.filter(
            (member) => member.userId !== removedUserId,
          ),
          tasks: previous.tasks.map((task) =>
            task.assigneeId === removedUserId
              ? { ...task, assigneeId: null }
              : task,
          ),
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível remover o membro.',
      );
    },
  });
}

export function useLeaveBoardMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeOrLeaveMember(boardId, userId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myTasks() });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível sair do quadro.',
      );
    },
  });
}

export function useTransferOwnershipMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newOwnerId: string) => transferOwnership(boardId, newOwnerId),
    onSuccess: (members, newOwnerId) => {
      const previous = queryClient.getQueryData<BoardDetail>(
        boardKeys.detail(boardId),
      );
      if (previous) {
        const currentUserId = useAuthStore.getState().user?.id;
        const nextMyRole =
          members.find((m) => m.userId === currentUserId)?.role ??
          previous.myRole;
        queryClient.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
          ...previous,
          board: {
            ...previous.board,
            ownerId: newOwnerId,
          },
          myRole: nextMyRole,
          members,
        });
      }
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível transferir a propriedade.',
      );
    },
  });
}

export function useAcceptInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.myInvites });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível aceitar o convite.',
      );
    },
  });
}

export function useDeclineInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => declineInvite(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.myInvites });
    },
    onError: (err) => {
      toast.error(
        getApiError(err).detail ?? 'Não foi possível recusar o convite.',
      );
    },
  });
}
