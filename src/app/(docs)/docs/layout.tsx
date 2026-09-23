import type { Metadata } from 'next';

import { DocsLayoutClient } from '@/features/docs/components/DocsLayoutClient';
import { getPublishedDocsTree } from '@/features/platform-content/server/queries';

export const metadata: Metadata = {
  title: 'Docs | Mkety',
  description:
    'Mkety documentation for the platform, workspaces, SolutionHub, Academy, plans, usage, deployments, security, and administration.',
};

export const dynamic = 'force-dynamic';

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = await getPublishedDocsTree();
  return (
    <DocsLayoutClient
      tree={{
        categories: tree.categories.map(({ key, title, description }) => ({ key, title, description })),
        articles: tree.articles.map(({ categoryKey, slug, title, sortOrder }) => ({
          categoryKey,
          slug,
          title,
          sortOrder,
        })),
      }}
    >
      {children}
    </DocsLayoutClient>
  );
}
