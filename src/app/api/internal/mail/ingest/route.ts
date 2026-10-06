import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from '@/features/mail/server/commercial';
import { isMailStorageWithinLimit } from '@/features/mail/commercial/storage-capacity';
import { applyInboundMailAutomation } from '@/features/mail/server/automation-actions';
import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { mailMailboxes, mailMessages, mailThreads, mailWorkspaces, tenants } from '@/shared/db/schema';

type IngestBody = {
  tenantId?: string;
  mailboxId?: string;
  from?: string;
  to?: string;
  subject?: string;
  internetMessageId?: string;
  rawR2Key?: string;
  htmlR2Key?: string;
  textR2Key?: string;
  preview?: string;
  attachmentCount?: number;
  rawSize?: number;
  storageBytes?: number;
  automated?: boolean;
};

export async function POST(request: Request) {
  const secret = getMailInternalSecret();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return withRequestDatabase(async () => {
    const body = await request.json().catch(() => null) as IngestBody | null;
    if (!body?.tenantId || !body.mailboxId || !body.from || !body.to || !body.rawR2Key) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const storageBytes = Number(body.storageBytes ?? body.rawSize);
    if (!Number.isSafeInteger(storageBytes) || storageBytes < 1 || storageBytes > 100 * 1024 * 1024) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const [mailbox, tenant, workspace] = await Promise.all([
      db.query.mailMailboxes.findFirst({
        where: and(eq(mailMailboxes.id, body.mailboxId), eq(mailMailboxes.tenantId, body.tenantId)),
      }),
      db.query.tenants.findFirst({ where: eq(tenants.id, body.tenantId), columns: { slug: true } }),
      db.query.mailWorkspaces.findFirst({ where: eq(mailWorkspaces.tenantId, body.tenantId), columns: { planKey: true } }),
    ]);
    if (!mailbox || !tenant || !workspace) return NextResponse.json({ ok: false }, { status: 404 });

    const planKey = await resolveTenantMailPlanKey(body.tenantId, workspace.planKey, tenant.slug);
    const limits = await resolveTenantMailPlanLimits(body.tenantId, planKey);
    const maximumBytes = limits ? limits.storageGb * 1024 * 1024 * 1024 : null;
    const receivedAt = new Date();
    const result = await db.transaction(async (tx) => {
      const [currentWorkspace] = await tx.select({
        id: mailWorkspaces.id,
        status: mailWorkspaces.status,
        storageBytesUsed: mailWorkspaces.storageBytesUsed,
      }).from(mailWorkspaces)
        .where(eq(mailWorkspaces.tenantId, body.tenantId!))
        .for('update')
        .limit(1);
      if (!currentWorkspace || currentWorkspace.status !== 'active') return { error: 'workspace' as const };
      if (!isMailStorageWithinLimit(currentWorkspace.storageBytesUsed, storageBytes, maximumBytes)) {
        return { error: 'storage_limit' as const };
      }

      await tx.update(mailWorkspaces).set({
        storageBytesUsed: currentWorkspace.storageBytesUsed + storageBytes,
        updatedAt: receivedAt,
      }).where(eq(mailWorkspaces.id, currentWorkspace.id));

      const [thread] = await tx.insert(mailThreads).values({
        tenantId: body.tenantId!,
        mailboxId: body.mailboxId!,
        subject: String(body.subject || '').slice(0, 500) || null,
        status: 'open',
        lastMessageAt: receivedAt,
      }).returning();
      if (!thread) throw new Error('Mail thread creation failed.');

      const [message] = await tx.insert(mailMessages).values({
        tenantId: body.tenantId!,
        mailboxId: body.mailboxId!,
        threadId: thread.id,
        direction: 'inbound',
        internetMessageId: String(body.internetMessageId || '').slice(0, 1000) || null,
        fromAddress: String(body.from).toLowerCase().slice(0, 320),
        toJson: [String(body.to).toLowerCase().slice(0, 320)],
        subject: String(body.subject || '').slice(0, 500) || null,
        preview: String(body.preview || '').slice(0, 240) || null,
        rawR2Key: String(body.rawR2Key),
        htmlR2Key: String(body.htmlR2Key || '') || null,
        textR2Key: String(body.textR2Key || '') || null,
        status: 'received',
        folder: 'inbox',
        receivedAt,
      }).returning();
      if (!message) throw new Error('Mail message creation failed.');
      return { thread, message };
    });

    if ('error' in result) {
      return NextResponse.json({ ok: false }, { status: result.error === 'storage_limit' ? 507 : 409 });
    }

    await applyInboundMailAutomation({
      tenantId: body.tenantId,
      mailboxId: body.mailboxId,
      threadId: result.thread.id,
      from: String(body.from).toLowerCase(),
      subject: String(body.subject || ''),
      automated: Boolean(body.automated),
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, messageId: result.message.id });
  });
}
