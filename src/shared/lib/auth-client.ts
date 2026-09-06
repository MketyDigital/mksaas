'use client';

import { useCallback } from 'react';

import type { Session } from './auth';

export type MketyClientSessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface MketySignInOptions {
  callbackUrl?: string;
  redirect?: boolean;
  [key: string]: unknown;
}

export interface MketySignInResult {
  error: string | null;
  url: string | null;
}

/**
 * Client identity boundary for Mkety.
 *
 * ZITADEL is the intended identity provider, but it is not wired yet. Until it is,
 * this boundary deliberately reports an unauthenticated state and refuses sign-in
 * rather than fabricating a local session.
 */
export function useSession(): { data: Session | null; status: MketyClientSessionStatus } {
  return { data: null, status: 'unauthenticated' };
}

export async function signIn(
  _provider?: string,
  options: MketySignInOptions = {},
): Promise<MketySignInResult> {
  const callbackUrl = typeof options.callbackUrl === 'string' ? options.callbackUrl : '/login';

  if (options.redirect !== false && typeof window !== 'undefined') {
    window.location.assign('/login');
  }

  return {
    error: 'Mkety identity is not configured yet.',
    url: options.redirect === false ? null : callbackUrl,
  };
}

export async function signOut(options: { callbackUrl?: string } = {}): Promise<void> {
  const callbackUrl = options.callbackUrl ?? '/login';
  if (typeof window !== 'undefined') {
    window.location.assign(callbackUrl);
  }
}

export function useMketyAuthClient() {
  const { data, status } = useSession();
  const login = useCallback((provider?: string, callbackUrl?: string) => signIn(provider, { callbackUrl }), []);
  const logout = useCallback((callbackUrl?: string) => signOut({ callbackUrl }), []);

  return {
    session: data,
    status,
    login,
    logout,
  };
}
