import { and, count, eq, gte } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  mailCustomerUpdateRecipients,
  mailDomains,
  mailMailboxes,
  mailMessages,
  mailWorkspaces,
} from '@/shared/db/schema';

import { MAIL_INTERNAL_CUSTOM_PROFILE_KEY, resolveTenantMailPlanDisplay, resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from './commercial';
import { requireMailWorkspaceAccess } from './workspace';

function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getCustomerMailUsageSummary(tenantSlug: string, now = new Date()) {
  const { tenant } = await requireMailWorkspaceAccess(tenantSlug);
  const workspace = await db.query.mailWorkspaces.findFirst({
    where: eq(mailWorkspaces.tenantId, tenant.id),
  });
  if (!workspace) return null;

  const planKey = await resolveTenantMailPlanKey(tenant.id, workspace.planKey, tenant.slug);
  const internalCustom = planKey === MAIL_INTERNAL_CUSTOM_PROFILE_KEY;
  const [display, limits] = await Promise.all([
    resolveTenantMailPlanDisplay(tenant.id, planKey),
    resolveTenantMailPlanLimits(tenant.id, planKey),
  ]);
  const periodStart = startOfUtcMonth(now);

  const [domainRows, mailboxRows, sharedRows, outboundRows, updateRows] = await Promise.all([
    db.select({ value: count() }).from(mailDomains).where(eq(mailDomains.tenantId, tenant.id)),
    db.select({ value: count() }).from(mailMailboxes).where(eq(mailMailboxes.tenantId, tenant.id)),
    db.select({ value: count() }).from(mailMailboxes).where(and(
      eq(mailMailboxes.tenantId, tenant.id),
      eq(mailMailboxes.type, 'shared'),
    )),
    db.select({ value: count() }).from(mailMessages).where(and(
      eq(mailMessages.tenantId, tenant.id),
      eq(mailMessages.direction, 'outbound'),
      gte(mailMessages.createdAt, periodStart),
    )),
    db.select({ value: count() }).from(mailCustomerUpdateRecipients).where(and(
      eq(mailCustomerUpdateRecipients.tenantId, tenant.id),
      gte(mailCustomerUpdateRecipients.createdAt, periodStart),
    )),
  ]);

  const internalLimits = {
    domains: null,
    mailboxes: null,
    teamSeats: null,
    sharedInboxes: null,
    storageGb: null,
    outboundMessagesPerMonth: null,
    customerUpdateDeliveriesPerMonth: null,
    maxRecipientsPerCustomerUpdate: 3000,
  };

  return {
    planKey,
    planName: display.name,
    priceMinor: display.amountMinor,
    currency: display.currency,
    termDays: 'termDays' in display ? display.termDays : null,
    periodStart,
    storageBytesUsed: workspace.storageBytesUsed,
    usage: {
      domains: Number(domainRows[0]?.value ?? 0),
      mailboxes: Number(mailboxRows[0]?.value ?? 0),
      sharedInboxes: Number(sharedRows[0]?.value ?? 0),
      outboundMessages: Number(outboundRows[0]?.value ?? 0),
      customerUpdateDeliveries: Number(updateRows[0]?.value ?? 0),
    },
    limits: internalCustom ? internalLimits : limits,
  };
}
