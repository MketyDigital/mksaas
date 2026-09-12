import type { MketyPublicPageDefault } from './public-page-defaults';

export const MKETY_LEGAL_PAGE_DEFAULTS: readonly MketyPublicPageDefault[] = [
  {
    slug: 'privacy',
    title: 'Mkety Privacy',
    seoTitle: 'Mkety Privacy | How public and platform data is handled',
    seoDescription: 'Read Mkety privacy information for the public website and platform services.',
    eyebrow: 'Privacy',
    headline: 'Privacy information for Mkety services.',
    intro:
      'This page explains the categories of information Mkety may process when you use the public website or platform. It is intentionally limited to current product behavior and does not claim certifications or fixed retention periods that have not been formally approved.',
    sections: [
      {
        eyebrow: 'Information',
        title: 'What Mkety may process.',
        description:
          'Depending on how you use Mkety, information can include account and organization details, content you submit, configuration data, service usage, security and audit events, and technical request information needed to operate and protect the service.',
        items: [
          {
            key: 'account',
            title: 'Account and organization data',
            description: 'Identity, membership and workspace information needed to provide authenticated services.',
          },
          {
            key: 'content',
            title: 'Submitted content',
            description: 'Content, configuration and files you intentionally provide to product features.',
          },
          {
            key: 'operations',
            title: 'Operational data',
            description:
              'Usage, security, audit and technical events required to operate, troubleshoot and protect Mkety.',
          },
        ],
      },
      {
        eyebrow: 'Controls',
        title: 'Protected boundaries remain server-side.',
        description:
          'Public content management does not control tenant authorization, billing ledger rules, secrets, deployment security or other protected backend behavior. Questions about privacy or account data can be directed through the Mkety contact page.',
        items: [],
        cta: { label: 'Contact Mkety', href: '/contact' },
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Mkety Terms',
    seoTitle: 'Mkety Terms | Service terms and acceptable use',
    seoDescription: 'Read the current Mkety service terms and acceptable-use principles.',
    eyebrow: 'Terms',
    headline: 'Terms for using Mkety services.',
    intro:
      'These terms describe baseline conditions for using Mkety while detailed commercial terms, enterprise agreements and product-specific conditions may apply separately. Nothing on this page creates an unapproved uptime, support or service-level commitment.',
    sections: [
      {
        eyebrow: 'Use of service',
        title: 'Use Mkety lawfully and within your granted access.',
        description:
          'You are responsible for the content, credentials and instructions you provide, and for keeping access credentials secure. You must not attempt to bypass tenant isolation, authorization, rate limits, security controls or usage restrictions.',
        items: [
          {
            key: 'access',
            title: 'Authorized access',
            description: 'Use only the organizations, projects, workspaces and services you are authorized to access.',
          },
          {
            key: 'security',
            title: 'Security',
            description: 'Do not probe, disrupt or circumvent Mkety security and isolation controls.',
          },
          {
            key: 'commercial',
            title: 'Commercial terms',
            description:
              'Plans, usage, credits, billing and enterprise arrangements are governed by the applicable offer and backend records.',
          },
        ],
      },
      {
        eyebrow: 'Service evolution',
        title: 'Product capabilities can change as Mkety develops.',
        description:
          'Public descriptions are intended to reflect the current product direction without guaranteeing unfinished features. Enterprise or custom commitments require the applicable written agreement.',
        items: [],
        cta: { label: 'Contact Mkety', href: '/contact' },
      },
    ],
  },
] as const;

export function getDefaultLegalPage(slug: string): MketyPublicPageDefault | null {
  return MKETY_LEGAL_PAGE_DEFAULTS.find((page) => page.slug === slug) ?? null;
}
