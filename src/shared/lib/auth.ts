import { cookies } from 'next/headers';

import { withRequestDatabase } from '@/shared/db/request';

import { getSessionByToken } from './auth/repository';
import { MKETY_SESSION_COOKIE } from './auth/service';
import type { MketySession, MketySessionUser } from './auth/types';

function getCookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getSessionToken(request?: Request): Promise<string | null> {
  if (request) return getCookieValue(request.headers.get('cookie'), MKETY_SESSION_COOKIE);
  const cookieStore = await cookies();
  return cookieStore.get(MKETY_SESSION_COOKIE)?.value ?? null;
}

export async function auth(request?: Request): Promise<MketySession | null> {
  const token = await getSessionToken(request);
  if (!token) return null;

  return withRequestDatabase(async (database) => {
    const session = await getSessionByToken(token, database);
    if (!session) return null;

    const { getAllTenantPermissionsForUser } = await import('@/shared/lib/permissions');
    return {
      ...session,
      user: {
        ...session.user,
        permissions: await getAllTenantPermissionsForUser(session.user.id, database),
      },
    };
  });
}

export async function requireAuth(request?: Request): Promise<MketySession> {
  const session = await auth(request);
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export async function getCurrentUser(request?: Request): Promise<MketySessionUser | null> {
  return (await auth(request))?.user ?? null;
}

export type { MketySession, MketySessionUser } from './auth/types';
