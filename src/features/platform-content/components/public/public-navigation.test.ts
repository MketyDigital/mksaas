import { defaultPlatformNavigation } from '../../defaults';
import type { PlatformNavigationItemInput } from '../../schemas';
import { dedupePublicNavigation } from './public-navigation';

describe('dedupePublicNavigation', () => {
  it('deduplicates equivalent internal destinations while preserving the first enabled item', () => {
    const items: PlatformNavigationItemInput[] = [
      ...defaultPlatformNavigation,
      { label: 'Documentation', href: '/docs/', area: 'header', enabled: true, external: false, sortOrder: 80 },
      { label: 'Docs', href: '/guides', area: 'header', enabled: true, external: false, sortOrder: 90 },
      { label: 'Hidden Docs', href: '/hidden-docs', area: 'header', enabled: false, external: false, sortOrder: 100 },
    ];

    const result = dedupePublicNavigation(items);

    expect(result.filter((item) => item.href.replace(/\/$/, '') === '/docs')).toHaveLength(1);
    expect(result.find((item) => item.href === '/docs')?.label).toBe('Docs');
    expect(result.some((item) => item.href === '/guides')).toBe(false);
    expect(result.some((item) => item.href === '/hidden-docs')).toBe(false);
  });

  it('trims values and preserves distinct external destinations', () => {
    const items: PlatformNavigationItemInput[] = [
      { label: ' Academy ', href: ' https://academy.mkety.com ', area: 'header', enabled: true, external: true, sortOrder: 10 },
      { label: 'Academy External', href: 'https://academy.mkety.com/path', area: 'header', enabled: true, external: true, sortOrder: 20 },
    ];

    expect(dedupePublicNavigation(items)).toEqual([
      { label: 'Academy', href: 'https://academy.mkety.com', area: 'header', enabled: true, external: true, sortOrder: 10 },
      { label: 'Academy External', href: 'https://academy.mkety.com/path', area: 'header', enabled: true, external: true, sortOrder: 20 },
    ]);
  });
});
