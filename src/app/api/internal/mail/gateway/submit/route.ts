import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import PostalMime from 'postal-mime';

import { pushMailQueueBatch } from '@/features/mail/server/cloudflare';
import { requireMailGatewaySecret } from '@/features/mail/server/gateway-auth';
import { getMailSendCapacity } from '@/features/mail/server/sending-policy';
import { db } from '@/shared/db/cloudflare';
import {
  mailDomains,
  mailMailboxes,
  mailMessages,
  mailSuppressions,
} from '@/shared/db/schema';

function normalizeEmail(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

export async function POST(request: Request) {
  if (!requireMailGatewaySecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as {
    tenantId?: string;
    mailboxId?: string;
    from?: string;
    recipients?: string[];
    rawBase64?: string;
  } | null;

  const tenantId = String(body?.tenantId || '');
  const mailboxId = String(body?.mailboxId || '');
  const from = normalizeEmail(body?.from);
  const recipients = [...new Set((body?.recipients || []).map(normalizeEmail).filter(Boolean))].slice(0, 50);
  if (!tenantId || !mailboxId || !from || !recipients.length || !body?.rawBase64) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  let raw: Uint8Array;
  try {
    raw = Uint8Array.from(atob(body.rawBase64), (char) => char.charCodeAt(0));
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_message' }, { status: 400 });
  }
  if (!raw.byteLength || raw.byteLength > 25_000_000) {
    return NextResponse.json({ ok: false, error: 'message_too_large' }, { status: 413 });
  }

  const mailbox = await db.query.mailMailboxes.findFirst({
    where: and(
      eq(mailMailboxes.id, mailboxId),
      eq(mailMailboxes.tenantId, tenantId),
      eq(mailMailboxes.status, 'active'),
    ),
  });
  if (!mailbox) return NextResponse.json({ ok: false, error: 'mailbox_not_found' }, { status: 404 });

  const domain = await db.query.mailDomains.findFirst({
    where: and(
      eq(mailDomains.id, mailbox.domainId),
      eq(mailDomains.tenantId, tenantId),
    ),
  });
  if (!domain?.sendingEnabled) {
    return NextResponse.json({ ok: false, error: 'sender_not_ready' }, { status: 409 });
  }
  const expectedFrom = `${mailbox.localPart}@${domain.domain}`.toLowerCase();
  if (from !== expectedFrom) {
    return NextResponse.json({ ok: false, error: 'sender_not_allowed' }, { status: 403 });
  }

  const capacity = await getMailSendCapacity(tenantId, domain.id, recipients.length);
  if (!capacity.allowed) {
    return NextResponse.json({
      ok: false,
      error: capacity.reason === 'warmup'
        ? 'sender_warmup'
        : capacity.reason === 'monthly_limit'
          ? 'monthly_limit'
          : 'daily_limit',
      remaining: capacity.remaining,
      period: capacity.period,
    }, { status: 429 });
  }

  const suppressions = await db.query.mailSuppressions.findMany({
    where: and(
      eq(mailSuppressions.tenantId, tenantId),
      inArray(mailSuppressions.email, recipients),
    ),
  });
  const blocked = new Set(
    suppressions
      .filter((item) => !item.expiresAt || item.expiresAt.getTime() > Date.now())
      .map((item) => item.email),
  );
  if (blocked.size) {
    return NextResponse.json({ ok: false, error: 'recipient_suppressed' }, { status: 409 });
  }

  let parsed;
  try {
    parsed = await PostalMime.parse(raw, {
      attachmentEncoding: 'arraybuffer',
      maxNestingDepth: 64,
      maxHeadersSize: 1_000_000,
      maxRfc822NestingDepth: 5,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_message' }, { status: 400 });
  }

  const subject = String(parsed.subject || '').trim().slice(0, 500) || '(no subject)';
  const text = typeof parsed.text === 'string' ? parsed.text.slice(0, 200_000) : '';
  const html = typeof parsed.html === 'string' ? parsed.html.slice(0, 500_000) : '';
  if (!text && !html) {
    return NextResponse.json({ ok: false, error: 'empty_message' }, { status: 400 });
  }

  const created: Array<{ id: string; recipient: string }> = [];
  for (const recipient of recipients) {
    const [message] = await db.insert(mailMessages).values({
      tenantId,
      mailboxId,
      direction: 'outbound',
      fromAddress: expectedFrom,
      toJson: [recipient],
      subject,
      preview: (text || html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 240),
      status: 'sending',
      folder: 'sent',
    }).returning({ id: mailMessages.id });
    if (!message) return NextResponse.json({ ok: false, error: 'message_create_failed' }, { status: 500 });
    created.push({ id: message.id, recipient });
  }

  try {
    await pushMailQueueBatch(created.map((message) => ({
      kind: 'transactional' as const,
      tenantId,
      messageId: message.id,
      mailboxId,
      from: { email: expectedFrom, name: mailbox.displayName || undefined },
      to: { email: message.recipient },
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    })));
    await db.update(mailMessages)
      .set({ status: 'queued' })
      .where(inArray(mailMessages.id, created.map((item) => item.id)));
    return NextResponse.json({ ok: true, queued: created.length }, { status: 202 });
  } catch {
    await db.update(mailMessages)
      .set({ status: 'failed' })
      .where(inArray(mailMessages.id, created.map((item) => item.id)));
    return NextResponse.json({ ok: false, error: 'queue_failed' }, { status: 502 });
  }
}
