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

/**
 * Mkety owns the registrar/reseller abstraction. Customer UI never receives
 * registrar credentials. The concrete adapter is intentionally selected from
 * server configuration so the existing reseller account can be bound without
 * coupling Enterprise AI to one registrar.
 */
let adapter: DomainResellerAdapter | null = null;

export function configureDomainResellerAdapter(next: DomainResellerAdapter) {
  adapter = next;
}

export function getDomainResellerAdapter() {
  if (!adapter) throw new Error('Domain reseller adapter is not configured.');
  return adapter;
}
