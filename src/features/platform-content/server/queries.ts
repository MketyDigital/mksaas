import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  platformDocsArticles,
  platformDocsCategories,
  platformNavigationItems,
  platformPageSections,
  platformPages,
  platformPricingFeatures,
  platformPricingPlans,
  platformSiteSettings,
} from '@/shared/db/schema/platform-content';

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
import {
  docsArticleSchema,
  docsCategorySchema,
  faqItemSchema,
  footerGroupSchema,
  heroSectionSchema,
  navigationItemSchema,
  pricingPlanSchema,
  siteSettingsSchema,
  workspaceSectionSchema,
} from '../schemas';

const PUBLISHED = 'published' as const;

async function withFallback<T>(read: () => Promise<T | null | undefined>, fallback: T): Promise<T> {
  try {
    const value = await read();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getPublishedPlatformSiteSettings() {
  return withFallback(async () => {
    const row = await db.query.platformSiteSettings.findFirst({
      where: and(eq(platformSiteSettings.environment, 'production'), eq(platformSiteSettings.status, PUBLISHED)),
      orderBy: [asc(platformSiteSettings.createdAt)],
    });

    if (!row) return null;

    return siteSettingsSchema.parse({
      brandName: row.brandName,
      logoUrl: row.logoUrl ?? undefined,
      faviconUrl: row.faviconUrl ?? undefined,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      accentColor: row.accentColor,
      defaultSeoTitle: row.defaultSeoTitle,
      defaultSeoDescription: row.defaultSeoDescription ?? defaultPlatformSiteSettings.defaultSeoDescription,
      socialImageUrl: row.socialImageUrl ?? undefined,
      contactEmail: row.contactEmail ?? undefined,
      contactHref: row.contactHref ?? undefined,
      legalLinks: row.legalLinksJson ?? [],
    });
  }, defaultPlatformSiteSettings);
}

export async function getPublishedNavigation(area?: 'header' | 'footer') {
  const fallback = !area
    ? defaultPlatformNavigation
    : defaultPlatformNavigation.filter((item) => item.area === area && item.enabled !== false);

  return withFallback(async () => {
    const rows = await db.query.platformNavigationItems.findMany({
      where: area
        ? and(eq(platformNavigationItems.status, PUBLISHED), eq(platformNavigationItems.enabled, true), eq(platformNavigationItems.area, area))
        : and(eq(platformNavigationItems.status, PUBLISHED), eq(platformNavigationItems.enabled, true)),
      orderBy: [asc(platformNavigationItems.area), asc(platformNavigationItems.sortOrder)],
    });

    if (rows.length === 0) return null;

    return rows.map((row) =>
      navigationItemSchema.parse({
        label: row.label,
        href: row.href,
        area: row.area,
        sortOrder: row.sortOrder,
        enabled: row.enabled,
        external: row.external,
      }),
    );
  }, fallback);
}

export async function getPublishedPricingPlans() {
  return withFallback(async () => {
    const rows = await db.query.platformPricingPlans.findMany({
      where: eq(platformPricingPlans.status, PUBLISHED),
      orderBy: [asc(platformPricingPlans.sortOrder)],
    });

    if (rows.length === 0) return null;

    const features = await db.query.platformPricingFeatures.findMany({
      where: eq(platformPricingFeatures.enabled, true),
      orderBy: [asc(platformPricingFeatures.sortOrder)],
    });

    return rows.map((row) => {
      const planFeatures = features.filter((feature) => feature.planId === row.id).map((feature) => feature.label);

      return pricingPlanSchema.parse({
        key: row.key,
        name: row.name,
        priceLabel: row.priceLabel,
        billingLabel: row.billingLabel ?? undefined,
        description: row.description,
        highlighted: row.highlighted,
        ctaLabel: row.ctaLabel,
        ctaHref: row.ctaHref,
        features: planFeatures.length > 0 ? planFeatures : ['Configured plan details are being prepared.'],
      });
    });
  }, defaultPricingPlans);
}

export async function getPublishedDocsTree() {
  return withFallback(async () => {
    const categories = await db.query.platformDocsCategories.findMany({
      where: eq(platformDocsCategories.status, PUBLISHED),
      orderBy: [asc(platformDocsCategories.sortOrder)],
    });

    if (categories.length === 0) return null;

    const articles = await db
      .select({
        categoryKey: platformDocsCategories.key,
        slug: platformDocsArticles.slug,
        title: platformDocsArticles.title,
        excerpt: platformDocsArticles.excerpt,
        bodyMarkdown: platformDocsArticles.bodyMarkdown,
        seoTitle: platformDocsArticles.seoTitle,
        seoDescription: platformDocsArticles.seoDescription,
        sortOrder: platformDocsArticles.sortOrder,
      })
      .from(platformDocsArticles)
      .innerJoin(platformDocsCategories, eq(platformDocsArticles.categoryId, platformDocsCategories.id))
      .where(and(eq(platformDocsArticles.status, PUBLISHED), eq(platformDocsCategories.status, PUBLISHED)))
      .orderBy(asc(platformDocsCategories.sortOrder), asc(platformDocsArticles.sortOrder));

    return {
      categories: categories.map((category) =>
        docsCategorySchema.parse({
          key: category.key,
          title: category.title,
          description: category.description ?? undefined,
          sortOrder: category.sortOrder,
        }),
      ),
      articles: articles.map((article) =>
        docsArticleSchema.parse({
          categoryKey: article.categoryKey,
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt ?? undefined,
          bodyMarkdown: article.bodyMarkdown,
          seoTitle: article.seoTitle ?? undefined,
          seoDescription: article.seoDescription ?? undefined,
          sortOrder: article.sortOrder,
        }),
      ),
    };
  }, {
    categories: defaultDocsCategories,
    articles: defaultDocsArticles,
  });
}

export async function getPublishedDocsArticle(slug: string) {
  const fallback = defaultDocsArticles.find((article) => `${article.categoryKey}/${article.slug}` === slug || article.slug === slug) ?? null;

  return withFallback(async () => {
    const [categoryKey, articleSlug] = slug.includes('/') ? slug.split('/') : [undefined, slug];
    const conditions = [eq(platformDocsArticles.status, PUBLISHED), eq(platformDocsCategories.status, PUBLISHED), eq(platformDocsArticles.slug, articleSlug)];

    if (categoryKey) {
      conditions.push(eq(platformDocsCategories.key, categoryKey));
    }

    const rows = await db
      .select({
        categoryKey: platformDocsCategories.key,
        slug: platformDocsArticles.slug,
        title: platformDocsArticles.title,
        excerpt: platformDocsArticles.excerpt,
        bodyMarkdown: platformDocsArticles.bodyMarkdown,
        seoTitle: platformDocsArticles.seoTitle,
        seoDescription: platformDocsArticles.seoDescription,
        sortOrder: platformDocsArticles.sortOrder,
      })
      .from(platformDocsArticles)
      .innerJoin(platformDocsCategories, eq(platformDocsArticles.categoryId, platformDocsCategories.id))
      .where(and(...conditions))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return docsArticleSchema.parse({
      categoryKey: row.categoryKey,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt ?? undefined,
      bodyMarkdown: row.bodyMarkdown,
      seoTitle: row.seoTitle ?? undefined,
      seoDescription: row.seoDescription ?? undefined,
      sortOrder: row.sortOrder,
    });
  }, fallback);
}

export async function getPublishedHomepageContent() {
  const [settings, navigation, pricingPlans] = await Promise.all([
    getPublishedPlatformSiteSettings(),
    getPublishedNavigation('header'),
    getPublishedPricingPlans(),
  ]);

  const sections = await withFallback(async () => {
    const page = await db.query.platformPages.findFirst({
      where: and(eq(platformPages.slug, 'home'), eq(platformPages.status, PUBLISHED), eq(platformPages.enabled, true)),
    });

    if (!page) return null;

    const rows = await db.query.platformPageSections.findMany({
      where: and(eq(platformPageSections.pageId, page.id), eq(platformPageSections.status, PUBLISHED), eq(platformPageSections.enabled, true)),
      orderBy: [asc(platformPageSections.sortOrder)],
    });

    if (rows.length === 0) return null;

    const sectionByKey = new Map(rows.map((row) => [row.sectionKey, row.contentJson]));

    return {
      hero: sectionByKey.has('hero') ? heroSectionSchema.parse(sectionByKey.get('hero')) : defaultHeroSection,
      workspaces: sectionByKey.has('workspaces') ? workspaceSectionSchema.parse(sectionByKey.get('workspaces')) : defaultWorkspaceSection,
      faqItems: sectionByKey.has('faq') ? faqItemSchema.array().parse(sectionByKey.get('faq')) : defaultFaqItems,
      footerGroups: sectionByKey.has('footer') ? footerGroupSchema.array().parse(sectionByKey.get('footer')) : defaultFooterGroups,
    };
  }, {
    hero: defaultHeroSection,
    workspaces: defaultWorkspaceSection,
    faqItems: defaultFaqItems,
    footerGroups: defaultFooterGroups,
  });

  return {
    settings,
    navigation,
    hero: sections.hero,
    workspaces: sections.workspaces,
    pricingPlans,
    faqItems: sections.faqItems,
    footerGroups: sections.footerGroups,
  };
}
