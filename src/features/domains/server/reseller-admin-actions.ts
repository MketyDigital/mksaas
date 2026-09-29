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
  const resellerId = String(formData.get('resellerId') ?? '').trim();
  const apiKey = String(formData.get('apiKey') ?? '').trim();
  const endpointUrl = String(formData.get('endpointUrl') ?? '').trim();
  const registrationMarkupPercent = Number(formData.get('registrationMarkupPercent') ?? 0);
  const renewalMarkupPercent = Number(formData.get('renewalMarkupPercent') ?? 0);
  const registrationFixedMarkupMinor = Math.round(Number(formData.get('registrationFixedMarkup') ?? 0) * 100);
  const renewalFixedMarkupMinor = Math.round(Number(formData.get('renewalFixedMarkup') ?? 0) * 100);
  const nameservers = String(formData.get('nameServers') ?? '')
    .split(/[\n,]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!resellerId) throw new Error('DomainNameAPI V2 Reseller ID is required.');
  if (!apiKey) throw new Error('DomainNameAPI V2 API Key is required.');
  if (endpointUrl) new URL(endpointUrl);
  for (const [label, value] of [
    ['Registration markup', registrationMarkupPercent],
    ['Renewal markup', renewalMarkupPercent],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      throw new Error(label + ' must be between 0% and 1000%.');
    }
  }
  for (const [label, value] of [
    ['Registration fixed markup', registrationFixedMarkupMinor],
    ['Renewal fixed markup', renewalFixedMarkupMinor],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 100000000) {
      throw new Error(label + ' is invalid.');
    }
  }

  await savePlatformServiceConnection({
    serviceKey: 'domains',
    providerKey: 'domainnameapi',
    mode,
    secret: { resellerId, apiKey },
    endpointUrl: endpointUrl || null,
    config: {
      nameServers: nameservers,
      whoisPrivacy: formData.get('whoisPrivacy') === 'on',
      registrationMarkupPercent,
      renewalMarkupPercent,
      registrationFixedMarkupMinor,
      renewalFixedMarkupMinor,
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
