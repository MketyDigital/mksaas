import { NextResponse } from 'next/server';

import { resolveEnterpriseAiHostname } from '@/features/ai-runtime/server/enterprise-hostnames';
import { auth } from '@/shared/lib/auth';
import {
  createProductHandoff,
  type MketyProductHandoff,
} from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

function canonicalProductHost(product: MketyProductHandoff) {
  return product === 'ai'
    ? (process.env.MKETY_AI_HOST || 'ai.mkety.com').trim().toLowerCase()
    : (process.env.MKETY_MAIL_HOST || 'mail.mkety.com').trim().toLowerCase();
}

function productReturnTo(product: MketyProductHandoff) {
  return product === 'ai' ? '/ai/app' : '/mail/app';
}

function parseProduct(value: string | null): MketyProductHandoff | null {
  return value === 'mail' || value === 'ai' ? value : null;
}

async function resolveTargetHost(product: MketyProductHandoff, requested: string | null) {
  const canonical = canonicalProductHost(product);
  if (!requested) return canonical;

  const normalized = requested.trim().toLowerCase();
  if (normalized === canonical) return canonical;
  if (product !== 'ai') return null;

  return (await resolveEnterpriseAiHostname(normalized)) ? normalized : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const product = parseProduct(url.searchParams.get('product'));
  if (!product) {
    return NextResponse.json({ ok: false, error: 'unsupported_product' }, { status: 400 });
  }

  const targetHost = await resolveTargetHost(product, url.searchParams.get('targetHost'));
  if (!targetHost) {
    return NextResponse.json({ ok: false, error: 'invalid_target_host' }, { status: 400 });
  }

  const session = await auth(request);
  if (!session?.user?.id) {
    const retry = new URL('/api/auth/product-handoff/start', url.origin);
    retry.searchParams.set('product', product);
    retry.searchParams.set('returnTo', productReturnTo(product));
    retry.searchParams.set('targetHost', targetHost);
    const login = new URL('/login', url.origin);
    login.searchParams.set('returnTo', retry.pathname + retry.search);
    return NextResponse.redirect(login);
  }

  if (product === 'ai' && targetHost !== canonicalProductHost('ai')) {
    const resolved = await resolveEnterpriseAiHostname(targetHost);
    const roles = session.user.roles as Record<string, string> | undefined;
    if (!resolved || !roles?.[resolved.tenant.slug]) {
      return NextResponse.json({ ok: false, error: 'tenant_access_required' }, { status: 403 });
    }
  }

  const returnTo = productReturnTo(product);
  const token = await createProductHandoff(session.user.id, product, returnTo, targetHost);
  const target = new URL('/api/auth/product-handoff/consume', `https://${targetHost}`);
  target.searchParams.set('token', token);
  target.searchParams.set('product', product);
  return NextResponse.redirect(target);
}
