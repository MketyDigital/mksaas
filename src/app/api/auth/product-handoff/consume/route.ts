import { NextResponse } from 'next/server';

import {
  consumeProductHandoff,
  createSessionForUser,
  type MketyProductHandoff,
  MKETY_SESSION_COOKIE,
  MKETY_SESSION_MAX_AGE_SECONDS,
} from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

function expectedHost(product: MketyProductHandoff) {
  return product === 'ai'
    ? (process.env.MKETY_AI_HOST || 'ai.mkety.com').trim().toLowerCase()
    : (process.env.MKETY_MAIL_HOST || 'mail.mkety.com').trim().toLowerCase();
}

function returnTo(product: MketyProductHandoff) {
  return product === 'ai' ? '/ai/app' : '/mail/app';
}

function parseProduct(value: string | null): MketyProductHandoff | null {
  return value === 'mail' || value === 'ai' ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const product = parseProduct(url.searchParams.get('product'));
  if (!product) {
    return NextResponse.json({ ok: false, error: 'unsupported_product' }, { status: 400 });
  }

  if (url.hostname.toLowerCase() !== expectedHost(product)) {
    return NextResponse.json({ ok: false, error: 'invalid_handoff_host' }, { status: 400 });
  }

  const fallback = returnTo(product);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(fallback)}`, url.origin));
  }

  const handoff = await consumeProductHandoff(token, product);
  if (!handoff) {
    return NextResponse.redirect(
      new URL(`/login?returnTo=${encodeURIComponent(fallback)}&error=handoff`, url.origin),
    );
  }

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
