'use client';

import type { Session } from '@/shared/lib/auth';

interface AuthProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

/**
 * Mkety client identity provider boundary.
 *
 * ZITADEL is the intended identity provider but is not wired yet. No client
 * session is manufactured during this migration, so this wrapper is
 * intentionally transparent until the real provider is connected.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <>{children}</>;
}
