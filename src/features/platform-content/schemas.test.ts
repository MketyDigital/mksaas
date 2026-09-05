import {
  ctaSchema,
  docsArticleSchema,
  footerGroupSchema,
  heroSectionSchema,
  navigationItemSchema,
  pricingPlanSchema,
  siteSettingsSchema,
  workspaceSectionSchema,
} from './schemas';

describe('platform content schemas', () => {
  it('accepts Mkety public site settings and navigation items', () => {
    expect(
      siteSettingsSchema.parse({
        brandName: 'Mkety',
        defaultSeoTitle: 'Mkety | Build, automate, deploy, and operate',
        defaultSeoDescription: 'Technology platform for AI, automation, deployment, and business systems.',
        primaryColor: '#6D5DF6',
        secondaryColor: '#A855F7',
        accentColor: '#22D3EE',
      }).brandName,
    ).toBe('Mkety');

    expect(navigationItemSchema.parse({ label: 'Platform', href: '#platform', area: 'header', sortOrder: 10 }).area).toBe(
      'header',
    );
  });

  it('rejects unsafe URLs for public CTAs', () => {
    expect(() => ctaSchema.parse({ label: 'Bad link', href: 'javascript:alert(1)' })).toThrow();
  });

  it('validates homepage sections for hero, workspaces, pricing, and footer', () => {
    expect(
      heroSectionSchema.parse({
        badge: 'Mkety Platform',
        headline: 'Build, automate, deploy, and operate with Mkety.',
        subheadline: 'Create AI agents, workflows, applications, websites, integrations, and business solutions.',
        primaryCta: { label: 'Get Started', href: '/create-workspace' },
        secondaryCta: { label: 'Explore Docs', href: '/docs' },
      }).primaryCta.label,
    ).toBe('Get Started');

    expect(
      workspaceSectionSchema.parse({
        eyebrow: 'Workspaces',
        title: 'One platform, multiple operating spaces',
        items: [
          {
            key: 'ai',
            title: 'AI Workspace',
            description: 'Build agents, connect knowledge, choose models, test, version, publish, and monitor AI apps.',
            href: '/app/ai',
          },
        ],
      }).items,
    ).toHaveLength(1);

    expect(
      pricingPlanSchema.parse({
        key: 'starter',
        name: 'Starter',
        priceLabel: 'Start free',
        description: 'For individuals and small teams exploring Mkety.',
        ctaLabel: 'Get Started',
        ctaHref: '/create-workspace',
        features: ['Projects', 'AI workspace', 'Usage tracking'],
      }).features,
    ).toContain('Usage tracking');

    expect(
      footerGroupSchema.parse({
        title: 'Platform',
        links: [{ label: 'Workspaces', href: '#workspaces' }],
      }).links[0]?.label,
    ).toBe('Workspaces');
  });

  it('validates documentation articles as markdown content', () => {
    expect(
      docsArticleSchema.parse({
        categoryKey: 'getting-started',
        slug: 'what-is-mkety',
        title: 'What is Mkety?',
        excerpt: 'Understand the Mkety platform.',
        bodyMarkdown: '# What is Mkety?\n\nMkety is a technology platform.',
      }).slug,
    ).toBe('what-is-mkety');
  });
});
