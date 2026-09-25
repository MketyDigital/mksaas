import type { MetadataRoute } from 'next';

import { getMketySitemapEntries } from '@/features/platform-content/indexing';
import { getPublishedDocsTree } from '@/features/platform-content/server/queries';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [publicEntries, docs] = await Promise.all([Promise.resolve(getMketySitemapEntries()), getPublishedDocsTree()]);

  const docsEntries: MetadataRoute.Sitemap = docs.articles.map((article) => ({
    url: `https://mkety.com/docs/${article.categoryKey}/${article.slug}`,
    changeFrequency: 'weekly',
    priority: article.categoryKey === 'trust' || article.categoryKey === 'getting-started' ? 0.7 : 0.6,
  }));

  return [...publicEntries, ...docsEntries];
}
