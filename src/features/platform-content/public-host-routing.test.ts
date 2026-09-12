import { getCanonicalMketyPublicUrl } from './public-host-routing';

describe('Mkety public canonical host routing', () => {
  it('redirects www.mkety.com to the canonical root while preserving path and query', () => {
    expect(getCanonicalMketyPublicUrl(new URL('https://www.mkety.com/pricing?source=nav'))?.toString()).toBe(
      'https://mkety.com/pricing?source=nav',
    );
  });

  it('does not redirect canonical or unrelated hosts', () => {
    expect(getCanonicalMketyPublicUrl(new URL('https://mkety.com/docs'))).toBeNull();
    expect(getCanonicalMketyPublicUrl(new URL('https://app.mkety.com/'))).toBeNull();
  });
});
