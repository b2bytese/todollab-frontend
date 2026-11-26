import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Kanban,
  List,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateColumnMutation,
  useDeleteBoardMutation,
  useDeleteColumnMutation,
  useMoveColumnMutation,
  useUpdateBoardMutation,
  useUpdateColumnMutation,
} from '@/features/boards/api';
import { BOARD_ICON_OPTIONS } from '@/features/boards/boardIcons';
import {
  ColumnDeleteDialog,
  type ColumnDeleteChoice,
} from '@/features/boards/ColumnDeleteDialog';
import { BOARD_COLORS } from '@/lib/avatarColors';
import { calculateDropPosition } from '@/lib/fractionalIndex';
import { cn } from '@/lib/utils';
import type { BoardColumn, BoardDetail, BoardView } from '@/types/api';

export interface BoardSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: BoardDetail;
  canEdit: boolean;
  isOwner: boolean;
}

export function BoardSettingsDialog({
  open,
  onOpenChange,
  detail,
  canEdit,
  isOwner,
}: BoardSettingsDialogProps) {
  const navigate = useNavigate();
  const boardId = detail.board.id;

  const updateBoardMutation = useUpdateBoardMutation(boardId);
  const deleteBoardMutation = useDeleteBoardMutation();
  const createColumnMutation = useCreateColumnMutation(boardId);
  const updateColumnMutation = useUpdateColumnMutation(boardId);
  const moveColumnMutation = useMoveColumnMutation(boardId);
  const deleteColumnMutation = useDeleteColumnMutation(boardId);

  const [name, setName] = useState(detail.board.name);
  const [description, setDescription] = useState(detail.board.description ?? '');
  const [color, setColor] = useState(detail.board.color);
  const [icon, setIcon] = useState(detail.board.icon);
  const [defaultView, setDefaultView] = useState<BoardView>(
    detail.board.defaultView,
  );
  const [confirmDeleteBoardOpen, setConfirmDeleteBoardOpen] = useState(false);

  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnIsDone, setNewColumnIsDone] = useState(false);
  const [columnEdits, setColumnEdits] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'general' | 'columns'>(
    isOwner ? 'general' : 'columns',
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    column: BoardColumn;
    taskCount: number;
  } | null>(null);

  const prevOpenRef = useRef(false);
  const prevBoardIdRef = useRef(detail.board.id);

  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    const prevBoardId = prevBoardIdRef.current;
    prevOpenRef.current = open;
    prevBoardIdRef.current = detail.board.id;

    if (!open) {
      setConfirmDeleteBoardOpen(false);
      setDeleteTarget(null);
      return;
    }

    if (!wasOpen || prevBoardId !== detail.board.id) {
      setName(detail.board.name);
      setDescription(detail.board.description ?? '');
      setColor(detail.board.color);
      setIcon(detail.board.icon);
      setDefaultView(detail.board.defaultView);
      const map: Record<string, string> = {};
      for (const col of detail.columns) {
        map[col.id] = col.name;
      }
      setColumnEdits(map);
      setNewColumnName('');
      setNewColumnIsDone(false);
      setActiveTab(isOwner ? 'general' : 'columns');
    }
  }, [open, detail.board, detail.columns, isOwner]);

  useEffect(() => {
    if (!isOwner && activeTab === 'general') {
      setActiveTab('columns');
    }
  }, [isOwner, activeTab]);

  const sortedColumns = [...detail.columns].sort(
    (a, b) => a.position - b.position,
  );

  const handleSaveBoard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOwner) {
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    updateBoardMutation.mutate(
      {
        name: trimmedName,
        description: description.trim() || null,
        color,
        icon,
        defaultView,
      },
      {
        onSuccess: () => {
          toast.success('Configurações do quadro atualizadas.');
        },
      },
    );
  };

  const handleDeleteBoard = () => {
    if (!isOwner) {
      return;
    }
    deleteBoardMutation.mutate(boardId, {
      onSuccess: () => {
        setConfirmDeleteBoardOpen(false);
        onOpenChange(false);
        toast.success('Quadro excluído.');
        navigate('/app/my-tasks', { replace: true });
      },
    });
  };

  const handleAddColumn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newColumnName.trim();
    if (!trimmed || !canEdit || createColumnMutation.isPending) {
      return;
    }
    createColumnMutation.mutate(
      {
        name: trimmed,
        isDoneColumn: newColumnIsDone,
      },
      {
        onSuccess: () => {
          setNewColumnName('');
          setNewColumnIsDone(false);
          toast.success('Coluna criada.');
        },
      },
    );
  };

  const handleMoveColumn = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedColumns.length) {
      return;
    }
    const moving = sortedColumns[index];
    const withoutMoving = sortedColumns.filter((c) => c.id !== moving.id);
    const newPosition = calculateDropPosition(withoutMoving, targetIndex);

    moveColumnMutation.mutate({
      columnId: moving.id,
      position: newPosition,
    });
  };

  const openDeleteColumnModal = (column: BoardColumn) => {
    const taskCount = detail.tasks.filter((t) => t.columnId === column.id).length;
    setDeleteTarget({ column, taskCount });
  };

  const handleConfirmEmptyDelete = () => {
    if (!deleteTarget) {
      return;
    }
    deleteColumnMutation.mutate(
      { columnId: deleteTarget.column.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          toast.success('Coluna removida.');
        },
      },
    );
  };

  const handleConfirmDeleteWithTasks = (choice: ColumnDeleteChoice) => {
    if (!deleteTarget) {
      return;
    }
    deleteColumnMutation.mutate(
      {
        columnId: deleteTarget.column.id,
        ...choice,
      },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          toast.success('Coluna removida.');
        },
      },
    );
  };

  const otherColumnsForDelete = deleteTarget
    ? sortedColumns.filter((c) => c.id !== deleteTarget.column.id)
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações do quadro</DialogTitle>
            <DialogDescription>
              Gerencie os detalhes do quadro e organize suas colunas.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as 'general' | 'columns')
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general" disabled={!isOwner}>
                Geral
              </TabsTrigger>
              <TabsTrigger value="columns" disabled={!canEdit}>
                Colunas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-5">
              <form
                onSubmit={handleSaveBoard}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="settings-board-name">Nome do quadro</Label>
                  <Input
                    id="settings-board-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isOwner || updateBoardMutation.isPending}
                    maxLength={80}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="settings-board-description">Descrição</Label>
                  <Textarea
                    id="settings-board-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isOwner || updateBoardMutation.isPending}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {BOARD_COLORS.map((item) => {
                      const active = color === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          disabled={!isOwner}
                          aria-label={`Cor ${item}`}
                          aria-pressed={active}
                          onClick={() => setColor(item)}
                          style={{ backgroundColor: item }}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full cursor-pointer transition-transform',
                            active
                              ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card'
                              : 'hover:scale-105',
                          )}
                        >
                          {active ? (
                            <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {BOARD_ICON_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = icon === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!isOwner}
                          aria-label={option.label}
                          aria-pressed={active}
                          onClick={() => setIcon(option.value)}
                          className={cn(
                            'flex items-center justify-center rounded-lg border py-2 transition-colors cursor-pointer',
                            active
                              ? 'border-brand-coral bg-brand-coral/10 text-brand-coral'
                              : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Visualização padrão</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!isOwner}
                      aria-pressed={defaultView === 'KANBAN'}
                      onClick={() => setDefaultView('KANBAN')}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                        defaultView === 'KANBAN'
                          ? 'border-brand-navy bg-brand-navy text-white dark:border-brand-coral dark:bg-brand-coral'
                          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Kanban className="h-4 w-4" aria-hidden="true" />
                      Kanban
                    </button>
                    <button
                      type="button"
                      disabled={!isOwner}
                      aria-pressed={defaultView === 'LIST'}
                      onClick={() => setDefaultView('LIST')}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                        defaultView === 'LIST'
                          ? 'border-brand-navy bg-brand-navy text-white dark:border-brand-coral dark:bg-brand-coral'
                          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <List className="h-4 w-4" aria-hidden="true" />
                      Lista
                    </button>
                  </div>
                </div>

                {isOwner ? (
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="coral"
                      disabled={!name.trim() || updateBoardMutation.isPending}
                    >
                      {updateBoardMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar alterações'
                      )}
                    </Button>
                  </div>
                ) : null}
              </form>

              {isOwner ? (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
                    <div>
                      <p className="text-sm font-semibold text-destructive">
                        Excluir quadro
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Remove permanentemente o quadro, colunas e tarefas.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDeleteBoardOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Excluir
                    </Button>
                  </div>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="columns" className="space-y-4">
              <div className="space-y-2">
                {sortedColumns.map((column, index) => {
                  const draftName = columnEdits[column.id] ?? column.name;
                  return (
                    <div
                      key={column.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/70 p-2.5"
                    >
                      <Input
                        value={draftName}
                        onChange={(e) =>
                          setColumnEdits((prev) => ({
                            ...prev,
                            [column.id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const trimmed = draftName.trim();
                          if (!trimmed) {
                            setColumnEdits((prev) => ({
                              ...prev,
                              [column.id]: column.name,
                            }));
                            return;
                          }
                          if (trimmed !== column.name) {
                            updateColumnMutation.mutate({
                              columnId: column.id,
                              payload: { name: trimmed },
                            });
                          }
                        }}
                        aria-label={`Nome da coluna ${column.name}`}
                        maxLength={80}
                        className="h-8 flex-1 min-w-[140px]"
                      />

                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id={`col-done-${column.id}`}
                          checked={column.isDoneColumn}
                          onCheckedChange={(checked) =>
                            updateColumnMutation.mutate({
                              columnId: column.id,
                              payload: { isDoneColumn: Boolean(checked) },
                            })
                          }
                        />
                        <Label
                          htmlFor={`col-done-${column.id}`}
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          Conclusão
                        </Label>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === 0 || moveColumnMutation.isPending}
                          aria-label={`Mover ${column.name} para cima`}
                          onClick={() => handleMoveColumn(index, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={
                            index === sortedColumns.length - 1 ||
                            moveColumnMutation.isPending
                          }
                          aria-label={`Mover ${column.name} para baixo`}
                          onClick={() => handleMoveColumn(index, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={
                            sortedColumns.length <= 1 ||
                            deleteColumnMutation.isPending
                          }
                          aria-label={`Excluir coluna ${column.name}`}
                          onClick={() => openDeleteColumnModal(column)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleAddColumn}
                className="space-y-2.5 rounded-xl border border-dashed border-border p-3"
              >
                <p className="text-xs font-semibold text-foreground">
                  Nova coluna
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="Nome da coluna..."
                    aria-label="Nome da nova coluna"
                    maxLength={80}
                    className="h-8 flex-1 min-w-[160px]"
                    disabled={createColumnMutation.isPending}
                  />
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="new-col-done"
                      checked={newColumnIsDone}
                      onCheckedChange={(checked) =>
                        setNewColumnIsDone(Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor="new-col-done"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Conclusão
                    </Label>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    variant="coral"
                    className="h-8"
                    disabled={
                      !newColumnName.trim() || createColumnMutation.isPending
                    }
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Adicionar
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteBoardOpen}
        onOpenChange={setConfirmDeleteBoardOpen}
        title="Excluir quadro?"
        description={`Tem certeza que deseja excluir "${detail.board.name}"? Todas as colunas, tarefas e convites serão perdidos.`}
        confirmLabel="Excluir quadro"
        destructive
        loading={deleteBoardMutation.isPending}
        onConfirm={handleDeleteBoard}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget && deleteTarget.taskCount === 0)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        title="Excluir coluna?"
        description={`Tem certeza que deseja excluir a coluna "${deleteTarget?.column.name ?? ''}"?`}
        confirmLabel="Excluir coluna"
        destructive
        loading={deleteColumnMutation.isPending}
        onConfirm={handleConfirmEmptyDelete}
      />

      <ColumnDeleteDialog
        open={Boolean(deleteTarget && deleteTarget.taskCount > 0)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        column={deleteTarget?.column ?? null}
        otherColumns={otherColumnsForDelete}
        taskCount={deleteTarget?.taskCount ?? 0}
        loading={deleteColumnMutation.isPending}
        onConfirm={handleConfirmDeleteWithTasks}
      />
    </>
  );
}
