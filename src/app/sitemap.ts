import type { MetadataRoute } from 'next';

import { getMketyDocsSitemapEntries, getMketySitemapEntries } from '@/features/platform-content/indexing';
import { getPublishedDocsTree } from '@/features/platform-content/server/queries';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [publicEntries, docs] = await Promise.all([Promise.resolve(getMketySitemapEntries()), getPublishedDocsTree()]);

  return [...publicEntries, ...getMketyDocsSitemapEntries(docs.articles)];
}
