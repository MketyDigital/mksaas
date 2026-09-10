import type { PlatformOverviewSectionInput, PlatformWorkspaceSectionInput } from './schemas';

export const ENTERPRISE_SALES_HREF = '/enterprise';

export function normalizeWorkspaceSalesLinks(section: PlatformWorkspaceSectionInput): PlatformWorkspaceSectionInput {
  return {
    ...section,
    items: section.items.map((item) =>
      item.key === 'trading'
        ? { ...item, href: ENTERPRISE_SALES_HREF, badge: item.badge ?? 'Custom / Enterprise' }
        : item,
    ),
  };
}

export function normalizePublicPageSalesLinks(sections: PlatformOverviewSectionInput[]): PlatformOverviewSectionInput[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.key === 'trading' && /trading/i.test(item.title)
        ? { ...item, href: ENTERPRISE_SALES_HREF, badge: item.badge ?? 'Custom / Enterprise' }
        : item,
    ),
  }));
}
