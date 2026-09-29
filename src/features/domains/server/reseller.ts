import { getActivePlatformServiceConnection } from '@/features/platform-connections/server/service';

import { DomainNameApiAdapter } from './domainnameapi';

export type DomainQuote = {
  domain: string;
  available: boolean;
  registrationPriceMinor: bigint | null;
  renewalPriceMinor: bigint | null;
  providerRegistrationPriceMinor?: bigint | null;
  providerRenewalPriceMinor?: bigint | null;
  registrationMarkupPercent?: number;
  renewalMarkupPercent?: number;
  registrationFixedMarkupMinor?: bigint;
  renewalFixedMarkupMinor?: bigint;
  currency: string;
  providerQuoteRef?: string | null;
};

export type RegisteredDomain = {
  domain: string;
  expiresAt: Date | null;
  providerDomainRef: string;
};

export type DomainRegistrationContact = {
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phoneCountryCode: string;
  phone: string;
  faxCountryCode?: string;
  fax?: string;
};

export interface DomainResellerAdapter {
  quote(domain: string, years?: number): Promise<DomainQuote>;
  register(input: {
    domain: string;
    years: number;
    idempotencyKey: string;
    contact: DomainRegistrationContact;
  }): Promise<RegisteredDomain>;
  renew(input: {
    providerDomainRef: string;
    years: number;
    idempotencyKey: string;
  }): Promise<RegisteredDomain>;
}

let adapterOverride: DomainResellerAdapter | null = null;

export function configureDomainResellerAdapter(next: DomainResellerAdapter | null) {
  adapterOverride = next;
}

export async function getDomainResellerAdapter(): Promise<DomainResellerAdapter> {
  if (adapterOverride) return adapterOverride;

  const connection = await getActivePlatformServiceConnection({
    serviceKey: 'domains',
    providerKey: 'domainnameapi',
  });
  if (!connection) throw new Error('Domain reseller adapter is not configured.');

  const resellerId = String(connection.secret.resellerId ?? connection.secret.username ?? '').trim();
  const apiKey = String(connection.secret.apiKey ?? connection.secret.apiToken ?? '').trim();
  if (!resellerId || !apiKey) throw new Error('DomainNameAPI reseller credentials are incomplete.');

  const config = connection.config ?? {};
  const nameServers = Array.isArray(config.nameServers)
    ? config.nameServers.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    : [];

  return new DomainNameApiAdapter({
    resellerId,
    apiKey,
    environment: connection.mode === 'production' ? 'production' : 'ote',
    baseUrl: connection.endpointUrl ?? undefined,
    nameServers,
    whoisPrivacy: config.whoisPrivacy !== false,
    registrationMarkupPercent: Number(config.registrationMarkupPercent ?? 0),
    renewalMarkupPercent: Number(config.renewalMarkupPercent ?? 0),
    registrationFixedMarkupMinor: BigInt(Math.max(0, Number(config.registrationFixedMarkupMinor ?? 0))),
    renewalFixedMarkupMinor: BigInt(Math.max(0, Number(config.renewalFixedMarkupMinor ?? 0))),
    relayUrl: process.env.MKETY_DOMAIN_RELAY_URL,
    relaySecret: process.env.MKETY_DOMAIN_RELAY_SECRET,
    relaySecretSeed: process.env.MKETY_CONNECTION_SECRET_ENCRYPTION_KEY
      || process.env.MKETY_AUTH_SESSION_SECRET,
  });
}
