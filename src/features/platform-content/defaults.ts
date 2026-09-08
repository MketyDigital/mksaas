import type {
  PlatformAcademySectionInput,
  PlatformDocsArticleInput,
  PlatformDocsCategoryInput,
  PlatformEnterpriseSectionInput,
  PlatformFaqItemInput,
  PlatformFooterGroupInput,
  PlatformHeroSectionInput,
  PlatformNavigationItemInput,
  PlatformOverviewSectionInput,
  PlatformPricingPlanInput,
  PlatformSiteSettingsInput,
  PlatformSolutionHubSectionInput,
  PlatformTrustSectionInput,
  PlatformWorkspaceSectionInput,
} from './schemas';

export const defaultPlatformSiteSettings: PlatformSiteSettingsInput = {
  brandName: 'Mkety',
  primaryColor: '#6D5DF6',
  secondaryColor: '#A855F7',
  accentColor: '#22D3EE',
  defaultSeoTitle: 'Mkety | Build, automate, deploy, and operate',
  defaultSeoDescription:
    'Mkety is a technology platform for AI agents, automation, deployment, integrations, cloud infrastructure, business solutions, and education.',
  contactHref: '/contact',
  legalLinks: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
};

export const defaultPlatformNavigation: PlatformNavigationItemInput[] = [
  { label: 'Platform', href: '/platform', area: 'header', enabled: true, external: false, sortOrder: 10 },
  { label: 'Workspaces', href: '/workspaces', area: 'header', enabled: true, external: false, sortOrder: 20 },
  { label: 'SolutionHub', href: '/solutions', area: 'header', enabled: true, external: false, sortOrder: 30 },
  { label: 'Academy', href: '/academy', area: 'header', enabled: true, external: false, sortOrder: 40 },
  { label: 'Pricing', href: '/pricing', area: 'header', enabled: true, external: false, sortOrder: 50 },
  { label: 'Enterprise', href: '/enterprise', area: 'header', enabled: true, external: false, sortOrder: 60 },
  { label: 'Docs', href: '/docs', area: 'header', enabled: true, external: false, sortOrder: 70 },
];

export const defaultHeroSection: PlatformHeroSectionInput = {
  badge: 'Mkety Platform',
  headline: 'Build, automate, deploy, and operate with Mkety.',
  subheadline:
    'Mkety is a technology platform for creating AI agents, workflows, applications, websites, integrations, cloud infrastructure, business solutions, and learning experiences from one unified workspace.',
  primaryCta: { label: 'Get Started', href: '/create-workspace' },
  secondaryCta: { label: 'Explore Docs', href: '/docs' },
  previewItems: [
    { label: 'AI', description: 'Agents, knowledge, tools, models, runs, versions, and publishing.' },
    { label: 'Automation', description: 'Triggers, workflows, actions, conditions, webhooks, and run history.' },
    { label: 'Deploy', description: 'Apps, websites, APIs, domains, previews, production, and operations.' },
    { label: 'SolutionHub', description: 'Ready-made solutions, templates, blueprints, and enterprise options.' },
  ],
};

export const defaultPlatformOverviewSection: PlatformOverviewSectionInput = {
  eyebrow: 'Platform',
  title: 'Build, automate, deploy, integrate, and operate.',
  description:
    'Mkety connects projects, teams, AI, automation, deployments, domains, SolutionHub, usage, credits, billing, and administration without turning the product into an AI-only tool.',
  items: [
    { key: 'build', title: 'Build', description: 'Create applications, AI experiences, workflows, portals, and connected business systems.' },
    { key: 'operate', title: 'Operate', description: 'Keep projects, teams, usage, credits, billing visibility, domains, and operations connected.' },
  ],
  cta: { label: 'Explore Platform', href: '/platform' },
};

export const defaultWorkspaceSection: PlatformWorkspaceSectionInput = {
  eyebrow: 'Workspaces',
  title: 'One platform, multiple operating spaces',
  description: 'Each workspace is focused, but they connect through projects, teams, usage, billing, and operations.',
  items: [
    {
      key: 'ai',
      title: 'AI Workspace',
      description: 'Build agents, connect knowledge, choose models, test, version, publish, and monitor AI applications.',
      href: '/app/ai',
    },
    {
      key: 'automation',
      title: 'Automation Workspace',
      description: 'Create workflows from triggers, actions, conditions, webhooks, transformations, and agent steps.',
      href: '/app/automation',
    },
    {
      key: 'deploy',
      title: 'Deploy Workspace',
      description: 'Publish websites, lightweight applications, APIs, portals, and services with domains and environments.',
      href: '/app/deploy',
    },
    {
      key: 'trading',
      title: 'Trading Workspace',
      description: 'Custom and enterprise trading infrastructure presented as a specialized solution, not a self-service plan.',
      href: '/enterprise',
      badge: 'Custom / Enterprise',
    },
  ],
};

export const defaultSolutionHubSection: PlatformSolutionHubSectionInput = {
  eyebrow: 'SolutionHub',
  title: 'Launch from ready-made solutions instead of always starting from zero.',
  description:
    'SolutionHub packages useful agents, workflows, applications, deployment templates, business automations, and industry blueprints that can be launched into Mkety workspaces.',
  items: [
    { key: 'shared', title: 'Shared-platform solutions', description: 'Reusable solutions that run inside standard Mkety workspace and platform boundaries.' },
    { key: 'enterprise', title: 'Enterprise solutions', description: 'Custom implementations where runtime, security, integrations, or operational needs exceed self-service boundaries.' },
  ],
  cta: { label: 'Explore SolutionHub', href: '/solutions' },
};

export const defaultAcademySection: PlatformAcademySectionInput = {
  eyebrow: 'Mkety Academy',
  title: 'Learn the systems you want to build and operate.',
  description:
    'Mkety Academy provides practical technology training, AI workshops, business implementation courses, webinars, certifications, and enterprise enablement.',
  items: [
    { key: 'training', title: 'Practical learning', description: 'Courses, workshops and guided implementation focused on real technology and business use cases.' },
  ],
  cta: { label: 'Explore Academy', href: '/academy' },
};

export const defaultEnterpriseSection: PlatformEnterpriseSectionInput = {
  eyebrow: 'Enterprise',
  title: 'Custom systems when standard self-service is not enough.',
  description:
    'Mkety can deliver specialized implementations, trading infrastructure, customer projects, integrations, managed deployment and enterprise support while keeping custom solutions separate from ordinary self-service plans.',
  items: [
    { key: 'trading', title: 'Trading infrastructure', description: 'Specialized trading systems remain Custom / Enterprise rather than normal self-service workspace entitlements.', badge: 'Custom / Enterprise' },
    { key: 'customer-projects', title: 'Customer projects', description: 'Dedicated systems such as mklms-style implementations are delivered as customer or enterprise projects, not core Mkety products.' },
  ],
  cta: { label: 'Talk to Mkety', href: '/contact' },
};

export const defaultTrustSection: PlatformTrustSectionInput = {
  eyebrow: 'Trust & readiness',
  title: 'Controlled by architecture, not marketing claims.',
  description:
    'Mkety separates public content from protected application logic. Tenant isolation, authorization, billing rules, deployment controls, secrets and audit-sensitive operations remain code-controlled and are verified before production promotion.',
  items: [
    { key: 'tenant-isolation', title: 'Tenant isolation', description: 'Tenant boundaries and membership checks are enforced server-side rather than trusted from browser input.' },
    { key: 'protected-logic', title: 'Protected logic', description: 'Security, billing ledger behavior, entitlements and deployment engines are not editable as public CMS content.' },
    { key: 'cloud-runtime', title: 'Cloudflare runtime', description: 'The current public production target uses the verified vinext Cloudflare runtime baseline.' },
  ],
  cta: { label: 'Read the docs', href: '/docs' },
};

export const defaultPricingPlans: PlatformPricingPlanInput[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceLabel: 'Start free',
    billingLabel: 'Usage-based limits apply',
    description: 'For individuals and early teams exploring projects, AI workspace basics, and SolutionHub discovery.',
    highlighted: false,
    ctaLabel: 'Get Started',
    ctaHref: '/create-workspace',
    features: ['Project workspace', 'AI workspace entry', 'SolutionHub discovery', 'Usage and credits visibility'],
  },
  {
    key: 'growth',
    name: 'Growth',
    priceLabel: 'Team plan',
    billingLabel: 'Plan, credits, and usage controls',
    description: 'For teams building workflows, applications, integrations, and operational systems on Mkety.',
    highlighted: true,
    ctaLabel: 'Choose Growth',
    ctaHref: '/create-workspace',
    features: ['Team workspaces', 'Automation workspace', 'Deploy workspace', 'Integrations', 'Usage controls'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    description: 'For custom systems, specialized implementations, trading infrastructure, enterprise support, and managed delivery.',
    highlighted: false,
    ctaLabel: 'Talk to Mkety',
    ctaHref: '/contact',
    features: ['Custom implementation', 'Enterprise support', 'Trading infrastructure options', 'Security and operations review'],
  },
];

export const defaultFaqItems: PlatformFaqItemInput[] = [
  {
    question: 'Is Mkety only an AI product?',
    answer:
      'No. Mkety includes AI, automation, deployment, integrations, cloud infrastructure, business solutions, education, and enterprise implementation support.',
  },
  {
    question: 'Can admins edit the public site and docs?',
    answer:
      'Yes. Public website content, docs, navigation, pricing display, FAQs, metadata, and CTAs are designed to be admin-managed with safe fallbacks.',
  },
  {
    question: 'Can admins edit backend logic or security rules?',
    answer:
      'No. Core backend logic, permissions, billing ledger rules, deployment engines, and security policies remain code-controlled and audit-protected.',
  },
];

export const defaultFooterGroups: PlatformFooterGroupInput[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Platform', href: '/platform' },
      { label: 'Workspaces', href: '/workspaces' },
      { label: 'SolutionHub', href: '/solutions' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Academy', href: '/academy' },
      { label: 'Enterprise', href: '/enterprise' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Docs', href: '/docs' },
    ],
  },
];

export const defaultDocsCategories: PlatformDocsCategoryInput[] = [
  { key: 'getting-started', title: 'Getting Started', description: 'Understand Mkety, the platform, and the product flow.', sortOrder: 10 },
  { key: 'platform', title: 'Platform', description: 'Organizations, projects, teams, workspaces, usage, credits, and billing.', sortOrder: 20 },
  { key: 'workspaces', title: 'Workspaces', description: 'AI, Automation, Deploy, SolutionHub, and Trading boundaries.', sortOrder: 30 },
  { key: 'deployments-domains', title: 'Deployments and Domains', description: 'Mkety domain map, routing boundaries, deployments, previews, and customer app hostnames.', sortOrder: 35 },
  { key: 'security-operations', title: 'Security and Operations', description: 'Tenant isolation, permissions, audit, deployment, and safe operations.', sortOrder: 40 },
];

export const defaultDocsArticles: PlatformDocsArticleInput[] = [
  {
    categoryKey: 'getting-started',
    slug: 'what-is-mkety',
    title: 'What is Mkety?',
    excerpt: 'A practical overview of the Mkety platform.',
    bodyMarkdown:
      '# What is Mkety?\n\nMkety is a technology platform for building, automating, deploying, integrating, and operating modern business systems. It combines AI agents, workflows, cloud infrastructure, ready-made solutions, education, and enterprise implementation support.',
    sortOrder: 10,
  },
  {
    categoryKey: 'platform',
    slug: 'plans-usage-credits',
    title: 'Plans, usage, and credits',
    excerpt: 'How Mkety separates commercial plans from metered usage and credits.',
    bodyMarkdown:
      '# Plans, usage, and credits\n\nMkety keeps plans, pricing, usage, credits, wallet records, and entitlements separate. Public pricing can be edited by admins, but billing ledger logic remains code-controlled and audit-protected.',
    sortOrder: 20,
  },
  {
    categoryKey: 'deployments-domains',
    slug: 'domain-map',
    title: 'Mkety domain map',
    excerpt: 'Where each Mkety domain and subdomain belongs.',
    bodyMarkdown:
      '# Mkety domain map\n\nMkety uses a strict domain map so product surfaces do not get mixed together. `mkety.com` is the public website. `app.mkety.com` is the authenticated Platform. `api.mkety.com` is the API surface. `origin.mkety.com` is infrastructure-only routing behind Cloudflare and OCI. `*.mkety.app` is reserved for customer deployments, previews, portals, generated sites, applications, and production app hostnames.\n\nCustomer apps must not be placed under `mkety.com` or `app.mkety.com`, and `origin.mkety.com` must not be marketed or linked as a product route.',
    sortOrder: 25,
  },
  {
    categoryKey: 'security-operations',
    slug: 'admin-control-boundaries',
    title: 'Admin control boundaries',
    excerpt: 'What admins can manage and what remains protected by backend logic.',
    bodyMarkdown:
      '# Admin control boundaries\n\nAdmins can manage public content, docs, app presentation, feature visibility, roles, controlled operations, and audit views. Admins do not directly edit backend logic, security rules, deployment engines, tenant isolation, or billing ledger calculations.',
    sortOrder: 30,
  },
];
