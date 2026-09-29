import { DomainNameApiAdapter } from '../src/features/domains/server/domainnameapi';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing relay acceptance setting: ' + name);
  return value;
}

const resellerId = required('DOMAINNAMEAPI_RESELLER_ID');
const liveApiKey = required('DOMAINNAMEAPI_LIVE_API_TOKEN');
const oteApiKey = required('DOMAINNAMEAPI_OTE_API_TOKEN');
const relayUrl = required('MKETY_DOMAIN_RELAY_URL');
const relaySecret = required('MKETY_DOMAIN_RELAY_SECRET');

async function signedRelayRequest(operation: string, environment: 'production' | 'ote', payload: Record<string, unknown>) {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const raw = JSON.stringify({ nonce, operation, environment, payload });
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(relaySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(timestamp + '.' + raw),
  ));
  const signature = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const response = await fetch(relayUrl + '/v1/domainnameapi', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-mkety-timestamp': timestamp,
      'x-mkety-signature': signature,
    },
    body: raw,
  });
  let body: unknown = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, ok: response.ok, body };
}

function sanitizeProviderBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeProviderBody);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/api.?key|token|password|authorization|reseller.?id|username/i.test(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = sanitizeProviderBody(item);
      }
    }
    return out;
  }
  return value;
}

async function probeCurrentOfficialLive(apiKey: string) {
  const domain = 'mkety-current-live-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.com';
  const result = await signedRelayRequest('quote-current-live', 'production', {
    resellerId,
    apiKey,
    domain,
  });
  return {
    environment: 'production' as const,
    status: result.status,
    ok: result.ok,
    body: sanitizeProviderBody(result.body),
  };
}

async function probeCurrent(environment: 'production' | 'ote', apiKey: string) {
  const domain = 'mkety-' + (environment === 'production' ? 'live' : 'ote') + '-current-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.com';
  const result = await signedRelayRequest('quote-current', environment, {
    resellerId,
    apiKey,
    domainName: domain,
    period: 1,
  });
  return {
    environment,
    status: result.status,
    ok: result.ok,
    body: sanitizeProviderBody(result.body),
  };
}

async function probeBasic(environment: 'production' | 'ote', apiKey: string) {
  const label = 'mkety-' + (environment === 'production' ? 'live' : 'ote') + '-basic-' + Date.now();
  const result = await signedRelayRequest('quote-basic', environment, {
    resellerId,
    apiKey,
    domainNames: label,
    tlds: 'com',
    period: 1,
  });
  return {
    environment,
    status: result.status,
    ok: result.ok,
    body: sanitizeProviderBody(result.body),
  };
}

async function probe(environment: 'production' | 'ote', apiKey: string) {
  const adapter = new DomainNameApiAdapter({
    resellerId,
    apiKey,
    environment,
    relayUrl,
    relaySecret,
    whoisPrivacy: true,
  });
  const domain = `mkety-${environment === 'production' ? 'live' : 'ote'}-relay-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.com`;
  const quote = await adapter.quote(domain, 1);
  if (quote.domain !== domain) throw new Error(environment + ' relay quote returned an unexpected domain.');
  if (!quote.currency) throw new Error(environment + ' relay quote did not return currency information.');
  return {
    environment,
    domain,
    available: quote.available,
    currency: quote.currency,
    registrationPriceMinor: quote.registrationPriceMinor?.toString() ?? null,
    renewalPriceMinor: quote.renewalPriceMinor?.toString() ?? null,
  };
}

let live: Awaited<ReturnType<typeof probe>> | null = null;
let ote: Awaited<ReturnType<typeof probe>> | null = null;
let liveError: string | null = null;
let oteError: string | null = null;
try { live = await probe('production', liveApiKey); } catch (error) { liveError = error instanceof Error ? error.message : String(error); }
try { ote = await probe('ote', oteApiKey); } catch (error) { oteError = error instanceof Error ? error.message : String(error); }

const liveBasic = await probeBasic('production', liveApiKey);
const oteBasic = await probeBasic('ote', oteApiKey);
const currentOfficialLive = await probeCurrentOfficialLive(liveApiKey);
const v2Passed = Boolean(live && ote);
const basicPassed = liveBasic.ok && oteBasic.ok;
const currentOfficialPassed = currentOfficialLive.ok;

console.log(JSON.stringify({
  ok: v2Passed || basicPassed || currentOfficialPassed,
  transport: 'fixed-egress-relay',
  mutationPerformed: false,
  v2: { live, ote, liveError, oteError },
  basic: { live: liveBasic, ote: oteBasic },
  currentOfficialLive,
}, null, 2));
