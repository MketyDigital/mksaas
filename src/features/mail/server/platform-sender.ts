import { and, eq } from 'drizzle-orm';

import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMessages, mailSuppressions, mailWorkspaces } from '@/shared/db/schema';

import { pushMailQueueBatch } from './cloudflare';
import { isFirstPartyMailSendingDomainReady, type PlatformMailInput, sendPlatformMailWithDependencies } from './platform-sender-core';
import { getFirstPartyMailTenantId } from './runtime-config';
import { getMailSendCapacity } from './sending-policy';

export { PLATFORM_MAIL_CATEGORIES, type PlatformMailCategory } from './platform-sender-core';

function databaseErrorCode(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code || candidate?.cause?.code;
}

export async function sendPlatformMail(input: PlatformMailInput) {
  return sendPlatformMailWithDependencies(input, {
    resolve: async () => {
      const tenantId = getFirstPartyMailTenantId().trim();
      if (!tenantId) return null;
      const [workspace, entitled, domain] = await Promise.all([
        db.query.mailWorkspaces.findFirst({ where: and(eq(mailWorkspaces.tenantId, tenantId), eq(mailWorkspaces.status, 'active')) }),
        hasEntitlement({ tenantId, entitlement: 'workspace.mail' }),
        db.query.mailDomains.findFirst({ where: and(eq(mailDomains.tenantId, tenantId), eq(mailDomains.domain, 'mail.mkety.com')) }),
      ]);
      if (!workspace || !domain) return null;
      const mailbox = await db.query.mailMailboxes.findFirst({
        where: and(
          eq(mailMailboxes.tenantId, tenantId),
          eq(mailMailboxes.workspaceId, workspace.id),
          eq(mailMailboxes.domainId, domain.id),
          eq(mailMailboxes.localPart, 'info'),
          eq(mailMailboxes.status, 'active'),
        ),
      });
      if (!mailbox) return null;
      return {
        tenantId,
        mailboxId: mailbox.id,
        domainId: domain.id,
        from: `${mailbox.localPart}@${domain.domain}`.toLowerCase(),
        workspaceActive: workspace.status === 'active',
        entitled,
        domainReady: isFirstPartyMailSendingDomainReady(domain),
      };
    },
    isSuppressed: async (tenantId, email) => {
      const suppression = await db.query.mailSuppressions.findFirst({
        where: and(eq(mailSuppressions.tenantId, tenantId), eq(mailSuppressions.email, email)),
      });
      return Boolean(suppression && (!suppression.expiresAt || suppression.expiresAt.getTime() > Date.now()));
    },
    hasCapacity: async (tenantId, domainId) => (await getMailSendCapacity(tenantId, domainId, 1)).allowed,
    findByIdempotencyKey: async (tenantId, key) => {
      const message = await db.query.mailMessages.findFirst({
        where: and(eq(mailMessages.tenantId, tenantId), eq(mailMessages.platformIdempotencyKey, key)),
        columns: { id: true, status: true },
      });
      return message ? { id: message.id, status: message.status } : null;
    },
    createMessage: async (message) => {
      try {
        const [created] = await db.insert(mailMessages).values({
          tenantId: message.tenantId,
          mailboxId: message.mailboxId,
          direction: 'outbound',
          fromAddress: message.from,
          toJson: [message.to],
          subject: message.subject,
          preview: (message.text || message.html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 240),
          status: message.status,
          folder: 'sent',
          platformIdempotencyKey: message.idempotencyKey,
        }).returning({ id: mailMessages.id });
        if (!created) throw new Error('Mail message creation failed.');
        return created;
      } catch (error) {
        if (databaseErrorCode(error) !== '23505') throw error;
        const existing = await db.query.mailMessages.findFirst({
          where: and(eq(mailMessages.tenantId, message.tenantId), eq(mailMessages.platformIdempotencyKey, message.idempotencyKey)),
          columns: { id: true, status: true },
        });
        if (existing) return { id: existing.id, duplicate: true, status: existing.status };
        throw error;
      }
    },
    retryFailedMessage: async (messageId) => {
      const [claimed] = await db.update(mailMessages)
        .set({ status: 'queued' })
        .where(and(
          eq(mailMessages.id, messageId),
          eq(mailMessages.tenantId, getFirstPartyMailTenantId()),
          eq(mailMessages.status, 'failed'),
        ))
        .returning({ id: mailMessages.id });
      return Boolean(claimed);
    },
    enqueue: async (message) => {
      await pushMailQueueBatch([message]);
    },
    setMessageStatus: async (messageId, status) => {
      await db.update(mailMessages)
        .set({ status })
        .where(and(eq(mailMessages.id, messageId), eq(mailMessages.tenantId, getFirstPartyMailTenantId())));
    },
  });
}
