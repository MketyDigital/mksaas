'use client';

import { useCallback, useContext } from 'react';

import { AuthContext } from '@/shared/components/providers/auth-provider';
import type { MketySessionUser } from '@/shared/lib/auth';

export interface UseAuthReturn {
  user: MketySessionUser | null;
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
    window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(callbackUrl)}`);
  }, []);

  const logout = useCallback(async (callbackUrl = '/login') => {
    window.location.assign(`/api/auth/logout?returnTo=${encodeURIComponent(callbackUrl)}`);
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
