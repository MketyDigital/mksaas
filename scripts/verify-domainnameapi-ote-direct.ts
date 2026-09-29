import { DomainNameApiAdapter } from '../src/features/domains/server/domainnameapi';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing DomainNameAPI OT&E setting: ' + name);
  return value;
}

const resellerId = required('DOMAINNAMEAPI_USERNAME');
const apiKey = required('DOMAINNAMEAPI_API_TOKEN');
const baseUrl = process.env.DOMAINNAMEAPI_OTE_BASE_URL?.trim() || undefined;
const nameServers = (process.env.DOMAINNAMEAPI_NAME_SERVERS || '')
  .split(/[,\n]+/)
  .map((value) => value.trim())
  .filter(Boolean);

const adapter = new DomainNameApiAdapter({
  resellerId,
  apiKey,
  environment: 'ote',
  baseUrl,
  nameServers,
  whoisPrivacy: true,
});

const domain = 'mkety-ote-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.com';
const quote = await adapter.quote(domain, 1);

if (quote.domain !== domain) throw new Error('DomainNameAPI OT&E quote returned an unexpected domain.');
if (!quote.currency) throw new Error('DomainNameAPI OT&E quote did not return currency information.');

console.log(JSON.stringify({
  ok: true,
  environment: 'ote',
  domain,
  available: quote.available,
  currency: quote.currency,
  registrationPriceMinor: quote.registrationPriceMinor?.toString() ?? null,
  renewalPriceMinor: quote.renewalPriceMinor?.toString() ?? null,
}, null, 2));
