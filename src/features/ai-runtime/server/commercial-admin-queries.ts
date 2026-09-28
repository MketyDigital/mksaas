import { asc, desc, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiModels, aiRateCards, aiRuntimePolicies, aiSolutionTemplates } from '@/shared/db/schema/ai-runtime';

import { ENTERPRISE_AI_RUNTIME_POLICY_KEY } from './commercial-policy';

export async function getAiCommercialControlOverview() {
  const [models, rateCards, policy, solutionTemplates] = await Promise.all([
    db.select().from(aiModels).orderBy(asc(aiModels.displayName)),
    db.select().from(aiRateCards).orderBy(asc(aiRateCards.modelId), desc(aiRateCards.version)),
    db.query.aiRuntimePolicies.findFirst({
      where: eq(aiRuntimePolicies.key, ENTERPRISE_AI_RUNTIME_POLICY_KEY),
    }),
    db.select().from(aiSolutionTemplates).orderBy(asc(aiSolutionTemplates.sortOrder)),
  ]);

  return {
    models,
    rateCards,
    solutionTemplates,
    policy: policy ?? {
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
    },
  };
}
