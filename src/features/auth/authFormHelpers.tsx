import { useState, type ComponentProps } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function AuthErrorAlert({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:text-foreground cursor-pointer"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function applyServerFieldErrors<T extends FieldValues>(
  fieldErrors: Record<string, string> | undefined,
  setError: UseFormSetError<T>,
  validFields: readonly Path<T>[],
): void {
  if (!fieldErrors) {
    return;
  }

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (validFields.includes(field as Path<T>)) {
      setError(field as Path<T>, { type: 'server', message });
    }
  }
}
