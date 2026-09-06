'use client';

/**
 * Mkety auth hook.
 *
 * ZITADEL is the intended identity provider, but it is not wired yet. The
 * client boundary therefore reports unauthenticated and refuses sign-in rather
 * than manufacturing a local session.
 */

import { signIn, signOut, useSession } from '@/shared/lib/auth-client';
import { useCallback } from 'react';

export interface UseAuthReturn {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider?: string, callbackUrl?: string) => Promise<void>;
  logout: (callbackUrl?: string) => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const { data: session, status } = useSession();

  const login = useCallback(async (provider?: string, callbackUrl = '/login') => {
    await signIn(provider, { callbackUrl });
  }, []);

  const logout = useCallback(async (callbackUrl = '/login') => {
    await signOut({ callbackUrl });
  }, []);

  return {
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    login,
    logout,
  };
};
