import { cn } from '@/lib/utils';

export interface AppLogoProps {
  compact?: boolean;
  showText?: boolean;
  className?: string;
}

export function AppLogo({
  compact = false,
  showText,
  className,
}: AppLogoProps) {
  const shouldShowText = showText ?? !compact;

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <img
        src="/logo.png"
        alt="Todollab"
        className={cn(
          'rounded-lg object-cover shrink-0 dark:hidden',
          compact ? 'h-8 w-8' : 'h-9 w-9',
        )}
      />
      <img
        src="/logo-dark.png"
        alt=""
        aria-hidden="true"
        className={cn(
          'rounded-lg object-cover shrink-0 hidden dark:block',
          compact ? 'h-8 w-8' : 'h-9 w-9',
        )}
      />
      {shouldShowText ? (
        <span className="font-heading text-lg font-bold tracking-tight text-foreground">
          Todollab
        </span>
      ) : null}
    </div>
  );
}
