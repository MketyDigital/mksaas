import { DomainNameApiAdapter } from '../src/features/domains/server/domainnameapi';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing DomainNameAPI live read-only setting: ' + name);
  return value;
}

const resellerId = required('DOMAINNAMEAPI_LIVE_USERNAME');
const apiKey = required('DOMAINNAMEAPI_LIVE_API_TOKEN');

const adapter = new DomainNameApiAdapter({
  resellerId,
  apiKey,
  environment: 'production',
  whoisPrivacy: true,
});

const domain = 'mkety-live-probe-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.com';
const quote = await adapter.quote(domain, 1);

if (quote.domain !== domain) throw new Error('DomainNameAPI live quote returned an unexpected domain.');
if (!quote.currency) throw new Error('DomainNameAPI live quote did not return currency information.');

console.log(JSON.stringify({
  ok: true,
  environment: 'production',
  operation: 'quote-only',
  mutationPerformed: false,
  domain,
  available: quote.available,
  currency: quote.currency,
  registrationPriceMinor: quote.registrationPriceMinor?.toString() ?? null,
  renewalPriceMinor: quote.renewalPriceMinor?.toString() ?? null,
}, null, 2));
