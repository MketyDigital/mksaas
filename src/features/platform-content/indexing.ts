import type { MetadataRoute } from 'next';

import { MKETY_PUBLIC_ROUTES } from './public-routes';

const MKETY_PUBLIC_ORIGIN = 'https://mkety.com';
export const MKETY_PUBLIC_CONTENT_LAST_MODIFIED = new Date('2026-09-28T03:24:08Z');

export function getMketySitemapEntries(): MetadataRoute.Sitemap {
  return MKETY_PUBLIC_ROUTES.filter((route) => route.sitemap).map((route) => ({
    url: route.path === '/' ? `${MKETY_PUBLIC_ORIGIN}/` : `${MKETY_PUBLIC_ORIGIN}${route.path}`,
    changeFrequency: route.path === '/docs' ? 'weekly' : 'monthly',
    priority: route.priority ?? 0.5,
    lastModified: MKETY_PUBLIC_CONTENT_LAST_MODIFIED,
  }));
}

export function getMketyDocsSitemapEntries(
  articles: ReadonlyArray<{ categoryKey: string; slug: string }>,
): MetadataRoute.Sitemap {
  return articles.map((article) => ({
    url: `${MKETY_PUBLIC_ORIGIN}/docs/${article.categoryKey}/${article.slug}`,
    changeFrequency: 'weekly',
    priority: article.categoryKey === 'trust' || article.categoryKey === 'getting-started' ? 0.7 : 0.6,
    lastModified: MKETY_PUBLIC_CONTENT_LAST_MODIFIED,
  }));
}

export function getMketyRobotsPolicy(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/app/', '/t/', '/login', '/signup', '/select-tenant', '/create-workspace', '/payment/'],
      },
    ],
    sitemap: `${MKETY_PUBLIC_ORIGIN}/sitemap.xml`,
    host: MKETY_PUBLIC_ORIGIN,
  };
}
