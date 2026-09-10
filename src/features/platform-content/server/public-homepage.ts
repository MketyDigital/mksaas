import { normalizeWorkspaceSalesLinks } from '../commercial-routing';
import { getPublishedHomepageContent } from './queries';

export async function getPublishedPublicHomepageContent() {
  const content = await getPublishedHomepageContent();
  return {
    ...content,
    workspaces: normalizeWorkspaceSalesLinks(content.workspaces),
  };
}
