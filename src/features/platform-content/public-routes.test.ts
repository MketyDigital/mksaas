import { MKETY_PUBLIC_ROUTES, isMketyPublicSitemapPath } from './public-routes';

describe('Mkety public route contract', () => {
  it('contains the required public mkety.com routes', () => {
    const paths = MKETY_PUBLIC_ROUTES.map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/platform',
        '/workspaces',
        '/solutions',
        '/academy',
        '/pricing',
        '/enterprise',
        '/about',
        '/docs',
        '/privacy',
        '/terms',
        '/contact',
      ]),
    );
  });

  it.each(['/t/acme', '/admin', '/api/health', '/app', '/app/ai', '/create-workspace'])(
    'excludes authenticated or internal path %s from the public sitemap',
    (path) => {
      expect(isMketyPublicSitemapPath(path)).toBe(false);
    },
  );

  it('includes only registered sitemap routes', () => {
    expect(isMketyPublicSitemapPath('/pricing')).toBe(true);
    expect(isMketyPublicSitemapPath('/docs')).toBe(true);
    expect(isMketyPublicSitemapPath('/something-unregistered')).toBe(false);
  });
});
