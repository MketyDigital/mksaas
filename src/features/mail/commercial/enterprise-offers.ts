import type { MailPlanLimits } from './plans';

export interface MailEnterpriseOfferInput {
  tenantId: string;
  name: string;
  description?: string;
  amountMinor: bigint;
  termDays: number | null;
  limits: MailPlanLimits;
}

const LIMIT_BOUNDS: Record<keyof MailPlanLimits, number> = {
  domains: 1000,
  mailboxes: 10000,
  teamSeats: 10000,
  sharedInboxes: 1000,
  storageGb: 10000,
  outboundMessagesPerMonth: 100_000_000,
  customerUpdateDeliveriesPerMonth: 100_000_000,
  maxRecipientsPerCustomerUpdate: 10000,
};

export function parseMailPlanLimits(value: unknown): MailPlanLimits {
  if (!value || typeof value !== 'object') throw new Error('Offer limits are required.');
  const rawLimits = value as Record<string, unknown>;
  const limits = {} as MailPlanLimits;
  for (const [key, maximum] of Object.entries(LIMIT_BOUNDS) as Array<[keyof MailPlanLimits, number]>) {
    const limit = rawLimits[key];
    if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
      throw new Error(`Offer limit ${key} is invalid.`);
    }
    limits[key] = limit;
  }
  return limits;
}

export function parseMailEnterpriseOfferInput(input: unknown): MailEnterpriseOfferInput {
  if (!input || typeof input !== 'object') throw new Error('Mail Enterprise offer is invalid.');
  const value = input as Record<string, unknown>;
  const tenantId = typeof value.tenantId === 'string' ? value.tenantId.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('Select a valid customer workspace.');
  if (name.length < 2 || name.length > 180) throw new Error('Offer name must be between 2 and 180 characters.');
  if (description.length > 2000) throw new Error('Offer description is too long.');
  if (typeof value.amountMinor !== 'bigint' || value.amountMinor < 1000n || value.amountMinor > 100_000_000n) {
    throw new Error('Offer amount must be between USD 10.00 and USD 1,000,000.00.');
  }
  const termDays = value.termDays === null ? null : Number(value.termDays);
  if (termDays !== null && (!Number.isInteger(termDays) || termDays < 1 || termDays > 3650)) {
    throw new Error('Offer term must be between 1 and 3650 days, or unlimited.');
  }
  const limits = parseMailPlanLimits(value.limits);
  return {
    tenantId,
    name,
    description: description || undefined,
    amountMinor: value.amountMinor,
    termDays,
    limits,
  };
}
