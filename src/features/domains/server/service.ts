import { type DomainQuote, getDomainResellerAdapter, type RegisteredDomain } from './reseller';

function years(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error('Domain registration period must be between 1 and 10 years.');
  }
  return value;
}

export async function quoteDomainRegistration(domain: string, registrationYears = 1): Promise<DomainQuote> {
  return (await getDomainResellerAdapter()).quote(domain, years(registrationYears));
}

export async function registerDomainAfterVerifiedSettlement(input: {
  domain: string;
  years: number;
  contactRef: string;
  orderId: string;
  settlementVerified: boolean;
}): Promise<RegisteredDomain> {
  if (!input.settlementVerified) {
    throw new Error('Domain registration requires verified settlement.');
  }
  if (!input.orderId.trim()) throw new Error('Domain registration order ID is required.');
  if (!input.contactRef.trim()) throw new Error('Domain registrant contact reference is required.');

  return (await getDomainResellerAdapter()).register({
    domain: input.domain,
    years: years(input.years),
    contactRef: input.contactRef.trim(),
    idempotencyKey: `domain-register:${input.orderId.trim()}`,
  });
}

export async function renewDomainAfterVerifiedSettlement(input: {
  providerDomainRef: string;
  years: number;
  orderId: string;
  settlementVerified: boolean;
}): Promise<RegisteredDomain> {
  if (!input.settlementVerified) {
    throw new Error('Domain renewal requires verified settlement.');
  }
  if (!input.orderId.trim()) throw new Error('Domain renewal order ID is required.');

  return (await getDomainResellerAdapter()).renew({
    providerDomainRef: input.providerDomainRef,
    years: years(input.years),
    idempotencyKey: `domain-renew:${input.orderId.trim()}`,
  });
}
