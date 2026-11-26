import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from '@/components/common/ThemeProvider';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
import { SignupPage } from '@/features/auth/SignupPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { BoardPage } from '@/features/boards/BoardPage';
import { MyTasksPage } from '@/features/dashboard/MyTasksPage';
import { InviteAcceptPage } from '@/features/invites/InviteAcceptPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AppShell } from '@/features/shell/AppShell';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthBootstrap />
        <BrowserRouter>
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
          <ThemedToaster />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
