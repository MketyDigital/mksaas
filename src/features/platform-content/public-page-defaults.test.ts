import { getDefaultPublicPage, MKETY_PUBLIC_PAGE_DEFAULTS } from './public-page-defaults';

describe('Mkety dedicated public page defaults', () => {
  it.each(['platform', 'workspaces', 'solutions', 'academy', 'pricing', 'enterprise', 'about', 'contact'])(
    'provides meaningful content for %s',
    (slug) => {
      const page = getDefaultPublicPage(slug);
      expect(page).not.toBeNull();
      expect(page?.title).toContain('Mkety');
      expect(page?.seoTitle).toContain('Mkety');
      expect(page?.sections.length).toBeGreaterThan(0);
    },
  );

  it('does not create defaults for authenticated/internal routes', () => {
    expect(getDefaultPublicPage('app')).toBeNull();
    expect(getDefaultPublicPage('admin')).toBeNull();
    expect(getDefaultPublicPage('create-workspace')).toBeNull();
  });

  it('has unique public slugs', () => {
    const slugs = MKETY_PUBLIC_PAGE_DEFAULTS.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
