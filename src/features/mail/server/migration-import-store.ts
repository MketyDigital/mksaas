import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/db/cloudflare';
import { mailMessages, mailMigrationMessages, mailMigrationRuns, mailThreads } from '@/shared/db/schema';
import { storeMailContent } from './content';
import { fingerprintImportedMessage, type ParsedImportMessage } from './migration-import-core';

export type ImportMessageOnceInput = {
  tenantId: string;
  mailboxId: string;
  runId: string;
  parsed: ParsedImportMessage;
  sourceUid?: string | null;
  sourceUidValidity?: string | null;
};

/** Stores one source message and records its identity in the same transaction as the Mail row. */
export async function importMessageOnce(input: ImportMessageOnceInput) {
  const { tenantId, mailboxId, runId, parsed } = input;
  const run = await db.query.mailMigrationRuns.findFirst({
    where: and(
      eq(mailMigrationRuns.id, runId),
      eq(mailMigrationRuns.tenantId, tenantId),
      eq(mailMigrationRuns.destinationMailboxId, mailboxId),
    ),
  });
  if (!run || !['queued', 'running'].includes(run.status)) throw new Error('migration_run_unavailable');
  const sourceKey = await fingerprintImportedMessage(
    new TextEncoder().encode(`${run.sourceType}:${run.sourceHost || ''}:${run.sourceMailboxAddress}:${mailboxId}`),
  );
  const fingerprint = await fingerprintImportedMessage(parsed.raw);
  const existing = await db.query.mailMigrationMessages.findFirst({
    where: and(
      eq(mailMigrationMessages.tenantId, tenantId),
      eq(mailMigrationMessages.sourceKey, sourceKey),
      eq(mailMigrationMessages.folderPath, parsed.folderPath),
      eq(mailMigrationMessages.contentFingerprint, fingerprint),
    ),
  });
  if (existing) return { imported: false, messageId: existing.targetMessageId };

  const messageId = crypto.randomUUID();
  const baseKey = `mail/${tenantId}/${mailboxId}/migration/${runId}/${messageId}`;
  const rawR2Key = `${baseKey}/raw.eml`;
  await storeMailContent(rawR2Key, parsed.raw, 'message/rfc822');

  let textR2Key: string | null = null;
  let htmlR2Key: string | null = null;
  if (parsed.text) {
    textR2Key = `${baseKey}/body.txt`;
    await storeMailContent(textR2Key, new TextEncoder().encode(parsed.text), 'text/plain; charset=utf-8');
  }
  if (parsed.html) {
    htmlR2Key = `${baseKey}/body.html`;
    await storeMailContent(htmlR2Key, new TextEncoder().encode(parsed.html), 'text/html; charset=utf-8');
  }

  const attachmentManifest: Array<{ filename: string; contentType: string; r2Key: string; size: number }> = [];
  for (let index = 0; index < parsed.attachments.length; index += 1) {
    const attachment = parsed.attachments[index];
    if (!attachment.content.byteLength) continue;
    const r2Key = `${baseKey}/attachments/${String(index + 1).padStart(3, '0')}-${attachment.filename}`;
    await storeMailContent(r2Key, attachment.content, attachment.contentType);
    attachmentManifest.push({
      filename: attachment.filename,
      contentType: attachment.contentType,
      r2Key,
      size: attachment.content.byteLength,
    });
  }
  if (attachmentManifest.length) {
    await storeMailContent(
      `${baseKey}/attachments.json`,
      new TextEncoder().encode(JSON.stringify(attachmentManifest)),
      'application/json',
    );
  }

  const occurredAt = parsed.occurredAt ?? new Date();
  const direction = parsed.folder === 'sent' ? 'outbound' : 'inbound';
  return db.transaction(async (tx) => {
    const [thread] = await tx
      .insert(mailThreads)
      .values({
        tenantId,
        mailboxId,
        subject: parsed.subject || null,
        status: 'open',
        lastMessageAt: occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      })
      .returning({ id: mailThreads.id });
    if (!thread) throw new Error('Imported Mail thread could not be created.');

    const [message] = await tx
      .insert(mailMessages)
      .values({
        id: messageId,
        tenantId,
        mailboxId,
        threadId: thread.id,
        direction,
        internetMessageId: parsed.messageId,
        fromAddress: parsed.from,
        toJson: parsed.to,
        ccJson: parsed.cc,
        bccJson: parsed.bcc,
        subject: parsed.subject || null,
        preview: parsed.preview || null,
        rawR2Key,
        textR2Key,
        htmlR2Key,
        status: direction === 'outbound' ? 'sent' : 'received',
        folder: parsed.folder,
        isRead: parsed.isRead,
        receivedAt: direction === 'inbound' ? occurredAt : null,
        sentAt: direction === 'outbound' ? occurredAt : null,
        createdAt: occurredAt,
      })
      .onConflictDoNothing()
      .returning({ id: mailMessages.id });

    if (!message) {
      const duplicate = await tx.query.mailMigrationMessages.findFirst({
        where: and(
          eq(mailMigrationMessages.tenantId, tenantId),
          eq(mailMigrationMessages.sourceKey, sourceKey),
          eq(mailMigrationMessages.folderPath, parsed.folderPath),
          eq(mailMigrationMessages.contentFingerprint, fingerprint),
        ),
      });
      if (duplicate) return { imported: false, messageId: duplicate.targetMessageId };
      throw new Error('Imported Mail message conflicts with an existing message.');
    }

    const [identity] = await tx
      .insert(mailMigrationMessages)
      .values({
        tenantId,
        migrationRunId: runId,
        sourceKey,
        folderPath: parsed.folderPath,
        sourceUid: input.sourceUid ?? null,
        sourceUidValidity: input.sourceUidValidity ?? null,
        internetMessageId: parsed.messageId,
        contentFingerprint: fingerprint,
        targetMessageId: message.id,
      })
      .onConflictDoNothing()
      .returning({ targetMessageId: mailMigrationMessages.targetMessageId });
    if (!identity) {
      const duplicate = await tx.query.mailMigrationMessages.findFirst({
        where: and(
          eq(mailMigrationMessages.tenantId, tenantId),
          eq(mailMigrationMessages.sourceKey, sourceKey),
          eq(mailMigrationMessages.folderPath, parsed.folderPath),
          eq(mailMigrationMessages.contentFingerprint, fingerprint),
        ),
      });
      if (duplicate) return { imported: false, messageId: duplicate.targetMessageId };
      throw new Error('Imported Mail source identity conflicts with an existing message.');
    }

    await tx
      .update(mailMigrationRuns)
      .set({
        importedMessages: sql`${mailMigrationRuns.importedMessages} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(mailMigrationRuns.id, runId));

    return { imported: true, messageId: message.id };
  });
}
