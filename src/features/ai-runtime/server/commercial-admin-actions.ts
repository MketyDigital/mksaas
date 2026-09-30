'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db/cloudflare';
import { aiModelAliases, aiModels, aiRateCards, aiRoutes, aiRuntimePolicies, aiSolutionTemplates } from '@/shared/db/schema/ai-runtime';
import { requirePermission } from '@/shared/lib/permissions';

import { ENTERPRISE_AI_RUNTIME_POLICY_KEY } from './commercial-policy';
import { PUBLIC_AI_MODEL_REGISTRY, type PublicAIProviderId } from '@/features/public-assistant/models';

function parsePositiveBigInt(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a positive whole number.`);
  const parsed = BigInt(raw);
  if (parsed <= 0n) throw new Error(`${label} must be greater than zero.`);
  return parsed;
}

function parseIntegerInRange(
  value: FormDataEntryValue | null,
  label: string,
  min: number,
  max: number,
) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

async function requireAiCommercialOps(tenantSlug: string) {
  const actor = await requirePlatformControlAccess(tenantSlug);
  await requirePermission(tenantSlug, 'platform:plans');
  return actor;
}

function revalidateAiOps(tenantSlug: string) {
  revalidatePath(`/t/${tenantSlug}/admin/platform-control/ai-operations`);
  revalidatePath(`/t/${tenantSlug}/admin/platform-control`);
}


const MANAGED_PROVIDER_KEYS = [
  'workers-ai',
  'openai',
  'azure-openai',
  'gemini',
  'vertex',
  'cloudflare-ai',
  'bedrock',
  'openai-compatible',
] as const;

function parseManagedProvider(value: FormDataEntryValue | null) {
  const provider = String(value ?? '').trim();
  if (!(MANAGED_PROVIDER_KEYS as readonly string[]).includes(provider)) {
    throw new Error('Unsupported managed AI provider.');
  }
  return provider;
}

function parseOptionalPositiveBigInt(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return parsePositiveBigInt(raw, label);
}

export async function reconcilePublishedManagedAiCatalog(tenantSlug: string) {
  await requireAiCommercialOps(tenantSlug);

  for (const [providerKey, provider] of Object.entries(PUBLIC_AI_MODEL_REGISTRY) as Array<
    [PublicAIProviderId, (typeof PUBLIC_AI_MODEL_REGISTRY)[PublicAIProviderId]]
  >) {
    for (const definition of provider.models) {
      await db.insert(aiModels).values({
        providerKey,
        nativeModel: definition.id,
        displayName: definition.id,
        status: definition.status === 'current-stable' ? 'candidate' : 'limited',
        managed: true,
        enabled: false,
        capabilities: {
          text: true,
          vision: true,
          embeddings: false,
          tools: true,
          reasoning: true,
          structuredOutput: true,
        },
        limits: { contextTokens: 128_000, maxOutputTokens: 32_768 },
        providerCostMetadata: {},
      }).onConflictDoNothing({
        target: [aiModels.providerKey, aiModels.nativeModel],
      });
    }
  }

  revalidateAiOps(tenantSlug);
}

export async function upsertManagedAiModel(tenantSlug: string, formData: FormData) {
  await requireAiCommercialOps(tenantSlug);
  const providerKey = parseManagedProvider(formData.get('providerKey'));
  const nativeModel = String(formData.get('nativeModel') ?? '').trim().slice(0, 200);
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 160) || nativeModel;
  const alias = String(formData.get('alias') ?? '').trim().slice(0, 128);
  if (!nativeModel) throw new Error('Native model is required.');
  if (!alias || !/^mkety-[a-z0-9][a-z0-9-]{1,80}$/.test(alias)) {
    throw new Error('Managed alias must use the mkety-* format.');
  }

  const contextTokens = parseIntegerInRange(formData.get('contextTokens'), 'Context tokens', 1_024, 10_000_000);
  const maxOutputTokens = parseIntegerInRange(formData.get('maxOutputTokens'), 'Maximum output tokens', 1, 1_000_000);
  const inputCost = parseOptionalPositiveBigInt(formData.get('inputUsdMicrosPerMillion'), 'Input provider cost');
  const cachedCost = parseOptionalPositiveBigInt(formData.get('cachedInputUsdMicrosPerMillion'), 'Cached input provider cost');
  const outputCost = parseOptionalPositiveBigInt(formData.get('outputUsdMicrosPerMillion'), 'Output provider cost');
  const verifiedAt = String(formData.get('providerCostVerifiedAt') ?? '').trim();
  const enabled = formData.get('enabled') === 'on';

  if (enabled && providerKey !== 'workers-ai' && (!inputCost || !outputCost || !verifiedAt)) {
    throw new Error('External managed models require verified input/output provider costs and a verification date before enabling.');
  }

  await db.transaction(async (tx) => {
    const existing = await tx.query.aiModels.findFirst({
      where: and(eq(aiModels.providerKey, providerKey), eq(aiModels.nativeModel, nativeModel)),
    });
    const values = {
      displayName,
      status: enabled ? 'approved' : 'candidate',
      managed: true,
      enabled,
      capabilities: {
        text: true,
        vision: formData.get('vision') === 'on',
        embeddings: false,
        tools: formData.get('tools') === 'on',
        reasoning: formData.get('reasoning') === 'on',
        structuredOutput: formData.get('structuredOutput') === 'on',
      },
      limits: { contextTokens, maxOutputTokens },
      providerCostMetadata: inputCost && outputCost && verifiedAt ? {
        inputUsdMicrosPerMillion: inputCost.toString(),
        ...(cachedCost ? { cachedInputUsdMicrosPerMillion: cachedCost.toString() } : {}),
        outputUsdMicrosPerMillion: outputCost.toString(),
        providerCostVerifiedAt: verifiedAt,
      } : {},
      updatedAt: new Date(),
    };

    let modelId: string;
    if (existing) {
      await tx.update(aiModels).set(values).where(eq(aiModels.id, existing.id));
      modelId = existing.id;
    } else {
      const [created] = await tx.insert(aiModels).values({
        providerKey,
        nativeModel,
        ...values,
      }).returning({ id: aiModels.id });
      if (!created) throw new Error('Managed AI model could not be created.');
      modelId = created.id;
    }

    await tx.insert(aiModelAliases).values({
      alias,
      modelId,
      stable: true,
    }).onConflictDoUpdate({
      target: aiModelAliases.alias,
      set: { modelId, stable: true, updatedAt: new Date() },
    });

    const existingRoute = await tx.query.aiRoutes.findFirst({
      where: and(
        eq(aiRoutes.modelAlias, alias),
        isNull(aiRoutes.tenantId),
        isNull(aiRoutes.projectId),
      ),
    });
    if (existingRoute) {
      await tx.update(aiRoutes).set({
        enabled,
        priority: 100,
        updatedAt: new Date(),
      }).where(eq(aiRoutes.id, existingRoute.id));
    } else {
      await tx.insert(aiRoutes).values({
        tenantId: null,
        projectId: null,
        modelAlias: alias,
        priority: 100,
        enabled,
        policy: {},
      });
    }
  });

  revalidateAiOps(tenantSlug);
}

export async function createAiRateCard(tenantSlug: string, formData: FormData) {
  const actor = await requireAiCommercialOps(tenantSlug);
  const modelId = String(formData.get('modelId') ?? '').trim();
  if (!modelId) throw new Error('Model is required.');

  const model = await db.query.aiModels.findFirst({
    where: eq(aiModels.id, modelId),
    columns: { id: true },
  });
  if (!model) throw new Error('AI model was not found.');

  const latest = await db.query.aiRateCards.findFirst({
    where: eq(aiRateCards.modelId, modelId),
    orderBy: [desc(aiRateCards.version)],
    columns: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  const cachedRaw = String(formData.get('cachedInputCreditsPerMillion') ?? '').trim();
  const effectiveRaw = String(formData.get('effectiveFrom') ?? '').trim();
  const effectiveFrom = effectiveRaw ? new Date(effectiveRaw) : new Date();
  if (Number.isNaN(effectiveFrom.getTime())) throw new Error('Effective date is invalid.');

  await db.insert(aiRateCards).values({
    modelId,
    version,
    status: 'draft',
    inputCreditsPerMillion: parsePositiveBigInt(
      formData.get('inputCreditsPerMillion'),
      'Input credits per million tokens',
    ),
    cachedInputCreditsPerMillion: cachedRaw
      ? parsePositiveBigInt(cachedRaw, 'Cached input credits per million tokens')
      : null,
    outputCreditsPerMillion: parsePositiveBigInt(
      formData.get('outputCreditsPerMillion'),
      'Output credits per million tokens',
    ),
    minimumCreditsPerRequest: parsePositiveBigInt(
      formData.get('minimumCreditsPerRequest'),
      'Minimum credits per request',
    ),
    effectiveFrom,
    createdByUserId: actor.userId,
  });

  revalidateAiOps(tenantSlug);
}

export async function activateAiRateCard(
  tenantSlug: string,
  rateCardId: string,
) {
  await requireAiCommercialOps(tenantSlug);
  const now = new Date();

  await db.transaction(async (tx) => {
    const selected = await tx.query.aiRateCards.findFirst({
      where: eq(aiRateCards.id, rateCardId),
    });
    if (!selected) throw new Error('AI rate card was not found.');
    if (selected.status === 'retired') throw new Error('Retired rate cards cannot be reactivated.');
    if (selected.status === 'active') return;

    await tx
      .update(aiRateCards)
      .set({ status: 'retired', effectiveTo: now })
      .where(and(eq(aiRateCards.modelId, selected.modelId), eq(aiRateCards.status, 'active')));

    await tx
      .update(aiRateCards)
      .set({
        status: 'active',
        effectiveFrom: selected.effectiveFrom > now ? selected.effectiveFrom : now,
        effectiveTo: null,
      })
      .where(eq(aiRateCards.id, selected.id));
  });

  revalidateAiOps(tenantSlug);
}

export async function retireAiRateCard(
  tenantSlug: string,
  rateCardId: string,
) {
  await requireAiCommercialOps(tenantSlug);
  await db
    .update(aiRateCards)
    .set({ status: 'retired', effectiveTo: new Date() })
    .where(eq(aiRateCards.id, rateCardId));
  revalidateAiOps(tenantSlug);
}

export async function updateAiRuntimePolicy(tenantSlug: string, formData: FormData) {
  const actor = await requireAiCommercialOps(tenantSlug);
  const now = new Date();
  const values = {
    maxRequestBytes: parseIntegerInRange(formData.get('maxRequestBytes'), 'Maximum request size', 1024, 5_000_000),
    maxMessages: parseIntegerInRange(formData.get('maxMessages'), 'Maximum messages', 1, 512),
    maxTools: parseIntegerInRange(formData.get('maxTools'), 'Maximum tools', 0, 256),
    maxOutputTokens: parseIntegerInRange(formData.get('maxOutputTokens'), 'Maximum output tokens', 1, 131_072),
    reservationTtlSeconds: parseIntegerInRange(formData.get('reservationTtlSeconds'), 'Reservation TTL', 30, 600),
  };

  await db
    .insert(aiRuntimePolicies)
    .values({
      key: ENTERPRISE_AI_RUNTIME_POLICY_KEY,
      ...values,
      prepaidOnly: true,
      customerInferenceEnabled: false,
      updatedByUserId: actor.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiRuntimePolicies.key,
      set: {
        ...values,
        prepaidOnly: true,
        updatedByUserId: actor.userId,
        updatedAt: now,
      },
    });

  revalidateAiOps(tenantSlug);
}

export async function disableEnterpriseAiInference(tenantSlug: string) {
  const actor = await requireAiCommercialOps(tenantSlug);
  await db
    .update(aiRuntimePolicies)
    .set({
      customerInferenceEnabled: false,
      prepaidOnly: true,
      updatedByUserId: actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(aiRuntimePolicies.key, ENTERPRISE_AI_RUNTIME_POLICY_KEY));
  revalidateAiOps(tenantSlug);
}

export async function updateAiSolutionTemplate(
  tenantSlug: string,
  templateKey: string,
  formData: FormData,
) {
  const actor = await requireAiCommercialOps(tenantSlug);
  const title = String(formData.get('title') ?? '').trim();
  const shortDescription = String(formData.get('shortDescription') ?? '').trim();
  const outcomes = String(formData.get('outcomes') ?? '').split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const setupSteps = String(formData.get('setupSteps') ?? '').split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const sortOrder = parseIntegerInRange(formData.get('sortOrder'), 'Sort order', 0, 10_000);
  const enabled = formData.get('enabled') === 'on';

  if (!title || title.length > 160 || !shortDescription || shortDescription.length > 2_000) {
    throw new Error('Solution title and description are required and must stay within safe limits.');
  }
  if (!outcomes.length || !setupSteps.length) {
    throw new Error('At least one outcome and one setup step are required.');
  }

  await db.update(aiSolutionTemplates).set({
    title,
    shortDescription,
    outcomes,
    setupSteps,
    sortOrder,
    enabled,
    updatedByUserId: actor.userId,
    updatedAt: new Date(),
  }).where(eq(aiSolutionTemplates.key, templateKey));

  revalidateAiOps(tenantSlug);
  revalidatePath('/ai/app');
}
