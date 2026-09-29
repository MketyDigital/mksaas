'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import PostalMime from 'postal-mime';

import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailMessages, mailThreads } from '@/shared/db/schema';

import { storeMailContent } from './content';
import { requireMailWorkspaceAccess } from './workspace';

function addressStrings(value: unknown): string[] {
  const result: string[] = [];
  const visit = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    if (typeof record.address === 'string' && record.address.trim()) {
      result.push(record.address.trim().toLowerCase().slice(0, 320));
    }
    if (Array.isArray(record.group)) record.group.forEach(visit);
  };
  if (Array.isArray(value)) value.forEach(visit);
  else visit(value);
  return [...new Set(result)].slice(0, 100);
}

function safeAttachmentFilename(value: unknown, index: number) {
  const raw = typeof value === 'string' ? value : `attachment-${index + 1}`;
  const normalized = raw
    .replace(/[\\/\0]/g, '_')
    .replace(/[^\p{L}\p{N}._()\- ]/gu, '_')
    .trim();
  return (normalized || `attachment-${index + 1}`).slice(0, 180);
}

function attachmentBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') return new TextEncoder().encode(value);
  return new Uint8Array();
}

function plainPreview(text: string, html: string) {
  const source = text || html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return source.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export async function importMailEmlFiles(tenantSlug: string, formData: FormData) {
  const access = await requireMailWorkspaceAccess(tenantSlug);
  if (!['admin', 'manager'].includes(String(access.membership.role))) {
    throw new Error('Mail migration requires workspace manager access.');
  }
  const mailboxId = String(formData.get('mailboxId') || '');
  const mailbox = await db.query.mailMailboxes.findFirst({
    where: and(
      eq(mailMailboxes.id, mailboxId),
      eq(mailMailboxes.tenantId, access.tenant.id),
      eq(mailMailboxes.status, 'active'),
    ),
  });
  if (!mailbox) redirect(`/t/${tenantSlug}/mail/migration?error=mailbox`);

  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length || files.length > 20) {
    redirect(`/t/${tenantSlug}/mail/migration?error=files`);
  }
  if (files.some((file) => !file.name.toLowerCase().endsWith('.eml') && file.type !== 'message/rfc822')) {
    redirect(`/t/${tenantSlug}/mail/migration?error=type`);
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > 25_000_000 || files.some((file) => file.size > 10_000_000)) {
    redirect(`/t/${tenantSlug}/mail/migration?error=size`);
  }

  let imported = 0;
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let parsed;
    try {
      parsed = await PostalMime.parse(bytes, {
        attachmentEncoding: 'arraybuffer',
        maxNestingDepth: 64,
        maxHeadersSize: 1_000_000,
      });
    } catch {
      continue;
    }

    const from = addressStrings(parsed.from)[0] ?? '';
    if (!from) continue;

    const to = addressStrings(parsed.to);
    const cc = addressStrings(parsed.cc);
    const bcc = addressStrings(parsed.bcc);
    const text = typeof parsed.text === 'string' ? parsed.text.slice(0, 2_000_000) : '';
    const html = typeof parsed.html === 'string' ? parsed.html.slice(0, 2_000_000) : '';
    const subject = String(parsed.subject ?? '').slice(0, 500);
    const occurredAtCandidate = parsed.date ? new Date(parsed.date) : new Date();
    const occurredAt = Number.isFinite(occurredAtCandidate.getTime())
      ? occurredAtCandidate
      : new Date();

    const messageId = crypto.randomUUID();
    const baseKey = `mail/${access.tenant.id}/${mailbox.id}/migration/${messageId}`;
    const rawR2Key = `${baseKey}/raw.eml`;
    await storeMailContent(rawR2Key, bytes, 'message/rfc822');

    let textR2Key: string | null = null;
    let htmlR2Key: string | null = null;
    if (text) {
      textR2Key = `${baseKey}/body.txt`;
      await storeMailContent(textR2Key, new TextEncoder().encode(text), 'text/plain; charset=utf-8');
    }
    if (html) {
      htmlR2Key = `${baseKey}/body.html`;
      await storeMailContent(htmlR2Key, new TextEncoder().encode(html), 'text/html; charset=utf-8');
    }

    const attachmentManifest: Array<{
      filename: string;
      contentType: string;
      r2Key: string;
      size: number;
    }> = [];
    for (let index = 0; index < parsed.attachments.length; index += 1) {
      const attachment = parsed.attachments[index];
      const attachmentContent = attachmentBytes(attachment.content);
      if (!attachmentContent.byteLength) continue;
      const filename = safeAttachmentFilename(attachment.filename, index);
      const r2Key = `${baseKey}/attachments/${String(index + 1).padStart(3, '0')}-${filename}`;
      const contentType = String(attachment.mimeType || 'application/octet-stream').slice(0, 255);
      await storeMailContent(r2Key, attachmentContent, contentType);
      attachmentManifest.push({
        filename,
        contentType,
        r2Key,
        size: attachmentContent.byteLength,
      });
    }
    if (attachmentManifest.length) {
      await storeMailContent(
        `${baseKey}/attachments.json`,
        new TextEncoder().encode(JSON.stringify(attachmentManifest)),
        'application/json',
      );
    }

    await db.transaction(async (tx) => {
      const [thread] = await tx.insert(mailThreads).values({
        tenantId: access.tenant.id,
        mailboxId: mailbox.id,
        subject: subject || null,
        status: 'open',
        lastMessageAt: occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }).returning({ id: mailThreads.id });
      if (!thread) throw new Error('Imported Mail thread could not be created.');

      await tx.insert(mailMessages).values({
        id: messageId,
        tenantId: access.tenant.id,
        mailboxId: mailbox.id,
        threadId: thread.id,
        direction: 'inbound',
        providerMessageId: null,
        internetMessageId: String(parsed.messageId ?? '').slice(0, 1000) || null,
        fromAddress: from,
        toJson: to,
        ccJson: cc,
        bccJson: bcc,
        subject: subject || null,
        preview: plainPreview(text, html) || null,
        rawR2Key,
        textR2Key,
        htmlR2Key,
        status: 'received',
        folder: 'inbox',
        isRead: false,
        receivedAt: occurredAt,
        createdAt: occurredAt,
      });
    });

    imported += 1;
  }

  revalidatePath(`/t/${tenantSlug}/mail/inbox`);
  redirect(`/t/${tenantSlug}/mail/migration?imported=${imported}`);
}
