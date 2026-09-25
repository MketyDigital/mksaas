import { getMketyDocsSitemapEntries, getMketyRobotsPolicy, getMketySitemapEntries } from './indexing';

describe('Mkety public indexing controls', () => {
  it('sitemaps only canonical public routes', () => {
    const entries = getMketySitemapEntries();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://mkety.com/');
    expect(urls).toContain('https://mkety.com/platform');
    expect(urls).toContain('https://mkety.com/docs');
    expect(urls).toContain('https://mkety.com/privacy');
    expect(urls).toContain('https://mkety.com/terms');
    expect(urls.some((url) => url.includes('/api'))).toBe(false);
    expect(urls.some((url) => url.includes('/admin'))).toBe(false);
    expect(urls.some((url) => url.includes('/create-workspace'))).toBe(false);
    expect(urls.some((url) => url.includes('/app/'))).toBe(false);
  });

  it('includes canonical published docs article paths', () => {
    const entries = getMketyDocsSitemapEntries([
      { categoryKey: 'trust', slug: 'security-and-reliability' },
      { categoryKey: 'platform', slug: 'projects-and-workspaces' },
    ]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://mkety.com/docs/trust/security-and-reliability',
          changeFrequency: 'weekly',
          priority: 0.7,
        }),
        expect.objectContaining({
          url: 'https://mkety.com/docs/platform/projects-and-workspaces',
          priority: 0.6,
        }),
      ]),
    );
  });

  it('allows the public site while blocking private application surfaces', () => {
    const robots = getMketyRobotsPolicy();
    expect(robots.rules).toEqual(expect.arrayContaining([expect.objectContaining({ userAgent: '*', allow: '/' })]));
    const serialized = JSON.stringify(robots);
    expect(serialized).toContain('/api/');
    expect(serialized).toContain('/admin/');
    expect(serialized).toContain('/create-workspace');
    expect(serialized).toContain('/login');
    expect(serialized).toContain('/signup');
    expect(serialized).toContain('/payment/');
    expect(serialized).toContain('/app/');
  });
});
