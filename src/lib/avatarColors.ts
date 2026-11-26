export const AVATAR_COLORS = [
  '#0C2439',
  '#FF4B4B',
  '#1D4ED8',
  '#0F766E',
  '#7C3AED',
  '#B45309',
  '#BE185D',
  '#15803D',
] as const;

export const BOARD_COLORS = [
  '#0C2439',
  '#FF4B4B',
  '#2563EB',
  '#0D9488',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#16A34A',
] as const;

export const TAG_COLORS = [
  '#0C2439',
  '#FF4B4B',
  '#2563EB',
  '#0D9488',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#16A34A',
] as const;

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
}
