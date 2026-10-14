import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMigrationRuns } from '@/shared/db/schema';

import { safeArchiveMessageErrorCode } from './archive-import-errors';
import { pushMailMigrationQueue } from './cloudflare';
import { deleteMailContent, fetchMailContent, storeMailContent } from './content';
import { extractZipArchive, parseImportedMessage, parseMbox } from './migration-import-core';
import { importMessageOnce } from './migration-import-store';
import { getMailWorkspace, requireMailWorkspaceAccess } from './workspace';

export const MAX_ARCHIVE_UPLOAD_FILES = 20;
export const MAX_ARCHIVE_UPLOAD_BYTES = 25_000_000;
export const MAX_ARCHIVE_FILE_BYTES = 10_000_000;
export const MAX_ARCHIVE_MESSAGES = 2_000;
export const MAX_ARCHIVE_CHUNK_BYTES = 256_000;
export const MAX_ARCHIVE_UPLOAD_CHUNKS = 40;
const ARCHIVE_BATCH_MESSAGES = 5;

export const SAFE_ARCHIVE_ERRORS = ['files', 'type', 'size', 'mailbox', 'workspace', 'active'] as const;
export type MailArchiveImportErrorCode = (typeof SAFE_ARCHIVE_ERRORS)[number];

export class MailArchiveImportError extends Error {
  constructor(readonly code: MailArchiveImportErrorCode) {
    super(`archive_${code}`);
    this.name = 'MailArchiveImportError';
  }
}

export type MailArchiveImportAccess = Awaited<ReturnType<typeof requireMailWorkspaceAccess>>;

export async function requireMailArchiveImportAccess(tenantSlug: string) {
  const access = await requireMailWorkspaceAccess(tenantSlug);
  if (!['admin', 'manager'].includes(String(access.membership.role))) {
    throw new Error('Mail migration requires workspace manager access.');
  }
  return access;
}

export function archiveUploadChunkKey(tenantId: string, uploadId: string, fileIndex: number, chunkIndex: number) {
  return `mail/archive-staging/${tenantId}/${uploadId}/${fileIndex}/${chunkIndex}`;
}

type ArchiveUploadFile = { name: string; size: number; chunks: number };

export async function completeMailArchiveUpload(
  tenantSlug: string,
  input: { mailboxId: string; uploadId: string; files: ArchiveUploadFile[] },
  access?: MailArchiveImportAccess,
) {
  const authorized = access ?? (await requireMailArchiveImportAccess(tenantSlug));
  const activeRuns = await db.query.mailMigrationRuns.findMany({
    where: and(
      eq(mailMigrationRuns.tenantId, authorized.tenant.id),
      eq(mailMigrationRuns.sourceType, 'archive'),
      inArray(mailMigrationRuns.status, ['queued', 'running']),
    ),
  });
  const staleBefore = Date.now() - 2 * 60 * 1000;
  for (const activeRun of activeRuns) {
    const cursor = activeRun.sourceCursor as { packKey?: unknown; messages?: unknown };
    const legacySynchronousRun = activeRun.status === 'running' && (!cursor.packKey || !Array.isArray(cursor.messages));
    if (legacySynchronousRun && activeRun.updatedAt.getTime() < staleBefore) {
      await db
        .update(mailMigrationRuns)
        .set({
          status: 'failed',
          safeErrorCode: 'archive_run_interrupted',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(mailMigrationRuns.id, activeRun.id), inArray(mailMigrationRuns.status, ['queued', 'running'])));
    } else {
      throw new MailArchiveImportError('active');
    }
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.uploadId)) throw new MailArchiveImportError('files');
  if (!Array.isArray(input.files) || !input.files.length || input.files.length > MAX_ARCHIVE_UPLOAD_FILES)
    throw new MailArchiveImportError('files');
  const files = input.files.map((file) => ({
    name:
      String(file?.name || '')
        .replace(/\\/g, '/')
        .split('/')
        .pop() || '',
    size: Number(file?.size),
    chunks: Number(file?.chunks),
  }));
  if (files.some((file) => !isSupportedName(file.name))) throw new MailArchiveImportError('type');
  if (
    files.some(
      (file) =>
        !Number.isSafeInteger(file.size) ||
        file.size <= 0 ||
        file.size > MAX_ARCHIVE_FILE_BYTES ||
        !Number.isSafeInteger(file.chunks) ||
        file.chunks < 1 ||
        file.chunks > MAX_ARCHIVE_UPLOAD_CHUNKS ||
        file.chunks !== Math.ceil(file.size / MAX_ARCHIVE_CHUNK_BYTES),
    ) ||
    files.reduce((sum, file) => sum + file.size, 0) > MAX_ARCHIVE_UPLOAD_BYTES
  ) {
    throw new MailArchiveImportError('size');
  }

  const [workspace, mailbox] = await Promise.all([
    getMailWorkspace(tenantSlug),
    db.query.mailMailboxes.findFirst({
      where: and(
        eq(mailMailboxes.id, input.mailboxId),
        eq(mailMailboxes.tenantId, authorized.tenant.id),
        eq(mailMailboxes.status, 'active'),
      ),
    }),
  ]);
  if (!workspace || !mailbox) throw new MailArchiveImportError('mailbox');
  const domain = await db.query.mailDomains.findFirst({
    where: and(eq(mailDomains.id, mailbox.domainId), eq(mailDomains.tenantId, authorized.tenant.id)),
  });
  if (!domain) throw new MailArchiveImportError('mailbox');

  const objectFiles: Array<{ key: string }> = [];
  const temporaryKeys: string[] = [];
  const packedMessages: Array<{ raw: Uint8Array; folderPath: string }> = [];
  let totalMessages = 0;
  let totalExpandedBytes = 0;
  let queued = false;
  let stage = 'read_and_parse_archive';
  try {
    for (const [fileIndex, file] of files.entries()) {
      const chunks: Uint8Array[] = [];
      let actualSize = 0;
      for (let chunkIndex = 0; chunkIndex < file.chunks; chunkIndex += 1) {
        const key = archiveUploadChunkKey(authorized.tenant.id, input.uploadId, fileIndex, chunkIndex);
        temporaryKeys.push(key);
        const object = await fetchMailContent(key);
        if (!object) throw new MailArchiveImportError('files');
        actualSize += object.bytes.byteLength;
        chunks.push(object.bytes);
      }
      if (actualSize !== file.size) throw new MailArchiveImportError('files');
      const bytes = new Uint8Array(actualSize);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const name = file.name.toLowerCase();
      if (name.endsWith('.zip')) {
        const entries = await extractZipArchive(bytes);
        let expanded = 0;
        for (const entry of entries) {
          expanded += entry.content.byteLength;
          if (entry.path.toLowerCase().endsWith('.eml'))
            packedMessages.push({ raw: entry.content, folderPath: entry.path });
          else {
            for (const [index, raw] of parseMbox(entry.content).entries()) {
              packedMessages.push({ raw, folderPath: `${entry.path}/${index + 1}` });
            }
          }
        }
        totalExpandedBytes += expanded;
      } else {
        totalExpandedBytes += bytes.byteLength;
        if (name.endsWith('.mbox')) {
          for (const [index, raw] of parseMbox(bytes).entries())
            packedMessages.push({ raw, folderPath: `${file.name}/${index + 1}` });
        } else {
          packedMessages.push({ raw: bytes, folderPath: file.name });
        }
      }
      totalMessages = packedMessages.length;
      if (totalExpandedBytes > MAX_ARCHIVE_UPLOAD_BYTES) throw new MailArchiveImportError('size');
      if (totalMessages > MAX_ARCHIVE_MESSAGES) throw new MailArchiveImportError('files');
    }

    const packSize = packedMessages.reduce((sum, message) => sum + message.raw.byteLength, 0);
    if (packSize > MAX_ARCHIVE_UPLOAD_BYTES) throw new MailArchiveImportError('size');
    const messagePack = new Uint8Array(packSize);
    const messageOffsets: Array<{ offset: number; size: number; folderPath: string }> = [];
    let packOffset = 0;
    for (const message of packedMessages) {
      messagePack.set(message.raw, packOffset);
      messageOffsets.push({ offset: packOffset, size: message.raw.byteLength, folderPath: message.folderPath });
      packOffset += message.raw.byteLength;
    }
    const packKey = `mail/archive-staging/${authorized.tenant.id}/${input.uploadId}/message-pack`;
    stage = 'store_message_pack';
    await storeMailContent(packKey, messagePack, 'application/octet-stream');
    objectFiles.push({ key: packKey });

    stage = 'create_migration_run';
    const [run] = await db
      .insert(mailMigrationRuns)
      .values({
        tenantId: authorized.tenant.id,
        workspaceId: workspace.id,
        sourceMailboxAddress: `${mailbox.localPart}@${domain.domain}`,
        destinationMailboxId: mailbox.id,
        sourceType: 'archive',
        mode: 'archive',
        status: 'queued',
        sourceCursor: { packKey, messages: messageOffsets, nextMessageIndex: 0 },
        totalMessages,
        actorUserId: authorized.actor.userId,
      })
      .returning({ id: mailMigrationRuns.id });
    if (!run) throw new Error('Could not start the Mail archive import.');
    try {
      stage = 'enqueue_migration';
      await pushMailMigrationQueue(run.id, 'archive');
      queued = true;
    } catch {
      await db
        .update(mailMigrationRuns)
        .set({
          status: 'failed',
          safeErrorCode: 'archive_queue_unavailable',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mailMigrationRuns.id, run.id));
      await Promise.allSettled(objectFiles.map((file) => deleteMailContent(file.key)));
      throw new Error('archive_queue_unavailable');
    }
    return { runId: run.id, total: totalMessages };
  } catch (error) {
    console.error('[mail-archive] finalization failed', {
      stage,
      safeErrorCode: safeArchiveMessageErrorCode(error),
    });
    throw error;
  } finally {
    await Promise.allSettled(temporaryKeys.map((key) => deleteMailContent(key)));
    if (!queued) await Promise.allSettled(objectFiles.map((file) => deleteMailContent(file.key)));
  }
}

function isSupportedName(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith('.eml') || lower.endsWith('.mbox') || lower.endsWith('.zip');
}

export async function processMailArchiveBatch(runId: string) {
  const run = await db.query.mailMigrationRuns.findFirst({ where: eq(mailMigrationRuns.id, runId) });
  if (!run || run.sourceType !== 'archive' || !['queued', 'running'].includes(run.status)) return { done: true };
  const cursor = run.sourceCursor as {
    packKey?: string;
    messages?: Array<{ offset?: number; size?: number; folderPath?: string }>;
    nextMessageIndex?: number;
  };
  if (!cursor.packKey || !Array.isArray(cursor.messages) || !Number.isSafeInteger(cursor.nextMessageIndex)) {
    await db
      .update(mailMigrationRuns)
      .set({
        status: 'failed',
        safeErrorCode: 'archive_cursor_invalid',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(mailMigrationRuns.id, runId), inArray(mailMigrationRuns.status, ['queued', 'running'])));
    return { done: true };
  }

  try {
    if (
      !cursor.packKey.startsWith(`mail/archive-staging/${run.tenantId}/`) ||
      cursor.messages.length > MAX_ARCHIVE_MESSAGES
    )
      throw new Error('archive_cursor_invalid');
    const messages = cursor.messages.map((item) => {
      const offset = Number(item.offset);
      const size = Number(item.size);
      const folderPath = String(item.folderPath || '');
      if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(size) ||
        offset < 0 ||
        size <= 0 ||
        !folderPath ||
        folderPath.length > 1024
      ) {
        throw new Error('archive_cursor_invalid');
      }
      return { offset, size, folderPath };
    });
    const start = cursor.nextMessageIndex!;
    if (start > messages.length || messages.length !== run.totalMessages)
      throw new Error('archive_message_count_changed');
    const end = Math.min(start + ARCHIVE_BATCH_MESSAGES, messages.length);
    const batchStart = messages[start]?.offset;
    const lastMessage = messages[end - 1];
    const batchEnd = lastMessage ? lastMessage.offset + lastMessage.size : undefined;
    if (start < end && (batchStart === undefined || batchEnd === undefined || batchEnd <= batchStart))
      throw new Error('archive_cursor_invalid');
    const object =
      start < end
        ? await fetchMailContent(cursor.packKey, { offset: batchStart!, length: batchEnd! - batchStart! })
        : null;
    if (start < end && (!object || object.bytes.byteLength !== batchEnd! - batchStart!))
      throw new Error('archive_files_missing');
    const [claimedRun] = await db
      .update(mailMigrationRuns)
      .set({ status: 'running', startedAt: run.startedAt ?? new Date(), updatedAt: new Date() })
      .where(and(eq(mailMigrationRuns.id, runId), inArray(mailMigrationRuns.status, ['queued', 'running'])))
      .returning({ id: mailMigrationRuns.id });
    if (!claimedRun) return { done: true };
    for (let index = start; index < end; index += 1) {
      const item = messages[index];
      const raw = object!.bytes.subarray(item.offset - batchStart!, item.offset - batchStart! + item.size);
      let failed = false;
      let errorCode: string | null = null;
      try {
        const parsed = await parseImportedMessage(raw, { folderPath: item.folderPath, flags: [] });
        const result = await importMessageOnce({
          tenantId: run.tenantId,
          mailboxId: run.destinationMailboxId,
          runId,
          parsed,
        });
        if (!result.imported) {
          await db
            .update(mailMigrationRuns)
            .set({ skippedMessages: sql`${mailMigrationRuns.skippedMessages} + 1` })
            .where(eq(mailMigrationRuns.id, runId));
        }
      } catch (error) {
        failed = true;
        errorCode = safeArchiveMessageErrorCode(error);
      }
      await db
        .update(mailMigrationRuns)
        .set({
          totalMessages: sql`GREATEST(${mailMigrationRuns.totalMessages}, ${index + 1})`,
          ...(failed ? { failedMessages: sql`${mailMigrationRuns.failedMessages} + 1` } : {}),
          ...(failed && !run.safeErrorCode ? { safeErrorCode: errorCode } : {}),
          sourceCursor: { ...cursor, nextMessageIndex: index + 1 },
          updatedAt: new Date(),
        })
        .where(and(eq(mailMigrationRuns.id, runId), eq(mailMigrationRuns.status, 'running')));
    }
    if (end < messages.length) return { done: false };
    const finalRun = await db.query.mailMigrationRuns.findFirst({ where: eq(mailMigrationRuns.id, runId) });
    await db
      .update(mailMigrationRuns)
      .set({
        status: finalRun?.failedMessages ? 'completed_with_errors' : 'completed',
        skippedMessages: Math.max(
          0,
          messages.length - Number(finalRun?.importedMessages || 0) - Number(finalRun?.failedMessages || 0),
        ),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(mailMigrationRuns.id, runId), eq(mailMigrationRuns.status, 'running')));
    await deleteMailContent(cursor.packKey);
    return { done: true };
  } catch (error) {
    const code =
      error instanceof Error && /^archive_[a-z_]+$/.test(error.message) ? error.message : 'archive_import_failed';
    await db
      .update(mailMigrationRuns)
      .set({ status: 'failed', safeErrorCode: code, completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(mailMigrationRuns.id, runId), inArray(mailMigrationRuns.status, ['queued', 'running'])));
    return { done: true };
  }
}
