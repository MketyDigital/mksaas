import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  platformDocsArticles,
  platformDocsCategories,
  platformNavigationItems,
  platformPages,
  platformPageSections,
  platformPricingFeatures,
  platformPricingPlans,
  platformSiteSettings,
} from '@/shared/db/schema/platform-content';
import { createLogger } from '@/shared/lib/logger';

import {
  defaultAcademySection,
  defaultDocsArticles,
  defaultDocsCategories,
  defaultEnterpriseSection,
  defaultFaqItems,
  defaultFooterGroups,
  defaultHeroSection,
  defaultPlatformNavigation,
  defaultPlatformOverviewSection,
  defaultPlatformSiteSettings,
  defaultPricingPlans,
  defaultSolutionHubSection,
  defaultTrustSection,
  defaultWorkspaceSection,
} from '../defaults';
import {
  academySectionSchema,
  docsArticleSchema,
  docsCategorySchema,
  enterpriseSectionSchema,
  faqItemSchema,
  footerGroupSchema,
  heroSectionSchema,
  navigationItemSchema,
  platformOverviewSectionSchema,
  pricingPlanSchema,
  siteSettingsSchema,
  solutionHubSectionSchema,
  trustSectionSchema,
  workspaceSectionSchema,
} from '../schemas';

const PUBLISHED = 'published' as const;
const cmsLogger = createLogger({ module: 'platform-content' });

async function withFallback<T>(
  read: () => Promise<T | null | undefined>,
  fallback: T,
  operation = 'cms-read',
): Promise<T> {
  try {
    const value = await read();
    return value ?? fallback;
  } catch (error) {
    cmsLogger.warn(
      { operation, errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Mkety CMS read failed; serving safe fallback content',
    );
    return fallback;
  }
}

function getSectionPayload(sectionByKey: Map<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (sectionByKey.has(key)) return sectionByKey.get(key);
  }

  return undefined;
}

export async function getPublishedPlatformSiteSettings() {
  return withFallback(
    async () => {
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
    },
    defaultPlatformSiteSettings,
    'site-settings',
  );
}

export async function getPublishedNavigation(area?: 'header' | 'footer') {
  const fallback = !area
    ? defaultPlatformNavigation
    : defaultPlatformNavigation.filter((item) => item.area === area && item.enabled !== false);

  return withFallback(
    async () => {
      const rows = await db.query.platformNavigationItems.findMany({
        where: area
          ? and(
              eq(platformNavigationItems.status, PUBLISHED),
              eq(platformNavigationItems.enabled, true),
              eq(platformNavigationItems.area, area),
            )
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
    },
    fallback,
    `navigation:${area ?? 'all'}`,
  );
}

export async function getPublishedPricingPlans() {
  return withFallback(
    async () => {
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
    },
    defaultPricingPlans,
    'pricing-plans',
  );
}

export async function getPublishedDocsTree() {
  return withFallback(
    async () => {
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
    },
    {
      categories: defaultDocsCategories,
      articles: defaultDocsArticles,
    },
    'docs-tree',
  );
}

export async function getPublishedDocsArticle(slug: string) {
  const fallback =
    defaultDocsArticles.find((article) => `${article.categoryKey}/${article.slug}` === slug || article.slug === slug) ??
    null;

  return withFallback(
    async () => {
      const [categoryKey, articleSlug] = slug.includes('/') ? slug.split('/') : [undefined, slug];
      const conditions = [
        eq(platformDocsArticles.status, PUBLISHED),
        eq(platformDocsCategories.status, PUBLISHED),
        eq(platformDocsArticles.slug, articleSlug),
      ];

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
    },
    fallback,
    'docs-article',
  );
}

export async function getPublishedHomepageContent() {
  const [settings, navigation, pricingPlans] = await Promise.all([
    getPublishedPlatformSiteSettings(),
    getPublishedNavigation('header'),
    getPublishedPricingPlans(),
  ]);

  const sections = await withFallback(
    async () => {
      const page = await db.query.platformPages.findFirst({
        where: and(
          eq(platformPages.slug, 'home'),
          eq(platformPages.status, PUBLISHED),
          eq(platformPages.enabled, true),
        ),
      });

      if (!page) return null;

      const rows = await db.query.platformPageSections.findMany({
        where: and(
          eq(platformPageSections.pageId, page.id),
          eq(platformPageSections.status, PUBLISHED),
          eq(platformPageSections.enabled, true),
        ),
        orderBy: [asc(platformPageSections.sortOrder)],
      });

      if (rows.length === 0) return null;

      const sectionByKey = new Map(rows.map((row) => [row.sectionKey, row.contentJson]));
      const heroPayload = getSectionPayload(sectionByKey, 'home.hero', 'hero');
      const platformPayload = getSectionPayload(sectionByKey, 'home.platform', 'platform');
      const workspacesPayload = getSectionPayload(sectionByKey, 'home.workspaces', 'workspaces');
      const solutionsPayload = getSectionPayload(sectionByKey, 'home.solutions', 'solutions');
      const academyPayload = getSectionPayload(sectionByKey, 'home.academy', 'academy');
      const enterprisePayload = getSectionPayload(sectionByKey, 'home.enterprise', 'enterprise');
      const trustPayload = getSectionPayload(sectionByKey, 'home.trust', 'trust');
      const faqPayload = getSectionPayload(sectionByKey, 'home.faq', 'faq');
      const footerPayload = getSectionPayload(sectionByKey, 'home.footer', 'footer');

      return {
        hero: heroPayload ? heroSectionSchema.parse(heroPayload) : defaultHeroSection,
        platformOverview: platformPayload
          ? platformOverviewSectionSchema.parse(platformPayload)
          : defaultPlatformOverviewSection,
        workspaces: workspacesPayload ? workspaceSectionSchema.parse(workspacesPayload) : defaultWorkspaceSection,
        solutionHub: solutionsPayload ? solutionHubSectionSchema.parse(solutionsPayload) : defaultSolutionHubSection,
        academy: academyPayload ? academySectionSchema.parse(academyPayload) : defaultAcademySection,
        enterprise: enterprisePayload ? enterpriseSectionSchema.parse(enterprisePayload) : defaultEnterpriseSection,
        trust: trustPayload ? trustSectionSchema.parse(trustPayload) : defaultTrustSection,
        faqItems: faqPayload ? faqItemSchema.array().parse(faqPayload) : defaultFaqItems,
        footerGroups: footerPayload ? footerGroupSchema.array().parse(footerPayload) : defaultFooterGroups,
      };
    },
    {
      hero: defaultHeroSection,
      platformOverview: defaultPlatformOverviewSection,
      workspaces: defaultWorkspaceSection,
      solutionHub: defaultSolutionHubSection,
      academy: defaultAcademySection,
      enterprise: defaultEnterpriseSection,
      trust: defaultTrustSection,
      faqItems: defaultFaqItems,
      footerGroups: defaultFooterGroups,
    },
    'homepage-sections',
  );

  return {
    settings,
    navigation,
    hero: sections.hero,
    platformOverview: sections.platformOverview,
    workspaces: sections.workspaces,
    solutionHub: sections.solutionHub,
    academy: sections.academy,
    enterprise: sections.enterprise,
    trust: sections.trust,
    pricingPlans,
    faqItems: sections.faqItems,
    footerGroups: sections.footerGroups,
  };
}
