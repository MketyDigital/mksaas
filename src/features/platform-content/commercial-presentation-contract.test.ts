import { defaultPricingPlans, defaultWorkspaceSection } from './defaults';
import { getDefaultPublicPage } from './public-page-defaults';

const pricingByKey = new Map(defaultPricingPlans.map((plan) => [plan.key, plan]));
const workspaceByKey = new Map(defaultWorkspaceSection.items.map((workspace) => [workspace.key, workspace]));

describe('Mkety documented public commercial presentation', () => {
  it('keeps the canonical Starter, Workspace, Mkety One and Enterprise commercial model', () => {
    expect(defaultPricingPlans.map((plan) => plan.key)).toEqual([
      'starter',
      'ai-workspace',
      'automation-workspace',
      'deploy-workspace',
      'mkety-one',
      'enterprise',
    ]);

    expect(pricingByKey.get('starter')).toMatchObject({
      name: 'Starter',
      priceLabel: '$5.99',
      billingLabel: '/ month',
      highlighted: false,
    });
    expect(pricingByKey.get('ai-workspace')).toMatchObject({
      name: 'AI Workspace',
      priceLabel: '$16.99',
      billingLabel: '/ month',
    });
    expect(pricingByKey.get('automation-workspace')).toMatchObject({
      name: 'Automation Workspace',
      priceLabel: '$16.99',
      billingLabel: '/ month',
    });
    expect(pricingByKey.get('deploy-workspace')).toMatchObject({
      name: 'Deploy Workspace',
      priceLabel: '$9.99',
      billingLabel: '/ month',
    });
    expect(pricingByKey.get('mkety-one')).toMatchObject({
      name: 'Mkety One',
      priceLabel: '$49',
      billingLabel: '/ month',
      highlighted: true,
    });
    expect(pricingByKey.get('enterprise')).toMatchObject({
      name: 'Enterprise',
      priceLabel: 'Custom',
      highlighted: false,
    });

    const obsoletePlanIdentities = new Set(['growth', 'pro', 'business']);
    for (const plan of defaultPricingPlans) {
      expect(obsoletePlanIdentities.has(plan.key.toLowerCase())).toBe(false);
      expect(obsoletePlanIdentities.has(plan.name.toLowerCase())).toBe(false);
    }
  });

  it('keeps public pricing free of infrastructure-slice and stale Academy/Trading pricing', () => {
    const presentation = JSON.stringify(defaultPricingPlans);
    expect(presentation).not.toMatch(/\b(cpu|ram|vps)\b/i);
    expect(presentation).not.toMatch(/African edition/i);
    expect(presentation).not.toMatch(/academy.*\$|trading.*\$/i);
  });

  it('keeps the documented workspace capabilities and production product handoffs', () => {
    expect(workspaceByKey.get('ai')).toMatchObject({
      title: 'AI Workspace',
      description: 'Build agents, connect knowledge, choose models, test, version, publish, and monitor AI applications.',
    });
    expect(workspaceByKey.get('automation')).toMatchObject({
      title: 'Automation Workspace',
      description: 'Create workflows from triggers, actions, conditions, webhooks, transformations, and agent steps.',
    });
    expect(workspaceByKey.get('deploy')).toMatchObject({
      title: 'Deploy Workspace',
      description: 'Publish websites, lightweight applications, APIs, portals, and serverless workloads with domains and deployment history.',
    });
    expect(workspaceByKey.get('trading')).toMatchObject({
      title: 'Trading Workspace',
      description: 'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.',
      badge: 'Custom / Enterprise',
      href: 'https://trade.mkety.com',
    });
  });

  it('keeps public Academy and Trading pages pointed at their production products', () => {
    const workspacesPage = getDefaultPublicPage('workspaces');
    expect(workspacesPage?.sections[0]?.items.find((item) => item.key === 'trading')).toMatchObject({
      badge: 'Custom / Enterprise',
      href: 'https://trade.mkety.com',
    });

    const academyPage = getDefaultPublicPage('academy');
    expect(academyPage?.sections[0]?.items.map((item) => item.title)).toEqual([
      'Web & App Engineering',
      'Trading Masterclass',
      'Digital Funnel & Marketing',
      'AI & Automation Lab',
      'Certified Digital Skills',
    ]);
    expect(academyPage?.sections[0]?.cta).toMatchObject({
      label: 'Explore Mkety Academy',
      href: 'https://academy.mkety.com',
    });
  });
});
