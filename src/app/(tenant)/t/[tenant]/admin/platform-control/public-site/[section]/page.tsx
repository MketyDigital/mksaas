import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformContentDraftForm } from '@/features/platform-content/components/admin/PlatformContentDraftForm';
import {
  defaultDocsArticles,
  defaultDocsCategories,
  defaultPlatformNavigation,
  defaultPlatformSiteSettings,
  defaultPricingPlans,
} from '@/features/platform-content/defaults';
import { MKETY_PUBLIC_PAGE_DEFAULTS } from '@/features/platform-content/public-page-defaults';
import { requirePlatformContentAccess } from '@/features/platform-content/server/authorization';
import { getRecentPublicAILeads } from '@/features/platform-content/server/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

interface PublicSiteSectionPageProps {
  params: Promise<{ tenant: string; section: string }>;
}

type PublicSiteModule = {
  title: string;
  description: string;
  items: string[];
  area: 'public-site' | 'docs' | 'pricing' | 'navigation' | 'settings';
  entityType: 'site_settings' | 'page' | 'page_section' | 'navigation_item' | 'pricing_plan' | 'docs_article';
  entityKey: string;
  defaultPayload: Record<string, unknown>;
};

const modules: Record<string, PublicSiteModule> = {
  pages: {
    title: 'Pages & Sections',
    description:
      'Manage Mkety public pages, page sections, ordering, CTAs, metadata, and the customer-facing copy used by Public Mkety AI.',
    items: ['Platform', 'Workspaces', 'SolutionHub', 'Academy course/tier cards & price badges', 'Academy ready-to-learn access CTA', 'Pricing', 'Trading Workspace presentation', 'Enterprise', 'About', 'Contact'],
    area: 'public-site',
    entityType: 'page',
    entityKey: 'public-pages',
    defaultPayload: { pages: MKETY_PUBLIC_PAGE_DEFAULTS },
  },
  navigation: {
    title: 'Navigation',
    description: 'Manage the public header, footer, CTA links, labels, visibility, and sort order.',
    items: ['Header links', 'Footer groups', 'Get Started CTA', 'Docs links', 'External links'],
    area: 'navigation',
    entityType: 'navigation_item',
    entityKey: 'header',
    defaultPayload: { items: defaultPlatformNavigation },
  },
  pricing: {
    title: 'Pricing Display',
    description: 'Manage the public commercial presentation while keeping real entitlements code-controlled.',
    items: [
      'Plan cards',
      'Feature bullets',
      'Usage labels',
      'Credits wording',
      'Starter',
      'Workspaces',
      'Mkety One',
      'Trading Workspace Custom / Enterprise presentation',
      'Enterprise CTA',
    ],
    area: 'pricing',
    entityType: 'pricing_plan',
    entityKey: 'pricing-plans',
    defaultPayload: { plans: defaultPricingPlans },
  },
  docs: {
    title: 'Docs Content',
    description:
      'Manage public Mkety documentation categories, articles, markdown content, slugs, and publishing state.',
    items: [
      'Getting Started',
      'Platform',
      'Workspaces',
      'SolutionHub',
      'Academy',
      'Enterprise',
      'Products & Domains',
      'Security & Trust',
    ],
    area: 'docs',
    entityType: 'docs_article',
    entityKey: 'docs-defaults',
    defaultPayload: { categories: defaultDocsCategories, articles: defaultDocsArticles },
  },
  settings: {
    title: 'Brand, Support & AI Settings',
    description: 'Manage public brand settings, support channels, Mkety AI guidance/fallback behavior, and metadata without changing application source code.',
    items: ['Brand name', 'Logo URL', 'SEO & social metadata', 'Support email', 'Sales email', 'Telegram URL', 'Public AI prompt extension', 'AI fallback message', 'Lead capture toggle', 'Legal links'],
    area: 'settings',
    entityType: 'site_settings',
    entityKey: 'production',
    defaultPayload: defaultPlatformSiteSettings,
  },
};

export default async function PublicSiteSectionPage({ params }: PublicSiteSectionPageProps) {
  const { tenant, section } = await params;
  await requirePlatformContentAccess(tenant);

  const sectionModule = modules[section];

  if (!sectionModule) notFound();

  const publicAILeads = section === 'settings' ? await getRecentPublicAILeads(50) : [];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/t/${tenant}/admin/platform-control/public-site`}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Public Website & Docs
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{sectionModule.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{sectionModule.description}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <PlatformContentDraftForm
          tenant={tenant}
          area={sectionModule.area}
          entityType={sectionModule.entityType}
          entityKey={sectionModule.entityKey}
          title={`${sectionModule.title} draft`}
          description="Edit the CMS payload, save it as a draft, then publish when it is ready for the public site and Public Mkety AI grounding."
          defaultPayload={sectionModule.defaultPayload}
        />

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Build scope</CardTitle>
            <CardDescription>
              This module is part of the Mkety public CMS. Validated edit forms call server actions that enforce
              platform content permissions, draft/publish state, revision records, route revalidation, and audit-safe
              changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {sectionModule.items.map((item) => (
                <div key={item} className="rounded-xl border bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {section === 'settings' ? (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Public AI leads</CardTitle>
            <CardDescription>
              Voluntary email/phone details captured by Mkety AI when lead capture is enabled. Public AI never asks for passwords, API keys, payment secrets, recovery codes, or other sensitive credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {publicAILeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No captured public leads yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {publicAILeads.map((lead) => (
                  <div
                    key={`${lead.conversationId}-${lead.createdAt.toISOString()}`}
                    className="rounded-xl border bg-muted/20 p-4 text-sm"
                  >
                    <p className="font-medium">{lead.email ?? lead.phone}</p>
                    {lead.email && lead.phone ? <p className="mt-1 text-muted-foreground">{lead.phone}</p> : null}
                    <p className="mt-2 text-xs text-muted-foreground">{lead.createdAt.toISOString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
