'use server';

import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getEnterpriseAiChannel, type EnterpriseAiChannelKey } from '@/features/ai-runtime/channels/registry';
import {
  fingerprintAiConnectionSecret,
  protectAiConnectionSecret,
} from '@/features/ai-runtime/channels/connection-secret-crypto';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { isEntitlementKey, type EntitlementKey } from '@/features/entitlements/entitlement-keys';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections } from '@/shared/db/schema/ai-runtime';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

function channelProviderKey(channel: EnterpriseAiChannelKey) {
  return `channel:${channel}`;
}

function parseChannel(value: FormDataEntryValue | null) {
  const key = String(value ?? '').trim() as EnterpriseAiChannelKey;
  const descriptor = getEnterpriseAiChannel(key);
  if (!descriptor) throw new Error('Unsupported Enterprise AI channel.');
  return descriptor;
}

function safeMetadata(formData: FormData) {
  const fields = ['displayName', 'accountId', 'pageId', 'phoneNumberId', 'teamId', 'channelId', 'botUsername'];
  const result: Record<string, string> = {};
  for (const field of fields) {
    const value = String(formData.get(field) ?? '').trim();
    if (value) result[field] = value.slice(0, 240);
  }
  return result;
}

async function requireChannelEntitlement(tenantId: string, entitlement: string) {
  if (!isEntitlementKey(entitlement)) throw new Error('Channel entitlement is not registered.');
  if (!(await hasEntitlement({ tenantId, entitlement: entitlement as EntitlementKey }))) {
    throw new Error('This channel is not enabled for the workspace.');
  }
}

export async function listEnterpriseAiChannelConnections(tenantId: string) {
  return db
    .select({
      id: aiProviderConnections.id,
      providerKey: aiProviderConnections.providerKey,
      endpointUrl: aiProviderConnections.endpointUrl,
      status: aiProviderConnections.status,
      metadata: aiProviderConnections.metadata,
      secretConfigured: aiProviderConnections.secretRef,
      updatedAt: aiProviderConnections.updatedAt,
    })
    .from(aiProviderConnections)
    .where(and(
      eq(aiProviderConnections.tenantId, tenantId),
      eq(aiProviderConnections.mode, 'channel'),
    ))
    .orderBy(asc(aiProviderConnections.providerKey))
    .then((rows) => rows.map((row) => ({
      ...row,
      secretConfigured: Boolean(row.secretConfigured),
    })));
}

export async function saveEnterpriseAiChannelConnection(tenantSlug: string, formData: FormData) {
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');

  const channel = parseChannel(formData.get('channel'));
  await requireChannelEntitlement(tenant.id, channel.entitlement);

  const endpointUrl = String(formData.get('endpointUrl') ?? '').trim() || null;
  if (endpointUrl) {
    const parsed = new URL(endpointUrl);
    if (parsed.protocol !== 'https:') throw new Error('Channel endpoints must use HTTPS.');
  }

  const rawSecret = String(formData.get('credential') ?? '').trim();
  const metadata = safeMetadata(formData);
  const existing = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.tenantId, tenant.id),
      eq(aiProviderConnections.providerKey, channelProviderKey(channel.key)),
      eq(aiProviderConnections.mode, 'channel'),
    ),
  });

  const secretRef = rawSecret
    ? protectAiConnectionSecret(rawSecret)
    : existing?.secretRef ?? null;

  if (rawSecret) {
    metadata.secretFingerprint = fingerprintAiConnectionSecret(rawSecret);
  } else if (typeof existing?.metadata?.secretFingerprint === 'string') {
    metadata.secretFingerprint = existing.metadata.secretFingerprint;
  }

  metadata.channelKey = channel.key;
  metadata.credentialMode = channel.credentialMode;

  if (existing) {
    await db.update(aiProviderConnections).set({
      endpointUrl,
      secretRef,
      status: 'active',
      metadata,
      updatedAt: new Date(),
    }).where(eq(aiProviderConnections.id, existing.id));
  } else {
    await db.insert(aiProviderConnections).values({
      tenantId: tenant.id,
      projectId: null,
      providerKey: channelProviderKey(channel.key),
      mode: 'channel',
      secretRef,
      endpointUrl,
      status: 'active',
      metadata,
    });
  }

  revalidatePath(`/t/${tenantSlug}/enterprise-ai/channels`);
}

export async function disableEnterpriseAiChannelConnection(tenantSlug: string, formData: FormData) {
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  const connectionId = String(formData.get('connectionId') ?? '').trim();
  if (!connectionId) throw new Error('Connection is required.');

  await db.update(aiProviderConnections).set({
    status: 'disabled',
    updatedAt: new Date(),
  }).where(and(
    eq(aiProviderConnections.id, connectionId),
    eq(aiProviderConnections.tenantId, tenant.id),
    eq(aiProviderConnections.mode, 'channel'),
  ));

  revalidatePath(`/t/${tenantSlug}/enterprise-ai/channels`);
}
