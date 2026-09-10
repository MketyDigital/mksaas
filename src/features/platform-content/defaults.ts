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
    'Mkety is a technology platform for AI agents, automation, deployment, integrations, business solutions, and practical digital learning.',
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
    'Create AI agents, workflows, applications, websites, integrations, business systems, and learning experiences from one connected platform.',
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
    'Mkety connects projects, teams, AI, automation, deployments, SolutionHub, usage, credits, billing, and administration in one product ecosystem.',
  items: [
    { key: 'build', title: 'Build', description: 'Create applications, AI experiences, workflows, portals, and connected business systems.' },
    { key: 'operate', title: 'Operate', description: 'Keep projects, teams, usage, billing visibility, domains, and operations connected.' },
  ],
  cta: { label: 'Explore Platform', href: '/platform' },
};

export const defaultWorkspaceSection: PlatformWorkspaceSectionInput = {
  eyebrow: 'Workspaces',
  title: 'One platform, multiple operating spaces',
  description: 'Choose the workspace that fits what you want to build, or use Mkety One for the complete self-service workspace bundle.',
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
      description: 'Publish websites, lightweight applications, APIs, portals, and serverless workloads with domains and deployment history.',
      href: '/app/deploy',
    },
    {
      key: 'trading',
      title: 'Trading Workspace',
      description: 'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.',
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
    { key: 'shared', title: 'Ready-made solutions', description: 'Reusable solutions designed to launch quickly inside Mkety workspaces.' },
    { key: 'enterprise', title: 'Enterprise solutions', description: 'Custom implementations for more specialized business, integration, security, or operational requirements.' },
  ],
  cta: { label: 'Explore SolutionHub', href: '/solutions' },
};

export const defaultAcademySection: PlatformAcademySectionInput = {
  eyebrow: 'Mkety Academy',
  title: 'Learn practical digital skills and build real systems.',
  description:
    'Mkety Academy offers structured learning across software engineering, trading, digital marketing, AI, automation, and certified digital skills.',
  items: [
    { key: 'web-app', title: 'Web & App Engineering', description: 'Learn to design, build, ship, and improve modern web and application products.' },
    { key: 'trading', title: 'Trading Masterclass', description: 'Structured trading education focused on market skills, risk, process, and execution.' },
    { key: 'marketing', title: 'Digital Funnel & Marketing', description: 'Build practical customer acquisition, conversion, content, and digital sales systems.' },
    { key: 'ai-automation', title: 'AI & Automation Lab', description: 'Build useful AI agents, automations, and connected workflows for real use cases.' },
    { key: 'certified-skills', title: 'Certified Digital Skills', description: 'Follow practical learning paths designed to build demonstrable digital capability.' },
  ],
  cta: { label: 'Explore Mkety Academy', href: 'https://academy.mkety.com' },
};

export const defaultEnterpriseSection: PlatformEnterpriseSectionInput = {
  eyebrow: 'Enterprise',
  title: 'Custom systems when standard self-service is not enough.',
  description:
    'Mkety delivers specialized implementations, integrations, managed deployment, trading infrastructure, customer projects, and enterprise support under custom commercial terms.',
  items: [
    { key: 'trading', title: 'Trading infrastructure', description: 'Specialized trading systems are delivered under Custom / Enterprise terms.', badge: 'Custom / Enterprise' },
    { key: 'customer-projects', title: 'Custom projects', description: 'Dedicated systems and integrations can be delivered around your organization’s requirements.' },
  ],
  cta: { label: 'Start Enterprise Project', href: '/enterprise' },
};

export const defaultTrustSection: PlatformTrustSectionInput = {
  eyebrow: 'Trust',
  title: 'Built for reliable, controlled operation.',
  description:
    'Mkety is designed around secure access, clear account boundaries, dependable operations, and transparent product controls.',
  items: [
    { key: 'access', title: 'Secure access', description: 'Account and workspace access is protected with server-side authorization controls.' },
    { key: 'privacy', title: 'Privacy-conscious', description: 'Private account and workspace information is kept separate from public Mkety content.' },
    { key: 'operations', title: 'Operational clarity', description: 'Usage, billing, deployments, and product access are presented through clear customer-facing controls.' },
  ],
  cta: { label: 'Read the docs', href: '/docs' },
};

export const defaultPricingPlans: PlatformPricingPlanInput[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceLabel: '$5.99',
    billingLabel: '/ month',
    description: 'A simple entry plan for individuals getting started with Mkety projects and core platform access.',
    highlighted: false,
    ctaLabel: 'Choose Starter',
    ctaHref: '/create-workspace',
    features: ['Project workspace', 'Core platform access', 'SolutionHub discovery', 'Usage and credits visibility'],
  },
  {
    key: 'ai-workspace',
    name: 'AI Workspace',
    priceLabel: '$16.99',
    billingLabel: '/ month',
    description: 'For building, testing, publishing, and operating AI agents and AI-powered applications.',
    highlighted: false,
    ctaLabel: 'Choose AI Workspace',
    ctaHref: '/create-workspace',
    features: ['AI agents', 'Knowledge connections', 'Model selection', 'Tools and runs', 'Versions and publishing'],
  },
  {
    key: 'automation-workspace',
    name: 'Automation Workspace',
    priceLabel: '$16.99',
    billingLabel: '/ month',
    description: 'For building repeatable workflows, integrations, triggers, actions, and business automations.',
    highlighted: false,
    ctaLabel: 'Choose Automation Workspace',
    ctaHref: '/create-workspace',
    features: ['Workflow builder', 'Triggers and actions', 'Conditions and transformations', 'Webhooks', 'Run history'],
  },
  {
    key: 'deploy-workspace',
    name: 'Deploy Workspace',
    priceLabel: '$9.99',
    billingLabel: '/ month',
    description: 'For publishing websites, lightweight applications, APIs, portals, and serverless workloads.',
    highlighted: false,
    ctaLabel: 'Choose Deploy Workspace',
    ctaHref: '/create-workspace',
    features: ['Website and app deploys', 'API and portal deploys', 'Preview and production environments', 'Domains', 'Deployment history'],
  },
  {
    key: 'mkety-one',
    name: 'Mkety One',
    priceLabel: '$49',
    billingLabel: '/ month',
    description: 'The complete self-service Mkety bundle: Starter plus AI, Automation, and Deploy Workspaces.',
    highlighted: true,
    ctaLabel: 'Choose Mkety One',
    ctaHref: '/create-workspace',
    features: ['Starter included', 'AI Workspace included', 'Automation Workspace included', 'Deploy Workspace included', 'Unified Mkety workspace access'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    description: 'For custom systems, specialized implementations, trading infrastructure, enterprise support, and managed delivery.',
    highlighted: false,
    ctaLabel: 'Start Enterprise Project',
    ctaHref: '/enterprise',
    features: ['Custom implementation', 'Enterprise support', 'Trading infrastructure options', 'Managed integrations and delivery'],
  },
];

export const defaultFaqItems: PlatformFaqItemInput[] = [
  {
    question: 'Is Mkety only an AI product?',
    answer:
      'No. Mkety includes AI, automation, deployment, integrations, business solutions, practical learning, and enterprise implementation support.',
  },
  {
    question: 'Do I need Mkety One to use Mkety?',
    answer:
      'No. You can start with Starter or choose an individual AI, Automation, or Deploy Workspace. Mkety One combines Starter and all three self-service Workspaces in one bundle.',
  },
  {
    question: 'Where do I access Mkety Academy and Trading?',
    answer:
      'Mkety Academy is available at academy.mkety.com. New Trading sales, custom pricing, and access requests start through Mkety Enterprise; customers with an approved commercial arrangement receive the appropriate Trading access separately.',
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
  { key: 'getting-started', title: 'Getting Started', description: 'Understand Mkety and choose the right place to begin.', sortOrder: 10 },
  { key: 'platform', title: 'Platform', description: 'Projects, workspaces, plans, usage, credits, and account concepts.', sortOrder: 20 },
  { key: 'workspaces', title: 'Workspaces', description: 'AI, Automation, Deploy, and the specialized Trading product.', sortOrder: 30 },
  { key: 'solutions', title: 'SolutionHub', description: 'Ready-made solutions, reusable blueprints, and custom solution options.', sortOrder: 35 },
  { key: 'academy', title: 'Academy', description: 'Practical Mkety learning paths and digital skills programs.', sortOrder: 40 },
  { key: 'enterprise', title: 'Enterprise', description: 'Custom implementations and specialized requirements.', sortOrder: 45 },
  { key: 'domains', title: 'Mkety Products & Domains', description: 'The official web addresses for Mkety products and customer experiences.', sortOrder: 50 },
  { key: 'trust', title: 'Security & Trust', description: 'High-level guidance for safe use of Mkety.', sortOrder: 60 },
];

export const defaultDocsArticles: PlatformDocsArticleInput[] = [
  {
    categoryKey: 'getting-started',
    slug: 'what-is-mkety',
    title: 'What is Mkety?',
    excerpt: 'A practical overview of the Mkety product ecosystem.',
    bodyMarkdown:
      '# What is Mkety?\n\nMkety is a technology platform for building, automating, deploying, integrating, and operating modern digital systems. Mkety Platform provides the core software experience, Mkety Academy provides practical learning, SolutionHub packages reusable solutions, and Enterprise supports specialized customer requirements.',
    sortOrder: 10,
  },
  {
    categoryKey: 'platform',
    slug: 'projects-and-workspaces',
    title: 'Projects and workspaces',
    excerpt: 'How Mkety organizes work around focused spaces.',
    bodyMarkdown:
      '# Projects and workspaces\n\nProjects organize the work you are building. AI Workspace focuses on agents and AI applications, Automation Workspace focuses on workflows and integrations, and Deploy Workspace focuses on publishing websites, applications, APIs, portals, and serverless workloads. Mkety One combines Starter with all three self-service Workspaces.',
    sortOrder: 10,
  },
  {
    categoryKey: 'platform',
    slug: 'plans-usage-credits',
    title: 'Plans, pricing, usage and credits',
    excerpt: 'The current Mkety Platform commercial options.',
    bodyMarkdown:
      '# Plans, pricing, usage and credits\n\nCurrent Mkety Platform options are Starter at $5.99/month, AI Workspace at $16.99/month, Automation Workspace at $16.99/month, Deploy Workspace at $9.99/month, Mkety One at $49/month, and Enterprise on custom terms. Mkety One includes Starter, AI Workspace, Automation Workspace, and Deploy Workspace. Usage and credits may vary by product activity and are shown separately from the subscription price.',
    sortOrder: 20,
  },
  {
    categoryKey: 'workspaces',
    slug: 'ai-workspace',
    title: 'AI Workspace',
    excerpt: 'Build agents, knowledge-powered tools, and AI applications.',
    bodyMarkdown:
      '# AI Workspace\n\nAI Workspace is designed for agents, knowledge, tools, model selection, testing, runs, versions, publishing, and ongoing AI application work.',
    sortOrder: 10,
  },
  {
    categoryKey: 'workspaces',
    slug: 'automation-workspace',
    title: 'Automation Workspace',
    excerpt: 'Build repeatable workflows and connected business automations.',
    bodyMarkdown:
      '# Automation Workspace\n\nAutomation Workspace helps you create workflows from triggers, actions, conditions, transformations, webhooks, integrations, agent steps, and run history.',
    sortOrder: 20,
  },
  {
    categoryKey: 'workspaces',
    slug: 'deploy-workspace',
    title: 'Deploy Workspace',
    excerpt: 'Publish websites, lightweight apps, APIs, portals, and serverless workloads.',
    bodyMarkdown:
      '# Deploy Workspace\n\nDeploy Workspace is for publishing websites, lightweight applications, APIs, portals, and serverless workloads with previews, production environments, domains, and deployment history.',
    sortOrder: 30,
  },
  {
    categoryKey: 'solutions',
    slug: 'solutionhub',
    title: 'SolutionHub',
    excerpt: 'Start from ready-made Mkety solutions instead of always building from zero.',
    bodyMarkdown:
      '# SolutionHub\n\nSolutionHub packages reusable agents, workflows, applications, deployment templates, business automations, and industry blueprints. A solution can use one or more Mkety Workspaces while remaining distinct from a subscription plan.',
    sortOrder: 10,
  },
  {
    categoryKey: 'academy',
    slug: 'academy',
    title: 'Mkety Academy',
    excerpt: 'Practical learning across engineering, trading, marketing, AI, automation, and certified digital skills.',
    bodyMarkdown:
      '# Mkety Academy\n\nMkety Academy is available at https://academy.mkety.com. Its learning hubs include Web & App Engineering, Trading Masterclass, Digital Funnel & Marketing, AI & Automation Lab, and Certified Digital Skills. Academy course pricing and enrolment details are maintained by Mkety Academy and should be checked there for the latest information.',
    sortOrder: 10,
  },
  {
    categoryKey: 'enterprise',
    slug: 'enterprise-and-trading',
    title: 'Enterprise and Trading',
    excerpt: 'Custom Mkety delivery and the specialized Trading product.',
    bodyMarkdown:
      '# Enterprise and Trading\n\nEnterprise supports custom systems, integrations, managed delivery, and specialized requirements. Trading is a specialized Custom / Enterprise product for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments. New Trading sales, pricing, quotes, and access requests start through Mkety Enterprise. After the commercial arrangement and access are approved, Mkety provides the appropriate Trading product access. Older Trading prices should not be used.',
    sortOrder: 10,
  },
  {
    categoryKey: 'domains',
    slug: 'domain-map',
    title: 'Official Mkety web addresses',
    excerpt: 'The main customer-facing Mkety product addresses.',
    bodyMarkdown:
      '# Official Mkety web addresses\n\nUse `mkety.com` for the public Mkety website, `app.mkety.com` for the Mkety Platform application, `academy.mkety.com` for Mkety Academy, and `trade.mkety.com` for approved access to the specialized Trading product. New Trading sales and custom pricing start through Enterprise on `mkety.com`. Customer deployments may use approved `*.mkety.app` addresses.',
    sortOrder: 10,
  },
  {
    categoryKey: 'trust',
    slug: 'account-security',
    title: 'Account security',
    excerpt: 'Simple guidance for using Mkety safely.',
    bodyMarkdown:
      '# Account security\n\nKeep your login details and recovery methods private, verify that you are using an official Mkety web address, and do not share passwords, API keys, payment secrets, or other sensitive credentials through public support conversations.',
    sortOrder: 10,
  },
  {
    categoryKey: 'trust',
    slug: 'privacy-and-access',
    title: 'Privacy and access',
    excerpt: 'How to think about public and private information in Mkety.',
    bodyMarkdown:
      '# Privacy and access\n\nPublic Mkety pages and documentation contain general product information. Account, workspace, billing, deployment, and organization-specific information should only be accessed through the appropriate authenticated Mkety experience.',
    sortOrder: 20,
  },
];