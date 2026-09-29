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

const live = await probe('production', liveApiKey);
const ote = await probe('ote', oteApiKey);

console.log(JSON.stringify({
  ok: true,
  transport: 'fixed-egress-relay',
  mutationPerformed: false,
  live,
  ote,
}, null, 2));
