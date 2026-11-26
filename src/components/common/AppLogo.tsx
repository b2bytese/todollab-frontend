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
        src="/logo.jpeg"
        alt="Todollab"
        className={cn(
          'rounded-lg object-cover ring-1 ring-border/80 shadow-xs shrink-0',
          compact ? 'h-8 w-8' : 'h-9 w-9',
        )}
      />
      {shouldShowText ? (
        <span className="font-heading text-lg font-bold tracking-tight text-foreground">
          Todo<span className="text-brand-coral">llab</span>
        </span>
      ) : null}
    </div>
  );
}
