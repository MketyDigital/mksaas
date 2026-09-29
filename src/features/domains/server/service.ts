import { recordManagedDomainAfterRegistration } from './managed-domain-service';
import {
  type DomainQuote,
  type DomainRegistrationContact,
  getDomainResellerAdapter,
  type RegisteredDomain,
} from './reseller';

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
  tenantId: string;
  domain: string;
  years: number;
  contact: DomainRegistrationContact;
  orderId: string;
  settlementVerified: boolean;
}): Promise<RegisteredDomain> {
  if (!input.settlementVerified) {
    throw new Error('Domain registration requires verified settlement.');
  }
  if (!input.tenantId.trim()) throw new Error('Domain registration tenant ID is required.');
  if (!input.orderId.trim()) throw new Error('Domain registration order ID is required.');
  if (!input.contact.firstName.trim() || !input.contact.lastName.trim() || !input.contact.email.trim()) {
    throw new Error('Domain registrant contact details are required.');
  }

  const registered = await (await getDomainResellerAdapter()).register({
    domain: input.domain,
    years: years(input.years),
    contact: input.contact,
    idempotencyKey: `domain-register:${input.orderId.trim()}`,
  });
  await recordManagedDomainAfterRegistration({
    tenantId: input.tenantId.trim(),
    orderId: input.orderId.trim(),
    registered,
  });
  return registered;
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
