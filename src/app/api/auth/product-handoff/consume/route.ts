import { NextResponse } from 'next/server';

import {
  consumeProductHandoff,
  createSessionForUser,
  MKETY_SESSION_COOKIE,
  MKETY_SESSION_MAX_AGE_SECONDS,
} from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expectedHost = (process.env.MKETY_MAIL_HOST || 'mail.mkety.com').trim().toLowerCase();
  if (url.hostname.toLowerCase() !== expectedHost) {
    return NextResponse.json({ ok: false, error: 'invalid_handoff_host' }, { status: 400 });
  }

  const token = url.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/login?returnTo=%2Fmail%2Fapp', url.origin));

  const handoff = await consumeProductHandoff(token, 'mail');
  if (!handoff) return NextResponse.redirect(new URL('/login?returnTo=%2Fmail%2Fapp&error=handoff', url.origin));

  const session = await createSessionForUser(handoff.userId);
  const response = NextResponse.redirect(new URL(handoff.returnTo, url.origin));
  response.cookies.set({
    name: MKETY_SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MKETY_SESSION_MAX_AGE_SECONDS,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
