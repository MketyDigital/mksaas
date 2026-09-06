import { NextResponse } from 'next/server';

import { completeLogin, MKETY_SESSION_COOKIE, MKETY_SESSION_MAX_AGE_SECONDS } from '@/shared/lib/auth/service';
import { env } from '@/shared/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));
  }

  try {
    const result = await completeLogin(code, state);
    const response = NextResponse.redirect(new URL(result.redirectTo, url.origin));
    response.cookies.set({
      name: MKETY_SESSION_COOKIE,
      value: result.token,
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MKETY_SESSION_MAX_AGE_SECONDS,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));
  }
}
