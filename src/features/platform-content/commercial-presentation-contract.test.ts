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

    expect(pricingByKey.get('starter')?.features).toEqual([
      'Published websites and pages',
      'Landing pages, portfolios, simple business sites, and supported blogs/docs',
      'Custom domains, SSL, and edge delivery where supported',
      'Forms and integrations where supported',
      'Basic analytics and project management',
      'Asset/storage and Mkety usage/credits visibility',
    ]);
    expect(pricingByKey.get('ai-workspace')?.features).toEqual([
      'AI Agent Builder with agents and published agents',
      'Drafts, version history, model choice, and test playground',
      'Knowledge sources, storage, and retrieval',
      'Tools, actions, and API access',
      'Website AI, Telegram, and supported messaging integrations',
      'Conversation/run history, usage, and team access',
    ]);
    expect(pricingByKey.get('automation-workspace')?.features).toEqual([
      'Visual workflow builder and workflow management',
      'Webhook and scheduled triggers',
      'API actions, conditions, notifications, and integrations',
      'Secrets and protected integration configuration',
      'Run history, execution logs, and retries',
      'Execution/usage visibility and team access',
    ]);
    expect(pricingByKey.get('deploy-workspace')?.features).toEqual([
      'Managed serverless application runtime and edge deployment',
      'Lightweight web app, API, and portal deployment',
      'Custom domains and SSL where supported',
      'Environment variables and secrets',
      'Deployment history, logs, and status where available',
      'Project, application, and usage visibility',
    ]);
    expect(pricingByKey.get('mkety-one')?.features).toEqual([
      'Starter website and publishing capabilities',
      'AI Workspace, Automation Workspace, and Deploy Workspace included',
      'Unified projects and workspace management',
      'Domains, usage, credits, and activity visibility',
      'Team access and shared operational controls',
      'Support and history/analytics experience across the bundle',
    ]);
    expect(pricingByKey.get('enterprise')?.features).toEqual([
      'Custom implementation and managed delivery',
      'Dedicated or private infrastructure when required',
      'Container, persistent-service, networking, and high-throughput requirements',
      'Specialized integrations and Trading infrastructure',
      'Enterprise support and commercial terms',
    ]);
  });

  it('keeps Trading visible but sends new buyers through Enterprise first', () => {
    expect(workspaceByKey.get('ai')).toMatchObject({
      title: 'AI Workspace',
      description:
        'Build and publish AI agents with knowledge, tools/actions, model choice, testing, drafts/versions, Website AI, supported messaging channels, API access, run history, and usage visibility.',
    });
    expect(workspaceByKey.get('automation')).toMatchObject({
      title: 'Automation Workspace',
      description: 'Build visual workflows with webhooks, schedules, API actions, conditions, notifications, integrations, secrets, retries, execution logs/history, and usage visibility.',
    });
    expect(workspaceByKey.get('deploy')).toMatchObject({
      title: 'Deploy Workspace',
      description:
        'Deploy lightweight web applications, APIs, portals, and serverless workloads through Mkety managed edge/serverless deployment with environment variables, secrets, supported domains, logs, status, history, and usage visibility.',
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

  it('keeps the production CMS repair seed aligned with the canonical feature lists', async () => {
    const { readFile } = await import('node:fs/promises');
    const migration = await readFile('migrations/0009_platform_commercial_content_repair.sql', 'utf8');

    const required = [
      'Published websites and pages',
      'Asset/storage and Mkety usage/credits visibility',
      'AI Agent Builder with agents and published agents',
      'Website AI, Telegram, and supported messaging integrations',
      'Visual workflow builder and workflow management',
      'Run history, execution logs, and retries',
      'Managed serverless application runtime and edge deployment',
      'Custom domains and SSL where supported',
      'Starter website and publishing capabilities',
      'Domains, usage, credits, and activity visibility',
      'Dedicated or private infrastructure when required',
      'Specialized integrations and Trading infrastructure',
    ];
    for (const label of required) expect(migration).toContain(label);

    expect(migration).not.toContain("'Project workspace'");
    expect(migration).not.toContain("'Core platform access'");
    expect(migration).not.toContain("'AI agents'");
    expect(migration).not.toContain("'Application and environment management'");
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
