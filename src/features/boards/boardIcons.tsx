import {
  Briefcase,
  Folder,
  Home,
  Kanban,
  ListTodo,
  Rocket,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';

export type BoardIconName =
  | 'kanban'
  | 'list-todo'
  | 'briefcase'
  | 'home'
  | 'rocket'
  | 'sparkles'
  | 'folder'
  | 'target';

export interface BoardIconOption {
  value: BoardIconName;
  label: string;
  icon: LucideIcon;
}

export const BOARD_ICON_OPTIONS: readonly BoardIconOption[] = [
  { value: 'kanban', label: 'Kanban', icon: Kanban },
  { value: 'list-todo', label: 'Lista de tarefas', icon: ListTodo },
  { value: 'briefcase', label: 'Trabalho', icon: Briefcase },
  { value: 'home', label: 'Casa', icon: Home },
  { value: 'rocket', label: 'Lançamento', icon: Rocket },
  { value: 'sparkles', label: 'Destaques', icon: Sparkles },
  { value: 'folder', label: 'Pasta', icon: Folder },
  { value: 'target', label: 'Metas', icon: Target },
] as const;

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  BOARD_ICON_OPTIONS.map((option) => [option.value, option.icon]),
);

export function BoardIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const Icon = (name && ICON_MAP[name]) || Kanban;
  return <Icon className={className} aria-hidden="true" />;
}
