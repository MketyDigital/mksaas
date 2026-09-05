import { platformContentDraftActionSchema, platformPublishActionSchema } from './action-schemas';

describe('platform content admin action schemas', () => {
  it('validates draft save requests with a known content area', () => {
    const parsed = platformContentDraftActionSchema.parse({
      area: 'public-site',
      entityType: 'page_section',
      entityKey: 'home.hero',
      payload: {
        badge: 'Mkety Platform',
        headline: 'Build with Mkety',
        subheadline: 'Build, automate, deploy, and operate from one workspace.',
        primaryCta: { label: 'Get Started', href: '/create-workspace' },
        secondaryCta: { label: 'Docs', href: '/docs' },
        previewItems: [],
      },
    });

    expect(parsed.area).toBe('public-site');
    expect(parsed.entityType).toBe('page_section');
    expect(parsed.entityKey).toBe('home.hero');
  });

  it('validates collection draft shapes used by admin CMS forms', () => {
    const navigation = platformContentDraftActionSchema.parse({
      area: 'navigation',
      entityType: 'navigation_item',
      entityKey: 'header',
      payload: { items: [{ label: 'Docs', href: '/docs', area: 'header', sortOrder: 10 }] },
    });

    const pricing = platformContentDraftActionSchema.parse({
      area: 'pricing',
      entityType: 'pricing_plan',
      entityKey: 'pricing-plans',
      payload: {
        plans: [
          {
            key: 'starter',
            name: 'Starter',
            priceLabel: 'Start free',
            description: 'For early Mkety users.',
            ctaLabel: 'Get Started',
            ctaHref: '/create-workspace',
            features: ['AI workspace entry'],
          },
        ],
      },
    });

    expect(navigation.payload.items).toHaveLength(1);
    expect(pricing.payload.plans).toHaveLength(1);
  });

  it('rejects unsupported CMS entity types before hitting server actions', () => {
    expect(() =>
      platformContentDraftActionSchema.parse({
        area: 'public-site',
        entityType: 'billing_ledger',
        entityKey: 'unsafe',
        payload: {},
      }),
    ).toThrow();
  });

  it('validates publish requests without accepting arbitrary action names', () => {
    const parsed = platformPublishActionSchema.parse({
      area: 'docs',
      entityType: 'docs_article',
      entityKey: 'docs-defaults',
    });

    expect(parsed.entityType).toBe('docs_article');
  });
});
