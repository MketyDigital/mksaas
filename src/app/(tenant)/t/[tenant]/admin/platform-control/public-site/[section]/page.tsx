import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requirePlatformContentAccess } from '@/features/platform-content/server/authorization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

interface PublicSiteSectionPageProps {
  params: Promise<{ tenant: string; section: string }>;
}

const modules: Record<string, { title: string; description: string; items: string[] }> = {
  pages: {
    title: 'Pages & Sections',
    description: 'Manage Mkety public pages, page sections, ordering, CTAs, FAQ content, and metadata.',
    items: ['Homepage hero', 'Platform overview', 'Workspace cards', 'SolutionHub', 'Academy', 'Enterprise', 'FAQ'],
  },
  navigation: {
    title: 'Navigation',
    description: 'Manage the public header, footer, CTA links, labels, visibility, and sort order.',
    items: ['Header links', 'Footer groups', 'Get Started CTA', 'Docs links', 'External links'],
  },
  pricing: {
    title: 'Pricing Display',
    description: 'Manage the public commercial presentation while keeping real entitlements code-controlled.',
    items: ['Plan cards', 'Feature bullets', 'Usage labels', 'Credits wording', 'Lite Offer', 'Enterprise CTA'],
  },
  docs: {
    title: 'Docs Content',
    description: 'Manage public Mkety documentation categories, articles, markdown content, slugs, and publishing state.',
    items: ['Getting Started', 'Platform', 'Workspaces', 'Billing', 'Deployments', 'Security', 'Administration'],
  },
  settings: {
    title: 'Brand & SEO Settings',
    description: 'Manage public brand settings and metadata without changing application source code.',
    items: ['Brand name', 'Logo URL', 'Favicon URL', 'SEO title', 'SEO description', 'Social image', 'Legal links'],
  },
};

export default async function PublicSiteSectionPage({ params }: PublicSiteSectionPageProps) {
  const { tenant, section } = await params;
  await requirePlatformContentAccess(tenant);

  const module = modules[section];

  if (!module) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/t/${tenant}/admin/platform-control/public-site`} className="text-sm font-medium text-primary hover:underline">
          ← Public Website & Docs
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{module.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{module.description}</p>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Build scope</CardTitle>
          <CardDescription>
            This module is part of the Mkety public CMS. Validated edit forms will call server actions that enforce
            platform content permissions, draft/publish state, revision records, route revalidation, and audit-safe changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {module.items.map((item) => (
              <div key={item} className="rounded-xl border bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
