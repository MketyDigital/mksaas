import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  aiEnterpriseCommercialPolicies,
  aiRequests,
  billingPeriods,
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

export async function getEnterpriseAiCostEnvelopeState(
  tenantId: string,
  now = new Date(),
): Promise<EnterpriseAiCostEnvelopeState> {
  const [subscription] = await db.select({
    id: billingSubscriptions.id,
    planVersionId: billingSubscriptions.planVersionId,
  })
    .from(billingSubscriptions)
    .where(and(
      eq(billingSubscriptions.tenantId, tenantId),
      inArray(billingSubscriptions.status, ['active', 'trialing', 'cancel_at_period_end', 'past_due']),
      lt(billingSubscriptions.currentPeriodStart, now),
      gte(billingSubscriptions.currentPeriodEnd, now),
    ))
    .orderBy(sql`${billingSubscriptions.updatedAt} desc`)
    .limit(1);

  if (!subscription) return { applicable: false };

  const [policy, period] = await Promise.all([
    db.query.aiEnterpriseCommercialPolicies.findFirst({
      where: eq(aiEnterpriseCommercialPolicies.planVersionId, subscription.planVersionId),
    }),
    db.query.billingPeriods.findFirst({
      where: and(
        eq(billingPeriods.tenantId, tenantId),
        eq(billingPeriods.subscriptionId, subscription.id),
        lt(billingPeriods.periodStart, now),
        gte(billingPeriods.periodEnd, now),
      ),
      orderBy: (table, { desc }) => [desc(table.periodEnd)],
    }),
  ]);

  if (!policy || !period) return { applicable: false };

  const [[funding], [usage]] = await Promise.all([
    db.select({
      fundedMinor: sql<bigint>`coalesce(sum(${billingSettlements.amountPaidMinor}), 0)::bigint`,
    }).from(billingSettlements).where(and(
      eq(billingSettlements.billingPeriodId, period.id),
      eq(billingSettlements.status, 'applied'),
      inArray(billingSettlements.settlementType, ['payment', 'enterprise_ai_funding']),
    )),
    db.select({
      spentUsdMicros: sql<bigint>`coalesce(sum(
        case
          when (${aiRequests.providerCostMetadata}->>'providerCostUsdMicros') ~ '^[0-9]+$'
            then (${aiRequests.providerCostMetadata}->>'providerCostUsdMicros')::numeric
          else 0
        end
      ), 0)::bigint`,
    }).from(aiRequests).where(and(
      eq(aiRequests.tenantId, tenantId),
      gte(aiRequests.startedAt, period.periodStart),
      lt(aiRequests.startedAt, period.periodEnd),
    )),
  ]);

  const fundedMinor = funding?.fundedMinor ?? 0n;
  const spentUsdMicros = usage?.spentUsdMicros ?? 0n;
  // One USD cent is 10,000 micro-USD. Multiplying cents by basis points
  // directly yields the allowed micro-USD envelope.
  const envelopeUsdMicros = fundedMinor * BigInt(policy.managedCostShareBps);
  const remainingUsdMicros = envelopeUsdMicros > spentUsdMicros
    ? envelopeUsdMicros - spentUsdMicros
    : 0n;

  return {
    applicable: true,
    billingPeriodId: period.id,
    fundedMinor,
    envelopeUsdMicros,
    spentUsdMicros,
    remainingUsdMicros,
    managedCostShareBps: policy.managedCostShareBps,
  };
}

export async function assertEnterpriseAiManagedCostEnvelope(input: {
  tenantId: string;
  estimatedAdditionalCostUsdMicros: bigint;
  now?: Date;
}) {
  const state = await getEnterpriseAiCostEnvelopeState(input.tenantId, input.now);
  if (!state.applicable) return state;
  if (input.estimatedAdditionalCostUsdMicros < 0n) throw new Error('Estimated provider cost cannot be negative.');

  if (state.remainingUsdMicros < input.estimatedAdditionalCostUsdMicros) {
    const error = new Error('Prepaid Enterprise AI capacity is exhausted. Add funds to continue managed AI usage.');
    Object.assign(error, { code: 'ENTERPRISE_AI_MANAGED_COST_ENVELOPE_EXHAUSTED' });
    throw error;
  }
  return state;
}
