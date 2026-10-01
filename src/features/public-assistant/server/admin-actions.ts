'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import type { CentralAiProviderId } from '@/features/ai-runtime/providers/external-types';
import {
  type ByokProviderInput,
  disableSystemAiProviderConnection,
  saveSystemAiProviderConnection,
} from '@/features/ai-runtime/server/provider-connections';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import {
  assertCurrentPublicAIModel,
  getDefaultPublicAIModel,
  type PublicAIProviderId,
} from '@/features/public-assistant/models';
import { db } from '@/shared/db/cloudflare';
import { withServerActionDatabase } from '@/shared/db/server-action';
import {
  platformAppControlCenterModules,
  platformAppExperienceRevisions,
} from '@/shared/db/schema/platform-app-experience';
import { requirePermission } from '@/shared/lib/permissions';

const PROVIDERS: readonly PublicAIProviderId[] = [
  'workers-ai',
  'openai',
  'azure-openai',
  'gemini',
  'vertex',
  'cloudflare-ai',
  'bedrock',
];

function isProvider(value: string): value is PublicAIProviderId {
  return PROVIDERS.includes(value as PublicAIProviderId);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requireAiOps(tenantSlug: string) {
  const actor = await requirePlatformControlAccess(tenantSlug);
  await requirePermission(tenantSlug, 'platform:plans');
  return actor;
}

function providerInput(formData: FormData): ByokProviderInput {
  const provider = text(formData, 'provider');
  switch (provider) {
    case 'openai':
      return { provider, apiKey: text(formData, 'apiKey') };
    case 'azure-openai':
      return {
        provider,
        apiKey: text(formData, 'apiKey'),
        endpoint: text(formData, 'endpoint'),
        deployment: text(formData, 'deployment'),
      };
    case 'gemini':
      return { provider, apiKey: text(formData, 'apiKey') };
    case 'vertex':
      return {
        provider,
        accessToken: text(formData, 'accessToken'),
        projectId: text(formData, 'vertexProjectId'),
        location: text(formData, 'location') || 'global',
      };
    case 'cloudflare-ai':
      return {
        provider,
        accountId: text(formData, 'accountId'),
        apiToken: text(formData, 'apiToken'),
      };
    case 'bedrock':
      return {
        provider,
        accessKeyId: text(formData, 'accessKeyId'),
        secretAccessKey: text(formData, 'secretAccessKey'),
        sessionToken: text(formData, 'sessionToken') || undefined,
        region: text(formData, 'region') || 'us-east-1',
      };
    default:
      throw new Error('Choose a supported Public AI provider.');
  }
}

function revalidate(tenantSlug: string) {
  revalidatePath(`/t/${tenantSlug}/admin/platform-control/ai-operations`);
  revalidatePath('/api/public-ai');
}

async function savePublicAiProviderConnectionImpl(tenantSlug: string, formData: FormData) {
  await requireAiOps(tenantSlug);
  await saveSystemAiProviderConnection({
    mode: 'public',
    provider: providerInput(formData),
  });
  revalidate(tenantSlug);
}

async function disablePublicAiProviderConnectionImpl(
  tenantSlug: string,
  providerKey: CentralAiProviderId,
) {
  await requireAiOps(tenantSlug);
  await disableSystemAiProviderConnection({ mode: 'public', providerKey });
  revalidate(tenantSlug);
}

async function updatePublicAiRoutingImpl(tenantSlug: string, formData: FormData) {
  const actor = await requireAiOps(tenantSlug);
  const primaryProviderRaw = text(formData, 'primaryProvider');
  if (!isProvider(primaryProviderRaw)) throw new Error('Choose a valid primary provider.');

  const fallbackProviders = text(formData, 'fallbackProviders')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (!isProvider(value)) throw new Error(`Unsupported Public AI fallback provider: ${value}`);
      return value;
    })
    .filter((provider, index, providers) =>
      provider !== primaryProviderRaw && providers.indexOf(provider) === index);

  const models: Partial<Record<PublicAIProviderId, string>> = {};
  for (const provider of PROVIDERS) {
    const model = text(formData, `model_${provider}`) || getDefaultPublicAIModel(provider);
    assertCurrentPublicAIModel(provider, model);
    models[provider] = model;
  }

  const row = await db.query.platformAppControlCenterModules.findFirst({
    where: eq(platformAppControlCenterModules.moduleKey, 'ai-operations'),
  });
  if (!row) throw new Error('AI Operations control module is not initialized.');

  const currentMetadata =
    row.metadataJson && typeof row.metadataJson === 'object' && !Array.isArray(row.metadataJson)
      ? row.metadataJson as Record<string, unknown>
      : {};
  const before = currentMetadata.publicAiConfig ?? null;
  const publicAiConfig = {
    enabled: formData.get('enabled') === 'on',
    primaryProvider: primaryProviderRaw,
    fallbackProviders,
    models,
  };

  await db.transaction(async (tx) => {
    await tx.update(platformAppControlCenterModules).set({
      metadataJson: { ...currentMetadata, publicAiConfig },
      updatedBy: actor.userId,
      updatedAt: new Date(),
    }).where(eq(platformAppControlCenterModules.id, row.id));

    await tx.insert(platformAppExperienceRevisions).values({
      entityType: 'control_center_module',
      entityId: row.id,
      beforeJson: { publicAiConfig: before },
      afterJson: { publicAiConfig },
      actorId: actor.userId,
    });
  });

  revalidate(tenantSlug);
}

export async function savePublicAiProviderConnection(...args: Parameters<typeof savePublicAiProviderConnectionImpl>) {
  return withServerActionDatabase(() => savePublicAiProviderConnectionImpl(...args));
}

export async function disablePublicAiProviderConnection(...args: Parameters<typeof disablePublicAiProviderConnectionImpl>) {
  return withServerActionDatabase(() => disablePublicAiProviderConnectionImpl(...args));
}

export async function updatePublicAiRouting(...args: Parameters<typeof updatePublicAiRoutingImpl>) {
  return withServerActionDatabase(() => updatePublicAiRoutingImpl(...args));
}
