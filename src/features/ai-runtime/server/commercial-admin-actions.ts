'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db/cloudflare';
import { aiModels, aiRateCards, aiRuntimePolicies, aiSolutionTemplates } from '@/shared/db/schema/ai-runtime';
import { requirePermission } from '@/shared/lib/permissions';

import { ENTERPRISE_AI_RUNTIME_POLICY_KEY } from './commercial-policy';

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
