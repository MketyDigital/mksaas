import { normalizePlatformControlTenantSlug } from './normalize-platform-control-tenant-slug';

describe('normalizePlatformControlTenantSlug', () => {
  it('accepts the stored slash-prefixed path slug', () => {
    expect(normalizePlatformControlTenantSlug('/mkety-ops')).toBe('mkety-ops');
  });

  it('trims surrounding whitespace and slashes', () => {
    expect(normalizePlatformControlTenantSlug('  /mkety-ops/  ')).toBe('mkety-ops');
  });

  it.each(['', '/', '/ops/mkety-ops', 'mkety ops', '../mkety-ops'])(
    'rejects unsafe or empty value %j',
    (value) => {
      expect(() => normalizePlatformControlTenantSlug(value)).toThrow(
        'Platform Control tenant slug must be a single slug.',
      );
    },
  );
});
