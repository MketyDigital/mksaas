import { eq } from 'drizzle-orm';

import { MANAGED_AI_MODEL_CANDIDATES } from '../model-candidates';
import { db } from '@/shared/db/cloudflare';
import { aiModelAliases, aiModels } from '@/shared/db/schema';

const EXACT_MODEL_ALIASES: Record<string, string> = {
  'gemma-4': 'gemma-4',
  'glm-5.3-flash': 'glm-5.3-flash',
  'qwen-3.8-27b': 'qwen-3.8-27b',
};

export async function reconcileManagedAiModelCandidates() {
  const reconciled: Array<{ key: string; modelId: string; alias: string }> = [];

  for (const candidate of MANAGED_AI_MODEL_CANDIDATES) {
    const [model] = await db.insert(aiModels).values({
      providerKey: candidate.providerKey,
      nativeModel: candidate.nativeModel,
      displayName: candidate.displayName,
      status: candidate.status,
      managed: true,
      // AI-01 never enables paid inference just because a model is present.
      enabled: false,
      capabilities: candidate.capabilities,
      limits: { contextTokens: candidate.contextTokens },
      providerCostMetadata: {
        currency: 'USD',
        unit: 'per_million_tokens',
        input: candidate.pricingUsdPerMillionTokens.input,
        output: candidate.pricingUsdPerMillionTokens.output,
        cachedInput: candidate.pricingUsdPerMillionTokens.cachedInput ?? null,
        catalogVerifiedAt: '2026-09-28',
        source: 'cloudflare-workers-ai-catalog',
      },
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [aiModels.providerKey, aiModels.nativeModel],
      set: {
        displayName: candidate.displayName,
        status: candidate.status,
        capabilities: candidate.capabilities,
        limits: { contextTokens: candidate.contextTokens },
        providerCostMetadata: {
          currency: 'USD',
          unit: 'per_million_tokens',
          input: candidate.pricingUsdPerMillionTokens.input,
          output: candidate.pricingUsdPerMillionTokens.output,
          cachedInput: candidate.pricingUsdPerMillionTokens.cachedInput ?? null,
          catalogVerifiedAt: '2026-09-28',
          source: 'cloudflare-workers-ai-catalog',
        },
        updatedAt: new Date(),
      },
    }).returning();

    if (!model) throw new Error(`AI model catalog reconciliation did not return ${candidate.key}.`);

    const alias = EXACT_MODEL_ALIASES[candidate.key];
    const existingAlias = await db.query.aiModelAliases.findFirst({
      where: eq(aiModelAliases.alias, alias),
    });

    if (existingAlias) {
      if (existingAlias.modelId !== model.id) {
        throw new Error(`AI model alias ${alias} is already bound to a different model.`);
      }
    } else {
      await db.insert(aiModelAliases).values({
        alias,
        modelId: model.id,
        // Generic stable aliases are selected only after benchmarks.
        stable: false,
      });
    }

    reconciled.push({ key: candidate.key, modelId: model.id, alias });
  }

  return reconciled;
}
