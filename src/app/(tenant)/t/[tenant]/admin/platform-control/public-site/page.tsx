import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

interface PublicSiteControlPageProps {
  params: Promise<{ tenant: string }>;
}

const sections = [
  {
    title: 'Pages & Sections',
    description: 'Manage Mkety homepage, product sections, enterprise sections, CTAs, FAQs, and metadata.',
    href: 'public-site/pages',
  },
  {
    title: 'Navigation',
    description: 'Manage public header links, footer groups, CTA destinations, sort order, and visibility.',
    href: 'public-site/navigation',
  },
  {
    title: 'Pricing Display',
    description: 'Manage public pricing copy, plan cards, feature bullets, Lite Offer wording, and enterprise CTAs.',
    href: 'public-site/pricing',
  },
  {
    title: 'Docs Content',
    description: 'Manage Mkety documentation categories, articles, slugs, markdown content, and publishing state.',
    href: 'public-site/docs',
  },
  {
    title: 'Brand & SEO Settings',
    description: 'Manage public brand name, logo URLs, colors, metadata, social image, legal links, and contact links.',
    href: 'public-site/settings',
  },
];

export default async function PublicSiteControlPage({ params }: PublicSiteControlPageProps) {
  const { tenant } = await params;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Platform Control</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Public Website & Docs</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage the public Mkety website and global documentation without changing code. These controls affect
          customer-facing presentation only; backend logic, security rules, billing ledger behavior, and deployment engines
          remain protected.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={`/t/${tenant}/admin/platform-control/${section.href}`}>
            <Card className="h-full rounded-2xl border-border/70 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary">Open module →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
