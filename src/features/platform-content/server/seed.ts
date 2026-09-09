import { and, eq, isNull } from 'drizzle-orm';

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
import { MKETY_LEGAL_PAGE_DEFAULTS } from '../legal-page-defaults';
import { getPricingPlanSortOrder } from '../pricing';
import { MKETY_PUBLIC_PAGE_DEFAULTS } from '../public-page-defaults';

const PUBLISHED = 'published' as const;
const publicPageDefaults = [...MKETY_PUBLIC_PAGE_DEFAULTS, ...MKETY_LEGAL_PAGE_DEFAULTS];

type SeedResult = {
  siteSettings: 'created' | 'exists';
  homepage: 'created' | 'exists';
  homepageSections: number;
  publicPages: number;
  publicPageSections: number;
  navigationItems: number;
  pricingPlans: number;
  pricingFeatures: number;
  pricingPlanOrderingUpdated: number;
  docsCategories: number;
  docsArticles: number;
  seedOwnedRecordsUpdated: number;
};

const homepageSectionDefaults = [
  { sectionKey: 'hero', sectionType: 'hero', sortOrder: 10, contentJson: defaultHeroSection },
  { sectionKey: 'platform', sectionType: 'platform_overview', sortOrder: 20, contentJson: defaultPlatformOverviewSection },
  { sectionKey: 'workspaces', sectionType: 'workspaces', sortOrder: 30, contentJson: defaultWorkspaceSection },
  { sectionKey: 'solutions', sectionType: 'solution_hub', sortOrder: 40, contentJson: defaultSolutionHubSection },
  { sectionKey: 'academy', sectionType: 'academy', sortOrder: 50, contentJson: defaultAcademySection },
  { sectionKey: 'enterprise', sectionType: 'enterprise', sortOrder: 60, contentJson: defaultEnterpriseSection },
  { sectionKey: 'trust', sectionType: 'trust', sortOrder: 70, contentJson: defaultTrustSection },
  { sectionKey: 'faq', sectionType: 'faq', sortOrder: 80, contentJson: defaultFaqItems },
  { sectionKey: 'footer', sectionType: 'footer_cta', sortOrder: 90, contentJson: defaultFooterGroups },
] as const;

/**
 * Seeds initial Mkety public website/docs records from code-owned defaults.
 * Existing admin-managed content is never overwritten. Rows that still have
 * updated_by = NULL are seed-owned and may be refreshed to the current safe
 * defaults; once an admin edits/publishes a record, the seeder leaves it alone.
 */
export async function seedDefaultPlatformContent(): Promise<SeedResult> {
  const result: SeedResult = {
    siteSettings: 'exists',
    homepage: 'exists',
    homepageSections: 0,
    publicPages: 0,
    publicPageSections: 0,
    navigationItems: 0,
    pricingPlans: 0,
    pricingFeatures: 0,
    pricingPlanOrderingUpdated: 0,
    docsCategories: 0,
    docsArticles: 0,
    seedOwnedRecordsUpdated: 0,
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
  } else if (existingSettings.updatedBy == null) {
    const refreshed = await db
      .update(platformSiteSettings)
      .set({
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
        publishedAt: existingSettings.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(platformSiteSettings.id, existingSettings.id), isNull(platformSiteSettings.updatedBy)))
      .returning({ id: platformSiteSettings.id });
    result.seedOwnedRecordsUpdated += refreshed.length;
  }

  let home = await db.query.platformPages.findFirst({
    where: eq(platformPages.slug, 'home'),
  });

  if (!home) {
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
      .returning();

    home = inserted[0];
    result.homepage = 'created';
  } else if (home.updatedBy == null) {
    const refreshed = await db
      .update(platformPages)
      .set({
        title: 'Mkety Home',
        status: PUBLISHED,
        seoTitle: defaultPlatformSiteSettings.defaultSeoTitle,
        seoDescription: defaultPlatformSiteSettings.defaultSeoDescription,
        enabled: true,
        publishedAt: home.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(platformPages.id, home.id), isNull(platformPages.updatedBy)))
      .returning();
    if (refreshed[0]) {
      home = refreshed[0];
      result.seedOwnedRecordsUpdated += 1;
    }
  }

  if (home) {
    for (const section of homepageSectionDefaults) {
      const existing = await db.query.platformPageSections.findFirst({
        where: and(eq(platformPageSections.pageId, home.id), eq(platformPageSections.sectionKey, section.sectionKey)),
      });

      if (!existing) {
        await db.insert(platformPageSections).values({
          pageId: home.id,
          sectionKey: section.sectionKey,
          sectionType: section.sectionType,
          sortOrder: section.sortOrder,
          enabled: true,
          status: PUBLISHED,
          contentJson: section.contentJson,
          publishedAt: new Date(),
        });
        result.homepageSections += 1;
      } else if (existing.updatedBy == null) {
        const refreshed = await db
          .update(platformPageSections)
          .set({
            sectionType: section.sectionType,
            sortOrder: section.sortOrder,
            enabled: true,
            status: PUBLISHED,
            contentJson: section.contentJson,
            publishedAt: existing.publishedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(platformPageSections.id, existing.id), isNull(platformPageSections.updatedBy)))
          .returning({ id: platformPageSections.id });
        result.seedOwnedRecordsUpdated += refreshed.length;
      }
    }
  }

  for (const publicPage of publicPageDefaults) {
    let page = await db.query.platformPages.findFirst({
      where: eq(platformPages.slug, publicPage.slug),
    });

    if (!page) {
      const inserted = await db
        .insert(platformPages)
        .values({
          slug: publicPage.slug,
          title: publicPage.title,
          status: PUBLISHED,
          seoTitle: publicPage.seoTitle,
          seoDescription: publicPage.seoDescription,
          enabled: true,
          publishedAt: new Date(),
        })
        .returning();

      page = inserted[0];
      result.publicPages += 1;
    } else if (page.updatedBy == null) {
      const refreshed = await db
        .update(platformPages)
        .set({
          title: publicPage.title,
          status: PUBLISHED,
          seoTitle: publicPage.seoTitle,
          seoDescription: publicPage.seoDescription,
          enabled: true,
          publishedAt: page.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(platformPages.id, page.id), isNull(platformPages.updatedBy)))
        .returning();
      if (refreshed[0]) {
        page = refreshed[0];
        result.seedOwnedRecordsUpdated += 1;
      }
    }

    if (!page) continue;

    const pageSections = [
      {
        sectionKey: 'intro',
        sectionType: 'public_content',
        sortOrder: 10,
        contentJson: {
          eyebrow: publicPage.eyebrow,
          title: publicPage.headline,
          description: publicPage.intro,
          items: [],
        },
      },
      ...publicPage.sections.map((section, index) => ({
        sectionKey: `section-${(index + 1) * 10}`,
        sectionType: 'public_content',
        sortOrder: (index + 2) * 10,
        contentJson: section,
      })),
    ];

    for (const section of pageSections) {
      const existingSection = await db.query.platformPageSections.findFirst({
        where: and(eq(platformPageSections.pageId, page.id), eq(platformPageSections.sectionKey, section.sectionKey)),
      });

      if (!existingSection) {
        await db.insert(platformPageSections).values({
          pageId: page.id,
          sectionKey: section.sectionKey,
          sectionType: section.sectionType,
          sortOrder: section.sortOrder,
          enabled: true,
          status: PUBLISHED,
          contentJson: section.contentJson,
          publishedAt: new Date(),
        });
        result.publicPageSections += 1;
      } else if (existingSection.updatedBy == null) {
        const refreshed = await db
          .update(platformPageSections)
          .set({
            sectionType: section.sectionType,
            sortOrder: section.sortOrder,
            enabled: true,
            status: PUBLISHED,
            contentJson: section.contentJson,
            publishedAt: existingSection.publishedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(platformPageSections.id, existingSection.id), isNull(platformPageSections.updatedBy)))
          .returning({ id: platformPageSections.id });
        result.seedOwnedRecordsUpdated += refreshed.length;
      }
    }
  }

  for (const item of defaultPlatformNavigation) {
    const existing = await db.query.platformNavigationItems.findFirst({
      where: eq(platformNavigationItems.label, item.label),
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
    } else if (existing.updatedBy == null) {
      const refreshed = await db
        .update(platformNavigationItems)
        .set({
          area: item.area,
          href: item.href,
          sortOrder: item.sortOrder,
          enabled: item.enabled,
          external: item.external,
          status: PUBLISHED,
          updatedAt: new Date(),
        })
        .where(and(eq(platformNavigationItems.id, existing.id), isNull(platformNavigationItems.updatedBy)))
        .returning({ id: platformNavigationItems.id });
      result.seedOwnedRecordsUpdated += refreshed.length;
    }
  }

  const planIdsByKey = new Map<string, string>();

  for (const plan of defaultPricingPlans) {
    const expectedSortOrder = getPricingPlanSortOrder(plan.key);
    const existing = await db.query.platformPricingPlans.findFirst({
      where: eq(platformPricingPlans.key, plan.key),
    });

    if (existing) {
      planIdsByKey.set(plan.key, existing.id);
      if (existing.updatedBy == null) {
        const refreshed = await db
          .update(platformPricingPlans)
          .set({
            name: plan.name,
            priceLabel: plan.priceLabel,
            billingLabel: plan.billingLabel,
            description: plan.description,
            highlighted: plan.highlighted,
            ctaLabel: plan.ctaLabel,
            ctaHref: plan.ctaHref,
            sortOrder: expectedSortOrder,
            status: PUBLISHED,
            updatedAt: new Date(),
          })
          .where(and(eq(platformPricingPlans.id, existing.id), isNull(platformPricingPlans.updatedBy)))
          .returning({ id: platformPricingPlans.id });

        if (refreshed.length > 0) {
          await db.delete(platformPricingFeatures).where(eq(platformPricingFeatures.planId, existing.id));
          await db.insert(platformPricingFeatures).values(
            plan.features.map((feature, index) => ({
              planId: existing.id,
              label: feature,
              sortOrder: index * 10,
              enabled: true,
            })),
          );
          result.seedOwnedRecordsUpdated += 1;
          result.pricingFeatures += plan.features.length;
        }
      } else if (existing.sortOrder !== expectedSortOrder) {
        await db
          .update(platformPricingPlans)
          .set({ sortOrder: expectedSortOrder })
          .where(and(eq(platformPricingPlans.id, existing.id), eq(platformPricingPlans.key, plan.key)));
        result.pricingPlanOrderingUpdated += 1;
      }
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
        sortOrder: expectedSortOrder,
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
      if (existing.updatedBy == null) {
        const refreshed = await db
          .update(platformDocsCategories)
          .set({
            title: category.title,
            description: category.description,
            sortOrder: category.sortOrder,
            status: PUBLISHED,
            updatedAt: new Date(),
          })
          .where(and(eq(platformDocsCategories.id, existing.id), isNull(platformDocsCategories.updatedBy)))
          .returning({ id: platformDocsCategories.id });
        result.seedOwnedRecordsUpdated += refreshed.length;
      }
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
    } else if (existing.updatedBy == null) {
      const refreshed = await db
        .update(platformDocsArticles)
        .set({
          categoryId,
          title: article.title,
          excerpt: article.excerpt,
          bodyMarkdown: article.bodyMarkdown,
          sortOrder: article.sortOrder,
          status: PUBLISHED,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          publishedAt: existing.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(platformDocsArticles.id, existing.id), isNull(platformDocsArticles.updatedBy)))
        .returning({ id: platformDocsArticles.id });
      result.seedOwnedRecordsUpdated += refreshed.length;
    }
  }

  return result;
}