'use server';

import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMigrationRuns } from '@/shared/db/schema';

import { pushMailMigrationQueue } from './cloudflare';
import { encryptImapCredential, normalizeImapEndpoint } from './migration-credentials';
import { getMailWorkspace, requireMailWorkspaceAccess } from './workspace';

function validAddress(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function startImapMailMigration(tenantSlug: string, formData: FormData) {
  const access = await requireMailWorkspaceAccess(tenantSlug);
  if (!['admin', 'manager'].includes(String(access.membership.role)))
    throw new Error('Mail migration requires workspace manager access.');
  const mailboxId = String(formData.get('mailboxId') || '');
  const sourceMailboxAddress = String(formData.get('sourceMailboxAddress') || '')
    .trim()
    .toLowerCase();
  const mode = String(formData.get('mode') || 'initial');
  const hostInput = String(formData.get('host') || '');
  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');
  let host: string;
  try {
    host = normalizeImapEndpoint(hostInput, 993);
  } catch {
    redirect(`/app/${tenantSlug}/mail/migration?error=imap-endpoint`);
  }
  if (!validAddress(sourceMailboxAddress)) redirect(`/app/${tenantSlug}/mail/migration?error=imap-source`);
  if (!['initial', 'delta'].includes(mode)) redirect(`/app/${tenantSlug}/mail/migration?error=imap-mode`);
  if (!username.trim() || username.length > 320 || !password || password.length > 2048)
    redirect(`/app/${tenantSlug}/mail/migration?error=imap-credentials`);
  const [workspace, mailbox] = await Promise.all([
    getMailWorkspace(tenantSlug),
    db.query.mailMailboxes.findFirst({
      where: and(
        eq(mailMailboxes.id, mailboxId),
        eq(mailMailboxes.tenantId, access.tenant.id),
        eq(mailMailboxes.status, 'active'),
      ),
    }),
  ]);
  if (!workspace || !mailbox) redirect(`/app/${tenantSlug}/mail/migration?error=mailbox`);
  const domain = await db.query.mailDomains.findFirst({
    where: and(eq(mailDomains.id, mailbox.domainId), eq(mailDomains.tenantId, access.tenant.id)),
  });
  if (!domain) redirect(`/app/${tenantSlug}/mail/migration?error=mailbox`);
  const activeRun = await db.query.mailMigrationRuns.findFirst({
    where: and(
      eq(mailMigrationRuns.tenantId, access.tenant.id),
      inArray(mailMigrationRuns.status, ['queued', 'running']),
    ),
  });
  if (activeRun) redirect(`/app/${tenantSlug}/mail/migration?error=imap-active`);

  let sourceCursor: Record<string, unknown> = {};
  if (mode === 'delta') {
    const previousRun = await db.query.mailMigrationRuns.findFirst({
      where: and(
        eq(mailMigrationRuns.tenantId, access.tenant.id),
        eq(mailMigrationRuns.destinationMailboxId, mailbox.id),
        eq(mailMigrationRuns.sourceType, 'imap'),
        eq(mailMigrationRuns.sourceMailboxAddress, sourceMailboxAddress),
        eq(mailMigrationRuns.sourceHost, host),
        eq(mailMigrationRuns.status, 'completed'),
      ),
      orderBy: (table, { desc }) => [desc(table.completedAt)],
    });
    if (!previousRun) redirect(`/app/${tenantSlug}/mail/migration?error=imap-delta-source`);
    sourceCursor = previousRun.sourceCursor;
  }

  const encryptedCredential = await encryptImapCredential(username, password);
  const [run] = await db
    .insert(mailMigrationRuns)
    .values({
      tenantId: access.tenant.id,
      workspaceId: workspace.id,
      sourceMailboxAddress,
      destinationMailboxId: mailbox.id,
      sourceType: 'imap',
      sourceHost: host,
      sourcePort: 993,
      encryptedCredential,
      mode,
      status: 'queued',
      sourceCursor,
      actorUserId: access.actor.userId,
    })
    .returning({ id: mailMigrationRuns.id });
  if (!run) throw new Error('Could not create the IMAP migration run.');
  try {
    await pushMailMigrationQueue(run.id);
  } catch {
    await db
      .update(mailMigrationRuns)
      .set({
        status: 'failed',
        encryptedCredential: null,
        safeErrorCode: 'migration_queue_unavailable',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mailMigrationRuns.id, run.id));
    redirect(`/app/${tenantSlug}/mail/migration?error=imap-queue`);
  }
  revalidatePath(`/app/${tenantSlug}/mail/migration`);
  redirect(`/app/${tenantSlug}/mail/migration?started=${run.id}`);
}

export async function cancelMailMigration(tenantSlug: string, formData: FormData) {
  const access = await requireMailWorkspaceAccess(tenantSlug);
  if (!['admin', 'manager'].includes(String(access.membership.role)))
    throw new Error('Mail migration requires workspace manager access.');
  const runId = String(formData.get('runId') || '');
  if (!/^[0-9a-f-]{36}$/i.test(runId)) redirect(`/app/${tenantSlug}/mail/migration?error=migration-run`);
  await db
    .update(mailMigrationRuns)
    .set({
      status: 'cancelled',
      encryptedCredential: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mailMigrationRuns.id, runId),
        eq(mailMigrationRuns.tenantId, access.tenant.id),
        inArray(mailMigrationRuns.status, ['queued', 'running']),
      ),
    );
  revalidatePath(`/app/${tenantSlug}/mail/migration`);
  redirect(`/app/${tenantSlug}/mail/migration?cancelled=${runId}`);
}

export async function resumeMailMigration(tenantSlug: string, formData: FormData) {
  const access = await requireMailWorkspaceAccess(tenantSlug);
  if (!['admin', 'manager'].includes(String(access.membership.role)))
    throw new Error('Mail migration requires workspace manager access.');
  const runId = String(formData.get('runId') || '');
  if (!/^[0-9a-f-]{36}$/i.test(runId)) redirect(`/app/${tenantSlug}/mail/migration?error=migration-run`);
  const [run] = await db
    .update(mailMigrationRuns)
    .set({ status: 'queued', safeErrorCode: null, completedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(mailMigrationRuns.id, runId),
        eq(mailMigrationRuns.tenantId, access.tenant.id),
        eq(mailMigrationRuns.sourceType, 'imap'),
        eq(mailMigrationRuns.status, 'failed'),
        isNotNull(mailMigrationRuns.encryptedCredential),
      ),
    )
    .returning({ id: mailMigrationRuns.id, encryptedCredential: mailMigrationRuns.encryptedCredential });
  if (!run?.encryptedCredential) redirect(`/app/${tenantSlug}/mail/migration?error=migration-resume`);
  try {
    await pushMailMigrationQueue(run.id);
  } catch {
    await db
      .update(mailMigrationRuns)
      .set({ status: 'failed', safeErrorCode: 'migration_queue_unavailable', updatedAt: new Date() })
      .where(eq(mailMigrationRuns.id, run.id));
    redirect(`/app/${tenantSlug}/mail/migration?error=imap-queue`);
  }
  revalidatePath(`/app/${tenantSlug}/mail/migration`);
  redirect(`/app/${tenantSlug}/mail/migration?started=${run.id}`);
}
