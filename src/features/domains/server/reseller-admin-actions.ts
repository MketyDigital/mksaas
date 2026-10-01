'use server';

import { revalidatePath } from 'next/cache';

import {
  disablePlatformServiceConnection,
  getActivePlatformServiceConnection,
  listPlatformServiceConnections,
  savePlatformServiceConnection,
} from '@/features/platform-connections/server/service';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { requirePermission } from '@/shared/lib/permissions';
import { runPlatformControlMutation } from '@/shared/db/platform-control-mutation';

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

async function saveDomainNameApiConnectionImpl(tenantSlug: string, formData: FormData) {
  const actor = await requireDomainOps(tenantSlug);
  const mode = String(formData.get('mode') ?? 'ote') === 'production' ? 'production' : 'ote';
  let resellerId = String(formData.get('resellerId') ?? '').trim();
  let apiKey = String(formData.get('apiKey') ?? '').trim();
  const endpointUrl = String(formData.get('endpointUrl') ?? '').trim();
  const registrationMarkupPercent = Number(formData.get('registrationMarkupPercent') ?? 0);
  const renewalMarkupPercent = Number(formData.get('renewalMarkupPercent') ?? 0);
  const registrationFixedMarkupMinor = Math.round(Number(formData.get('registrationFixedMarkup') ?? 0) * 100);
  const renewalFixedMarkupMinor = Math.round(Number(formData.get('renewalFixedMarkup') ?? 0) * 100);
  const nameservers = String(formData.get('nameServers') ?? '')
    .split(/[\n,]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!resellerId || !apiKey) {
    const existing = await getActivePlatformServiceConnection({
      serviceKey: 'domains',
      providerKey: 'domainnameapi',
    });
    if (existing?.mode === mode) {
      resellerId ||= String(existing.secret.resellerId ?? existing.secret.username ?? '').trim();
      apiKey ||= String(existing.secret.apiKey ?? existing.secret.apiToken ?? '').trim();
    }
  }
  if (!resellerId) throw new Error('Registrar Reseller ID is required for this environment.');
  if (!apiKey) throw new Error('Registrar API key is required for this environment.');
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

async function disableDomainResellerConnectionImpl(
  tenantSlug: string,
  connectionId: string,
) {
  const actor = await requireDomainOps(tenantSlug);
  await disablePlatformServiceConnection({ id: connectionId, actorUserId: actor.userId });
  revalidate(tenantSlug);
}


async function saveCloudflareDomainRoutingConnectionImpl(tenantSlug: string, formData: FormData) {
  const actor = await requireDomainOps(tenantSlug);
  const apiTokenInput = String(formData.get('apiToken') ?? '').trim();
  const accountId = String(formData.get('accountId') ?? '').trim();
  const saasZoneId = String(formData.get('saasZoneId') ?? '').trim();
  const appZoneId = String(formData.get('appZoneId') ?? '').trim();
  const cnameTarget = String(formData.get('cnameTarget') ?? '').trim().toLowerCase();
  const minTlsVersion = String(formData.get('minTlsVersion') ?? '1.2').trim();
  const managedDnsProxied = formData.get('managedDnsProxied') === 'on';

  if (!accountId || !saasZoneId || !appZoneId || !cnameTarget) {
    throw new Error('Cloudflare account, SaaS zone, app zone and CNAME target are required.');
  }
  if (!/^[a-z0-9.-]+$/i.test(cnameTarget)) throw new Error('Cloudflare CNAME target is invalid.');
  if (!['1.2', '1.3'].includes(minTlsVersion)) throw new Error('Minimum TLS version must be 1.2 or 1.3.');

  let apiToken = apiTokenInput;
  if (!apiToken) {
    const existing = await getActivePlatformServiceConnection({
      serviceKey: 'domains',
      providerKey: 'cloudflare-saas',
    });
    apiToken = String(existing?.secret.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? '').trim();
  }
  if (!apiToken) throw new Error('Cloudflare API token is required for first-time configuration.');

  await savePlatformServiceConnection({
    serviceKey: 'domains',
    providerKey: 'cloudflare-saas',
    mode: 'production',
    secret: { apiToken },
    config: {
      accountId,
      saasZoneId,
      appZoneId,
      cnameTarget,
      minTlsVersion,
      managedDnsProxied,
    },
    actorUserId: actor.userId,
    exclusiveProviderModes: true,
  });

  revalidate(tenantSlug);
}

async function disableCloudflareDomainRoutingConnectionImpl(
  tenantSlug: string,
  connectionId: string,
) {
  const actor = await requireDomainOps(tenantSlug);
  await disablePlatformServiceConnection({ id: connectionId, actorUserId: actor.userId });
  revalidate(tenantSlug);
}

export async function saveDomainNameApiConnection(...args: Parameters<typeof saveDomainNameApiConnectionImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/t/${tenantSlug}/admin/platform-control/domains-routing`,
    action: 'saveDomainNameApiConnection',
    work: () => saveDomainNameApiConnectionImpl(...args),
  });
}

export async function disableDomainResellerConnection(...args: Parameters<typeof disableDomainResellerConnectionImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/t/${tenantSlug}/admin/platform-control/domains-routing`,
    action: 'disableDomainResellerConnection',
    work: () => disableDomainResellerConnectionImpl(...args),
  });
}

export async function saveCloudflareDomainRoutingConnection(...args: Parameters<typeof saveCloudflareDomainRoutingConnectionImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/t/${tenantSlug}/admin/platform-control/domains-routing`,
    action: 'saveCloudflareDomainRoutingConnection',
    work: () => saveCloudflareDomainRoutingConnectionImpl(...args),
  });
}

export async function disableCloudflareDomainRoutingConnection(...args: Parameters<typeof disableCloudflareDomainRoutingConnectionImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/t/${tenantSlug}/admin/platform-control/domains-routing`,
    action: 'disableCloudflareDomainRoutingConnection',
    work: () => disableCloudflareDomainRoutingConnectionImpl(...args),
  });
}
