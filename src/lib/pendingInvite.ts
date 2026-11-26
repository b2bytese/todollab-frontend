const PENDING_INVITE_STORAGE_KEY = 'todollab_pending_invite_token';

export function getPendingInviteToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const token = window.sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    return token && token.trim().length > 0 ? token.trim() : null;
  } catch {
    return null;
  }
}

export function setPendingInviteToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = token.trim();
  try {
    if (!normalized) {
      window.sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage write failures (e.g. private browsing restrictions)
  }
}

export function clearPendingInviteToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // Ignore storage removal failures
  }
}
