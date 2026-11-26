const PENDING_INVITE_STORAGE_KEY = 'todollab_pending_invite_token';

interface PendingInviteRecord {
  token: string;
  autoAccept: boolean;
}

function readPendingInviteRecord(): PendingInviteRecord | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === 'object') {
        if (
          parsed !== null &&
          'token' in parsed &&
          typeof parsed.token === 'string'
        ) {
          const normalized = parsed.token.trim();
          if (!normalized) {
            return null;
          }
          const autoAccept =
            'autoAccept' in parsed && parsed.autoAccept === true;
          return { token: normalized, autoAccept };
        }
        return null;
      }
      return { token: trimmed, autoAccept: false };
    } catch {
      return { token: trimmed, autoAccept: false };
    }
  } catch {
    return null;
  }
}

export function getPendingInviteToken(): string | null {
  return readPendingInviteRecord()?.token ?? null;
}

export function shouldAutoAcceptPendingInvite(token: string): boolean {
  const normalized = token.trim();
  if (!normalized) {
    return false;
  }
  const record = readPendingInviteRecord();
  return Boolean(record && record.token === normalized && record.autoAccept);
}

export function setPendingInviteToken(
  token: string,
  options?: { autoAccept?: boolean },
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = token.trim();
  try {
    if (!normalized) {
      window.sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      return;
    }
    const record: PendingInviteRecord = {
      token: normalized,
      autoAccept: options?.autoAccept ?? false,
    };
    window.sessionStorage.setItem(
      PENDING_INVITE_STORAGE_KEY,
      JSON.stringify(record),
    );
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
