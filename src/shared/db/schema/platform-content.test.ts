import {
  platformContentActionEnum,
  platformContentEntityEnum,
  platformContentRevisions,
  platformContentStatusEnum,
  platformDocsArticles,
  platformDocsCategories,
  platformNavigationAreaEnum,
  platformNavigationItems,
  platformPageSections,
  platformPages,
  platformPricingFeatures,
  platformPricingPlans,
  platformSiteSettings,
} from './platform-content';

describe('platform content schema', () => {
  it('defines the required enum values for content lifecycle and classification', () => {
    expect(platformContentStatusEnum.enumValues).toEqual(['draft', 'published', 'archived']);
    expect(platformNavigationAreaEnum.enumValues).toEqual(['header', 'footer']);
    expect(platformContentActionEnum.enumValues).toEqual(['create', 'update', 'publish', 'unpublish', 'archive', 'delete']);
    expect(platformContentEntityEnum.enumValues).toEqual([
      'site_settings',
      'page',
      'page_section',
      'navigation_item',
      'pricing_plan',
      'pricing_feature',
      'docs_category',
      'docs_article',
    ]);
  });

  it('defines platform-level tables for public site, docs, pricing, navigation, and revisions', () => {
    expect(platformSiteSettings).toBeDefined();
    expect(platformPages).toBeDefined();
    expect(platformPageSections).toBeDefined();
    expect(platformNavigationItems).toBeDefined();
    expect(platformPricingPlans).toBeDefined();
    expect(platformPricingFeatures).toBeDefined();
    expect(platformDocsCategories).toBeDefined();
    expect(platformDocsArticles).toBeDefined();
    expect(platformContentRevisions).toBeDefined();
  });
});
