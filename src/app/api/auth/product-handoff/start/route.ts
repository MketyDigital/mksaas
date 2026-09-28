import { NextResponse } from 'next/server';

import { auth } from '@/shared/lib/auth';
import {
  createProductHandoff,
  type MketyProductHandoff,
} from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

function productConfig(product: MketyProductHandoff) {
  if (product === 'ai') {
    const host = (process.env.MKETY_AI_HOST || 'ai.mkety.com').trim().toLowerCase();
    return { origin: `https://${host}`, returnTo: '/ai/app' };
  }
  const host = (process.env.MKETY_MAIL_HOST || 'mail.mkety.com').trim().toLowerCase();
  return { origin: `https://${host}`, returnTo: '/mail/app' };
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

  const config = productConfig(product);
  const session = await auth(request);
  if (!session?.user?.id) {
    const retry = new URL('/api/auth/product-handoff/start', url.origin);
    retry.searchParams.set('product', product);
    retry.searchParams.set('returnTo', config.returnTo);
    const login = new URL('/login', url.origin);
    login.searchParams.set('returnTo', retry.pathname + retry.search);
    return NextResponse.redirect(login);
  }

  const token = await createProductHandoff(session.user.id, product, config.returnTo);
  const target = new URL('/api/auth/product-handoff/consume', config.origin);
  target.searchParams.set('token', token);
  target.searchParams.set('product', product);
  return NextResponse.redirect(target);
}
