import postgres from 'postgres';

import { DomainNameApiAdapter } from '../src/features/domains/server/domainnameapi';
import { decryptConnectionSecret } from '../src/shared/security/connection-secrets';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required DomainNameAPI acceptance setting: ' + name);
  return value;
}

const databaseUrl = required('DOMAIN_ACCEPTANCE_DATABASE_URL');
const encryptionKey = required('MKETY_CONNECTION_SECRET_ENCRYPTION_KEY');
const runLifecycle = process.env.DOMAIN_ACCEPTANCE_LIFECYCLE === 'true';
const contactRef = process.env.DOMAIN_ACCEPTANCE_CONTACT_REF?.trim() || '';
if (runLifecycle && !contactRef) throw new Error('Lifecycle acceptance requires DOMAIN_ACCEPTANCE_CONTACT_REF.');

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const rows = await sql.unsafe("select id, mode, secret_ref, endpoint_url, config from saas_template.platform_service_connections where service_key = 'domains' and provider_key = 'domainnameapi' and status = 'active' order by updated_at desc limit 1");
  const row = rows[0];
  if (!row) throw new Error('No active database-backed DomainNameAPI connection exists.');
  if (row.mode !== 'ote') throw new Error('Refusing registrar acceptance because the active DomainNameAPI connection is not OT&E.');
  if (!row.secret_ref) throw new Error('Active DomainNameAPI connection has no encrypted credential reference.');

  const secret = await decryptConnectionSecret(String(row.secret_ref), encryptionKey);
  const resellerId = String(secret.resellerId ?? secret.username ?? '').trim();
  const apiKey = String(secret.apiKey ?? secret.apiToken ?? '').trim();
  if (!resellerId || !apiKey) throw new Error('Decrypted DomainNameAPI OT&E credentials are incomplete.');

  const config = row.config && typeof row.config === 'object' ? row.config as Record<string, unknown> : {};
  const nameServers = Array.isArray(config.nameServers)
    ? config.nameServers.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    : [];

  const adapter = new DomainNameApiAdapter({
    resellerId,
    apiKey,
    environment: 'ote',
    baseUrl: row.endpoint_url ? String(row.endpoint_url) : undefined,
    nameServers,
    whoisPrivacy: config.whoisPrivacy !== false,
  });

  const label = 'mkety-accept-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8);
  const domain = label + '.com';
  const quote = await adapter.quote(domain, 1);
  if (quote.domain !== domain) throw new Error('DomainNameAPI quote did not preserve the requested domain.');
  if (!quote.currency) throw new Error('DomainNameAPI quote did not return a currency.');

  const evidence: Record<string, unknown> = {
    ok: true,
    environment: 'ote',
    connectionId: String(row.id),
    domain,
    quoteAvailable: quote.available,
    currency: quote.currency,
    registrationPriceMinor: quote.registrationPriceMinor?.toString() ?? null,
    renewalPriceMinor: quote.renewalPriceMinor?.toString() ?? null,
    lifecycle: 'not-requested',
  };

  if (runLifecycle) {
    if (!quote.available) throw new Error('Generated OT&E acceptance domain was not available; rerun with a fresh generated label.');
    const registered = await adapter.register({
      domain,
      years: 1,
      idempotencyKey: 'domain-accept-register-' + crypto.randomUUID(),
      contactRef,
    });
    if (registered.domain !== domain || !registered.providerDomainRef) throw new Error('DomainNameAPI OT&E registration was not confirmed.');

    const renewed = await adapter.renew({
      providerDomainRef: registered.providerDomainRef,
      years: 1,
      idempotencyKey: 'domain-accept-renew-' + crypto.randomUUID(),
    });
    if (!renewed.providerDomainRef) throw new Error('DomainNameAPI OT&E renewal was not confirmed.');

    evidence.lifecycle = 'register-and-renew-confirmed';
    evidence.providerDomainRef = registered.providerDomainRef;
    evidence.registeredExpiresAt = registered.expiresAt?.toISOString() ?? null;
    evidence.renewedExpiresAt = renewed.expiresAt?.toISOString() ?? null;
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await sql.end();
}
