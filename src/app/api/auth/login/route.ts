import { NextResponse } from 'next/server';

import { beginLogin } from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

const MKETY_AUTH_ORIGIN = 'https://auth.mkety.com';

async function resolveBrandedLoginUrl(authorizationUrl: string): Promise<string> {
  const response = await fetch(authorizationUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: { accept: 'text/html' },
  });

  if (response.status < 300 || response.status >= 400) {
    throw new Error('Identity provider did not redirect to the hosted login');
  }

  const location = response.headers.get('location');
  if (!location) throw new Error('Identity provider login redirect is missing');

  const resolved = new URL(location, authorizationUrl);
  if (resolved.origin !== MKETY_AUTH_ORIGIN || !resolved.pathname.startsWith('/ui/v2/login/')) {
    throw new Error('Identity provider login redirect is outside the Mkety auth origin');
  }

  return resolved.toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') ?? '/select-tenant';
  const intent = url.searchParams.get('intent') === 'signup' ? 'signup' : 'signin';
  const authorizationUrl = await beginLogin(returnTo, intent);
  const brandedLoginUrl = await resolveBrandedLoginUrl(authorizationUrl);
  return NextResponse.redirect(brandedLoginUrl);
}
