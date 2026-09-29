'use server';

import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { type EnterpriseAiChannelKey, getEnterpriseAiChannel } from '@/features/ai-runtime/channels/registry';
import { fingerprintAiConnectionSecret } from '@/features/ai-runtime/channels/connection-secret-crypto';
import {
  channelCredentialsFromForm,
  protectChannelCredentials,
  revealChannelCredentials,
} from '@/features/ai-runtime/channels/credentials';
import { type EntitlementKey, isEntitlementKey } from '@/features/entitlements/entitlement-keys';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections, aiSolutionInstances } from '@/shared/db/schema/ai-runtime';
import { requirePermission } from '@/shared/lib/permissions';
import { assertPublicHttpsUrl } from '@/shared/security/outbound-url';
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
  const fields = ['displayName', 'accountId', 'pageId', 'phoneNumberId', 'teamId', 'channelId', 'botUsername', 'guildId', 'applicationId', 'organizationId', 'memberId', 'linkedinVersion', 'modelAlias', 'solutionInstanceId'];
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
    const common = { label: 'Channel endpoint' };
    switch (channel.key) {
      case 'whatsapp':
      case 'instagram':
      case 'facebook_messenger':
        assertPublicHttpsUrl(endpointUrl, { ...common, allowedHosts: ['graph.facebook.com'] });
        break;
      case 'microsoft_teams':
        assertPublicHttpsUrl(endpointUrl, {
          ...common,
          allowedSuffixes: ['.webhook.office.com', '.logic.azure.com', '.powerautomate.com'],
        });
        break;
      case 'custom_webhook':
        assertPublicHttpsUrl(endpointUrl, common);
        break;
      default:
        assertPublicHttpsUrl(endpointUrl, common);
    }
  }

  const submittedCredentials = channelCredentialsFromForm(formData);
  const metadata = safeMetadata(formData);
  if (metadata.solutionInstanceId) {
    const solution = await db.query.aiSolutionInstances.findFirst({
      where: and(
        eq(aiSolutionInstances.id, metadata.solutionInstanceId),
        eq(aiSolutionInstances.tenantId, tenant.id),
      ),
      columns: { id: true },
    });
    if (!solution) throw new Error('Selected AI solution is not available to this workspace.');
  }

  const existing = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.tenantId, tenant.id),
      eq(aiProviderConnections.providerKey, channelProviderKey(channel.key)),
      eq(aiProviderConnections.mode, 'channel'),
    ),
  });

  const existingCredentials = existing?.secretRef
    ? revealChannelCredentials(existing.secretRef)
    : {};
  const credentials = { ...existingCredentials, ...submittedCredentials };
  const protectedCredentials = protectChannelCredentials(credentials);
  const secretRef = protectedCredentials ?? existing?.secretRef ?? null;
  const rawSecret = Object.entries(credentials)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

  if (rawSecret) {
    metadata.secretFingerprint = fingerprintAiConnectionSecret(rawSecret);
  } else if (typeof existing?.metadata?.secretFingerprint === 'string') {
    metadata.secretFingerprint = existing.metadata.secretFingerprint;
  }

  const mergedMetadata = {
    ...(existing?.metadata ?? {}),
    ...metadata,
    channelKey: channel.key,
    credentialMode: channel.credentialMode,
  };

  if (existing) {
    await db.update(aiProviderConnections).set({
      endpointUrl,
      secretRef,
      status: 'active',
      metadata: mergedMetadata,
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
      metadata: mergedMetadata,
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
