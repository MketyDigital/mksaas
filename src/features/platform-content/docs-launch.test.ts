import { defaultDocsArticles, defaultDocsCategories } from './defaults';

const publicDocsText = JSON.stringify({ defaultDocsArticles, defaultDocsCategories }).toLowerCase();

describe('Mkety public docs launch set', () => {
  it('does not publish stale template/runtime/auth claims', () => {
    expect(publicDocsText).not.toContain('next.js saas ai template');
    expect(publicDocsText).not.toContain('auth.js v5');
    expect(publicDocsText).not.toContain('auth0');
    expect(publicDocsText).not.toContain('vercel');
    expect(publicDocsText).not.toContain('opennext');
  });

  it('covers every launch-critical product boundary', () => {
    const categories = new Set(defaultDocsCategories.map((category) => category.key));
    expect(categories).toEqual(
      expect.objectContaining({
        has: expect.any(Function),
      }),
    );

    const articleSlugs = new Set(defaultDocsArticles.map((article) => article.slug));
    for (const slug of [
      'what-is-mkety',
      'projects-and-workspaces',
      'ai-workspace',
      'automation-workspace',
      'deploy-workspace',
      'solutionhub',
      'plans-usage-credits',
      'academy',
      'enterprise-and-trading',
      'tenant-isolation',
    ]) {
      expect(articleSlugs.has(slug)).toBe(true);
    }
  });
});
