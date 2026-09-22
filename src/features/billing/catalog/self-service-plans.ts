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
