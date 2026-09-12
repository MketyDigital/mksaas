const MKETY_CANONICAL_PUBLIC_ORIGIN = 'https://mkety.com';

export function getCanonicalMketyPublicUrl(url: URL): URL | null {
  if (url.hostname.toLowerCase() !== 'www.mkety.com') return null;

  const canonical = new URL(url.pathname + url.search, MKETY_CANONICAL_PUBLIC_ORIGIN);
  canonical.hash = url.hash;
  return canonical;
}
