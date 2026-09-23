import type { Metadata } from 'next';

import { DocsLayoutClient } from '@/features/docs/components/DocsLayoutClient';
import { getPublishedDocsTree } from '@/features/platform-content/server/queries';

export const metadata: Metadata = {
  title: 'Docs | Mkety',
  description:
    'Mkety documentation for the platform, workspaces, SolutionHub, Academy, plans, usage, deployments, security, and administration.',
};

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = await getPublishedDocsTree();
  return <DocsLayoutClient docsTree={tree}>{children}</DocsLayoutClient>;
}
