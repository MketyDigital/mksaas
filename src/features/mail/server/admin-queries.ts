import { and, asc, desc, eq, isNull, like, ne } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { billingPlans, billingPlanVersions, mailDomains, mailEnterpriseOffers, mailWorkspaces, platformEnterpriseOrders, tenants } from '@/shared/db/schema';

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
      resolveTenantMailPlanKey(workspace.tenantId, workspace.mirroredPlanKey, workspace.tenantSlug),
    ]);

    return {
      ...workspace,
      paidPlanKey,
      domains,
    };
  }));

  const catalog = await db
    .select({
      key: billingPlans.key,
      name: billingPlans.name,
      description: billingPlans.description,
      version: billingPlanVersions.version,
      amountMinor: billingPlanVersions.amountMinor,
      currency: billingPlanVersions.currency,
      billingInterval: billingPlanVersions.billingInterval,
      effectiveFrom: billingPlanVersions.effectiveFrom,
    })
    .from(billingPlanVersions)
    .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
    .where(
      and(
        like(billingPlans.key, 'mail-%'),
        eq(billingPlans.status, 'active'),
        eq(billingPlanVersions.isPublic, true),
        isNull(billingPlanVersions.effectiveTo),
      ),
    )
    .orderBy(asc(billingPlans.key));

  const [customers, offers] = await Promise.all([
    db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(ne(tenants.slug, 'mkety-ops'))
      .orderBy(asc(tenants.name))
      .limit(250),
    db.select({
      id: mailEnterpriseOffers.id,
      tenantId: mailEnterpriseOffers.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      name: mailEnterpriseOffers.name,
      amountMinor: mailEnterpriseOffers.amountMinor,
      currency: mailEnterpriseOffers.currency,
      termDays: mailEnterpriseOffers.termDays,
      status: mailEnterpriseOffers.status,
      orderId: mailEnterpriseOffers.orderId,
      createdAt: mailEnterpriseOffers.createdAt,
      redirectUrl: platformEnterpriseOrders.metadata,
    }).from(mailEnterpriseOffers)
      .innerJoin(tenants, eq(tenants.id, mailEnterpriseOffers.tenantId))
      .leftJoin(platformEnterpriseOrders, eq(platformEnterpriseOrders.id, mailEnterpriseOffers.orderId))
      .orderBy(desc(mailEnterpriseOffers.createdAt))
      .limit(50),
  ]);

  return {
    catalog,
    workspaces: rows,
    customers,
    offers: offers.map((offer) => ({
      ...offer,
      paymentUrl: typeof offer.redirectUrl?.redirectUrl === 'string' ? offer.redirectUrl.redirectUrl : null,
      redirectUrl: undefined,
    })),
  };
}
