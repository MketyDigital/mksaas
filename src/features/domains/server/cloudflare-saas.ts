const CF_API = 'https://api.cloudflare.com/client/v4';

type CloudflareCustomHostname = {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status?: string };
  ownership_verification?: { type?: string; name?: string; value?: string };
};

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const token = env('CLOUDFLARE_API_TOKEN');
  const response = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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

export function cloudflareSaasCnameTarget() {
  return env('MKETY_SAAS_CNAME_TARGET').toLowerCase();
}

export async function createCloudflareSaasHostname(hostname: string) {
  const zoneId = env('MKETY_SAAS_ZONE_ID');
  const normalized = hostname.trim().toLowerCase();

  const result = await cf<CloudflareCustomHostname>(`/zones/${zoneId}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname: normalized,
      ssl: {
        // HTTP DCV lets non-wildcard customers finish onboarding with only the
        // CNAME to our SaaS target; Cloudflare serves the validation token.
        method: 'http',
        type: 'dv',
        settings: { min_tls_version: '1.2' },
      },
    }),
  });

  return {
    id: result.id,
    hostname: result.hostname,
    status: result.status,
    sslStatus: result.ssl?.status ?? null,
    ownershipVerification: result.ownership_verification ?? null,
    cnameTarget: cloudflareSaasCnameTarget(),
  };
}

export async function getCloudflareSaasHostname(id: string) {
  const zoneId = env('MKETY_SAAS_ZONE_ID');
  return cf<CloudflareCustomHostname>(`/zones/${zoneId}/custom_hostnames/${encodeURIComponent(id)}`);
}

export async function deleteCloudflareSaasHostname(id: string) {
  const zoneId = env('MKETY_SAAS_ZONE_ID');
  await cf<{ id: string }>(`/zones/${zoneId}/custom_hostnames/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}


export async function retryCloudflareSaasHostnameValidation(id: string) {
  const zoneId = env('MKETY_SAAS_ZONE_ID');
  return cf<CloudflareCustomHostname>(
    `/zones/${zoneId}/custom_hostnames/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ssl: {
          method: 'http',
          type: 'dv',
          settings: { min_tls_version: '1.2' },
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
  const zoneId = env('MKETY_APP_ZONE_ID');
  const query = new URLSearchParams({ type: 'CNAME', name: hostname });
  const existing = await cf<CloudflareDnsRecord[]>(`/zones/${zoneId}/dns_records?${query.toString()}`);
  const body = JSON.stringify({
    type: 'CNAME',
    name: hostname,
    content: target,
    ttl: 1,
    proxied: false,
    comment: 'Mkety Enterprise AI managed hostname',
  });

  if (existing.length > 1) throw new Error('Managed hostname has conflicting DNS records.');
  if (existing[0]) {
    return cf<CloudflareDnsRecord>(`/zones/${zoneId}/dns_records/${existing[0].id}`, {
      method: 'PUT',
      body,
    });
  }
  return cf<CloudflareDnsRecord>(`/zones/${zoneId}/dns_records`, {
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
