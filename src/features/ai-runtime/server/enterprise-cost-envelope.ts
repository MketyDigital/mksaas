import { and, eq, gt, gte, inArray, isNotNull, lt, lte, or, sql } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  aiEnterpriseCommercialPolicies,
  aiRequests,
  billingPeriods,
  billingPlans,
  billingPlanVersions,
  billingSettlements,
  billingSubscriptions,
} from '@/shared/db/schema';

export type EnterpriseAiCostEnvelopeState =
  | { applicable: false }
  | {
      applicable: true;
      billingPeriodId: string;
      fundedMinor: bigint;
      envelopeUsdMicros: bigint;
      spentUsdMicros: bigint;
      remainingUsdMicros: bigint;
      managedCostShareBps: number;
    };

type EnvelopeDatabase = Pick<typeof db, 'select' | 'query'>;

async function readEnvelope(database: EnvelopeDatabase, tenantId: string, now: Date): Promise<EnterpriseAiCostEnvelopeState> {
  const [subscription] = await database.select({
    id: billingSubscriptions.id,
    managedCostShareBps: aiEnterpriseCommercialPolicies.managedCostShareBps,
  }).from(billingSubscriptions)
    .innerJoin(billingPlanVersions, eq(billingPlanVersions.id, billingSubscriptions.planVersionId))
    .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
    .leftJoin(aiEnterpriseCommercialPolicies,
      eq(aiEnterpriseCommercialPolicies.planVersionId, billingSubscriptions.planVersionId))
    .where(and(
      eq(billingSubscriptions.tenantId, tenantId),
      or(isNotNull(aiEnterpriseCommercialPolicies.planVersionId), eq(billingPlans.key, `enterprise-ai-contract-${tenantId}`)),
      inArray(billingSubscriptions.status, ['active', 'trialing', 'cancel_at_period_end', 'past_due']),
      lte(billingSubscriptions.currentPeriodStart, now),
      gt(billingSubscriptions.currentPeriodEnd, now),
    )).orderBy(sql`${billingSubscriptions.updatedAt} desc`).limit(1);
  if (!subscription) return { applicable: false };
  if (subscription.managedCostShareBps === null) throw new Error('Enterprise AI commercial policy is unavailable.');

  const period = await database.query.billingPeriods.findFirst({
    where: and(
      eq(billingPeriods.tenantId, tenantId),
      eq(billingPeriods.subscriptionId, subscription.id),
      lte(billingPeriods.periodStart, now),
      gt(billingPeriods.periodEnd, now),
    ),
    orderBy: (table, { desc }) => [desc(table.periodEnd)],
  });
  if (!period) throw new Error('Enterprise AI billing period is unavailable.');

  const [[funding], [usage]] = await Promise.all([
    database.select({
      fundedMinor: sql<string>`coalesce(sum(${billingSettlements.amountPaidMinor}), 0)::bigint`,
    }).from(billingSettlements).where(and(
      eq(billingSettlements.tenantId, tenantId),
      eq(billingSettlements.billingPeriodId, period.id),
      eq(billingSettlements.status, 'applied'),
      inArray(billingSettlements.settlementType, ['payment', 'enterprise_ai_funding']),
    )),
    database.select({
      spentUsdMicros: sql<string>`coalesce(sum(greatest(
        case when (${aiRequests.providerCostMetadata}->>'providerCostUsdMicros') ~ '^[0-9]+$'
          then (${aiRequests.providerCostMetadata}->>'providerCostUsdMicros')::numeric else 0 end,
        case when ${aiRequests.status} in ('admitting', 'authorized', 'reconciliation_required')
          and (${aiRequests.providerCostMetadata}->>'reservedProviderCostUsdMicros') ~ '^[0-9]+$'
          then (${aiRequests.providerCostMetadata}->>'reservedProviderCostUsdMicros')::numeric else 0 end
      )), 0)::bigint`,
    }).from(aiRequests).where(and(
      eq(aiRequests.tenantId, tenantId),
      gte(aiRequests.startedAt, period.periodStart),
      lt(aiRequests.startedAt, period.periodEnd),
    )),
  ]);

  // Aggregate SQL expressions do not inherit bigint column decoders. Both
  // Postgres.js and embedded PostgreSQL may return int8 aggregates as strings.
  const fundedMinor = BigInt(funding?.fundedMinor ?? 0);
  const spentUsdMicros = BigInt(usage?.spentUsdMicros ?? 0);
  const envelopeUsdMicros = fundedMinor * BigInt(subscription.managedCostShareBps);
  return {
    applicable: true,
    billingPeriodId: period.id,
    fundedMinor,
    envelopeUsdMicros,
    spentUsdMicros,
    remainingUsdMicros: envelopeUsdMicros > spentUsdMicros ? envelopeUsdMicros - spentUsdMicros : 0n,
    managedCostShareBps: subscription.managedCostShareBps,
  };
}

export async function getEnterpriseAiCostEnvelopeState(tenantId: string, now = new Date()) {
  return readEnvelope(db, tenantId, now);
}

export async function assertEnterpriseAiManagedCostEnvelope(input: {
  tenantId: string;
  requestId?: string;
  estimatedAdditionalCostUsdMicros: bigint;
  now?: Date;
}) {
  if (input.estimatedAdditionalCostUsdMicros < 0n) throw new Error('Estimated provider cost cannot be negative.');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`enterprise-managed-cost:${input.tenantId}`}, 0))`);
    const state = await readEnvelope(tx, input.tenantId, input.now ?? new Date());
    if (!state.applicable) return state;
    if (state.remainingUsdMicros < input.estimatedAdditionalCostUsdMicros) {
      throw Object.assign(new Error('Prepaid Enterprise AI capacity is exhausted. Add funds to continue managed AI usage.'),
        { code: 'ENTERPRISE_AI_MANAGED_COST_ENVELOPE_EXHAUSTED' });
    }
    if (input.requestId) {
      const [held] = await tx.update(aiRequests).set({
        providerCostMetadata: sql`${aiRequests.providerCostMetadata} || ${JSON.stringify({
          reservedProviderCostUsdMicros: input.estimatedAdditionalCostUsdMicros.toString(),
          providerCostEnvelopePeriodId: state.billingPeriodId,
        })}::jsonb`,
      }).where(and(
        eq(aiRequests.id, input.requestId),
        eq(aiRequests.tenantId, input.tenantId),
        eq(aiRequests.status, 'admitting'),
      )).returning({ id: aiRequests.id });
      if (!held) throw new Error('Enterprise AI provider cost reservation is unavailable.');
    }
    return state;
  });
}
