import { and, eq, isNull } from 'drizzle-orm';

import {
  type CentralAiProviderCredentials,
  createCentralExternalProvider,
  isCentralAiProviderId,
} from '@/features/ai-runtime/providers/external';
import type { CentralAiProviderId } from '@/features/ai-runtime/providers/external-types';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections, projects } from '@/shared/db/schema';

import { getConnectionEncryptionKey } from '@/shared/security/connection-secrets';
import { assertPublicHttpsUrl } from '@/shared/security/outbound-url';

import { decryptAiProviderSecret, encryptAiProviderSecret } from './byok-secrets';

export type ByokProviderInput =
  | { provider: 'openai'; apiKey: string }
  | { provider: 'azure-openai'; apiKey: string; endpoint: string; deployment: string }
  | { provider: 'gemini'; apiKey: string }
  | { provider: 'vertex'; accessToken: string; projectId: string; location?: string }
  | { provider: 'cloudflare-ai'; accountId: string; apiToken: string }
  | { provider: 'bedrock'; accessKeyId: string; secretAccessKey: string; sessionToken?: string; region?: string }
  | { provider: 'openai-compatible'; apiKey: string; endpoint: string };

function encryptionKey() {
  return getConnectionEncryptionKey();
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
        endpointUrl: assertPublicHttpsUrl(
          nonEmpty(input.endpoint, 'Azure OpenAI endpoint'),
          {
            label: 'Azure OpenAI endpoint',
            allowedSuffixes: ['.openai.azure.com', '.services.ai.azure.com'],
          },
        ).toString().replace(/\/+$/, ''),
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
    case 'openai-compatible':
      return {
        providerKey: input.provider,
        secret: { apiKey: nonEmpty(input.apiKey, 'OpenAI-compatible API key') },
        metadata: {},
        endpointUrl: assertPublicHttpsUrl(
          nonEmpty(input.endpoint, 'OpenAI-compatible endpoint'),
          { label: 'OpenAI-compatible endpoint' },
        ).toString().replace(/\/+$/, ''),
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
        ? isNull(aiProviderConnections.projectId)
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

export async function disableByokProviderConnection(input: {
  tenantId: string;
  connectionId: string;
  projectId?: string | null;
}) {
  const scope = input.projectId === undefined
    ? undefined
    : input.projectId === null
      ? isNull(aiProviderConnections.projectId)
      : eq(aiProviderConnections.projectId, input.projectId);

  const [row] = await db.update(aiProviderConnections)
    .set({ status: 'disabled', updatedAt: new Date() })
    .where(and(
      eq(aiProviderConnections.id, input.connectionId),
      eq(aiProviderConnections.tenantId, input.tenantId),
      eq(aiProviderConnections.mode, 'byok'),
      scope,
    ))
    .returning();
  return row ?? null;
}

function adapterFromConnection(row: {
  providerKey: string;
  secretRef: string | null;
  endpointUrl: string | null;
  metadata: Record<string, unknown>;
}) {
  if (!isCentralAiProviderId(row.providerKey)) {
    throw new Error('AI provider is not supported by the central Mkety AI runtime.');
  }
  if (!row.secretRef) throw new Error('AI provider secret is not configured.');

  return decryptAiProviderSecret(row.secretRef, encryptionKey()).then((secret) => {
    const metadata = row.metadata ?? {};
    let credentials: CentralAiProviderCredentials | null = null;

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
      case 'openai-compatible':
        credentials = {
          provider: 'openai-compatible',
          apiKey: nonEmpty(secret.apiKey ?? '', 'OpenAI-compatible API key'),
          endpoint: nonEmpty(row.endpointUrl ?? '', 'OpenAI-compatible endpoint'),
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

    if (!credentials) throw new Error('AI provider credentials could not be resolved.');
    return createCentralExternalProvider(credentials);
  });
}

export async function saveSystemAiProviderConnection(input: {
  mode: 'public' | 'platform';
  provider: ByokProviderInput;
}) {
  const normalized = normalizeInput(input.provider);
  const secretRef = await encryptAiProviderSecret(normalized.secret, encryptionKey());
  const now = new Date();

  const existing = await db.query.aiProviderConnections.findFirst({
    where: and(
      isNull(aiProviderConnections.tenantId),
      isNull(aiProviderConnections.projectId),
      eq(aiProviderConnections.providerKey, normalized.providerKey),
      eq(aiProviderConnections.mode, input.mode),
    ),
  });

  if (existing) {
    const [updated] = await db.update(aiProviderConnections).set({
      secretRef,
      endpointUrl: normalized.endpointUrl,
      metadata: normalized.metadata,
      status: 'active',
      updatedAt: now,
    }).where(eq(aiProviderConnections.id, existing.id)).returning();
    return updated ?? existing;
  }

  const [created] = await db.insert(aiProviderConnections).values({
    tenantId: null,
    projectId: null,
    providerKey: normalized.providerKey,
    mode: input.mode,
    secretRef,
    endpointUrl: normalized.endpointUrl,
    status: 'active',
    metadata: normalized.metadata,
    updatedAt: now,
  }).returning();
  if (!created) throw new Error('System AI provider connection creation did not return a record.');
  return created;
}

export async function listSystemAiProviderConnections(mode: 'public' | 'platform') {
  return db.query.aiProviderConnections.findMany({
    where: and(
      isNull(aiProviderConnections.tenantId),
      isNull(aiProviderConnections.projectId),
      eq(aiProviderConnections.mode, mode),
    ),
    columns: {
      id: true,
      providerKey: true,
      mode: true,
      endpointUrl: true,
      status: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function resolveSystemAiProviderConnection(input: {
  mode: 'public' | 'platform';
  providerKey: CentralAiProviderId;
}) {
  const row = await db.query.aiProviderConnections.findFirst({
    where: and(
      isNull(aiProviderConnections.tenantId),
      isNull(aiProviderConnections.projectId),
      eq(aiProviderConnections.providerKey, input.providerKey),
      eq(aiProviderConnections.mode, input.mode),
      eq(aiProviderConnections.status, 'active'),
    ),
  });
  if (!row) throw new Error(`${input.mode} AI provider connection is not active.`);
  return { connection: row, adapter: await adapterFromConnection(row) };
}

export async function disableSystemAiProviderConnection(input: {
  mode: 'public' | 'platform';
  providerKey: CentralAiProviderId;
}) {
  const [row] = await db.update(aiProviderConnections).set({
    status: 'disabled',
    updatedAt: new Date(),
  }).where(and(
    isNull(aiProviderConnections.tenantId),
    isNull(aiProviderConnections.projectId),
    eq(aiProviderConnections.providerKey, input.providerKey),
    eq(aiProviderConnections.mode, input.mode),
  )).returning();
  return row ?? null;
}

export async function resolveByokProviderConnection(input: {
  tenantId: string;
  projectId?: string | null;
  connectionId: string;
}) {
  if (!(await hasEntitlement({ tenantId: input.tenantId, entitlement: 'ai.byok' }))) {
    throw new Error('BYOK provider access is not enabled for this tenant.');
  }

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
  return {
    connection: row,
    adapter: await adapterFromConnection(row),
  };
}


export async function listByokProviderConnections(input: {
  tenantId: string;
  projectId?: string | null;
}) {
  const projectId = input.projectId ?? null;
  await assertProjectScope(input.tenantId, projectId);
  return db.query.aiProviderConnections.findMany({
    where: and(
      eq(aiProviderConnections.tenantId, input.tenantId),
      projectId === null
        ? isNull(aiProviderConnections.projectId)
        : eq(aiProviderConnections.projectId, projectId),
      eq(aiProviderConnections.mode, 'byok'),
    ),
    columns: {
      id: true,
      projectId: true,
      providerKey: true,
      mode: true,
      endpointUrl: true,
      status: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
