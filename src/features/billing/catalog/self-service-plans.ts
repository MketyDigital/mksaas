import type { EntitlementKey } from '@/features/entitlements/entitlement-keys';

export const SELF_SERVICE_BILLING_PLANS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    description: 'Core Mkety platform access for individuals getting started.',
    amountMinor: 599n,
    currency: 'USD',
    billingInterval: 'monthly',
    entitlements: [] as EntitlementKey[],
  },
  'ai-workspace': {
    key: 'ai-workspace',
    name: 'AI Workspace',
    description: 'AI agents, knowledge, integrations, and AI application workspace access.',
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
    description: 'Workflow, webhook, trigger, action, and integration workspace access.',
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
    description: 'Application, environment, release configuration, and deployment-history access.',
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
