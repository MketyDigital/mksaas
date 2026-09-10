import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { platformPages } from '@/shared/db/schema/platform-content';

const PUBLISHED = 'published' as const;

export interface PublishedPublicPageSeo {
  slug: string;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
}

export async function getPublishedPublicPageSeo(slug: string): Promise<PublishedPublicPageSeo | null> {
  try {
    const row = await db.query.platformPages.findFirst({
      where: and(
        eq(platformPages.slug, slug),
        eq(platformPages.status, PUBLISHED),
        eq(platformPages.enabled, true),
      ),
      columns: {
        slug: true,
        title: true,
        seoTitle: true,
        seoDescription: true,
      },
    });

    if (!row) return null;

    return {
      slug: row.slug,
      title: row.title,
      seoTitle: row.seoTitle ?? undefined,
      seoDescription: row.seoDescription ?? undefined,
    };
  } catch {
    return null;
  }
}
