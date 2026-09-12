'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import type { MketySession } from '@/shared/lib/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

interface AuthContextValue {
  session: MketySession | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<MketySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) {
        setSession(null);
        return;
      }
      setSession((await response.json()) as MketySession | null);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ session, isLoading, refresh }), [session, isLoading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
