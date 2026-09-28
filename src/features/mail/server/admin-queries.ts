import { asc, desc, eq } from 'drizzle-orm';

import { SELF_SERVICE_BILLING_PLANS } from '@/features/billing/catalog/self-service-plans';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailWorkspaces, tenants } from '@/shared/db/schema';

import { resolveTenantMailPlanKey } from './commercial';

export async function getMailOperationsOverview(limit = 100) {
  const workspaces = await db
    .select({
      workspaceId: mailWorkspaces.id,
      tenantId: mailWorkspaces.tenantId,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      status: mailWorkspaces.status,
      mirroredPlanKey: mailWorkspaces.planKey,
      onboardingStep: mailWorkspaces.onboardingStep,
      storageBytesUsed: mailWorkspaces.storageBytesUsed,
      enabledAt: mailWorkspaces.enabledAt,
      updatedAt: mailWorkspaces.updatedAt,
    })
    .from(mailWorkspaces)
    .innerJoin(tenants, eq(tenants.id, mailWorkspaces.tenantId))
    .orderBy(desc(mailWorkspaces.updatedAt))
    .limit(limit);

  const rows = await Promise.all(workspaces.map(async (workspace) => {
    const [domains, paidPlanKey] = await Promise.all([
      db
        .select({
          id: mailDomains.id,
          domain: mailDomains.domain,
          status: mailDomains.status,
          sendingEnabled: mailDomains.sendingEnabled,
          routingEnabled: mailDomains.routingEnabled,
          spfStatus: mailDomains.spfStatus,
          dkimStatus: mailDomains.dkimStatus,
          dmarcStatus: mailDomains.dmarcStatus,
          mxStatus: mailDomains.mxStatus,
          verifiedAt: mailDomains.verifiedAt,
        })
        .from(mailDomains)
        .where(eq(mailDomains.tenantId, workspace.tenantId))
        .orderBy(asc(mailDomains.domain)),
      resolveTenantMailPlanKey(workspace.tenantId, workspace.mirroredPlanKey),
    ]);

    return {
      ...workspace,
      paidPlanKey,
      domains,
    };
  }));

  return {
    catalog: Object.values(SELF_SERVICE_BILLING_PLANS)
      .filter((plan) => plan.key.startsWith('mail-'))
      .map((plan) => ({
        key: plan.key,
        name: plan.name,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
      })),
    workspaces: rows,
  };
}
