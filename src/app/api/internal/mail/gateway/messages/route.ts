import { and, asc, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireMailGatewaySecret } from '@/features/mail/server/gateway-auth';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { mailMailboxes, mailMessages } from '@/shared/db/schema';

function toGatewayIso(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

function gatewayErrorMarker(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '').replace(/[^A-Za-z0-9_.-]/g, '');
    if (code) return code.slice(0, 80);
  }
  if (error instanceof Error) {
    return error.name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80) || 'Error';
  }
  return 'unknown';
}

async function handlePost(request: Request) {
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

  try {
    const [mailbox] = await db
      .select({ id: mailMailboxes.id })
      .from(mailMailboxes)
      .where(and(
        eq(mailMailboxes.id, mailboxId),
        eq(mailMailboxes.tenantId, tenantId),
        eq(mailMailboxes.status, 'active'),
      ))
      .limit(1);
    if (!mailbox) return NextResponse.json({ ok: false }, { status: 404 });

    const rows = await db
      .select({
        id: mailMessages.id,
        uid: mailMessages.imapUid,
        from: mailMessages.fromAddress,
        to: mailMessages.toJson,
        cc: mailMessages.ccJson,
        subject: mailMessages.subject,
        preview: mailMessages.preview,
        isRead: mailMessages.isRead,
        isStarred: mailMessages.isStarred,
        receivedAt: mailMessages.receivedAt,
        sentAt: mailMessages.sentAt,
        createdAt: mailMessages.createdAt,
      })
      .from(mailMessages)
      .where(and(
        eq(mailMessages.tenantId, tenantId),
        eq(mailMessages.mailboxId, mailboxId),
        eq(mailMessages.folder, folder),
        gt(mailMessages.imapUid, afterUid),
      ))
      .orderBy(asc(mailMessages.imapUid))
      .limit(limit);

    return NextResponse.json({
      ok: true,
      folder,
      messages: rows.map((message) => ({
        id: message.id,
        uid: message.uid,
        from: message.from,
        to: message.to,
        cc: message.cc,
        subject: message.subject || '',
        preview: message.preview || '',
        isRead: message.isRead,
        isStarred: message.isStarred,
        size: 0,
        internalDate: toGatewayIso(message.receivedAt || message.sentAt || message.createdAt),
      })),
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const detail = gatewayErrorMarker(error);
    console.error(`MKETY_MAIL_GATEWAY_MESSAGES_ERROR=${detail}`);
    return NextResponse.json(
      { ok: false, error: 'message_index_failed', detail },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  if (!requireMailGatewaySecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return withRequestDatabase(() => handlePost(request));
}
