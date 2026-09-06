import type { TenantRole } from '@/shared/db/schema/auth';

/**
 * Mkety-owned identity/session contract.
 *
 * AGENTS.md defines ZITADEL as the intended identity foundation. The ZITADEL
 * integration is not live yet, so this boundary intentionally fails closed:
 * no request is treated as authenticated unless a future verified identity
 * adapter explicitly returns a session.
 */
export interface Session {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    roles: Record<string, TenantRole>;
    permissions?: Record<string, string[]>;
  };
  expires?: string;
}

export async function auth(): Promise<Session | null> {
  return null;
}

export async function signIn(): Promise<never> {
  throw new Error('Mkety identity is not configured yet.');
}

export async function signOut(): Promise<never> {
  throw new Error('Mkety identity is not configured yet.');
}
