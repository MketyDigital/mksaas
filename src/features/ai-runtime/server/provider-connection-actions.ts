'use server';

import { revalidatePath } from 'next/cache';

import { runCentralAi } from '@/features/ai-runtime/providers/central-runtime';
import {
  type ByokProviderInput,
  disableByokProviderConnection,
  saveByokProviderConnection,
} from '@/features/ai-runtime/server/provider-connections';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requireByokAccess(tenantSlug: string) {
  await requirePermission(tenantSlug, 'ai:models:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  if (!(await hasEntitlement({ tenantId: tenant.id, entitlement: 'ai.byok' }))) {
    throw new Error('BYOK access is not enabled for this workspace.');
  }
  return tenant;
}

function parseProvider(formData: FormData): ByokProviderInput {
  const provider = text(formData, 'provider');
  switch (provider) {
    case 'openai':
      return { provider, apiKey: text(formData, 'apiKey') };
    case 'openai-compatible':
      return { provider, apiKey: text(formData, 'apiKey'), endpoint: text(formData, 'endpoint') };
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
      throw new Error('Choose a supported AI provider.');
  }
}

export async function saveEnterpriseAiByokProvider(tenantSlug: string, formData: FormData) {
  const tenant = await requireByokAccess(tenantSlug);
  await saveByokProviderConnection({
    tenantId: tenant.id,
    provider: parseProvider(formData),
  });
  revalidatePath(`/app/${tenantSlug}/enterprise-ai/providers`);
}

export async function disableEnterpriseAiByokProvider(
  tenantSlug: string,
  connectionId: string,
) {
  const tenant = await requireByokAccess(tenantSlug);
  await disableByokProviderConnection({ tenantId: tenant.id, connectionId });
  revalidatePath(`/app/${tenantSlug}/enterprise-ai/providers`);
}

export async function testEnterpriseAiByokProvider(
  tenantSlug: string,
  connectionId: string,
  formData: FormData,
) {
  const tenant = await requireByokAccess(tenantSlug);
  const model = text(formData, 'model');
  const result = await runCentralAi({
    tenantId: tenant.id,
    providerConnectionId: connectionId,
    model: model.trim() || null,
    system: 'You are a provider connection diagnostic. Follow the user instruction exactly.',
    messages: [{ role: 'user', content: 'Reply only with: MKETY_BYOK_OK' }],
    maxOutputTokens: 64,
    idempotencyKey: `byok-test-${connectionId}-${crypto.randomUUID()}`,
  });
  if (result.text.trim() !== 'MKETY_BYOK_OK') {
    throw new Error('Provider responded, but the connection diagnostic did not return the expected result.');
  }
  void result;
}

