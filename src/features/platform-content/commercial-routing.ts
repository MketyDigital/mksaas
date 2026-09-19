import type { PlatformOverviewSectionInput, PlatformWorkspaceSectionInput } from './schemas';

export const ENTERPRISE_SALES_HREF = '/?mketyAI=enterprise-sales';

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

export function normalizePublicPageSalesLinks(
  sections: PlatformOverviewSectionInput[],
): PlatformOverviewSectionInput[] {
  return sections.map((section) => ({
    ...section,
    cta:
      section.cta && /enterprise|contact sales|request proposal|discuss/i.test(section.cta.label)
        ? { ...section.cta, href: ENTERPRISE_SALES_HREF }
        : section.cta,
    items: section.items.map((item) =>
      item.key === 'trading' && /trading/i.test(item.title)
        ? { ...item, href: ENTERPRISE_SALES_HREF, badge: item.badge ?? 'Custom / Enterprise' }
        : item,
    ),
  }));
}
