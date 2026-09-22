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
    expect(pricingByKey.get('starter')?.ctaHref).toBe('/signup?plan=starter');
    expect(pricingByKey.get('ai-workspace')?.ctaHref).toBe('/signup?plan=ai-workspace');
    expect(pricingByKey.get('automation-workspace')?.ctaHref).toBe('/signup?plan=automation-workspace');
    expect(pricingByKey.get('deploy-workspace')?.ctaHref).toBe('/signup?plan=deploy-workspace');
    expect(pricingByKey.get('mkety-one')?.ctaHref).toBe('/signup?plan=mkety-one');

    expect(pricingByKey.get('enterprise')).toMatchObject({
      name: 'Enterprise',
      priceLabel: 'Custom',
      highlighted: false,
      ctaHref: '/contact',
    });

    const obsoletePlanIdentities = new Set(['growth', 'pro', 'business']);
    for (const plan of defaultPricingPlans) {
      expect(obsoletePlanIdentities.has(plan.key.toLowerCase())).toBe(false);
      expect(obsoletePlanIdentities.has(plan.name.toLowerCase())).toBe(false);
    }
  });

  it('keeps public pricing free of infrastructure-slice and stale Academy/Trading pricing', () => {
    const presentation = JSON.stringify(defaultPricingPlans);
    expect(presentation).not.toMatch(/\b(cpu|ram|vps|server allocation|shared cpu|shared ram)\b/i);
    expect(presentation).not.toMatch(/African edition/i);
    expect(presentation).not.toMatch(/academy.*\$|trading.*\$/i);
    expect(pricingByKey.get('starter')?.description).toMatch(/Pages-first website and publishing/i);
    expect(pricingByKey.get('deploy-workspace')?.description).toMatch(/serverless application deployment|managed edge runtime/i);
  });

  it('keeps Trading visible but sends new buyers through Enterprise first', () => {
    expect(workspaceByKey.get('ai')).toMatchObject({
      title: 'AI Workspace',
      description:
        'Build and publish AI agents with knowledge, tools, model choice, testing, versions, supported channels, API access, and run history.',
    });
    expect(workspaceByKey.get('automation')).toMatchObject({
      title: 'Automation Workspace',
      description: 'Build visual workflows with webhooks, schedules, API actions, conditions, integrations, secrets, retries, and execution history.',
    });
    expect(workspaceByKey.get('deploy')).toMatchObject({
      title: 'Deploy Workspace',
      description:
        'Deploy lightweight web applications, APIs, portals, and serverless workloads through Mkety managed edge deployment, with environment configuration, status, and history.',
    });
    expect(workspaceByKey.get('trading')).toMatchObject({
      title: 'Trading Workspace',
      description:
        'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.',
      badge: 'Custom / Enterprise',
      href: '/enterprise',
    });

    const workspacesPage = getDefaultPublicPage('workspaces');
    expect(workspacesPage?.sections[0]?.items.find((item) => item.key === 'trading')).toMatchObject({
      badge: 'Custom / Enterprise',
      href: '/enterprise',
    });

    const enterprisePage = getDefaultPublicPage('enterprise');
    expect(enterprisePage?.sections[0]?.items.find((item) => item.key === 'trading')).toMatchObject({
      badge: 'Custom / Enterprise',
      href: '/enterprise',
    });
    expect(enterprisePage?.sections[0]?.cta).toMatchObject({ label: 'Discuss Enterprise Project', href: '/contact' });
  });

  it('keeps Academy as a distinct commercial and learning destination', () => {
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
