import { MKETY_PUBLIC_PAGE_DEFAULTS } from './public-page-defaults';
import { publicPagesAdminPayloadSchema } from './public-pages-admin';

describe('Mkety public pages admin collection', () => {
  it('accepts every customer-facing public page as one CMS-managed collection', () => {
    const parsed = publicPagesAdminPayloadSchema.parse({ pages: MKETY_PUBLIC_PAGE_DEFAULTS });
    expect(parsed.pages.map((page) => page.slug)).toEqual([
      'platform',
      'workspaces',
      'solutions',
      'academy',
      'pricing',
      'enterprise',
      'about',
      'contact',
    ]);
  });

  it('rejects unsafe or incomplete page collections', () => {
    expect(() => publicPagesAdminPayloadSchema.parse({ pages: [] })).toThrow();
    expect(() => publicPagesAdminPayloadSchema.parse({
      pages: [{
        slug: 'academy',
        title: 'Academy',
        seoTitle: 'Academy',
        seoDescription: 'Academy',
        eyebrow: 'Academy',
        headline: 'Academy',
        intro: 'Academy',
        sections: [{
          eyebrow: 'Learning',
          title: 'Learning',
          description: 'Learning',
          items: [],
          cta: { label: 'Unsafe', href: 'javascript:alert(1)' },
        }],
      }],
    })).toThrow();
  });
});
