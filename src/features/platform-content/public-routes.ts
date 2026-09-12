export interface MketyPublicRoute {
  path: string;
  key: string;
  label: string;
  sitemap: boolean;
  priority?: number;
}

export const MKETY_PUBLIC_ROUTES = [
  { path: '/', key: 'home', label: 'Home', sitemap: true, priority: 1 },
  { path: '/platform', key: 'platform', label: 'Platform', sitemap: true, priority: 0.9 },
  { path: '/workspaces', key: 'workspaces', label: 'Workspaces', sitemap: true, priority: 0.9 },
  { path: '/solutions', key: 'solutions', label: 'SolutionHub', sitemap: true, priority: 0.9 },
  { path: '/academy', key: 'academy', label: 'Academy', sitemap: true, priority: 0.8 },
  { path: '/pricing', key: 'pricing', label: 'Pricing', sitemap: true, priority: 0.8 },
  { path: '/enterprise', key: 'enterprise', label: 'Enterprise', sitemap: true, priority: 0.8 },
  { path: '/about', key: 'about', label: 'About', sitemap: true, priority: 0.6 },
  { path: '/docs', key: 'docs', label: 'Docs', sitemap: true, priority: 0.8 },
  { path: '/privacy', key: 'privacy', label: 'Privacy', sitemap: true, priority: 0.3 },
  { path: '/terms', key: 'terms', label: 'Terms', sitemap: true, priority: 0.3 },
  { path: '/contact', key: 'contact', label: 'Contact', sitemap: true, priority: 0.5 },
] as const satisfies readonly MketyPublicRoute[];

const PUBLIC_SITEMAP_PATHS = new Set(MKETY_PUBLIC_ROUTES.filter((route) => route.sitemap).map((route) => route.path));

export function isMketyPublicSitemapPath(path: string) {
  return PUBLIC_SITEMAP_PATHS.has(path as (typeof MKETY_PUBLIC_ROUTES)[number]['path']);
}
