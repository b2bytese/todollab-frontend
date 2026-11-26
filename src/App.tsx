import { lazy, Suspense, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLogo } from '@/components/common/AppLogo';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ThemeProvider, useTheme } from '@/components/common/ThemeProvider';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
import { SignupPage } from '@/features/auth/SignupPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { InviteAcceptPage } from '@/features/invites/InviteAcceptPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';

const AppShell = lazy(() =>
  import('@/features/shell/AppShell').then((m) => ({ default: m.AppShell })),
);
const MyTasksPage = lazy(() =>
  import('@/features/dashboard/MyTasksPage').then((m) => ({
    default: m.MyTasksPage,
  })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
);
const BoardPage = lazy(() =>
  import('@/features/boards/BoardPage').then((m) => ({ default: m.BoardPage })),
);

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-surface text-foreground flex flex-col items-center justify-center gap-4 p-6"
    >
      <AppLogo />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2
          className="h-4 w-4 animate-spin text-brand-coral"
          aria-hidden="true"
        />
        <span>Carregando...</span>
      </div>
    </div>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      richColors
      position="top-right"
      closeButton
      containerAriaLabel="Notificações"
      toastOptions={{ closeButtonAriaLabel: 'Fechar notificação' }}
    />
  );
}

function AuthBootstrap() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthBootstrap />
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />

                <Route element={<GuestOnly />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>

                <Route path="/invite/:token" element={<InviteAcceptPage />} />

                <Route element={<RequireAuth />}>
                  <Route path="/app" element={<AppShell />}>
                    <Route index element={<Navigate to="/app/my-tasks" replace />} />
                    <Route path="my-tasks" element={<MyTasksPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="boards/:boardId" element={<BoardPage />} />
                    <Route
                      path="*"
                      element={<Navigate to="/app/my-tasks" replace />}
                    />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <ThemedToaster />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
