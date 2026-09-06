import { NextResponse } from 'next/server';

import { getSessionToken } from '@/shared/lib/auth';
import { logoutSession, MKETY_SESSION_COOKIE } from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

async function handleLogout(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') ?? '/login';
  const token = await getSessionToken(request);
  const destination = await logoutSession(token, returnTo);
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.cookies.set({
    name: MKETY_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request) {
  return handleLogout(request);
}

export async function POST(request: Request) {
  return handleLogout(request);
}
