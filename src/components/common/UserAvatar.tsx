import { getInitials } from '@/lib/avatarColors';
import { cn } from '@/lib/utils';

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

export interface UserAvatarProps {
  name: string;
  avatarColor?: string;
  size?: UserAvatarSize;
  className?: string;
}

export function UserAvatar({
  name,
  avatarColor = '#0C2439',
  size = 'md',
  className,
}: UserAvatarProps) {
  return (
    <span
      role="img"
      title={name}
      aria-label={name}
      style={{ backgroundColor: avatarColor || '#0C2439' }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/10 dark:ring-white/15 select-none',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
