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
  saasZoneId: string;
  appZoneId: string;
  cnameTarget: string;
  minTlsVersion: '1.2' | '1.3';
  managedDnsProxied: boolean;
};

async function cloudflareDomainConfig(): Promise<CloudflareDomainConfig> {
  const connection = await getActivePlatformServiceConnection({
    serviceKey: 'domains',
    providerKey: 'cloudflare-saas',
  }).catch(() => null);

  const config = connection?.config ?? {};
  const apiToken = String(connection?.secret.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? '').trim();
  const saasZoneId = String(config.saasZoneId ?? process.env.MKETY_SAAS_ZONE_ID ?? '').trim();
  const appZoneId = String(config.appZoneId ?? process.env.MKETY_APP_ZONE_ID ?? '').trim();
  const cnameTarget = String(config.cnameTarget ?? process.env.MKETY_SAAS_CNAME_TARGET ?? '').trim().toLowerCase();
  const minTlsVersion = String(config.minTlsVersion ?? '1.2') === '1.3' ? '1.3' : '1.2';
  const managedDnsProxied = typeof config.managedDnsProxied === 'boolean'
    ? config.managedDnsProxied
    : false;

  if (!apiToken) throw new Error('Cloudflare domain API token is not configured.');
  if (!saasZoneId) throw new Error('Cloudflare SaaS zone ID is not configured.');
  if (!appZoneId) throw new Error('Cloudflare app zone ID is not configured.');
  if (!cnameTarget) throw new Error('Cloudflare SaaS CNAME target is not configured.');

  return {
    apiToken,
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
