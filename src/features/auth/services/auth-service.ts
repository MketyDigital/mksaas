/**
 * Mkety Auth server-side helpers.
 *
 * The application imports the provider-neutral Mkety Auth boundary only.
 */

import { auth } from '@/shared/lib/auth';

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}
