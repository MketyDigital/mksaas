import type { MetadataRoute } from 'next';

import { getMketySitemapEntries } from '@/features/platform-content/indexing';

export default function sitemap(): MetadataRoute.Sitemap {
  return getMketySitemapEntries();
}
