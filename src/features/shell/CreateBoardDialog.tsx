import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Kanban, List, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBoardMutation } from '@/features/boards/api';
import { BOARD_ICON_OPTIONS } from '@/features/boards/boardIcons';
import { getApiError } from '@/lib/api';
import { BOARD_COLORS } from '@/lib/avatarColors';
import { cn } from '@/lib/utils';

const createBoardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome do quadro.')
    .max(80, 'O nome deve ter no máximo 80 caracteres.'),
  description: z
    .string()
    .trim()
    .max(300, 'A descrição deve ter no máximo 300 caracteres.')
    .optional(),
  color: z.string().min(1),
  icon: z.string().min(1),
  defaultView: z.enum(['KANBAN', 'LIST']),
});

type CreateBoardFormValues = z.infer<typeof createBoardSchema>;

export interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBoardDialog({
  open,
  onOpenChange,
}: CreateBoardDialogProps) {
  const navigate = useNavigate();
  const createBoardMutation = useCreateBoardMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateBoardFormValues>({
    resolver: zodResolver(createBoardSchema),
    defaultValues: {
      name: '',
      description: '',
      color: BOARD_COLORS[0],
      icon: 'kanban',
      defaultView: 'KANBAN',
    },
  });

  const selectedColor = watch('color');
  const selectedIcon = watch('icon');
  const selectedView = watch('defaultView');

  const closeAndReset = () => {
    setServerError(null);
    reset();
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (createBoardMutation.isPending) {
        return;
      }
      closeAndReset();
      return;
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = async (values: CreateBoardFormValues) => {
    setServerError(null);
    try {
      const created = await createBoardMutation.mutateAsync({
        name: values.name,
        description: values.description || null,
        color: values.color,
        icon: values.icon,
        defaultView: values.defaultView,
      });
      toast.success('Quadro criado com sucesso!');
      closeAndReset();
      navigate(`/app/boards/${created.board.id}`);
    } catch (err) {
      const problem = getApiError(err);
      const message = problem.detail ?? 'Não foi possível criar o quadro.';
      setServerError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo quadro</DialogTitle>
          <DialogDescription>
            Configure o nome, identidade visual e visualização padrão do quadro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {serverError}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="board-name">Nome do quadro</Label>
            <Input
              id="board-name"
              placeholder="Ex.: Roadmap do Produto"
              autoFocus
              disabled={createBoardMutation.isPending}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'board-name-error' : undefined}
              {...register('name')}
            />
            {errors.name ? (
              <p id="board-name-error" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="board-description">Descrição (opcional)</Label>
            <Textarea
              id="board-description"
              placeholder="Descreva o objetivo deste quadro..."
              rows={2}
              disabled={createBoardMutation.isPending}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'board-description-error' : undefined
              }
              {...register('description')}
            />
            {errors.description ? (
              <p id="board-description-error" className="text-xs text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLORS.map((color) => {
                const active = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Cor ${color}`}
                    aria-pressed={active}
                    onClick={() => setValue('color', color)}
                    style={{ backgroundColor: color }}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      active
                        ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card'
                        : 'hover:scale-105',
                    )}
                  >
                    {active ? (
                      <Check className="h-4 w-4 text-white" aria-hidden="true" />
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
                const active = selectedIcon === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={active}
                    onClick={() => setValue('icon', option.value)}
                    className={cn(
                      'flex items-center justify-center rounded-lg border py-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
            <Label>Visualização inicial</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={selectedView === 'KANBAN'}
                onClick={() => setValue('defaultView', 'KANBAN')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                  selectedView === 'KANBAN'
                    ? 'border-brand-navy bg-brand-navy text-white dark:border-brand-coral dark:bg-brand-coral'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Kanban className="h-4 w-4" aria-hidden="true" />
                Kanban
              </button>
              <button
                type="button"
                aria-pressed={selectedView === 'LIST'}
                onClick={() => setValue('defaultView', 'LIST')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                  selectedView === 'LIST'
                    ? 'border-brand-navy bg-brand-navy text-white dark:border-brand-coral dark:bg-brand-coral'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <List className="h-4 w-4" aria-hidden="true" />
                Lista
              </button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createBoardMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="coral"
              disabled={createBoardMutation.isPending}
            >
              {createBoardMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Criando...
                </>
              ) : (
                'Criar quadro'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
