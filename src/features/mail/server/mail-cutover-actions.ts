'use server';

import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db';
import {
  mailDomainCutoverChecks,
  mailDomainCutovers,
  mailDomains,
  mailMailboxes,
  mailMailboxIngressAliases,
  mailMigrationRuns,
  tenants,
} from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { logAuditEvent } from '@/shared/services/audit-service';
import {
  createCloudflareEmailWorkerRule,
  deleteCloudflareEmailWorkerRule,
  disableCloudflareEmailRouting,
  enableCloudflareEmailRouting,
  getCloudflareEmailCatchAll,
  getCloudflareEmailRouting,
  getCloudflareEmailRoutingDns,
  getCloudflareEmailSending,
  getCloudflareEmailSendingDns,
  getCloudflareZoneMailDnsRecords,
  getPublicCloudflareDnsRecords,
  getPublicCloudflareSendingDns,
  restoreCloudflareRootMailDnsRecords,
  setCloudflareEmailCatchAll,
} from './cloudflare';
import { areCloudflareEmailAuthRecordsPublished } from './domain-provisioning-policy';
import { enableRootEmailRoutingAfterCatchAll } from './mail-cutover-cloudflare';
import {
  evaluateMailCutoverCompletion,
  evaluateMailCutoverReadiness,
  type MailCutoverCheck,
  normalizeCloudflareMxTarget,
} from './mail-cutover-readiness';
import { getFirstPartyMailTenantId } from './runtime-config';

const PRE_CUTOVER_CHECKS = ['temporary_inbound', 'outbound_acceptance', 'rollback_rehearsal'] as const;
const POST_CUTOVER_CHECKS = ['post_cutover_inbound', 'hello_final_delta'] as const;
type CheckName = (typeof PRE_CUTOVER_CHECKS)[number] | (typeof POST_CUTOVER_CHECKS)[number];

async function requireMailOps(opsTenantSlug: string) {
  const actor = await requirePlatformControlAccess(opsTenantSlug);
  await requirePermission(opsTenantSlug, 'platform:plans');
  return actor;
}

async function getFirstPartyRoot(opsTenantSlug: string) {
  const configuredTenantId = getFirstPartyMailTenantId().trim();
  if (!configuredTenantId) throw new Error('First-party Mail tenant is not configured.');
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, configuredTenantId) });
  if (!tenant || tenant.slug !== 'mkety-ops' || opsTenantSlug !== 'mkety-ops')
    throw new Error('The reserved first-party Mail tenant is unavailable.');
  const domain = await db.query.mailDomains.findFirst({
    where: and(eq(mailDomains.tenantId, tenant.id), eq(mailDomains.domain, 'mkety.com')),
  });
  if (!domain || !domain.cloudflareZoneId)
    throw new Error('The reserved root mail domain is not provisioned in Cloudflare.');
  const rows = await db
    .select({ id: mailMailboxes.id, address: sql<string>`${mailMailboxes.localPart} || '@' || ${mailDomains.domain}` })
    .from(mailMailboxes)
    .innerJoin(mailDomains, eq(mailMailboxes.domainId, mailDomains.id))
    .where(
      and(
        eq(mailMailboxes.tenantId, tenant.id),
        eq(mailMailboxes.domainId, domain.id),
        eq(mailMailboxes.status, 'active'),
        ne(mailMailboxes.type, 'alias'),
      ),
    );
  const cutover = await db.query.mailDomainCutovers.findFirst({
    where: and(eq(mailDomainCutovers.tenantId, tenant.id), eq(mailDomainCutovers.domainId, domain.id)),
  });
  const checks = cutover
    ? await db.query.mailDomainCutoverChecks.findMany({
        where: and(eq(mailDomainCutoverChecks.tenantId, tenant.id), eq(mailDomainCutoverChecks.cutoverId, cutover.id)),
      })
    : [];
  const hello = rows.find((row) => row.address.toLowerCase() === 'hello@mkety.com');
  const initialHelloImport = hello
    ? await db.query.mailMigrationRuns.findFirst({
        where: and(
          eq(mailMigrationRuns.tenantId, tenant.id),
          eq(mailMigrationRuns.destinationMailboxId, hello.id),
          eq(mailMigrationRuns.sourceMailboxAddress, 'hello@mkety.com'),
          inArray(mailMigrationRuns.mode, ['initial', 'archive']),
          eq(mailMigrationRuns.status, 'completed'),
        ),
        orderBy: (table) => [desc(table.completedAt)],
      })
    : null;
  const readiness = evaluateMailCutoverReadiness({
    tenantId: tenant.id,
    configuredTenantId,
    tenantSlug: tenant.slug,
    domain: domain.domain,
    sendingReady:
      domain.sendingEnabled &&
      domain.spfStatus === 'verified' &&
      domain.dkimStatus === 'verified' &&
      domain.dmarcStatus === 'verified',
    activeAddresses: rows.map((row) => row.address),
    helloMailboxId: hello?.id || null,
    initialHelloImport: initialHelloImport
      ? {
          status: initialHelloImport.status,
          mode: initialHelloImport.mode,
          sourceMailboxAddress: initialHelloImport.sourceMailboxAddress,
          destinationMailboxId: initialHelloImport.destinationMailboxId,
          failedMessages: initialHelloImport.failedMessages,
        }
      : null,
    checks: checks as MailCutoverCheck[],
  });
  return { tenant, domain, rows, cutover, checks: checks as MailCutoverCheck[], readiness, hello };
}

export async function recordFirstPartyMailCutoverCheck(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  const root = await getFirstPartyRoot(opsTenantSlug);
  const name = String(formData.get('checkName') || '') as CheckName;
  const passed = formData.get('passed') === 'on';
  const evidenceRef = String(formData.get('evidenceRef') || '')
    .trim()
    .slice(0, 500);
  if (![...PRE_CUTOVER_CHECKS, ...POST_CUTOVER_CHECKS].includes(name))
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=check`);
  if (!evidenceRef || /password|token|secret|app.?pass/i.test(evidenceRef))
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=evidence`);
  const postCheck = (POST_CUTOVER_CHECKS as readonly string[]).includes(name);
  if (postCheck && root.cutover?.state !== 'activated')
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=phase`);
  if (name === 'hello_final_delta') {
    const run = await db.query.mailMigrationRuns.findFirst({
      where: and(
        eq(mailMigrationRuns.id, evidenceRef),
        eq(mailMigrationRuns.tenantId, root.tenant.id),
        eq(mailMigrationRuns.sourceType, 'imap'),
        eq(mailMigrationRuns.sourceMailboxAddress, 'hello@mkety.com'),
        eq(mailMigrationRuns.mode, 'delta'),
        eq(mailMigrationRuns.status, 'completed'),
        eq(mailMigrationRuns.destinationMailboxId, root.hello?.id || ''),
        eq(mailMigrationRuns.failedMessages, 0),
      ),
    });
    if (!run) redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=delta`);
  }
  const [cutover] = root.cutover
    ? [root.cutover]
    : await db
        .insert(mailDomainCutovers)
        .values({ tenantId: root.tenant.id, domainId: root.domain.id, state: 'inventory' })
        .onConflictDoNothing()
        .returning();
  const current =
    cutover ||
    (await db.query.mailDomainCutovers.findFirst({
      where: and(eq(mailDomainCutovers.tenantId, root.tenant.id), eq(mailDomainCutovers.domainId, root.domain.id)),
    }));
  if (!current) throw new Error('Could not create first-party Mail cutover record.');
  const requiresAddressCoverage = ['temporary_inbound', 'outbound_acceptance', 'post_cutover_inbound'].includes(name);
  await db
    .insert(mailDomainCutoverChecks)
    .values({
      tenantId: root.tenant.id,
      cutoverId: current.id,
      checkName: name,
      passed,
      evidenceRef,
      safeDetails: requiresAddressCoverage ? { addresses: root.rows.map((row) => row.address).sort() } : {},
      checkedByUserId: actor.userId,
    })
    .onConflictDoUpdate({
      target: [mailDomainCutoverChecks.cutoverId, mailDomainCutoverChecks.checkName],
      set: {
        passed,
        evidenceRef,
        safeDetails: requiresAddressCoverage ? { addresses: root.rows.map((row) => row.address).sort() } : {},
        checkedByUserId: actor.userId,
        checkedAt: new Date(),
      },
    });
  await logAuditEvent({
    actorId: actor.userId,
    action: `mail.first_party_cutover.check.${name}`,
    entityType: 'mail_domain_cutover',
    entityId: current.id,
    metadata: { tenantId: root.tenant.id, passed },
  });
  revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
  redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
}

export async function prepareFirstPartyMailTestRoutes(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const root = await getFirstPartyRoot(opsTenantSlug);
  const ingress = await db.query.mailDomains.findFirst({
    where: and(eq(mailDomains.tenantId, root.tenant.id), eq(mailDomains.domain, 'mail.mkety.com')),
  });
  if (!ingress?.routingEnabled || !ingress.cloudflareZoneId)
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=test-domain`);
  const prepared: string[] = [];
  for (const mailbox of root.rows) {
    const localPart = `test-mkety-${mailbox.address.slice(0, mailbox.address.indexOf('@')).slice(0, 100)}`;
    const address = `${localPart}@mail.mkety.com`;
    const conflictingMailbox = await db.query.mailMailboxes.findFirst({
      where: and(
        eq(mailMailboxes.tenantId, root.tenant.id),
        eq(mailMailboxes.domainId, ingress.id),
        eq(mailMailboxes.localPart, localPart),
      ),
    });
    if (conflictingMailbox)
      redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=test-address-conflict`);
    const [created] = await db
      .insert(mailMailboxIngressAliases)
      .values({
        tenantId: root.tenant.id,
        mailboxId: mailbox.id,
        domainId: ingress.id,
        localPart,
        status: 'pending',
        createdByUserId: actor.userId,
      })
      .onConflictDoNothing({ target: [mailMailboxIngressAliases.domainId, mailMailboxIngressAliases.localPart] })
      .returning({ id: mailMailboxIngressAliases.id, mailboxId: mailMailboxIngressAliases.mailboxId });
    const alias =
      created ||
      (await db.query.mailMailboxIngressAliases.findFirst({
        where: and(
          eq(mailMailboxIngressAliases.tenantId, root.tenant.id),
          eq(mailMailboxIngressAliases.domainId, ingress.id),
          eq(mailMailboxIngressAliases.localPart, localPart),
        ),
      }));
    if (!alias || alias.mailboxId !== mailbox.id)
      redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=test-address-conflict`);
    try {
      await createCloudflareEmailWorkerRule(ingress.cloudflareZoneId, address);
      await db
        .update(mailMailboxIngressAliases)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(mailMailboxIngressAliases.id, alias.id));
      prepared.push(address);
    } catch {
      await db
        .update(mailMailboxIngressAliases)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(eq(mailMailboxIngressAliases.id, alias.id));
      redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=test-route-pending`);
    }
  }
  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.first_party_test_routes.prepared',
    entityType: 'mail_domain',
    entityId: ingress.id,
    metadata: { tenantId: root.tenant.id, count: prepared.length },
  });
  revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
  redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?testRoutes=${prepared.length}`);
}

export async function removeFirstPartyMailTestRoutes(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const root = await getFirstPartyRoot(opsTenantSlug);
  const ingress = await db.query.mailDomains.findFirst({
    where: and(eq(mailDomains.tenantId, root.tenant.id), eq(mailDomains.domain, 'mail.mkety.com')),
  });
  if (!ingress?.cloudflareZoneId)
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=test-domain`);
  let removed = 0;
  for (const mailbox of root.rows) {
    const localPart = `test-mkety-${mailbox.address.slice(0, mailbox.address.indexOf('@')).slice(0, 100)}`;
    const alias = await db.query.mailMailboxIngressAliases.findFirst({
      where: and(
        eq(mailMailboxIngressAliases.tenantId, root.tenant.id),
        eq(mailMailboxIngressAliases.domainId, ingress.id),
        eq(mailMailboxIngressAliases.localPart, localPart),
        eq(mailMailboxIngressAliases.mailboxId, mailbox.id),
      ),
    });
    if (!alias) continue;
    await deleteCloudflareEmailWorkerRule(ingress.cloudflareZoneId, `${localPart}@mail.mkety.com`);
    await db
      .update(mailMailboxIngressAliases)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(mailMailboxIngressAliases.id, alias.id));
    removed += 1;
  }
  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.first_party_test_routes.removed',
    entityType: 'mail_domain',
    entityId: ingress.id,
    metadata: { tenantId: root.tenant.id, count: removed },
  });
  revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
  redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?testRoutesRemoved=${removed}`);
}

export async function activateFirstPartyMailRootRouting(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  if (String(formData.get('confirm') || '') !== 'CUTOVER mkety.com')
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=confirm`);
  const root = await getFirstPartyRoot(opsTenantSlug);
  if (!root.readiness.ready || !root.cutover)
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=blocked`);
  if (root.cutover.state === 'activated' || root.cutover.state === 'completed')
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=already-active`);
  const dnsSnapshot = await getCloudflareZoneMailDnsRecords(root.domain.cloudflareZoneId!);
  if (
    !dnsSnapshot.some((record) => record.type === 'MX' && record.name.toLowerCase().replace(/\.$/, '') === 'mkety.com')
  ) {
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=rollback-snapshot`);
  }
  await db
    .update(mailDomainCutovers)
    .set({
      state: 'preparing',
      previousDnsRecords: dnsSnapshot,
      authorizedByUserId: actor.userId,
      authorizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(mailDomainCutovers.id, root.cutover.id));
  try {
    await enableRootEmailRoutingAfterCatchAll(root.domain.cloudflareZoneId!, {
      setWorkerCatchAll: setCloudflareEmailCatchAll,
      readCatchAll: getCloudflareEmailCatchAll,
      enableRecipientResolver: async () => {
        await db
          .update(mailDomains)
          .set({ routingEnabled: true, status: 'routing_ready', updatedAt: new Date() })
          .where(eq(mailDomains.id, root.domain.id));
      },
      enableRootEmailRouting: (zoneId) => enableCloudflareEmailRouting(zoneId, 'mkety.com'),
    });
    const routing = await getCloudflareEmailRouting(root.domain.cloudflareZoneId!);
    if (routing?.enabled !== true) throw new Error('mail_root_routing_unverified');
    const routingDns = await getCloudflareEmailRoutingDns(root.domain.cloudflareZoneId!);
    const expectedMx = routingDns
      .filter(
        (record) =>
          record.type?.toUpperCase() === 'MX' && record.name?.toLowerCase().replace(/\.$/, '') === 'mkety.com',
      )
      .map((record) => normalizeCloudflareMxTarget(String(record.content || '')))
      .filter(Boolean)
      .sort();
    const publicMx = await getPublicCloudflareDnsRecords('mkety.com', 'MX');
    const actualMx = publicMx
      .map((record) => normalizeCloudflareMxTarget(record.content))
      .filter(Boolean)
      .sort();
    if (
      !expectedMx.length ||
      expectedMx.length !== actualMx.length ||
      expectedMx.some((record, index) => record !== actualMx[index])
    ) {
      throw new Error('mail_root_public_mx_unverified');
    }
    const sending = await getCloudflareEmailSending(root.domain.cloudflareZoneId!, 'mkety.com');
    const sendingTag = typeof sending?.tag === 'string' ? sending.tag : '';
    const sendingRecords = sendingTag
      ? await getCloudflareEmailSendingDns(root.domain.cloudflareZoneId!, sendingTag)
      : [];
    const publicSendingRecords = await getPublicCloudflareSendingDns(sendingRecords, 'mkety.com');
    if (
      !areCloudflareEmailAuthRecordsPublished(
        'mkety.com',
        Boolean(sending?.enabled),
        sendingRecords,
        publicSendingRecords,
      )
    ) {
      throw new Error('mail_root_sending_dns_unverified');
    }
    await db
      .update(mailDomains)
      .set({ mxStatus: 'verified', routingEnabled: true, status: 'ready', updatedAt: new Date() })
      .where(eq(mailDomains.id, root.domain.id));
    await db
      .update(mailDomainCutovers)
      .set({ state: 'activated', activatedAt: new Date(), updatedAt: new Date() })
      .where(eq(mailDomainCutovers.id, root.cutover.id));
    await logAuditEvent({
      actorId: actor.userId,
      action: 'mail.first_party_root_routing.activated',
      entityType: 'mail_domain',
      entityId: root.domain.id,
      metadata: { tenantId: root.tenant.id, domain: 'mkety.com', route: 'catch_all_worker' },
    });
  } catch {
    await db
      .update(mailDomainCutovers)
      .set({ state: 'needs_reconciliation', updatedAt: new Date() })
      .where(eq(mailDomainCutovers.id, root.cutover.id));
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=reconcile`);
  }
  revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
  redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutover=activated`);
}

export async function completeFirstPartyMailCutover(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const root = await getFirstPartyRoot(opsTenantSlug);
  if (root.cutover?.state !== 'activated')
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=phase`);
  const completion = evaluateMailCutoverCompletion(
    root.checks,
    root.rows.map((row) => row.address),
  );
  if (!completion.ready) redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=post-tests`);
  await db
    .update(mailDomainCutovers)
    .set({ state: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(mailDomainCutovers.id, root.cutover.id));
  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.first_party_root_routing.completed',
    entityType: 'mail_domain',
    entityId: root.domain.id,
    metadata: { tenantId: root.tenant.id, domain: 'mkety.com' },
  });
  revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
  redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutover=completed`);
}

export async function rollbackFirstPartyMailRootRouting(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  if (String(formData.get('confirm') || '') !== 'ROLLBACK mkety.com')
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=rollback-confirm`);
  const root = await getFirstPartyRoot(opsTenantSlug);
  const snapshot = root.cutover?.previousDnsRecords;
  if (!root.cutover || !['activated', 'needs_reconciliation'].includes(root.cutover.state) || !snapshot?.length) {
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=rollback-unavailable`);
  }
  try {
    await disableCloudflareEmailRouting(root.domain.cloudflareZoneId!);
    await restoreCloudflareRootMailDnsRecords(root.domain.cloudflareZoneId!, snapshot);
    const expectedMx = snapshot
      .filter((record) => String(record.type).toUpperCase() === 'MX')
      .map((record) =>
        String(record.content || '')
          .toLowerCase()
          .replace(/\.$/, ''),
      )
      .sort();
    const publicMx = await getPublicCloudflareDnsRecords('mkety.com', 'MX');
    const actualMx = publicMx
      .map(
        (record) =>
          record.content
            .trim()
            .split(/\s+/)
            .find((part) => !/^\d+$/.test(part))
            ?.toLowerCase()
            .replace(/\.$/, '') || '',
      )
      .filter(Boolean)
      .sort();
    if (
      !expectedMx.length ||
      expectedMx.length !== actualMx.length ||
      expectedMx.some((record, index) => record !== actualMx[index])
    ) {
      throw new Error('mail_rollback_public_mx_unverified');
    }
    await db
      .update(mailDomains)
      .set({ routingEnabled: false, status: 'sending_ready', mxStatus: 'pending', updatedAt: new Date() })
      .where(eq(mailDomains.id, root.domain.id));
    await db.delete(mailDomainCutoverChecks).where(eq(mailDomainCutoverChecks.cutoverId, root.cutover.id));
    await db
      .update(mailDomainCutovers)
      .set({ state: 'inventory', rolledBackAt: new Date(), updatedAt: new Date() })
      .where(eq(mailDomainCutovers.id, root.cutover.id));
    await logAuditEvent({
      actorId: actor.userId,
      action: 'mail.first_party_root_routing.rolled_back',
      entityType: 'mail_domain',
      entityId: root.domain.id,
      metadata: { tenantId: root.tenant.id, domain: 'mkety.com' },
    });
  } catch {
    await db
      .update(mailDomainCutovers)
      .set({ state: 'needs_reconciliation', updatedAt: new Date() })
      .where(eq(mailDomainCutovers.id, root.cutover.id));
    redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutoverError=rollback-reconcile`);
  }
  revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
  redirect(`/ops/${opsTenantSlug}/platform-control/mail-operations?mailCutover=rolled-back`);
}
