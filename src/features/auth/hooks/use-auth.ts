'use client';

import { useCallback, useContext } from 'react';

import { AuthContext } from '@/shared/components/providers/auth-provider';

export interface UseAuthReturn {
  user: NonNullable<Awaited<ReturnType<typeof import('@/shared/lib/auth').auth>>>['user'] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (callbackUrl?: string) => Promise<void>;
  logout: (callbackUrl?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');

  const login = useCallback(async (callbackUrl = '/select-tenant') => {
    const target = `/api/auth/login?returnTo=${encodeURIComponent(callbackUrl)}`;
    window.location.assign(target);
  }, []);

  const logout = useCallback(async (callbackUrl = '/login') => {
    const target = `/api/auth/logout?returnTo=${encodeURIComponent(callbackUrl)}`;
    window.location.assign(target);
  }, []);

  return {
    user: context.session?.user ?? null,
    isLoading: context.isLoading,
    isAuthenticated: !!context.session,
    login,
    logout,
    refresh: context.refresh,
  };
};
