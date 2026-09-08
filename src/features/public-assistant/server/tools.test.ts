import { PUBLIC_SUPPORT_TOOL_NAMES, resolvePublicRoute } from './tools';

describe('Public Mkety AI support tools', () => {
  it('exposes only the approved read-only informational tools', () => {
    expect(PUBLIC_SUPPORT_TOOL_NAMES).toEqual([
      'search_public_docs',
      'search_public_site',
      'get_public_pricing',
      'resolve_public_route',
      'get_public_product_summary',
    ]);
  });

  it('resolves known destinations to canonical mkety.com public routes', () => {
    expect(resolvePublicRoute('pricing')).toEqual({ label: 'Pricing', path: '/pricing' });
    expect(resolvePublicRoute('solutionhub')).toEqual({ label: 'SolutionHub', path: '/solutions' });
    expect(resolvePublicRoute('agent builder')).toEqual({ label: 'Platform', path: '/platform' });
  });

  it('does not invent a private/internal route for an unknown destination', () => {
    expect(resolvePublicRoute('admin billing database')).toBeNull();
  });
});
