import { resolve4, resolve6, resolveCname } from 'node:dns/promises';
import postgres from 'postgres';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing white-label acceptance setting: ' + name);
  return value;
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function textContent(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const databaseUrl = required('WHITE_LABEL_ACCEPTANCE_DATABASE_URL');
const hostname = normalizeHost(required('WHITE_LABEL_ACCEPTANCE_HOSTNAME'));
const expectedTenantSlug = required('WHITE_LABEL_ACCEPTANCE_TENANT_SLUG');
const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  const domainRows = await sql.unsafe("select id, tenant_id, hostname, provider, provider_verified, status from saas_template.custom_domains where hostname = '" + hostname.replace(/'/g, "''") + "'");
  if (domainRows.length !== 1) throw new Error('Expected exactly one custom-domain record for the hostname; found ' + domainRows.length + '.');
  const domain = domainRows[0];
  if (domain.provider !== 'cloudflare-for-saas') throw new Error('Hostname is not bound through Cloudflare for SaaS.');
  if (domain.status !== 'verified') throw new Error('Hostname is not verified in Mkety database truth.');

  const tenantId = String(domain.tenant_id);
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('Domain tenant id is invalid.');
  const tenantRows = await sql.unsafe("select id, slug, name, settings from saas_template.tenants where id = '" + tenantId + "'::uuid");
  const tenant = tenantRows[0];
  if (!tenant) throw new Error('Hostname tenant no longer exists.');
  if (String(tenant.slug) !== expectedTenantSlug) throw new Error('Hostname belongs to ' + tenant.slug + ', not expected tenant ' + expectedTenantSlug + '.');

  let providerVerified: Record<string, unknown> = {};
  try { providerVerified = JSON.parse(String(domain.provider_verified ?? '{}')) as Record<string, unknown>; }
  catch { throw new Error('Hostname provider metadata is not valid JSON.'); }
  if (providerVerified.purpose !== 'enterprise-ai') throw new Error('Hostname is not an Enterprise AI hostname.');
  const cnameTarget = String(providerVerified.cnameTarget ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!cnameTarget) throw new Error('Enterprise hostname has no recorded CNAME target.');

  let cnames: string[] = [];
  try {
    cnames = (await resolveCname(hostname)).map((value) => value.toLowerCase().replace(/\.$/, ''));
  } catch {
    // A customer may proxy the CNAME through their own Cloudflare account, in which
    // case public DNS exposes A/AAAA records instead of the underlying CNAME.
  }
  const addresses = [
    ...(await resolve4(hostname).catch(() => [])),
    ...(await resolve6(hostname).catch(() => [])),
  ];
  const dnsResolvable = cnames.length > 0 || addresses.length > 0;
  if (!dnsResolvable) throw new Error('Customer hostname does not resolve in public DNS.');
  const dnsCnameVerified = cnames.includes(cnameTarget);

  const proofResponse = await fetch('https://' + hostname + '/api/v1/ai/domain-route-proof', {
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!proofResponse.ok) throw new Error('HTTPS tenant route proof returned HTTP ' + proofResponse.status + '.');
  const proof = await proofResponse.json() as Record<string, unknown>;
  if (proof.ok !== true || proof.hostname !== hostname || proof.tenant_id !== tenantId) throw new Error('HTTPS route proof did not match the expected tenant.');

  let settings: Record<string, unknown> = {};
  try { settings = JSON.parse(String(tenant.settings ?? '{}')) as Record<string, unknown>; }
  catch { settings = {}; }
  const enterpriseAi = settings.enterpriseAi && typeof settings.enterpriseAi === 'object' ? settings.enterpriseAi as Record<string, unknown> : {};
  const whiteLabel = enterpriseAi.whiteLabel && typeof enterpriseAi.whiteLabel === 'object' ? enterpriseAi.whiteLabel as Record<string, unknown> : {};
  if (whiteLabel.enabled !== true) throw new Error('Tenant white-label settings are not enabled.');
  const brandName = String(whiteLabel.brandName ?? tenant.name ?? '').trim();
  const productName = String(whiteLabel.productName ?? 'AI Assistant').trim();
  const loginHeading = String(whiteLabel.loginHeading ?? ('Sign in to ' + brandName)).trim();
  if (!brandName || !productName) throw new Error('White-label brand identity is incomplete.');

  const loginResponse = await fetch('https://' + hostname + '/', { redirect: 'manual' });
  if (!loginResponse.ok) throw new Error('Customer-host login surface returned HTTP ' + loginResponse.status + '.');
  const loginText = textContent(await loginResponse.text()).toLowerCase();
  for (const expected of [brandName, productName, loginHeading]) {
    if (expected && !loginText.includes(expected.toLowerCase())) throw new Error('Customer-host login surface is missing configured brand text: ' + expected);
  }

  const isolationResponse = await fetch('https://' + hostname + '/t/__mkety_wrong_tenant__/enterprise-ai/customer', { redirect: 'manual' });
  if (!isolationResponse.ok) throw new Error('Cross-tenant isolation probe returned HTTP ' + isolationResponse.status + '.');
  const isolationText = textContent(await isolationResponse.text()).toLowerCase();
  if (!isolationText.includes(brandName.toLowerCase())) throw new Error('Wrong-tenant path escaped the hostname-bound tenant identity.');

  console.log(JSON.stringify({
    ok: true,
    hostname,
    tenantId,
    tenantSlug: tenant.slug,
    cnameTarget,
    dnsResolvable,
    dnsCnameVerified,
    dnsCnameObserved: cnames,
    httpsTenantProofVerified: true,
    brandName,
    productName,
    loginHeading,
    wrongTenantPathRemainedHostBound: true,
  }, null, 2));
} finally {
  await sql.end();
}
