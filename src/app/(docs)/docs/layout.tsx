import type { Metadata } from 'next';

import { DocsLayoutClient } from '@/features/docs/components/DocsLayoutClient';

export const metadata: Metadata = {
  title: 'Docs | Mkety',
  description:
    'Mkety documentation for the platform, workspaces, SolutionHub, Academy, plans, usage, deployments, security, and administration.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsLayoutClient>{children}</DocsLayoutClient>;
}
