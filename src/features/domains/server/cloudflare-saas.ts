import { getActivePlatformServiceConnection } from '@/features/platform-connections/server/service';

const CF_API = 'https://api.cloudflare.com/client/v4';

type CloudflareCustomHostname = {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status?: string };
  ownership_verification?: { type?: string; name?: string; value?: string };
};

type CloudflareDomainConfig = {
  apiToken: string;
  accountId: string;
  saasZoneId: string;
  appZoneId: string;
  cnameTarget: string;
  minTlsVersion: '1.2' | '1.3';
  managedDnsProxied: boolean;
};

async function cloudflareBootstrapRequest<T>(
  apiToken: string,
  path: string,
): Promise<T> {
  const response = await fetch(`${CF_API}${path}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });
  const body = await response.json() as { success: boolean; result?: T };
  if (!response.ok || !body.success || body.result === undefined) {
    throw new Error(`Cloudflare bootstrap request failed with HTTP ${response.status}.`);
  }
  return body.result;
}

async function discoverCloudflareZoneId(
  apiToken: string,
  accountId: string,
  zoneName: string,
) {
  const query = new URLSearchParams({
    name: zoneName,
    'account.id': accountId,
    status: 'active',
    per_page: '50',
  });
  const zones = await cloudflareBootstrapRequest<Array<{ id: string; name: string }>>(
    apiToken,
    `/zones?${query.toString()}`,
  );
  const matches = zones.filter((zone) => zone.name.toLowerCase() === zoneName.toLowerCase());
  if (matches.length !== 1 || !matches[0]?.id) {
    throw new Error(`Expected exactly one active Cloudflare zone for ${zoneName}.`);
  }
  return matches[0].id;
}

async function discoverCloudflareFallbackOrigin(apiToken: string, saasZoneId: string) {
  const fallback = await cloudflareBootstrapRequest<{ origin?: string; status?: string }>(
    apiToken,
    `/zones/${encodeURIComponent(saasZoneId)}/custom_hostnames/fallback_origin`,
  );
  const origin = String(fallback.origin ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!origin) throw new Error('Cloudflare for SaaS fallback origin is not configured.');
  if (fallback.status && fallback.status !== 'active') {
    throw new Error(`Cloudflare for SaaS fallback origin is not active (${fallback.status}).`);
  }
  return origin;
}

async function cloudflareDomainConfig(): Promise<CloudflareDomainConfig> {
  const connection = await getActivePlatformServiceConnection({
    serviceKey: 'domains',
    providerKey: 'cloudflare-saas',
  }).catch(() => null);

  const config = connection?.config ?? {};
  const apiToken = String(connection?.secret.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? '').trim();
  const accountId = String(config.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  let saasZoneId = String(config.saasZoneId ?? process.env.MKETY_SAAS_ZONE_ID ?? '').trim();
  let appZoneId = String(config.appZoneId ?? process.env.MKETY_APP_ZONE_ID ?? '').trim();
  let cnameTarget = String(config.cnameTarget ?? process.env.MKETY_SAAS_CNAME_TARGET ?? '').trim().toLowerCase();
  const minTlsVersion = String(config.minTlsVersion ?? '1.2') === '1.3' ? '1.3' : '1.2';
  const managedDnsProxied = typeof config.managedDnsProxied === 'boolean'
    ? config.managedDnsProxied
    : false;

  if (!apiToken) throw new Error('Cloudflare domain API token is not configured.');
  if (!accountId) throw new Error('Cloudflare account ID is not configured.');

  // Bootstrap from Cloudflare itself when Platform Control has not stored these
  // non-secret routing values yet. This keeps managed hostname provisioning
  // operational from the existing Cloudflare root credentials without guessing.
  saasZoneId ||= await discoverCloudflareZoneId(apiToken, accountId, 'mkety.com');
  appZoneId ||= await discoverCloudflareZoneId(apiToken, accountId, 'mkety.app');
  cnameTarget ||= await discoverCloudflareFallbackOrigin(apiToken, saasZoneId);

  return {
    apiToken,
    accountId,
    saasZoneId,
    appZoneId,
    cnameTarget,
    minTlsVersion,
    managedDnsProxied,
  };
}

async function cf<T>(config: CloudflareDomainConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json() as { success: boolean; result?: T; errors?: unknown };
  if (!response.ok || !body.success || body.result === undefined) {
    throw new Error(`Cloudflare for SaaS request failed with HTTP ${response.status}.`);
  }
  return body.result;
}

export async function cloudflareSaasCnameTarget() {
  return (await cloudflareDomainConfig()).cnameTarget;
}

export async function createCloudflareSaasHostname(hostname: string) {
  const config = await cloudflareDomainConfig();
  const normalized = hostname.trim().toLowerCase();

  const result = await cf<CloudflareCustomHostname>(config, `/zones/${config.saasZoneId}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname: normalized,
      ssl: {
        method: 'http',
        type: 'dv',
        settings: { min_tls_version: config.minTlsVersion },
      },
    }),
  });

  return {
    id: result.id,
    hostname: result.hostname,
    status: result.status,
    sslStatus: result.ssl?.status ?? null,
    ownershipVerification: result.ownership_verification ?? null,
    cnameTarget: config.cnameTarget,
  };
}

export async function getCloudflareSaasHostname(id: string) {
  const config = await cloudflareDomainConfig();
  return cf<CloudflareCustomHostname>(
    config,
    `/zones/${config.saasZoneId}/custom_hostnames/${encodeURIComponent(id)}`,
  );
}

export async function deleteCloudflareSaasHostname(id: string) {
  const config = await cloudflareDomainConfig();
  await cf<{ id: string }>(
    config,
    `/zones/${config.saasZoneId}/custom_hostnames/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function retryCloudflareSaasHostnameValidation(id: string) {
  const config = await cloudflareDomainConfig();
  return cf<CloudflareCustomHostname>(
    config,
    `/zones/${config.saasZoneId}/custom_hostnames/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ssl: {
          method: 'http',
          type: 'dv',
          settings: { min_tls_version: config.minTlsVersion },
        },
      }),
    },
  );
}

type CloudflareDnsRecord = {
  id: string;
  name: string;
  type: string;
  content: string;
  proxied?: boolean;
};

async function upsertManagedMketyAppCname(hostname: string, target: string) {
  const config = await cloudflareDomainConfig();
  const query = new URLSearchParams({ type: 'CNAME', name: hostname });
  const existing = await cf<CloudflareDnsRecord[]>(
    config,
    `/zones/${config.appZoneId}/dns_records?${query.toString()}`,
  );
  const body = JSON.stringify({
    type: 'CNAME',
    name: hostname,
    content: target,
    ttl: 1,
    proxied: config.managedDnsProxied,
    comment: 'Mkety Enterprise AI managed hostname',
  });

  if (existing.length > 1) throw new Error('Managed hostname has conflicting DNS records.');
  if (existing[0]) {
    return cf<CloudflareDnsRecord>(
      config,
      `/zones/${config.appZoneId}/dns_records/${existing[0].id}`,
      { method: 'PUT', body },
    );
  }
  return cf<CloudflareDnsRecord>(config, `/zones/${config.appZoneId}/dns_records`, {
    method: 'POST',
    body,
  });
}

export async function provisionMketyAppManagedHostname(subdomain: string) {
  const normalized = subdomain.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
    throw new Error('Managed subdomain is invalid.');
  }
  const hostname = `${normalized}.mkety.app`;
  const customHostname = await createCloudflareSaasHostname(hostname);
  await upsertManagedMketyAppCname(hostname, customHostname.cnameTarget);

  let current = await retryCloudflareSaasHostnameValidation(customHostname.id);
  if (current.status !== 'active' || current.ssl?.status !== 'active') {
    current = await getCloudflareSaasHostname(customHostname.id);
  }

  return {
    id: customHostname.id,
    hostname,
    cnameTarget: customHostname.cnameTarget,
    status: current.status,
    sslStatus: current.ssl?.status ?? null,
    ready: current.status === 'active' && current.ssl?.status === 'active',
  };
}


export type MketyDnsRecordInput = {
  id?: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'SRV' | 'CAA';
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
};


export async function findCloudflareManagedZone(domain: string) {
  const config = await cloudflareDomainConfig();
  const normalized = domain.trim().toLowerCase().replace(/\.$/, '');
  const query = new URLSearchParams({
    name: normalized,
    'account.id': config.accountId,
    per_page: '50',
  });
  const zones = await cf<Array<{
    id: string;
    name: string;
    status: string;
    name_servers?: string[];
  }>>(config, `/zones?${query.toString()}`);
  return zones.find((zone) => zone.name.toLowerCase() === normalized) ?? null;
}

export async function createCloudflareManagedZone(domain: string) {
  const config = await cloudflareDomainConfig();
  const normalized = domain.trim().toLowerCase().replace(/\.$/, '');
  const zone = await cf<{
    id: string;
    name: string;
    status: string;
    name_servers?: string[];
  }>(config, '/zones', {
    method: 'POST',
    body: JSON.stringify({
      name: normalized,
      account: { id: config.accountId },
      type: 'full',
      jump_start: false,
    }),
  });
  return {
    id: zone.id,
    name: zone.name,
    status: zone.status,
    nameServers: Array.isArray(zone.name_servers) ? zone.name_servers : [],
  };
}

export async function getCloudflareManagedZone(zoneId: string) {
  const config = await cloudflareDomainConfig();
  return cf<{
    id: string;
    name: string;
    status: string;
    name_servers?: string[];
  }>(config, `/zones/${encodeURIComponent(zoneId)}`);
}

export async function deleteCloudflareManagedZone(zoneId: string) {
  const config = await cloudflareDomainConfig();
  return cf<{ id: string }>(config, `/zones/${encodeURIComponent(zoneId)}`, {
    method: 'DELETE',
  });
}

export async function listCloudflareDnsRecords(zoneId: string) {
  const config = await cloudflareDomainConfig();
  return cf<Array<{
    id: string;
    type: string;
    name: string;
    content: string;
    ttl: number;
    proxied?: boolean;
    priority?: number;
  }>>(config, `/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=500`);
}

export async function saveCloudflareDnsRecord(zoneId: string, input: MketyDnsRecordInput) {
  const config = await cloudflareDomainConfig();
  const type = input.type.toUpperCase() as MketyDnsRecordInput['type'];
  const allowed = new Set(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'CAA']);
  if (!allowed.has(type)) throw new Error('Unsupported Mkety DNS record type.');
  const name = input.name.trim().toLowerCase();
  const content = input.content.trim();
  if (!name || !content) throw new Error('DNS record name and content are required.');
  const proxiedAllowed = type === 'A' || type === 'AAAA' || type === 'CNAME';
  const body = JSON.stringify({
    type,
    name,
    content,
    ttl: input.ttl && input.ttl >= 60 ? input.ttl : 1,
    ...(proxiedAllowed ? { proxied: input.proxied === true } : {}),
    ...(type === 'MX' && Number.isFinite(input.priority) ? { priority: input.priority } : {}),
  });
  if (input.id) {
    return cf(config, `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(input.id)}`, {
      method: 'PUT',
      body,
    });
  }
  return cf(config, `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
    method: 'POST',
    body,
  });
}

export async function deleteCloudflareDnsRecord(zoneId: string, recordId: string) {
  const config = await cloudflareDomainConfig();
  return cf<{ id: string }>(
    config,
    `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    { method: 'DELETE' },
  );
}
