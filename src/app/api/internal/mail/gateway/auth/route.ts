import { NextResponse } from 'next/server';

import {
  authenticateExternalMailClient,
  requireMailGatewaySecret,
} from '@/features/mail/server/gateway-auth';

export async function POST(request: Request) {
  if (!requireMailGatewaySecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as {
    username?: string;
    password?: string;
  } | null;
  if (!body?.username || !body.password) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }
  const session = await authenticateExternalMailClient(body.username, body.password);
  if (!session) return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  return NextResponse.json({ ok: true, ...session }, {
    headers: { 'cache-control': 'no-store' },
  });
}
