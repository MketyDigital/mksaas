import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireMailGatewaySecret } from '@/features/mail/server/gateway-auth';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { mailMessages } from '@/shared/db/schema';

async function handlePost(request: Request) {
  const body = await request.json().catch(() => null) as {
    tenantId?: string;
    mailboxId?: string;
    uid?: number;
    isRead?: boolean;
    isStarred?: boolean;
  } | null;
  const tenantId = String(body?.tenantId || '');
  const mailboxId = String(body?.mailboxId || '');
  const uid = Number(body?.uid || 0);
  if (!tenantId || !mailboxId || !Number.isFinite(uid) || uid <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const set: { isRead?: boolean; isStarred?: boolean } = {};
  if (typeof body?.isRead === 'boolean') set.isRead = body.isRead;
  if (typeof body?.isStarred === 'boolean') set.isStarred = body.isStarred;
  if (!Object.keys(set).length) return NextResponse.json({ ok: true });

  await db.update(mailMessages)
    .set(set)
    .where(and(
      eq(mailMessages.tenantId, tenantId),
      eq(mailMessages.mailboxId, mailboxId),
      eq(mailMessages.imapUid, uid),
    ));
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!requireMailGatewaySecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return withRequestDatabase(() => handlePost(request));
}
