import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { platformPages, platformPageSections } from '@/shared/db/schema/platform-content';

import { getPublishedNavigation, getPublishedPlatformSiteSettings } from './queries';
import { defaultFooterGroups } from '../defaults';
import { footerGroupSchema } from '../schemas';

const PUBLISHED = 'published' as const;

async function getPublishedFooterGroups() {
  try {
    const page = await db.query.platformPages.findFirst({
      where: and(eq(platformPages.slug, 'home'), eq(platformPages.status, PUBLISHED), eq(platformPages.enabled, true)),
    });

    if (!page) return defaultFooterGroups;

    const row = await db.query.platformPageSections.findFirst({
      where: and(
        eq(platformPageSections.pageId, page.id),
        eq(platformPageSections.sectionKey, 'footer'),
        eq(platformPageSections.status, PUBLISHED),
        eq(platformPageSections.enabled, true),
      ),
    });

    return row ? footerGroupSchema.array().parse(row.contentJson) : defaultFooterGroups;
  } catch {
    return defaultFooterGroups;
  }
}

export async function getPublishedPublicChrome() {
  const [settings, navigation, footerGroups] = await Promise.all([
    getPublishedPlatformSiteSettings(),
    getPublishedNavigation('header'),
    getPublishedFooterGroups(),
  ]);

  return { settings, navigation, footerGroups };
}
