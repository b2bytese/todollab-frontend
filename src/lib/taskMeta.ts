import type { BadgeProps } from '@/components/ui/badge';
import type { BoardRole, TaskPriority } from '@/types/api';

export interface PriorityMeta {
  label: string;
  variant: BadgeProps['variant'];
}

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  URGENT: { label: 'Urgente', variant: 'coral' },
  HIGH: { label: 'Alta', variant: 'warning' },
  MEDIUM: { label: 'Média', variant: 'secondary' },
  LOW: { label: 'Baixa', variant: 'outline' },
};

/**
 * Returns display label and badge variant for a task priority, with a safe fallback.
 */
export function getPriorityMeta(priority: string): PriorityMeta {
  if (Object.prototype.hasOwnProperty.call(PRIORITY_META, priority)) {
    return PRIORITY_META[priority as TaskPriority];
  }
  return { label: priority, variant: 'secondary' };
}

export const ROLE_LABELS: Record<BoardRole, string> = {
  OWNER: 'Proprietário',
  EDITOR: 'Editor',
  VIEWER: 'Visualizador',
};

/**
 * Returns localized pt-BR label for a board role, falling back to the raw role key.
 */
export function getRoleLabel(role: string): string {
  if (Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)) {
    return ROLE_LABELS[role as BoardRole];
  }
  return role;
}
