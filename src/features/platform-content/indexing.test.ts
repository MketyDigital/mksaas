import { getMketyRobotsPolicy, getMketySitemapEntries } from './indexing';

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

  it('allows the public site while blocking private application surfaces', () => {
    const robots = getMketyRobotsPolicy();
    expect(robots.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: '*', allow: '/' }),
      ]),
    );
    const serialized = JSON.stringify(robots);
    expect(serialized).toContain('/api/');
    expect(serialized).toContain('/admin/');
    expect(serialized).toContain('/create-workspace');
    expect(serialized).toContain('/app/');
  });
});
