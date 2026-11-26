import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useCreateTagMutation,
  useDeleteTagMutation,
  useUpdateTagMutation,
} from '@/features/tasks/api';
import { TAG_COLORS } from '@/lib/avatarColors';
import { cn } from '@/lib/utils';
import type { BoardTag } from '@/types/api';

export interface TaskTagsPopoverProps {
  boardId: string;
  boardTags: BoardTag[];
  selectedTagIds: string[];
  canEdit: boolean;
  onChangeTagIds: (nextTagIds: string[]) => void;
}

export function TaskTagsPopover({
  boardId,
  boardTags,
  selectedTagIds,
  canEdit,
  onChangeTagIds,
}: TaskTagsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(TAG_COLORS[1]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>(TAG_COLORS[0]);

  const createTagMutation = useCreateTagMutation(boardId);
  const updateTagMutation = useUpdateTagMutation(boardId);
  const deleteTagMutation = useDeleteTagMutation(boardId);

  const selectedTagIdsRef = useRef(selectedTagIds);
  useEffect(() => {
    selectedTagIdsRef.current = selectedTagIds;
  }, [selectedTagIds]);

  const selectedSet = new Set(selectedTagIds);
  const selectedTags = boardTags.filter((tag) => selectedSet.has(tag.id));

  const handlePopoverOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEditingTagId(null);
    }
  };

  const handleToggleTag = (tagId: string) => {
    if (!canEdit) {
      return;
    }
    if (selectedSet.has(tagId)) {
      onChangeTagIds(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChangeTagIds([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || !canEdit || createTagMutation.isPending) {
      return;
    }
    createTagMutation.mutate(
      {
        name: trimmed,
        color: newColor,
      },
      {
        onSuccess: (created) => {
          setNewName('');
          const latestSelected = selectedTagIdsRef.current;
          if (!latestSelected.includes(created.id)) {
            onChangeTagIds([...latestSelected, created.id]);
          }
        },
      },
    );
  };

  const startEditingTag = (tag: BoardTag) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEditTag = (
    event: FormEvent<HTMLFormElement>,
    tag: BoardTag,
  ) => {
    event.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || !canEdit || updateTagMutation.isPending) {
      return;
    }
    if (trimmed === tag.name && editColor === tag.color) {
      setEditingTagId(null);
      return;
    }
    updateTagMutation.mutate(
      {
        tagId: tag.id,
        payload: {
          name: trimmed,
          color: editColor,
        },
      },
      {
        onSuccess: () => {
          setEditingTagId(null);
        },
      },
    );
  };

  const handleDeleteTag = (tagId: string) => {
    if (!canEdit || deleteTagMutation.isPending) {
      return;
    }
    deleteTagMutation.mutate(tagId, {
      onSuccess: () => {
        if (editingTagId === tagId) {
          setEditingTagId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              borderColor: `${tag.color}40`,
            }}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: tag.color }}
              className="h-1.5 w-1.5 rounded-full"
            />
            {tag.name}
          </span>
        ))}

        {!canEdit && selectedTags.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Nenhuma etiqueta
          </span>
        ) : null}

        {canEdit ? (
          <Popover open={open} onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                aria-label="Gerenciar etiquetas"
              >
                <Tag className="h-3 w-3" aria-hidden="true" />
                {selectedTags.length > 0 ? 'Editar etiquetas' : 'Adicionar etiquetas'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-3 p-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Etiquetas do quadro
                </p>
                {boardTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma etiqueta criada ainda.
                  </p>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                    {boardTags.map((tag) => {
                      const active = selectedSet.has(tag.id);
                      const isEditing = editingTagId === tag.id;

                      if (isEditing) {
                        return (
                          <form
                            key={tag.id}
                            onSubmit={(e) => handleSaveEditTag(e, tag)}
                            className="space-y-2 rounded-lg border border-border bg-background/80 p-2"
                          >
                            <div className="flex items-center gap-1">
                              <Input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Nome da etiqueta..."
                                aria-label={`Editar nome da etiqueta ${tag.name}`}
                                maxLength={40}
                                className="h-7 flex-1 text-xs"
                                disabled={updateTagMutation.isPending}
                              />
                              <Button
                                type="submit"
                                size="icon"
                                variant="coral"
                                className="h-7 w-7 shrink-0"
                                disabled={
                                  !editName.trim() || updateTagMutation.isPending
                                }
                                aria-label="Salvar etiqueta"
                              >
                                {updateTagMutation.isPending ? (
                                  <Loader2
                                    className="h-3 w-3 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => setEditingTagId(null)}
                                aria-label="Cancelar edição"
                              >
                                <X className="h-3 w-3" aria-hidden="true" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {TAG_COLORS.map((color) => {
                                const colorActive = editColor === color;
                                return (
                                  <button
                                    key={color}
                                    type="button"
                                    aria-label={`Editar cor da etiqueta ${color}`}
                                    aria-pressed={colorActive}
                                    onClick={() => setEditColor(color)}
                                    style={{ backgroundColor: color }}
                                    className={cn(
                                      'flex h-4 w-4 items-center justify-center rounded-full cursor-pointer transition-transform',
                                      colorActive
                                        ? 'scale-110 ring-2 ring-foreground ring-offset-1 ring-offset-popover'
                                        : 'hover:scale-105',
                                    )}
                                  >
                                    {colorActive ? (
                                      <Check
                                        className="h-2.5 w-2.5 text-white"
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={tag.id}
                          className="group flex items-center gap-1"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleTag(tag.id)}
                            aria-pressed={active}
                            className={cn(
                              'flex flex-1 min-w-0 items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors cursor-pointer',
                              active
                                ? 'bg-accent text-foreground font-medium'
                                : 'hover:bg-accent/60 text-foreground',
                            )}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                aria-hidden="true"
                                style={{ backgroundColor: tag.color }}
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                              />
                              <span className="truncate">{tag.name}</span>
                            </span>
                            {active ? (
                              <Check
                                className="h-3.5 w-3.5 shrink-0 text-brand-coral"
                                aria-hidden="true"
                              />
                            ) : null}
                          </button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label={`Editar etiqueta ${tag.name}`}
                            title="Editar etiqueta"
                            onClick={() => startEditingTag(tag)}
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Excluir etiqueta ${tag.name}`}
                            title="Excluir etiqueta"
                            disabled={deleteTagMutation.isPending}
                            onClick={() => handleDeleteTag(tag.id)}
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleCreateTag}
                className="space-y-2 border-t border-border pt-2.5"
              >
                <p className="text-xs font-semibold text-foreground">
                  Nova etiqueta
                </p>
                <div className="flex gap-1.5">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome da etiqueta..."
                    aria-label="Nome da nova etiqueta"
                    maxLength={40}
                    className="h-8 text-xs"
                    disabled={createTagMutation.isPending}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="coral"
                    className="h-8 px-2.5"
                    disabled={!newName.trim() || createTagMutation.isPending}
                    aria-label="Criar etiqueta"
                  >
                    {createTagMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_COLORS.map((color) => {
                    const active = newColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Cor da etiqueta ${color}`}
                        aria-pressed={active}
                        onClick={() => setNewColor(color)}
                        style={{ backgroundColor: color }}
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full cursor-pointer transition-transform',
                          active
                            ? 'scale-110 ring-2 ring-foreground ring-offset-1 ring-offset-popover'
                            : 'hover:scale-105',
                        )}
                      >
                        {active ? (
                          <Check className="h-3 w-3 text-white" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </form>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
