import { getActivePlatformServiceConnection } from '@/features/platform-connections/server/service';

import { DomainNameApiAdapter } from './domainnameapi';

export type DomainQuote = {
  domain: string;
  available: boolean;
  registrationPriceMinor: bigint | null;
  renewalPriceMinor: bigint | null;
  currency: string;
  providerQuoteRef?: string | null;
};

export type RegisteredDomain = {
  domain: string;
  expiresAt: Date | null;
  providerDomainRef: string;
};

export interface DomainResellerAdapter {
  quote(domain: string, years?: number): Promise<DomainQuote>;
  register(input: {
    domain: string;
    years: number;
    idempotencyKey: string;
    contactRef: string;
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

  const username = String(connection.secret.username ?? '').trim();
  const apiToken = String(connection.secret.apiToken ?? '').trim();
  if (!username || !apiToken) throw new Error('DomainNameAPI reseller credentials are incomplete.');

  const config = connection.config ?? {};
  const nameServers = Array.isArray(config.nameServers)
    ? config.nameServers.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    : [];

  return new DomainNameApiAdapter({
    username,
    apiToken,
    environment: connection.mode === 'production' ? 'production' : 'ote',
    baseUrl: connection.endpointUrl ?? undefined,
    nameServers,
    whoisPrivacy: config.whoisPrivacy !== false,
  });
}
