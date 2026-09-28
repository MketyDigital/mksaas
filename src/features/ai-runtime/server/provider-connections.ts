import { and, eq } from 'drizzle-orm';

import {
  createCentralExternalProvider,
  isCentralAiProviderId,
  type CentralAiProviderCredentials,
} from '@/features/ai-runtime/providers/external';
import type { CentralAiProviderId } from '@/features/ai-runtime/providers/external-types';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections, projects } from '@/shared/db/schema';
import { env } from '@/shared/lib/env';

import { decryptAiProviderSecret, encryptAiProviderSecret } from './byok-secrets';

export type ByokProviderInput =
  | { provider: 'openai'; apiKey: string }
  | { provider: 'azure-openai'; apiKey: string; endpoint: string; deployment: string }
  | { provider: 'gemini'; apiKey: string }
  | { provider: 'vertex'; accessToken: string; projectId: string; location?: string }
  | { provider: 'cloudflare-ai'; accountId: string; apiToken: string }
  | { provider: 'bedrock'; accessKeyId: string; secretAccessKey: string; sessionToken?: string; region?: string };

function encryptionKey() {
  const key = env.MKETY_AI_BYOK_ENCRYPTION_KEY;
  if (!key) throw new Error('BYOK secret encryption is not configured.');
  return key;
}

function nonEmpty(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function normalizeInput(input: ByokProviderInput): {
  providerKey: CentralAiProviderId;
  secret: Record<string, string>;
  metadata: Record<string, string>;
  endpointUrl: string | null;
} {
  switch (input.provider) {
    case 'openai':
      return {
        providerKey: input.provider,
        secret: { apiKey: nonEmpty(input.apiKey, 'OpenAI API key') },
        metadata: {},
        endpointUrl: null,
      };
    case 'azure-openai':
      return {
        providerKey: input.provider,
        secret: { apiKey: nonEmpty(input.apiKey, 'Azure OpenAI API key') },
        metadata: { deployment: nonEmpty(input.deployment, 'Azure OpenAI deployment') },
        endpointUrl: new URL(nonEmpty(input.endpoint, 'Azure OpenAI endpoint')).toString().replace(/\/+$/, ''),
      };
    case 'gemini':
      return {
        providerKey: input.provider,
        secret: { apiKey: nonEmpty(input.apiKey, 'Gemini API key') },
        metadata: {},
        endpointUrl: null,
      };
    case 'vertex':
      return {
        providerKey: input.provider,
        secret: { accessToken: nonEmpty(input.accessToken, 'Vertex access token') },
        metadata: {
          projectId: nonEmpty(input.projectId, 'Vertex project ID'),
          location: input.location?.trim() || 'global',
        },
        endpointUrl: null,
      };
    case 'cloudflare-ai':
      return {
        providerKey: input.provider,
        secret: { apiToken: nonEmpty(input.apiToken, 'Cloudflare AI API token') },
        metadata: { accountId: nonEmpty(input.accountId, 'Cloudflare account ID') },
        endpointUrl: null,
      };
    case 'bedrock':
      return {
        providerKey: input.provider,
        secret: {
          accessKeyId: nonEmpty(input.accessKeyId, 'AWS access key ID'),
          secretAccessKey: nonEmpty(input.secretAccessKey, 'AWS secret access key'),
          ...(input.sessionToken?.trim() ? { sessionToken: input.sessionToken.trim() } : {}),
        },
        metadata: { region: input.region?.trim() || 'us-east-1' },
        endpointUrl: null,
      };
  }
}

async function assertProjectScope(tenantId: string, projectId: string | null) {
  if (!projectId) return;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)),
    columns: { id: true },
  });
  if (!project) throw new Error('AI provider project is not available to this tenant.');
}

export async function saveByokProviderConnection(input: {
  tenantId: string;
  projectId?: string | null;
  provider: ByokProviderInput;
}) {
  const projectId = input.projectId ?? null;
  await assertProjectScope(input.tenantId, projectId);
  const normalized = normalizeInput(input.provider);
  const secretRef = await encryptAiProviderSecret(normalized.secret, encryptionKey());
  const now = new Date();

  const existing = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.tenantId, input.tenantId),
      projectId === null
        ? eq(aiProviderConnections.projectId, null as never)
        : eq(aiProviderConnections.projectId, projectId),
      eq(aiProviderConnections.providerKey, normalized.providerKey),
      eq(aiProviderConnections.mode, 'byok'),
    ),
  });

  if (existing) {
    const [updated] = await db.update(aiProviderConnections)
      .set({
        secretRef,
        endpointUrl: normalized.endpointUrl,
        metadata: normalized.metadata,
        status: 'active',
        updatedAt: now,
      })
      .where(and(
        eq(aiProviderConnections.id, existing.id),
        eq(aiProviderConnections.tenantId, input.tenantId),
      ))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db.insert(aiProviderConnections).values({
    tenantId: input.tenantId,
    projectId,
    providerKey: normalized.providerKey,
    mode: 'byok',
    secretRef,
    endpointUrl: normalized.endpointUrl,
    status: 'active',
    metadata: normalized.metadata,
    updatedAt: now,
  }).returning();
  if (!created) throw new Error('AI provider connection creation did not return a record.');
  return created;
}

export async function disableByokProviderConnection(input: { tenantId: string; connectionId: string }) {
  const [row] = await db.update(aiProviderConnections)
    .set({ status: 'disabled', updatedAt: new Date() })
    .where(and(
      eq(aiProviderConnections.id, input.connectionId),
      eq(aiProviderConnections.tenantId, input.tenantId),
      eq(aiProviderConnections.mode, 'byok'),
    ))
    .returning();
  return row ?? null;
}

export async function resolveByokProviderConnection(input: {
  tenantId: string;
  projectId?: string | null;
  connectionId: string;
}) {
  const row = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.id, input.connectionId),
      eq(aiProviderConnections.tenantId, input.tenantId),
      eq(aiProviderConnections.status, 'active'),
      eq(aiProviderConnections.mode, 'byok'),
    ),
  });
  if (!row) throw new Error('BYOK provider connection is not active.');
  if (row.projectId && row.projectId !== (input.projectId ?? null)) {
    throw new Error('BYOK provider connection is outside the requested project scope.');
  }
  if (!isCentralAiProviderId(row.providerKey)) {
    throw new Error('BYOK provider is not supported by the central Mkety AI runtime.');
  }
  if (!row.secretRef) throw new Error('BYOK provider secret is not configured.');

  const secret = await decryptAiProviderSecret(row.secretRef, encryptionKey());
  const metadata = row.metadata ?? {};
  let credentials: CentralAiProviderCredentials;

  switch (row.providerKey) {
    case 'openai':
      credentials = { provider: 'openai', apiKey: nonEmpty(secret.apiKey ?? '', 'OpenAI API key') };
      break;
    case 'azure-openai':
      credentials = {
        provider: 'azure-openai',
        apiKey: nonEmpty(secret.apiKey ?? '', 'Azure OpenAI API key'),
        endpoint: nonEmpty(row.endpointUrl ?? '', 'Azure OpenAI endpoint'),
        deployment: nonEmpty(String(metadata.deployment ?? ''), 'Azure OpenAI deployment'),
      };
      break;
    case 'gemini':
      credentials = { provider: 'gemini', apiKey: nonEmpty(secret.apiKey ?? '', 'Gemini API key') };
      break;
    case 'vertex':
      credentials = {
        provider: 'vertex',
        accessToken: nonEmpty(secret.accessToken ?? '', 'Vertex access token'),
        projectId: nonEmpty(String(metadata.projectId ?? ''), 'Vertex project ID'),
        location: String(metadata.location ?? 'global'),
      };
      break;
    case 'cloudflare-ai':
      credentials = {
        provider: 'cloudflare-ai',
        accountId: nonEmpty(String(metadata.accountId ?? ''), 'Cloudflare account ID'),
        apiToken: nonEmpty(secret.apiToken ?? '', 'Cloudflare AI API token'),
      };
      break;
    case 'bedrock':
      credentials = {
        provider: 'bedrock',
        accessKeyId: nonEmpty(secret.accessKeyId ?? '', 'AWS access key ID'),
        secretAccessKey: nonEmpty(secret.secretAccessKey ?? '', 'AWS secret access key'),
        ...(secret.sessionToken ? { sessionToken: secret.sessionToken } : {}),
        region: String(metadata.region ?? 'us-east-1'),
      };
      break;
  }

  return {
    connection: row,
    adapter: createCentralExternalProvider(credentials),
  };
}
