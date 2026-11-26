import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        coral:
          'border-transparent bg-brand-coral/15 text-brand-coral dark:bg-brand-coral/20',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        success:
          'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        warning:
          'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
