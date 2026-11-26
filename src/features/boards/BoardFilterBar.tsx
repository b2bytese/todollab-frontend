import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  BoardMember,
  BoardTag,
  TaskItem,
  TaskPriority,
} from '@/types/api';

export interface BoardFilters {
  search: string;
  assigneeId: string | 'ALL' | 'UNASSIGNED';
  priority: TaskPriority | 'ALL';
  tagId: string | 'ALL';
  hideCompleted: boolean;
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  search: '',
  assigneeId: 'ALL',
  priority: 'ALL',
  tagId: 'ALL',
  hideCompleted: false,
};

export { getPriorityMeta, PRIORITY_META } from '@/lib/taskMeta';

export function hasActiveBoardFilters(filters: BoardFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.assigneeId !== 'ALL' ||
    filters.priority !== 'ALL' ||
    filters.tagId !== 'ALL' ||
    filters.hideCompleted
  );
}

export function filterBoardTasks(
  tasks: TaskItem[],
  filters: BoardFilters,
): TaskItem[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.hideCompleted && task.completed) {
      return false;
    }
    if (normalizedSearch) {
      const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }
    if (filters.assigneeId === 'UNASSIGNED') {
      if (task.assigneeId !== null) {
        return false;
      }
    } else if (filters.assigneeId !== 'ALL') {
      if (task.assigneeId !== filters.assigneeId) {
        return false;
      }
    }
    if (filters.priority !== 'ALL' && task.priority !== filters.priority) {
      return false;
    }
    if (filters.tagId !== 'ALL' && !task.tagIds.includes(filters.tagId)) {
      return false;
    }
    return true;
  });
}

export interface BoardFilterBarProps {
  filters: BoardFilters;
  onChange: (next: BoardFilters) => void;
  members: BoardMember[];
  tags: BoardTag[];
}

export function BoardFilterBar({
  filters,
  onChange,
  members,
  tags,
}: BoardFilterBarProps) {
  const filtersActive = hasActiveBoardFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-card/50 px-4 py-2.5 sm:px-6">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar tarefas..."
          aria-label="Buscar tarefas"
          className="h-9 pl-8"
        />
      </div>

      <div className="w-44">
        <Select
          value={filters.assigneeId}
          onValueChange={(value) =>
            onChange({
              ...filters,
              assigneeId: value as BoardFilters['assigneeId'],
            })
          }
        >
          <SelectTrigger aria-label="Filtrar por responsável" className="h-9">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos responsáveis</SelectItem>
            <SelectItem value="UNASSIGNED">Sem responsável</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-40">
        <Select
          value={filters.priority}
          onValueChange={(value) =>
            onChange({
              ...filters,
              priority: value as BoardFilters['priority'],
            })
          }
        >
          <SelectTrigger aria-label="Filtrar por prioridade" className="h-9">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas prioridades</SelectItem>
            <SelectItem value="URGENT">Urgente</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Média</SelectItem>
            <SelectItem value="LOW">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-40">
        <Select
          value={filters.tagId}
          onValueChange={(value) =>
            onChange({
              ...filters,
              tagId: value as BoardFilters['tagId'],
            })
          }
        >
          <SelectTrigger aria-label="Filtrar por etiqueta" className="h-9">
            <SelectValue placeholder="Etiqueta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas etiquetas</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: tag.color }}
                    className="h-2 w-2 rounded-full"
                  />
                  <span>{tag.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 px-1">
        <Checkbox
          id="filter-hide-completed"
          checked={filters.hideCompleted}
          onCheckedChange={(checked) =>
            onChange({ ...filters, hideCompleted: Boolean(checked) })
          }
        />
        <Label
          htmlFor="filter-hide-completed"
          className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
        >
          Ocultar concluídas
        </Label>
      </div>

      {filtersActive ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(DEFAULT_BOARD_FILTERS)}
          className="h-8 gap-1 text-xs text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
