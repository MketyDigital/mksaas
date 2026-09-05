import {
  defaultDocsArticles,
  defaultDocsCategories,
  defaultFaqItems,
  defaultFooterGroups,
  defaultHeroSection,
  defaultPlatformNavigation,
  defaultPlatformSiteSettings,
  defaultPricingPlans,
  defaultWorkspaceSection,
} from '../defaults';

export async function getPublishedPlatformSiteSettings() {
  return defaultPlatformSiteSettings;
}

export async function getPublishedNavigation(area?: 'header' | 'footer') {
  if (!area) return defaultPlatformNavigation;
  return defaultPlatformNavigation.filter((item) => item.area === area && item.enabled !== false);
}

export async function getPublishedPricingPlans() {
  return defaultPricingPlans;
}

export async function getPublishedDocsTree() {
  return {
    categories: defaultDocsCategories,
    articles: defaultDocsArticles,
  };
}

export async function getPublishedDocsArticle(slug: string) {
  return defaultDocsArticles.find((article) => `${article.categoryKey}/${article.slug}` === slug || article.slug === slug) ?? null;
}

export async function getPublishedHomepageContent() {
  return {
    settings: defaultPlatformSiteSettings,
    navigation: defaultPlatformNavigation,
    hero: defaultHeroSection,
    workspaces: defaultWorkspaceSection,
    pricingPlans: defaultPricingPlans,
    faqItems: defaultFaqItems,
    footerGroups: defaultFooterGroups,
  };
}
