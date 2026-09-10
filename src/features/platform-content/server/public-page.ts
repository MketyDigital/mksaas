import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { platformPages, platformPageSections } from '@/shared/db/schema/platform-content';

import { normalizePublicPageSalesLinks } from '../commercial-routing';
import { getDefaultLegalPage } from '../legal-page-defaults';
import { getDefaultPublicPage, type MketyPublicPageDefault } from '../public-page-defaults';
import { platformOverviewSectionSchema } from '../schemas';

const PUBLISHED = 'published' as const;

export type MketyPublishedPublicPage = MketyPublicPageDefault;

function normalizePage(page: MketyPublishedPublicPage): MketyPublishedPublicPage {
  return { ...page, sections: normalizePublicPageSalesLinks(page.sections) };
}

export async function getPublishedPublicPageContent(slug: string): Promise<MketyPublishedPublicPage | null> {
  const fallback = getDefaultPublicPage(slug) ?? getDefaultLegalPage(slug);
  if (!fallback) return null;
  const normalizedFallback = normalizePage(fallback);

  try {
    const page = await db.query.platformPages.findFirst({
      where: and(eq(platformPages.slug, slug), eq(platformPages.status, PUBLISHED), eq(platformPages.enabled, true)),
    });

    if (!page) return normalizedFallback;

    const rows = await db.query.platformPageSections.findMany({
      where: and(
        eq(platformPageSections.pageId, page.id),
        eq(platformPageSections.status, PUBLISHED),
        eq(platformPageSections.enabled, true),
      ),
      orderBy: [asc(platformPageSections.sortOrder)],
    });

    const introRow = rows.find((row) => row.sectionKey === 'intro');
    const intro = introRow ? platformOverviewSectionSchema.parse(introRow.contentJson) : null;
    const sectionRows = rows.filter((row) => row.sectionKey !== 'intro');
    const sections = normalizePublicPageSalesLinks(
      sectionRows.length > 0
        ? sectionRows.map((row) => platformOverviewSectionSchema.parse(row.contentJson))
        : normalizedFallback.sections,
    );

    return {
      slug: page.slug,
      title: page.title,
      seoTitle: page.seoTitle ?? normalizedFallback.seoTitle,
      seoDescription: page.seoDescription ?? normalizedFallback.seoDescription,
      eyebrow: intro?.eyebrow ?? normalizedFallback.eyebrow,
      headline: intro?.title ?? normalizedFallback.headline,
      intro: intro?.description ?? normalizedFallback.intro,
      sections,
    };
  } catch {
    return normalizedFallback;
  }
}
