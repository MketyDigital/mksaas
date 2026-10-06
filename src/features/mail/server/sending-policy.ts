import { and, count, eq, gte } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  mailCustomerUpdateRecipients,
  mailDomains,
  mailMessages,
  mailWorkspaces,
  tenants,
} from '@/shared/db/schema';

import { MAIL_INTERNAL_CUSTOM_PROFILE_KEY, resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from './commercial';

export type MailCapacity = {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  reason?: 'warmup' | 'daily_limit' | 'monthly_limit';
  period: 'daily' | 'monthly';
};

function configuredLimit() {
  const value = Number(process.env.MKETY_MAIL_DAILY_SEND_LIMIT || 3000);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 3000;
}

function domainLimit(createdAt: Date) {
  const ageHours = Math.max(0, (Date.now() - createdAt.getTime()) / 3_600_000);
  const platformLimit = configuredLimit();
  if (ageHours < 24) return Math.min(platformLimit, 500);
  if (ageHours < 72) return Math.min(platformLimit, 1500);
  return platformLimit;
}

function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getMailSendCapacity(
  tenantId: string,
  domainId: string,
  requested = 1,
  category: 'general' | 'customer_update' = 'general',
): Promise<MailCapacity> {
  const [domain, workspace, tenant] = await Promise.all([
    db.query.mailDomains.findFirst({
      where: and(eq(mailDomains.id, domainId), eq(mailDomains.tenantId, tenantId)),
      columns: { createdAt: true },
    }),
    db.query.mailWorkspaces.findFirst({
      where: eq(mailWorkspaces.tenantId, tenantId),
      columns: { planKey: true },
    }),
    db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { slug: true },
    }),
  ]);
  if (!domain || !workspace || !tenant) {
    return { allowed: false, limit: 0, used: 0, remaining: 0, reason: 'daily_limit', period: 'daily' };
  }

  const planKey = await resolveTenantMailPlanKey(tenantId, workspace.planKey, tenant.slug);
  const limits = planKey === MAIL_INTERNAL_CUSTOM_PROFILE_KEY ? null : await resolveTenantMailPlanLimits(tenantId, planKey);
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceMonth = startOfUtcMonth();

  const [dayMessages, dayUpdates, monthMessages, monthUpdates] = await Promise.all([
    db.select({ value: count() }).from(mailMessages).where(and(
      eq(mailMessages.tenantId, tenantId),
      eq(mailMessages.direction, 'outbound'),
      gte(mailMessages.createdAt, sinceDay),
    )),
    db.select({ value: count() }).from(mailCustomerUpdateRecipients).where(and(
      eq(mailCustomerUpdateRecipients.tenantId, tenantId),
      gte(mailCustomerUpdateRecipients.createdAt, sinceDay),
    )),
    db.select({ value: count() }).from(mailMessages).where(and(
      eq(mailMessages.tenantId, tenantId),
      eq(mailMessages.direction, 'outbound'),
      gte(mailMessages.createdAt, sinceMonth),
    )),
    db.select({ value: count() }).from(mailCustomerUpdateRecipients).where(and(
      eq(mailCustomerUpdateRecipients.tenantId, tenantId),
      gte(mailCustomerUpdateRecipients.createdAt, sinceMonth),
    )),
  ]);

  const dailyUsed = Number(dayMessages[0]?.value || 0) + Number(dayUpdates[0]?.value || 0);
  const dailyLimit = domainLimit(domain.createdAt);
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
  if (requested > dailyRemaining) {
    return {
      allowed: false,
      limit: dailyLimit,
      used: dailyUsed,
      remaining: dailyRemaining,
      reason: dailyLimit < configuredLimit() ? 'warmup' : 'daily_limit',
      period: 'daily',
    };
  }

  if (!limits) {
    return {
      allowed: true,
      limit: dailyLimit,
      used: dailyUsed,
      remaining: dailyRemaining,
      period: 'daily',
    };
  }

  const monthlyUsed = category === 'customer_update'
    ? Number(monthUpdates[0]?.value || 0)
    : Number(monthMessages[0]?.value || 0);
  const monthlyLimit = category === 'customer_update'
    ? limits.customerUpdateDeliveriesPerMonth
    : limits.outboundMessagesPerMonth;
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
  if (requested > monthlyRemaining) {
    return {
      allowed: false,
      limit: monthlyLimit,
      used: monthlyUsed,
      remaining: monthlyRemaining,
      reason: 'monthly_limit',
      period: 'monthly',
    };
  }

  return {
    allowed: true,
    limit: monthlyLimit,
    used: monthlyUsed,
    remaining: monthlyRemaining,
    period: 'monthly',
  };
}
