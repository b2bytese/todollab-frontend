import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BoardColumn } from '@/types/api';

export interface ColumnDeleteChoice {
  targetColumnId?: string;
  deleteTasks?: boolean;
}

export interface ColumnDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: BoardColumn | null;
  otherColumns: BoardColumn[];
  taskCount: number;
  loading?: boolean;
  onConfirm: (choice: ColumnDeleteChoice) => void;
}

export function ColumnDeleteDialog({
  open,
  onOpenChange,
  column,
  otherColumns,
  taskCount,
  loading = false,
  onConfirm,
}: ColumnDeleteDialogProps) {
  const [mode, setMode] = useState<'move' | 'delete'>('move');
  const [targetColumnId, setTargetColumnId] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (otherColumns.length > 0) {
        setMode('move');
        setTargetColumnId(otherColumns[0].id);
      } else {
        setMode('delete');
        setTargetColumnId('');
      }
    }
  }, [open, column?.id, otherColumns]);

  const handleConfirm = () => {
    if (mode === 'delete') {
      onConfirm({ deleteTasks: true });
      return;
    }
    if (!targetColumnId) {
      return;
    }
    onConfirm({ targetColumnId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir coluna com tarefas</DialogTitle>
          <DialogDescription>
            A coluna &quot;{column?.name}&quot; possui {taskCount}{' '}
            {taskCount === 1 ? 'tarefa' : 'tarefas'}. Escolha o que fazer com{' '}
            {taskCount === 1 ? 'ela' : 'elas'} antes de excluir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="rounded-lg border border-border p-3 space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm font-medium text-foreground cursor-pointer">
              <input
                type="radio"
                name="column-delete-strategy"
                value="move"
                checked={mode === 'move'}
                disabled={otherColumns.length === 0 || loading}
                onChange={() => setMode('move')}
                className="h-4 w-4 accent-brand-coral cursor-pointer"
              />
              <span>Mover tarefas para outra coluna</span>
            </label>

            {mode === 'move' && otherColumns.length > 0 ? (
              <div className="pl-6 space-y-1.5">
                <Label htmlFor="kanban-delete-target-column" className="text-xs">
                  Coluna de destino
                </Label>
                <Select
                  value={targetColumnId}
                  onValueChange={setTargetColumnId}
                  disabled={loading}
                >
                  <SelectTrigger
                    id="kanban-delete-target-column"
                    aria-label="Coluna de destino"
                  >
                    <SelectValue placeholder="Selecione uma coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherColumns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm cursor-pointer">
            <input
              type="radio"
              name="column-delete-strategy"
              value="delete"
              checked={mode === 'delete'}
              disabled={loading}
              onChange={() => setMode('delete')}
              className="mt-0.5 h-4 w-4 accent-destructive cursor-pointer"
            />
            <span className="space-y-0.5">
              <span className="block font-medium text-destructive">
                Excluir todas as tarefas da coluna
              </span>
              <span className="block text-xs text-muted-foreground">
                Essa ação remove permanentemente as tarefas desta coluna.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading || (mode === 'move' && !targetColumnId)}
            onClick={handleConfirm}
          >
            {loading ? 'Excluindo...' : 'Excluir coluna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
