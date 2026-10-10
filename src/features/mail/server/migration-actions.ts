'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMigrationRuns } from '@/shared/db/schema';

import { extractZipArchive, parseImportedMessage, parseMbox } from './migration-import-core';
import { importMessageOnce } from './migration-import-store';
import { getMailWorkspace, requireMailWorkspaceAccess } from './workspace';

const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_BYTES = 25_000_000;
const MAX_FILE_BYTES = 10_000_000;
const MAX_ARCHIVE_MESSAGES = 2_000;

function isSupportedFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.eml') || name.endsWith('.mbox') || name.endsWith('.zip');
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
  if (!mailbox) redirect(`/app/${tenantSlug}/mail/migration?error=mailbox`);

  const workspace = await getMailWorkspace(tenantSlug);
  if (!workspace) redirect(`/app/${tenantSlug}/mail/migration?error=workspace`);
  const domain = await db.query.mailDomains.findFirst({ where: eq(mailDomains.id, mailbox.domainId) });
  if (!domain) redirect(`/app/${tenantSlug}/mail/migration?error=mailbox`);

  const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length || files.length > MAX_UPLOAD_FILES) redirect(`/app/${tenantSlug}/mail/migration?error=files`);
  if (files.some((file) => !isSupportedFile(file))) redirect(`/app/${tenantSlug}/mail/migration?error=type`);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_UPLOAD_BYTES || files.some((file) => file.size > MAX_FILE_BYTES)) {
    redirect(`/app/${tenantSlug}/mail/migration?error=size`);
  }

  const [run] = await db
    .insert(mailMigrationRuns)
    .values({
      tenantId: access.tenant.id,
      workspaceId: workspace.id,
      sourceMailboxAddress: `${mailbox.localPart}@${domain.domain}`,
      destinationMailboxId: mailbox.id,
      sourceType: 'archive',
      mode: 'archive',
      status: 'running',
      startedAt: new Date(),
      actorUserId: access.actor.userId,
    })
    .returning({ id: mailMigrationRuns.id });
  if (!run) throw new Error('Could not start the Mail archive import.');

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let total = 0;
  const importRaw = async (raw: Uint8Array, folderPath: string) => {
    total += 1;
    if (total > MAX_ARCHIVE_MESSAGES) throw new Error('archive_message_limit');
    try {
      const parsed = await parseImportedMessage(raw, { folderPath, flags: [] });
      const result = await importMessageOnce({
        tenantId: access.tenant.id,
        mailboxId: mailbox.id,
        runId: run.id,
        parsed,
      });
      if (result.imported) imported += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  };

  try {
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = file.name.replace(/\\/g, '/').split('/').pop() || 'archive';
      if (name.toLowerCase().endsWith('.eml')) {
        await importRaw(bytes, name);
      } else if (name.toLowerCase().endsWith('.mbox')) {
        for (const [index, raw] of parseMbox(bytes).entries()) await importRaw(raw, `${name}/${index + 1}`);
      } else {
        const entries = await extractZipArchive(bytes);
        for (const entry of entries) {
          if (entry.path.toLowerCase().endsWith('.eml')) await importRaw(entry.content, entry.path);
          else
            for (const [index, raw] of parseMbox(entry.content).entries())
              await importRaw(raw, `${entry.path}/${index + 1}`);
        }
      }
    }
    await db
      .update(mailMigrationRuns)
      .set({
        status: failed ? 'completed_with_errors' : 'completed',
        totalMessages: total,
        importedMessages: imported,
        skippedMessages: skipped,
        failedMessages: failed,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(mailMigrationRuns.id, run.id), eq(mailMigrationRuns.tenantId, access.tenant.id)));
  } catch (error) {
    await db
      .update(mailMigrationRuns)
      .set({
        status: 'failed',
        totalMessages: total,
        importedMessages: imported,
        skippedMessages: skipped,
        failedMessages: failed + 1,
        safeErrorCode:
          error instanceof Error && /^archive_[a-z_]+$/.test(error.message) ? error.message : 'archive_import_failed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(mailMigrationRuns.id, run.id), eq(mailMigrationRuns.tenantId, access.tenant.id)));
  }

  revalidatePath(`/app/${tenantSlug}/mail/inbox`);
  redirect(`/app/${tenantSlug}/mail/migration?imported=${imported}&run=${run.id}`);
}
