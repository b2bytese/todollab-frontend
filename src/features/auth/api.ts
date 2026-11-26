import { api } from '@/lib/api';
import type { AuthResponse, RegisterResponse } from '@/types/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  inviteToken?: string | null;
}

export interface VerifyEmailPayload {
  email: string;
  code: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/v1/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('/api/v1/auth/register', payload);
  return data;
}

export async function verifyEmail(payload: VerifyEmailPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/v1/auth/verify-email', payload);
  return data;
}

export async function resendVerification(
  payload: ResendVerificationPayload,
): Promise<void> {
  await api.post('/api/v1/auth/resend-verification', payload);
}

export async function logout(): Promise<void> {
  await api.post('/api/v1/auth/logout');
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
  await api.post('/api/v1/auth/forgot-password', payload);
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await api.post('/api/v1/auth/reset-password', payload);
}
