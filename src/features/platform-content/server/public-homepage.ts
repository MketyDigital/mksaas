import { getPublishedHomepageContent } from './queries';
import { normalizeWorkspaceSalesLinks } from '../commercial-routing';

export async function getPublishedPublicHomepageContent() {
  const content = await getPublishedHomepageContent();
  return {
    ...content,
    workspaces: normalizeWorkspaceSalesLinks(content.workspaces),
  };
}
