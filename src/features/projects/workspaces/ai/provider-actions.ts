'use server';

import { revalidatePath } from 'next/cache';

import {
  type ByokProviderInput,
  disableByokProviderConnection,
  saveByokProviderConnection,
} from '@/features/ai-runtime/server/provider-connections';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { requireProjectAccess } from '@/features/projects/server/access';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requireWorkspaceByok(tenantSlug: string, projectSlug: string) {
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') throw new Error(access.reason);
  if (!access.canManage) throw new Error('You do not have permission to manage project AI providers.');
  if (!(await hasEntitlement({ tenantId: access.tenant.id, entitlement: 'ai.byok' }))) {
    throw new Error('BYOK access is not enabled for this workspace.');
  }
  return access;
}

function parseProvider(formData: FormData): ByokProviderInput {
  const provider = text(formData, 'provider');
  switch (provider) {
    case 'openai':
      return { provider, apiKey: text(formData, 'apiKey') };
    case 'openai-compatible':
      return { provider, apiKey: text(formData, 'apiKey'), endpoint: text(formData, 'endpoint') };
    case 'azure-openai':
      return { provider, apiKey: text(formData, 'apiKey'), endpoint: text(formData, 'endpoint'), deployment: text(formData, 'deployment') };
    case 'gemini':
      return { provider, apiKey: text(formData, 'apiKey') };
    case 'vertex':
      return { provider, accessToken: text(formData, 'accessToken'), projectId: text(formData, 'vertexProjectId'), location: text(formData, 'location') || 'global' };
    case 'cloudflare-ai':
      return { provider, accountId: text(formData, 'accountId'), apiToken: text(formData, 'apiToken') };
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

export async function saveWorkspaceByokProvider(
  tenantSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const access = await requireWorkspaceByok(tenantSlug, projectSlug);
  await saveByokProviderConnection({
    tenantId: access.tenant.id,
    projectId: access.project.id,
    provider: parseProvider(formData),
  });
  revalidatePath(`/app/${tenantSlug}/projects/${projectSlug}/ai/providers`);
  revalidatePath(`/app/${tenantSlug}/projects/${projectSlug}/ai`);
}

export async function disableWorkspaceByokProvider(
  tenantSlug: string,
  projectSlug: string,
  connectionId: string,
) {
  const access = await requireWorkspaceByok(tenantSlug, projectSlug);
  await disableByokProviderConnection({
    tenantId: access.tenant.id,
    projectId: access.project.id,
    connectionId,
  });
  revalidatePath(`/app/${tenantSlug}/projects/${projectSlug}/ai/providers`);
}
