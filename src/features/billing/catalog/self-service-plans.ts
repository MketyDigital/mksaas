import type { EntitlementKey } from '@/features/entitlements/entitlement-keys';

export const SELF_SERVICE_BILLING_PLANS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    description: 'Pages-first website and publishing access for lightweight websites and landing pages.',
    amountMinor: 599n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: [] as EntitlementKey[],
  },
  'ai-workspace': {
    key: 'ai-workspace',
    name: 'AI Workspace',
    description: 'AI Agent Builder access with knowledge, tools, models, publishing, supported integrations, and run history.',
    amountMinor: 1699n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: [
      'workspace.ai',
      'workspace.agents',
      'workspace.knowledge',
      'workspace.integrations',
    ] as EntitlementKey[],
  },
  'automation-workspace': {
    key: 'automation-workspace',
    name: 'Automation Workspace',
    description: 'Visual workflow access with webhooks, schedules, API actions, conditions, integrations, retries, and execution history.',
    amountMinor: 1699n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: [
      'workspace.automation',
      'workspace.workflows',
      'workspace.integrations',
    ] as EntitlementKey[],
  },
  'deploy-workspace': {
    key: 'deploy-workspace',
    name: 'Deploy Workspace',
    description: 'Managed serverless and edge deployment access for lightweight web apps, APIs, and portals.',
    amountMinor: 999n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: ['workspace.deploy'] as EntitlementKey[],
  },
  'mail-starter': {
    key: 'mail-starter',
    name: 'Mail Starter',
    description: 'Professional business email for solo operators and small teams.',
    amountMinor: 499n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: ['workspace.mail'] as EntitlementKey[],
  },
  'mail-growth': {
    key: 'mail-growth',
    name: 'Mail Growth',
    description: 'Business email, shared inboxes and customer communication for growing teams.',
    amountMinor: 999n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: ['workspace.mail'] as EntitlementKey[],
  },
  'mail-business': {
    key: 'mail-business',
    name: 'Mail Business',
    description: 'Higher-capacity business email, transactional API and team communication controls.',
    amountMinor: 2499n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: ['workspace.mail'] as EntitlementKey[],
  },
  'mkety-one': {
    key: 'mkety-one',
    name: 'Mkety One',
    description: 'Starter plus AI, Automation, and Deploy Workspace access.',
    amountMinor: 4900n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: [
      'workspace.ai',
      'workspace.automation',
      'workspace.deploy',
      'workspace.agents',
      'workspace.workflows',
      'workspace.knowledge',
      'workspace.integrations',
    ] as EntitlementKey[],
  },
} as const;

export type SelfServiceBillingPlanKey = keyof typeof SELF_SERVICE_BILLING_PLANS;

const PLAN_KEYS = new Set<string>(Object.keys(SELF_SERVICE_BILLING_PLANS));

export function isSelfServiceBillingPlanKey(value: string): value is SelfServiceBillingPlanKey {
  return PLAN_KEYS.has(value);
}

export function getSelfServiceBillingPlan(key: string) {
  if (!isSelfServiceBillingPlanKey(key)) {
    throw new Error('Unknown self-service billing plan.');
  }
  return SELF_SERVICE_BILLING_PLANS[key];
}


export const SELF_SERVICE_BILLING_TERMS = {
  '1m': { key: '1m', months: 1, label: 'Monthly', discountPercent: 0 },
  '3m': { key: '3m', months: 3, label: '3 months', discountPercent: 5 },
  '6m': { key: '6m', months: 6, label: '6 months', discountPercent: 10 },
  '12m': { key: '12m', months: 12, label: '12 months', discountPercent: 15 },
} as const;

export type SelfServiceBillingTermKey = keyof typeof SELF_SERVICE_BILLING_TERMS;

const BILLING_TERM_KEYS = new Set<string>(Object.keys(SELF_SERVICE_BILLING_TERMS));

export function isSelfServiceBillingTermKey(value: string): value is SelfServiceBillingTermKey {
  return BILLING_TERM_KEYS.has(value);
}

export function getSelfServiceBillingTerm(key: string) {
  if (!isSelfServiceBillingTermKey(key)) throw new Error('Unknown self-service billing term.');
  return SELF_SERVICE_BILLING_TERMS[key];
}

export function getSelfServiceBillingQuote(planKey: string, termKey: SelfServiceBillingTermKey = '1m') {
  const plan = getSelfServiceBillingPlan(planKey);
  const term = getSelfServiceBillingTerm(termKey);
  const undiscountedMinor = plan.amountMinor * BigInt(term.months);
  const amountMinor =
    (undiscountedMinor * BigInt(100 - term.discountPercent) + 50n) / 100n;

  return {
    plan,
    term,
    amountMinor,
    undiscountedMinor,
    savingsMinor: undiscountedMinor - amountMinor,
    effectiveMonthlyMinor: (amountMinor + BigInt(Math.floor(term.months / 2))) / BigInt(term.months),
    currency: plan.currency,
  };
}


export type SelfServiceBillingPlanFamily = 'platform' | 'mail';

export function getSelfServiceBillingPlanFamily(planKey: string): SelfServiceBillingPlanFamily {
  const plan = getSelfServiceBillingPlan(planKey);
  return plan.key.startsWith('mail-') ? 'mail' : 'platform';
}
