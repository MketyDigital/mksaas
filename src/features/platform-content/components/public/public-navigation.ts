import type { PlatformNavigationItemInput } from '../../schemas';

function canonicalizeHref(href: string, external: boolean | undefined) {
  const trimmed = href.trim();
  if (external || !trimmed.startsWith('/') || trimmed === '/') return trimmed;
  return trimmed.replace(/\/+$/, '');
}

export function dedupePublicNavigation(items: PlatformNavigationItemInput[]) {
  const seenHrefs = new Set<string>();
  const seenLabels = new Set<string>();
  const result: PlatformNavigationItemInput[] = [];

  for (const item of items) {
    if (item.enabled === false) continue;

    const label = item.label.trim();
    const href = canonicalizeHref(item.href, item.external);
    if (!label || !href) continue;

    const labelKey = label.toLocaleLowerCase();
    const hrefKey = item.external ? href : href.toLocaleLowerCase();
    if (seenHrefs.has(hrefKey) || seenLabels.has(labelKey)) continue;

    seenHrefs.add(hrefKey);
    seenLabels.add(labelKey);
    result.push({ ...item, label, href });
  }

  return result;
}
