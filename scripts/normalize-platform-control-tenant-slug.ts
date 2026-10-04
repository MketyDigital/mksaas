export function normalizePlatformControlTenantSlug(value: string): string {
  const slug = value.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Platform Control tenant slug must be a single slug.');
  }
  return slug;
}
