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
  { key: 'platform', title: 'Platform', description: 'Projects, teams, workspaces, usage, credits, billing and commercial boundaries.', sortOrder: 20 },
  { key: 'workspaces', title: 'Workspaces', description: 'AI, Automation and Deploy workspace direction and capabilities.', sortOrder: 30 },
  { key: 'solutions', title: 'SolutionHub', description: 'Packaged solutions, reusable blueprints and solution boundaries.', sortOrder: 35 },
  { key: 'academy', title: 'Academy', description: 'Practical Mkety learning, workshops and enterprise enablement.', sortOrder: 40 },
  { key: 'enterprise', title: 'Enterprise', description: 'Custom implementations and the Trading boundary.', sortOrder: 45 },
  { key: 'deployments-domains', title: 'Deployments and Domains', description: 'Mkety domain map, routing boundaries, deployments, previews and customer app hostnames.', sortOrder: 50 },
  { key: 'security-operations', title: 'Security and Operations', description: 'Tenant isolation, permissions, audit and safe operations.', sortOrder: 60 },
];

export const defaultDocsArticles: PlatformDocsArticleInput[] = [
  {
    categoryKey: 'getting-started',
    slug: 'what-is-mkety',
    title: 'What is Mkety?',
    excerpt: 'A practical overview of the Mkety platform.',
    bodyMarkdown:
      '# What is Mkety?\n\nMkety is a technology platform for building, automating, deploying, integrating, and operating modern business systems. Mkety Platform and Mkety Academy are core products, while SolutionHub packages reusable solutions and Enterprise handles specialized customer requirements.',
    sortOrder: 10,
  },
  {
    categoryKey: 'platform',
    slug: 'projects-and-workspaces',
    title: 'Projects and workspaces',
    excerpt: 'How Mkety organizes project context around focused workspaces.',
    bodyMarkdown:
      '# Projects and workspaces\n\nProjects organize teams, workspaces, usage, deployments and operational context. Workspaces provide focused tools for AI, Automation and Deploy rather than collapsing every capability into one interface.',
    sortOrder: 10,
  },
  {
    categoryKey: 'platform',
    slug: 'plans-usage-credits',
    title: 'Plans, pricing, usage and credits',
    excerpt: 'How Mkety separates commercial plans from metered usage and credits.',
    bodyMarkdown:
      '# Plans, pricing, usage and credits\n\nPricing communicates an offer. Plans group commercial terms. Entitlements enforce access. Usage records consumption. Credits represent product units. Wallet and accounting views remain separate from product credits. Public pricing content does not replace authoritative backend billing or entitlement logic.',
    sortOrder: 20,
  },
  {
    categoryKey: 'workspaces',
    slug: 'ai-workspace',
    title: 'AI Workspace',
    excerpt: 'The Mkety area for agents, knowledge, tools, models, runs and versions.',
    bodyMarkdown:
      '# AI Workspace\n\nThe AI Workspace is designed around agents, knowledge, tools, model selection, runs, versions and publishing. Availability is controlled by authenticated Platform permissions and entitlements; public documentation does not grant access by itself.',
    sortOrder: 10,
  },
  {
    categoryKey: 'workspaces',
    slug: 'automation-workspace',
    title: 'Automation Workspace',
    excerpt: 'Triggers, workflow definitions, actions, conditions, webhooks and run history.',
    bodyMarkdown:
      '# Automation Workspace\n\nAutomation workflows are composed from controlled trigger and action nodes, conditions, transformations, webhook events and agent steps. Execution is bounded and recorded by the Platform runtime rather than delegated to public CMS content.',
    sortOrder: 20,
  },
  {
    categoryKey: 'workspaces',
    slug: 'deploy-workspace',
    title: 'Deploy Workspace',
    excerpt: 'Mkety deployment direction for websites, lightweight apps, APIs and environments.',
    bodyMarkdown:
      '# Deploy Workspace\n\nDeploy is the Mkety workspace direction for websites, lightweight applications, APIs, previews, production environments and domains. Heavier dedicated runtime requirements remain an Enterprise concern rather than an ordinary self-service infrastructure promise.',
    sortOrder: 30,
  },
  {
    categoryKey: 'solutions',
    slug: 'solutionhub',
    title: 'SolutionHub',
    excerpt: 'How reusable Mkety solutions differ from workspaces and plans.',
    bodyMarkdown:
      '# SolutionHub\n\nSolutionHub packages reusable agents, workflows, applications, deployment templates and business automations. A solution can use one or more workspaces, but SolutionHub is not itself a workspace and is not a pricing-plan synonym.',
    sortOrder: 10,
  },
  {
    categoryKey: 'academy',
    slug: 'academy',
    title: 'Mkety Academy',
    excerpt: 'Courses, workshops, webinars and enterprise enablement.',
    bodyMarkdown:
      '# Mkety Academy\n\nMkety Academy provides practical technology learning through courses, workshops, webinars and enterprise enablement. Academy is a core Mkety product and remains distinct from Platform workspace entitlements.',
    sortOrder: 10,
  },
  {
    categoryKey: 'enterprise',
    slug: 'enterprise-and-trading',
    title: 'Enterprise and Trading',
    excerpt: 'Why Trading and specialized implementations remain Custom / Enterprise.',
    bodyMarkdown:
      '# Enterprise and Trading\n\nSpecialized Trading infrastructure, dedicated customer systems and requirements that exceed normal shared-platform economics are handled under Custom / Enterprise boundaries. Trading is visible in the Mkety product model but is not marketed as an ordinary self-service plan entitlement.',
    sortOrder: 10,
  },
  {
    categoryKey: 'deployments-domains',
    slug: 'domain-map',
    title: 'Mkety domain map',
    excerpt: 'Where each Mkety domain and subdomain belongs.',
    bodyMarkdown:
      '# Mkety domain map\n\n`mkety.com` is the public website. `app.mkety.com` is the authenticated Platform. `api.mkety.com` is the API surface. `origin.mkety.com` is infrastructure-only routing behind Cloudflare and OCI. `*.mkety.app` is reserved for customer deployments, previews, portals, generated sites, applications and production app hostnames.\n\nCustomer apps must not be placed under `mkety.com` or `app.mkety.com`, and `origin.mkety.com` must not be marketed or linked as a product route.',
    sortOrder: 10,
  },
  {
    categoryKey: 'security-operations',
    slug: 'tenant-isolation',
    title: 'Tenant isolation',
    excerpt: 'High-level Mkety tenant and authorization boundaries.',
    bodyMarkdown:
      '# Tenant isolation\n\nTenant identity and membership are enforced server-side. Browser-provided tenant identifiers are not sufficient authorization by themselves. Protected operations use authenticated identity, current database membership and least-privilege permission checks.',
    sortOrder: 10,
  },
  {
    categoryKey: 'security-operations',
    slug: 'admin-control-boundaries',
    title: 'Admin control boundaries',
    excerpt: 'What admins can manage and what remains protected by backend logic.',
    bodyMarkdown:
      '# Admin control boundaries\n\nAdmins can manage public content, docs, app presentation, feature visibility, roles, controlled operations and audit views. Admins do not directly edit backend logic, security rules, deployment engines, tenant isolation or billing ledger calculations.',
    sortOrder: 20,
  },
];
