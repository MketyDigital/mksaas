import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  billingPlans,
  billingPlanVersionEntitlements,
  billingPlanVersions,
} from '@/shared/db/schema';

import { SELF_SERVICE_BILLING_PLANS } from '../catalog/self-service-plans';

export interface BillingCatalogSeedResult {
  plansCreated: number;
  planMetadataRefreshed: number;
  versionsCreated: number;
  entitlementsCreated: number;
}

export async function seedSelfServiceBillingCatalog(): Promise<BillingCatalogSeedResult> {
  const result: BillingCatalogSeedResult = {
    plansCreated: 0,
    planMetadataRefreshed: 0,
    versionsCreated: 0,
    entitlementsCreated: 0,
  };

  for (const plan of Object.values(SELF_SERVICE_BILLING_PLANS)) {
    let [planRow] = await db.select().from(billingPlans).where(eq(billingPlans.key, plan.key)).limit(1);

    if (!planRow) {
      [planRow] = await db
        .insert(billingPlans)
        .values({
          key: plan.key,
          name: plan.name,
          description: plan.description,
          status: 'active',
        })
        .returning();
      result.plansCreated += 1;
    } else if (
      planRow.name !== plan.name ||
      planRow.description !== plan.description ||
      planRow.status !== 'active'
    ) {
      [planRow] = await db
        .update(billingPlans)
        .set({
          name: plan.name,
          description: plan.description,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(billingPlans.id, planRow.id))
        .returning();
      result.planMetadataRefreshed += 1;
    }

    const [activeVersion] = await db
      .select()
      .from(billingPlanVersions)
      .where(and(eq(billingPlanVersions.planId, planRow.id), isNull(billingPlanVersions.effectiveTo)))
      .orderBy(desc(billingPlanVersions.version))
      .limit(1);

    let versionRow = activeVersion;
    if (!versionRow) {
      const [latestVersion] = await db
        .select({ version: billingPlanVersions.version })
        .from(billingPlanVersions)
        .where(eq(billingPlanVersions.planId, planRow.id))
        .orderBy(desc(billingPlanVersions.version))
        .limit(1);

      [versionRow] = await db
        .insert(billingPlanVersions)
        .values({
          planId: planRow.id,
          version: (latestVersion?.version ?? 0) + 1,
          amountMinor: plan.amountMinor,
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          isPublic: true,
          metadataReference: `self-service:${plan.key}`,
          effectiveFrom: new Date(),
        })
        .returning();
      result.versionsCreated += 1;
    } else {
      const matchesCanonicalVersion =
        versionRow.amountMinor === plan.amountMinor &&
        versionRow.currency === plan.currency &&
        versionRow.billingInterval === plan.billingInterval &&
        versionRow.isPublic;

      if (!matchesCanonicalVersion) {
        throw new Error(
          `Active billing version for ${plan.key} conflicts with the canonical self-service catalog. Create a new explicit plan version instead of rewriting history.`,
        );
      }
    }

    for (const entitlementKey of plan.entitlements) {
      const inserted = await db
        .insert(billingPlanVersionEntitlements)
        .values({
          planVersionId: versionRow.id,
          entitlementKey,
          enabled: true,
        })
        .onConflictDoNothing()
        .returning({ id: billingPlanVersionEntitlements.id });
      result.entitlementsCreated += inserted.length;
    }
  }

  return result;
}
