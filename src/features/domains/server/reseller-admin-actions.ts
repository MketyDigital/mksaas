'use server';

import { revalidatePath } from 'next/cache';

import {
  disablePlatformServiceConnection,
  listPlatformServiceConnections,
  savePlatformServiceConnection,
} from '@/features/platform-connections/server/service';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { requirePermission } from '@/shared/lib/permissions';

async function requireDomainOps(tenantSlug: string) {
  const actor = await requirePlatformControlAccess(tenantSlug);
  await requirePermission(tenantSlug, 'platform:deployments');
  return actor;
}

function revalidate(tenantSlug: string) {
  revalidatePath(`/t/${tenantSlug}/admin/platform-control/domains-routing`);
  revalidatePath(`/t/${tenantSlug}/admin/platform-control`);
}

export async function getDomainResellerConnections() {
  return listPlatformServiceConnections('domains');
}

export async function saveDomainNameApiConnection(tenantSlug: string, formData: FormData) {
  const actor = await requireDomainOps(tenantSlug);
  const mode = String(formData.get('mode') ?? 'ote') === 'production' ? 'production' : 'ote';
  const username = String(formData.get('username') ?? '').trim();
  const apiToken = String(formData.get('apiToken') ?? '').trim();
  const endpointUrl = String(formData.get('endpointUrl') ?? '').trim();
  const nameservers = String(formData.get('nameServers') ?? '')
    .split(/[\n,]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!username || !apiToken) throw new Error('DomainNameAPI reseller ID/username and API token are required.');
  if (endpointUrl) new URL(endpointUrl);

  await savePlatformServiceConnection({
    serviceKey: 'domains',
    providerKey: 'domainnameapi',
    mode,
    secret: { username, apiToken },
    endpointUrl: endpointUrl || null,
    config: {
      nameServers: nameservers,
      whoisPrivacy: formData.get('whoisPrivacy') === 'on',
    },
    actorUserId: actor.userId,
    exclusiveProviderModes: true,
  });

  revalidate(tenantSlug);
}

export async function disableDomainResellerConnection(
  tenantSlug: string,
  connectionId: string,
) {
  const actor = await requireDomainOps(tenantSlug);
  await disablePlatformServiceConnection({ id: connectionId, actorUserId: actor.userId });
  revalidate(tenantSlug);
}
