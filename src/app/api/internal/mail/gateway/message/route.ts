import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { fetchMailContent, fetchMailText } from '@/features/mail/server/content';
import { requireMailGatewaySecret } from '@/features/mail/server/gateway-auth';
import { db } from '@/shared/db/cloudflare';
import { mailMessages } from '@/shared/db/schema';

function header(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export async function POST(request: Request) {
  if (!requireMailGatewaySecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as {
    tenantId?: string;
    mailboxId?: string;
    uid?: number;
  } | null;
  const tenantId = String(body?.tenantId || '');
  const mailboxId = String(body?.mailboxId || '');
  const uid = Number(body?.uid || 0);
  if (!tenantId || !mailboxId || !Number.isFinite(uid) || uid <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const message = await db.query.mailMessages.findFirst({
    where: and(
      eq(mailMessages.tenantId, tenantId),
      eq(mailMessages.mailboxId, mailboxId),
      eq(mailMessages.imapUid, uid),
    ),
  });
  if (!message) return NextResponse.json({ ok: false }, { status: 404 });

  if (message.rawR2Key) {
    const raw = await fetchMailContent(message.rawR2Key);
    if (raw?.bytes?.byteLength) {
      return new Response(raw.bytes, {
        headers: {
          'content-type': 'message/rfc822',
          'content-length': String(raw.bytes.byteLength),
          'cache-control': 'private, no-store',
          'x-mkety-imap-uid': String(message.imapUid),
        },
      });
    }
  }

  const text = await fetchMailText(message.textR2Key) || message.preview || '';
  const date = (message.receivedAt || message.sentAt || message.createdAt).toUTCString();
  const raw = [
    `From: ${header(message.fromAddress)}`,
    `To: ${message.toJson.map(header).join(', ')}`,
    ...(message.ccJson.length ? [`Cc: ${message.ccJson.map(header).join(', ')}`] : []),
    `Subject: ${header(message.subject || '')}`,
    `Date: ${date}`,
    ...(message.internetMessageId ? [`Message-ID: ${header(message.internetMessageId)}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
  ].join('\r\n');
  const bytes = new TextEncoder().encode(raw);
  return new Response(bytes, {
    headers: {
      'content-type': 'message/rfc822',
      'content-length': String(bytes.byteLength),
      'cache-control': 'private, no-store',
      'x-mkety-imap-uid': String(message.imapUid),
    },
  });
}
