import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { AppLogo } from '@/components/common/AppLogo';
import { getPendingInviteToken } from '@/lib/pendingInvite';
import { useAuthStore } from '@/stores/authStore';

function AuthLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-surface text-foreground flex flex-col items-center justify-center gap-4 p-6"
    >
      <AppLogo />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-brand-coral" aria-hidden="true" />
        <span>Carregando sua sessão...</span>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children?: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function GuestOnly({ children }: { children?: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const [searchParams] = useSearchParams();
  const hasInviteToken = Boolean(
    searchParams.get('inviteToken') || getPendingInviteToken(),
  );

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'authenticated' && !hasInviteToken) {
    return <Navigate to="/app/my-tasks" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
