import type { MetadataRoute } from 'next';

import { MKETY_PUBLIC_ROUTES } from './public-routes';

const MKETY_PUBLIC_ORIGIN = 'https://mkety.com';

export function getMketySitemapEntries(): MetadataRoute.Sitemap {
  return MKETY_PUBLIC_ROUTES.filter((route) => route.sitemap).map((route) => ({
    url: route.path === '/' ? `${MKETY_PUBLIC_ORIGIN}/` : `${MKETY_PUBLIC_ORIGIN}${route.path}`,
    changeFrequency: route.path === '/docs' ? 'weekly' : 'monthly',
    priority: route.priority ?? 0.5,
  }));
}

export function getMketyRobotsPolicy(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/create-workspace', '/app/', '/t/'],
      },
    ],
    sitemap: `${MKETY_PUBLIC_ORIGIN}/sitemap.xml`,
    host: MKETY_PUBLIC_ORIGIN,
  };
}
