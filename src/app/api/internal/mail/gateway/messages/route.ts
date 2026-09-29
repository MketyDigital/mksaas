import { and, asc, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireMailGatewaySecret } from '@/features/mail/server/gateway-auth';
import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailMessages } from '@/shared/db/schema';

export async function POST(request: Request) {
  if (!requireMailGatewaySecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as {
    tenantId?: string;
    mailboxId?: string;
    folder?: string;
    afterUid?: number;
    limit?: number;
  } | null;
  const tenantId = String(body?.tenantId || '');
  const mailboxId = String(body?.mailboxId || '');
  const folder = String(body?.folder || 'inbox').toLowerCase() === 'sent' ? 'sent' : 'inbox';
  const afterUid = Math.max(0, Number(body?.afterUid || 0));
  const limit = Math.max(1, Math.min(500, Number(body?.limit || 200)));
  if (!tenantId || !mailboxId) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const mailbox = await db.query.mailMailboxes.findFirst({
    where: and(
      eq(mailMailboxes.id, mailboxId),
      eq(mailMailboxes.tenantId, tenantId),
      eq(mailMailboxes.status, 'active'),
    ),
    columns: { id: true },
  });
  if (!mailbox) return NextResponse.json({ ok: false }, { status: 404 });

  const rows = await db.query.mailMessages.findMany({
    where: and(
      eq(mailMessages.tenantId, tenantId),
      eq(mailMessages.mailboxId, mailboxId),
      eq(mailMessages.folder, folder),
      gt(mailMessages.imapUid, afterUid),
    ),
    orderBy: [asc(mailMessages.imapUid)],
    limit,
  });

  return NextResponse.json({
    ok: true,
    folder,
    messages: rows.map((message) => ({
      id: message.id,
      uid: message.imapUid,
      from: message.fromAddress,
      to: message.toJson,
      cc: message.ccJson,
      subject: message.subject || '',
      preview: message.preview || '',
      isRead: message.isRead,
      isStarred: message.isStarred,
      size: 0,
      internalDate: (message.receivedAt || message.sentAt || message.createdAt).toISOString(),
    })),
  }, { headers: { 'cache-control': 'no-store' } });
}
