import { NextResponse } from 'next/server';

import { auth } from '@/shared/lib/auth';
import { createProductHandoff } from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

function mailOrigin() {
  const host = (process.env.MKETY_MAIL_HOST || 'mail.mkety.com').trim().toLowerCase();
  return `https://${host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await auth(request);
  if (!session?.user?.id) {
    const retry = new URL('/api/auth/product-handoff/start', url.origin);
    retry.searchParams.set('product', 'mail');
    retry.searchParams.set('returnTo', '/mail/app');
    const login = new URL('/login', url.origin);
    login.searchParams.set('returnTo', retry.pathname + retry.search);
    return NextResponse.redirect(login);
  }

  if (url.searchParams.get('product') !== 'mail') {
    return NextResponse.json({ ok: false, error: 'unsupported_product' }, { status: 400 });
  }

  const token = await createProductHandoff(session.user.id, 'mail', '/mail/app');
  const target = new URL('/api/auth/product-handoff/consume', mailOrigin());
  target.searchParams.set('token', token);
  return NextResponse.redirect(target);
}
