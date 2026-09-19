import { getPublishedHomepageContent } from './queries';
import { ENTERPRISE_SALES_HREF, normalizeWorkspaceSalesLinks } from '../commercial-routing';

export async function getPublishedPublicHomepageContent() {
  const content = await getPublishedHomepageContent();
  return {
    ...content,
    workspaces: normalizeWorkspaceSalesLinks(content.workspaces),
    enterprise: content.enterprise.cta
      ? { ...content.enterprise, cta: { ...content.enterprise.cta, href: ENTERPRISE_SALES_HREF } }
      : content.enterprise,
  };
}
