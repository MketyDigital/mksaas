import { defaultPricingPlans, defaultWorkspaceSection } from './defaults';
import { getDefaultPublicPage } from './public-page-defaults';

const pricingByKey = new Map(defaultPricingPlans.map((plan) => [plan.key, plan]));
const workspaceByKey = new Map(defaultWorkspaceSection.items.map((workspace) => [workspace.key, workspace]));

describe('Mkety documented public commercial presentation', () => {
  it('keeps the documented Starter, Growth and Enterprise commercial boundary', () => {
    expect(defaultPricingPlans.map((plan) => plan.key)).toEqual(['starter', 'growth', 'enterprise']);

    expect(pricingByKey.get('starter')).toMatchObject({
      name: 'Starter',
      priceLabel: 'Start free',
      billingLabel: 'Usage-based limits apply',
      highlighted: false,
    });
    expect(pricingByKey.get('starter')?.features).toEqual([
      'Project workspace',
      'AI workspace entry',
      'SolutionHub discovery',
      'Usage and credits visibility',
    ]);

    expect(pricingByKey.get('growth')).toMatchObject({
      name: 'Growth',
      priceLabel: 'Team plan',
      billingLabel: 'Plan, credits, and usage controls',
      highlighted: true,
    });
    expect(pricingByKey.get('growth')?.features).toEqual([
      'Team workspaces',
      'Automation workspace',
      'Deploy workspace',
      'Integrations',
      'Usage controls',
    ]);

    expect(pricingByKey.get('enterprise')).toMatchObject({
      name: 'Enterprise',
      priceLabel: 'Custom',
      highlighted: false,
    });
    expect(pricingByKey.get('enterprise')?.features).toEqual([
      'Custom implementation',
      'Enterprise support',
      'Trading infrastructure options',
      'Security and operations review',
    ]);
  });

  it('keeps public pricing free of ordinary infrastructure-slice marketing', () => {
    const presentation = JSON.stringify(defaultPricingPlans);
    expect(presentation).not.toMatch(/\b(cpu|ram|vps)\b/i);
    expect(presentation).not.toMatch(/African edition/i);
  });

  it('keeps the documented workspace capabilities and Trading boundary', () => {
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
      description: 'Publish websites, lightweight applications, APIs, portals, and services with domains and environments.',
    });
    expect(workspaceByKey.get('trading')).toMatchObject({
      title: 'Trading Workspace',
      badge: 'Custom / Enterprise',
      href: '/enterprise',
    });
  });

  it('keeps workspace packages separate from product workspaces in public positioning', () => {
    const workspacesPage = getDefaultPublicPage('workspaces');
    expect(workspacesPage?.headline).toBe('Focused tools that share one platform context.');
    expect(workspacesPage?.sections[0]?.items.map((item) => item.key)).toEqual(['ai', 'automation', 'deploy', 'trading']);
    expect(workspacesPage?.sections[0]?.items.find((item) => item.key === 'trading')).toMatchObject({
      badge: 'Custom / Enterprise',
      href: '/enterprise',
    });
  });
});
