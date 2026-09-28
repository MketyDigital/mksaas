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
        method: 'txt',
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
