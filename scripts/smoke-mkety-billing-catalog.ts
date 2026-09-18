import { and, desc, eq, isNull } from 'drizzle-orm';

import { SELF_SERVICE_BILLING_PLANS } from '../src/features/billing/catalog/self-service-plans';
import { db } from '../src/shared/db';
import {
  billingPlans,
  billingPlanVersionEntitlements,
  billingPlanVersions,
} from '../src/shared/db/schema';

function assertSmoke(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Billing catalog smoke failed: ${message}`);
}

async function main() {
  for (const plan of Object.values(SELF_SERVICE_BILLING_PLANS)) {
    const [planRow] = await db
      .select()
      .from(billingPlans)
      .where(and(eq(billingPlans.key, plan.key), eq(billingPlans.status, 'active')))
      .limit(1);

    assertSmoke(planRow, `missing active billing plan ${plan.key}`);

    const [version] = await db
      .select()
      .from(billingPlanVersions)
      .where(
        and(
          eq(billingPlanVersions.planId, planRow.id),
          eq(billingPlanVersions.isPublic, true),
          isNull(billingPlanVersions.effectiveTo),
        ),
      )
      .orderBy(desc(billingPlanVersions.version))
      .limit(1);

    assertSmoke(version, `missing active public version for ${plan.key}`);
    assertSmoke(version.amountMinor === plan.amountMinor, `amount mismatch for ${plan.key}`);
    assertSmoke(version.currency === plan.currency, `currency mismatch for ${plan.key}`);
    assertSmoke(version.billingInterval === plan.billingInterval, `interval mismatch for ${plan.key}`);

    const entitlements = await db
      .select({ entitlementKey: billingPlanVersionEntitlements.entitlementKey })
      .from(billingPlanVersionEntitlements)
      .where(
        and(
          eq(billingPlanVersionEntitlements.planVersionId, version.id),
          eq(billingPlanVersionEntitlements.enabled, true),
        ),
      );

    const enabled = new Set(entitlements.map((row) => row.entitlementKey));
    for (const entitlement of plan.entitlements) {
      assertSmoke(enabled.has(entitlement), `missing ${entitlement} grant for ${plan.key}`);
    }
  }

  console.log('✅ Mkety self-service Billing catalog smoke passed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
