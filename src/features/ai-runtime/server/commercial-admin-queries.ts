import { asc, desc, eq, gte, sql } from 'drizzle-orm';

import { getPublicAiControlOverview } from '@/features/public-assistant/server/dynamic-config';
import { db } from '@/shared/db/cloudflare';
import { tenants } from '@/shared/db/schema';
import {
  aiModels,
  aiRateCards,
  aiRequests,
  aiRuntimePolicies,
  aiSolutionTemplates,
} from '@/shared/db/schema/ai-runtime';

import { ENTERPRISE_AI_RUNTIME_POLICY_KEY } from './commercial-policy';
import { minimumCustomerRevenueUsdMicros } from './provider-cost';

const DEFAULT_POLICY = {
  key: ENTERPRISE_AI_RUNTIME_POLICY_KEY,
  maxRequestBytes: 1_000_000,
  maxMessages: 128,
  maxTools: 64,
  maxOutputTokens: 32_768,
  reservationTtlSeconds: 120,
  prepaidOnly: true,
  customerInferenceEnabled: false,
  updatedByUserId: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export async function getAiCommercialControlOverview() {
  const profitabilitySince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);

  const [models, rateCards, policy, solutionTemplates, profitabilityRows, publicAi] = await Promise.all([
    db.select().from(aiModels).orderBy(asc(aiModels.displayName)),
    db.select().from(aiRateCards).orderBy(asc(aiRateCards.modelId), desc(aiRateCards.version)),
    db.query.aiRuntimePolicies.findFirst({
      where: eq(aiRuntimePolicies.key, ENTERPRISE_AI_RUNTIME_POLICY_KEY),
    }),
    db.select().from(aiSolutionTemplates).orderBy(asc(aiSolutionTemplates.sortOrder)),
    db
      .select({
        tenantId: aiRequests.tenantId,
        tenantName: tenants.name,
        modelAlias: aiRequests.modelAlias,
        requests: sql<bigint>`count(*)::bigint`,
        settledCredits: sql<bigint>`coalesce(sum(${aiRequests.settledCredits}), 0)::bigint`,
        providerCostUsdMicros: sql<string>`coalesce(sum(
          case
            when (${aiRequests.providerCostMetadata}->>'providerCostUsdMicros') ~ '^[0-9]+$'
              then (${aiRequests.providerCostMetadata}->>'providerCostUsdMicros')::numeric
            else 0
          end
        ), 0)::text`,
      })
      .from(aiRequests)
      .leftJoin(tenants, eq(tenants.id, aiRequests.tenantId))
      .where(gte(aiRequests.startedAt, profitabilitySince))
      .groupBy(aiRequests.tenantId, tenants.name, aiRequests.modelAlias)
      .orderBy(desc(sql`count(*)`))
      .limit(100),
    getPublicAiControlOverview(),
  ]);

  const profitability = profitabilityRows.map((row) => {
    const providerCostUsdMicros = BigInt(row.providerCostUsdMicros);
    return {
      ...row,
      providerCostUsdMicros,
      minimumRevenueUsdMicros: minimumCustomerRevenueUsdMicros(providerCostUsdMicros),
    };
  });

  return {
    models,
    rateCards,
    solutionTemplates,
    profitabilitySince,
    profitability,
    publicAi,
    policy: policy ?? DEFAULT_POLICY,
  };
}
