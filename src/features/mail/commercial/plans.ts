export const MAIL_PLAN_KEYS = ['mail-starter', 'mail-growth', 'mail-business'] as const;

export type MailPlanKey = (typeof MAIL_PLAN_KEYS)[number];

export interface MailPlanLimits {
  domains: number;
  mailboxes: number;
  teamSeats: number;
  sharedInboxes: number;
  storageGb: number;
  outboundMessagesPerMonth: number;
  customerUpdateDeliveriesPerMonth: number;
  maxRecipientsPerCustomerUpdate: number;
}

export interface MailCommercialPlan {
  key: MailPlanKey;
  name: string;
  amountMinor: bigint;
  currency: 'USD';
  billingInterval: 'monthly';
  description: string;
  limits: MailPlanLimits;
}

export const MAIL_COMMERCIAL_PLANS: Record<MailPlanKey, MailCommercialPlan> = {
  'mail-starter': {
    key: 'mail-starter',
    name: 'Mail Starter',
    amountMinor: 499n,
    currency: 'USD',
    billingInterval: 'monthly',
    description: 'Professional business email for solo operators and small teams.',
    limits: {
      domains: 1,
      mailboxes: 3,
      teamSeats: 3,
      sharedInboxes: 1,
      storageGb: 5,
      outboundMessagesPerMonth: 2_000,
      customerUpdateDeliveriesPerMonth: 500,
      maxRecipientsPerCustomerUpdate: 500,
    },
  },
  'mail-growth': {
    key: 'mail-growth',
    name: 'Mail Growth',
    amountMinor: 999n,
    currency: 'USD',
    billingInterval: 'monthly',
    description: 'Business email, shared inboxes and customer communication for growing teams.',
    limits: {
      domains: 3,
      mailboxes: 10,
      teamSeats: 10,
      sharedInboxes: 3,
      storageGb: 25,
      outboundMessagesPerMonth: 10_000,
      customerUpdateDeliveriesPerMonth: 3_000,
      maxRecipientsPerCustomerUpdate: 3_000,
    },
  },
  'mail-business': {
    key: 'mail-business',
    name: 'Mail Business',
    amountMinor: 2499n,
    currency: 'USD',
    billingInterval: 'monthly',
    description: 'Higher-capacity business email, transactional API and team communication controls.',
    limits: {
      domains: 10,
      mailboxes: 50,
      teamSeats: 25,
      sharedInboxes: 10,
      storageGb: 100,
      outboundMessagesPerMonth: 50_000,
      customerUpdateDeliveriesPerMonth: 15_000,
      maxRecipientsPerCustomerUpdate: 3_000,
    },
  },
};

export const MAIL_PREPAID_ADDONS = {
  storage10Gb: { key: 'mail-storage-10gb', label: 'Extra 10 GB storage', amountMinor: 200n },
  outbound10k: { key: 'mail-outbound-10k', label: 'Extra 10,000 outbound messages', amountMinor: 300n },
  customerUpdates5k: { key: 'mail-customer-updates-5k', label: 'Extra 5,000 Customer Update deliveries', amountMinor: 300n },
  mailboxes5: { key: 'mail-mailboxes-5', label: 'Extra 5 mailboxes', amountMinor: 200n },
  seats5: { key: 'mail-seats-5', label: 'Extra 5 team seats', amountMinor: 300n },
} as const;

export function isMailPlanKey(value: string): value is MailPlanKey {
  return (MAIL_PLAN_KEYS as readonly string[]).includes(value);
}

export function getMailCommercialPlan(value: string) {
  if (!isMailPlanKey(value)) throw new Error('Unknown Mkety Mail plan.');
  return MAIL_COMMERCIAL_PLANS[value];
}


export function normalizeMailPlanKey(value: string | null | undefined): MailPlanKey {
  if (value === 'starter') return 'mail-starter';
  if (isMailPlanKey(String(value ?? ''))) return value as MailPlanKey;
  return 'mail-starter';
}
