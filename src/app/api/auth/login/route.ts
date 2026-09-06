import { NextResponse } from 'next/server';

import { beginLogin } from '@/shared/lib/auth/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') ?? '/select-tenant';
  const authorizationUrl = await beginLogin(returnTo);
  return NextResponse.redirect(authorizationUrl);
}
