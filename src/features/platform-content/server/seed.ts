import { eq } from 'drizzle-orm';

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

const PUBLISHED = 'published' as const;

type SeedResult = {
  siteSettings: 'created' | 'exists';
  homepage: 'created' | 'exists';
  navigationItems: number;
  pricingPlans: number;
  pricingFeatures: number;
  docsCategories: number;
  docsArticles: number;
};

/**
 * Seeds the initial Mkety public website/docs records from the code-owned defaults.
 *
 * This is intentionally idempotent and conservative:
 * - it does not overwrite existing admin-managed content;
 * - it creates published defaults only when a key/slug is absent;
 * - it keeps real billing/security/deployment logic outside editable content.
 */
export async function seedDefaultPlatformContent(): Promise<SeedResult> {
  const result: SeedResult = {
    siteSettings: 'exists',
    homepage: 'exists',
    navigationItems: 0,
    pricingPlans: 0,
    pricingFeatures: 0,
    docsCategories: 0,
    docsArticles: 0,
  };

  const existingSettings = await db.query.platformSiteSettings.findFirst({
    where: eq(platformSiteSettings.environment, 'production'),
  });

  if (!existingSettings) {
    await db.insert(platformSiteSettings).values({
      environment: 'production',
      status: PUBLISHED,
      brandName: defaultPlatformSiteSettings.brandName,
      logoUrl: defaultPlatformSiteSettings.logoUrl,
      faviconUrl: defaultPlatformSiteSettings.faviconUrl,
      primaryColor: defaultPlatformSiteSettings.primaryColor,
      secondaryColor: defaultPlatformSiteSettings.secondaryColor,
      accentColor: defaultPlatformSiteSettings.accentColor,
      defaultSeoTitle: defaultPlatformSiteSettings.defaultSeoTitle,
      defaultSeoDescription: defaultPlatformSiteSettings.defaultSeoDescription,
      socialImageUrl: defaultPlatformSiteSettings.socialImageUrl,
      contactEmail: defaultPlatformSiteSettings.contactEmail,
      contactHref: defaultPlatformSiteSettings.contactHref,
      legalLinksJson: defaultPlatformSiteSettings.legalLinks,
      publishedAt: new Date(),
    });
    result.siteSettings = 'created';
  }

  const existingHome = await db.query.platformPages.findFirst({
    where: eq(platformPages.slug, 'home'),
  });

  if (!existingHome) {
    const inserted = await db
      .insert(platformPages)
      .values({
        slug: 'home',
        title: 'Mkety Home',
        status: PUBLISHED,
        seoTitle: defaultPlatformSiteSettings.defaultSeoTitle,
        seoDescription: defaultPlatformSiteSettings.defaultSeoDescription,
        enabled: true,
        publishedAt: new Date(),
      })
      .returning({ id: platformPages.id });

    const pageId = inserted[0]?.id;

    if (pageId) {
      await db.insert(platformPageSections).values([
        {
          pageId,
          sectionKey: 'hero',
          sectionType: 'hero',
          sortOrder: 10,
          enabled: true,
          status: PUBLISHED,
          contentJson: defaultHeroSection,
          publishedAt: new Date(),
        },
        {
          pageId,
          sectionKey: 'workspaces',
          sectionType: 'workspaces',
          sortOrder: 20,
          enabled: true,
          status: PUBLISHED,
          contentJson: defaultWorkspaceSection,
          publishedAt: new Date(),
        },
        {
          pageId,
          sectionKey: 'faq',
          sectionType: 'faq',
          sortOrder: 80,
          enabled: true,
          status: PUBLISHED,
          contentJson: defaultFaqItems,
          publishedAt: new Date(),
        },
        {
          pageId,
          sectionKey: 'footer',
          sectionType: 'footer_cta',
          sortOrder: 90,
          enabled: true,
          status: PUBLISHED,
          contentJson: defaultFooterGroups,
          publishedAt: new Date(),
        },
      ]);
    }

    result.homepage = 'created';
  }

  for (const item of defaultPlatformNavigation) {
    const existing = await db.query.platformNavigationItems.findFirst({
      where: eq(platformNavigationItems.href, item.href),
    });

    if (!existing) {
      await db.insert(platformNavigationItems).values({
        area: item.area,
        label: item.label,
        href: item.href,
        sortOrder: item.sortOrder,
        enabled: item.enabled,
        external: item.external,
        status: PUBLISHED,
      });
      result.navigationItems += 1;
    }
  }

  const planIdsByKey = new Map<string, string>();

  for (const plan of defaultPricingPlans) {
    const existing = await db.query.platformPricingPlans.findFirst({
      where: eq(platformPricingPlans.key, plan.key),
    });

    if (existing) {
      planIdsByKey.set(plan.key, existing.id);
      continue;
    }

    const inserted = await db
      .insert(platformPricingPlans)
      .values({
        key: plan.key,
        name: plan.name,
        priceLabel: plan.priceLabel,
        billingLabel: plan.billingLabel,
        description: plan.description,
        highlighted: plan.highlighted,
        ctaLabel: plan.ctaLabel,
        ctaHref: plan.ctaHref,
        status: PUBLISHED,
      })
      .returning({ id: platformPricingPlans.id });

    const planId = inserted[0]?.id;
    if (!planId) continue;
    planIdsByKey.set(plan.key, planId);
    result.pricingPlans += 1;

    await db.insert(platformPricingFeatures).values(
      plan.features.map((feature, index) => ({
        planId,
        label: feature,
        sortOrder: index * 10,
        enabled: true,
      })),
    );
    result.pricingFeatures += plan.features.length;
  }

  const categoryIdsByKey = new Map<string, string>();

  for (const category of defaultDocsCategories) {
    const existing = await db.query.platformDocsCategories.findFirst({
      where: eq(platformDocsCategories.key, category.key),
    });

    if (existing) {
      categoryIdsByKey.set(category.key, existing.id);
      continue;
    }

    const inserted = await db
      .insert(platformDocsCategories)
      .values({
        key: category.key,
        title: category.title,
        description: category.description,
        sortOrder: category.sortOrder,
        status: PUBLISHED,
      })
      .returning({ id: platformDocsCategories.id });

    const categoryId = inserted[0]?.id;
    if (!categoryId) continue;
    categoryIdsByKey.set(category.key, categoryId);
    result.docsCategories += 1;
  }

  for (const article of defaultDocsArticles) {
    const categoryId = categoryIdsByKey.get(article.categoryKey);
    if (!categoryId) continue;

    const existing = await db.query.platformDocsArticles.findFirst({
      where: eq(platformDocsArticles.slug, article.slug),
    });

    if (!existing) {
      await db.insert(platformDocsArticles).values({
        categoryId,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        bodyMarkdown: article.bodyMarkdown,
        sortOrder: article.sortOrder,
        status: PUBLISHED,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        publishedAt: new Date(),
      });
      result.docsArticles += 1;
    }
  }

  return result;
}
