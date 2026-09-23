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
  logoUrl: 'https://mkety.com/mkety-logo.png',
  faviconUrl: 'https://mkety.com/mkety-logo.png',
  socialImageUrl: 'https://mkety.com/mkety-social-card.png',
  primaryColor: '#6D5DF6',
  secondaryColor: '#A855F7',
  accentColor: '#22D3EE',
  defaultSeoTitle: 'Mkety | Build, automate, deploy, and operate',
  defaultSeoDescription:
    'Mkety is a technology platform for AI agents, automation, deployment, integrations, business solutions, and practical digital learning.',
  contactEmail: 'support@mkety.com',
  contactHref: '/contact',
  salesEmail: 'hello@mkety.com',
  telegramHref: 'https://t.me/mketyadmin',
  publicAiPrompt:
    'Use public Mkety documentation first for support questions. If documentation does not fully answer the visitor, answer from approved public Mkety context. Escalate to human support only when necessary.',
  publicAiFallbackMessage:
    'Mkety AI is temporarily unavailable. You can continue with Mkety support by email or Telegram, or leave your contact details in this chat and the team can follow up.',
  publicAiLeadCaptureEnabled: true,
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
  primaryCta: { label: 'Get Started', href: '/signup' },
  secondaryCta: { label: 'Explore Docs', href: '/docs' },
  previewItems: [
    { label: 'AI', description: 'Agents, knowledge, tools, models, runs, versions, and publishing.' },
    { label: 'Automation', description: 'Triggers, workflows, actions, conditions, webhooks, and run history.' },
    { label: 'Deploy', description: 'Lightweight web apps, APIs, portals, managed edge/serverless deployment, status, and history.' },
    { label: 'SolutionHub', description: 'Ready-made solutions, templates, blueprints, and enterprise options.' },
  ],
};

export const defaultPlatformOverviewSection: PlatformOverviewSectionInput = {
  eyebrow: 'Platform',
  title: 'Everything your digital work needs, connected.',
  description:
    'Projects, teams, AI, automation, deployments, SolutionHub, usage, credits, billing, and administration share one coordinated system.',
  items: [
    {
      key: 'build',
      title: 'Create',
      description: 'Turn ideas into applications, AI experiences, workflows, portals, and connected business systems.',
    },
    {
      key: 'operate',
      title: 'Manage',
      description: 'Keep projects, teams, usage, billing visibility, domains, and day-to-day operations organized.',
    },
  ],
  cta: { label: 'Explore Platform', href: '/platform' },
};

export const defaultWorkspaceSection: PlatformWorkspaceSectionInput = {
  eyebrow: 'Workspaces',
  title: 'One platform, multiple operating spaces',
  description:
    'Choose the workspace that fits what you want to build, or use Mkety One for the complete self-service workspace bundle.',
  items: [
    {
      key: 'ai',
      title: 'AI Workspace',
      description:
        'Build and publish AI agents with knowledge, tools/actions, model choice, testing, drafts/versions, Website AI, supported messaging channels, API access, run history, and usage visibility.',
      href: '/app',
    },
    {
      key: 'automation',
      title: 'Automation Workspace',
      description: 'Build visual workflows with webhooks, schedules, API actions, conditions, notifications, integrations, secrets, retries, execution logs/history, and usage visibility.',
      href: '/app',
    },
    {
      key: 'deploy',
      title: 'Deploy Workspace',
      description:
        'Deploy lightweight web applications, APIs, portals, and serverless workloads through Mkety managed edge/serverless deployment with environment variables, secrets, supported domains, logs, status, history, and usage visibility.',
      href: '/app',
    },
    {
      key: 'trading',
      title: 'Trading Workspace',
      description:
        'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.',
      href: '/enterprise',
      badge: 'Custom / Enterprise',
    },
  ],
};

export const defaultSolutionHubSection: PlatformSolutionHubSectionInput = {
  eyebrow: 'SolutionHub',
  title: 'Launch from ready-made solutions instead of always starting from zero.',
  description:
    'SolutionHub packages reusable AI, automation, web, and lightweight application solutions for the shared Mkety platform, while heavier or dedicated requirements move to Enterprise.',
  items: [
    {
      key: 'shared',
      title: 'Managed shared-platform solutions',
      description: 'Reusable AI, automation, websites, portals, dashboards, lightweight apps, and APIs designed for Mkety shared/serverless infrastructure.',
    },
    {
      key: 'enterprise',
      title: 'Enterprise / dedicated solutions',
      description:
        'Custom delivery for complex systems, private or dedicated infrastructure, persistent services, heavy processing, special networking, browser automation, or strict SLA requirements.',
    },
  ],
  cta: { label: 'Explore SolutionHub', href: '/solutions' },
};

export const defaultAcademySection: PlatformAcademySectionInput = {
  eyebrow: 'Mkety Academy',
  title: 'Learn practical digital skills and build real systems.',
  description:
    'Mkety Academy offers structured learning across software engineering, trading, digital marketing, AI, automation, and certified digital skills.',
  items: [
    {
      key: 'web-app',
      title: 'Web & App Engineering',
      description: 'Learn to design, build, ship, and improve modern web and application products.',
    },
    {
      key: 'trading',
      title: 'Trading Masterclass',
      description: 'Structured trading education focused on market skills, risk, process, and execution.',
    },
    {
      key: 'marketing',
      title: 'Digital Funnel & Marketing',
      description: 'Build practical customer acquisition, conversion, content, and digital sales systems.',
    },
    {
      key: 'ai-automation',
      title: 'AI & Automation Lab',
      description: 'Build useful AI agents, automations, and connected workflows for real use cases.',
    },
    {
      key: 'certified-skills',
      title: 'Certified Digital Skills',
      description: 'Follow practical learning paths designed to build demonstrable digital capability.',
    },
  ],
  cta: { label: 'Explore Mkety Academy', href: 'https://academy.mkety.com' },
};

export const defaultEnterpriseSection: PlatformEnterpriseSectionInput = {
  eyebrow: 'Enterprise',
  title: 'Custom systems when standard self-service is not enough.',
  description:
    'Mkety delivers specialized implementations, integrations, managed deployment, trading infrastructure, customer projects, and enterprise support under custom commercial terms.',
  items: [
    {
      key: 'trading',
      title: 'Trading infrastructure',
      description: 'Specialized trading systems are delivered under Custom / Enterprise terms.',
      badge: 'Custom / Enterprise',
    },
    {
      key: 'customer-projects',
      title: 'Custom projects',
      description: 'Dedicated systems and integrations can be delivered around your organization’s requirements.',
    },
  ],
  cta: { label: 'Start Enterprise Project', href: '/enterprise' },
};

export const defaultTrustSection: PlatformTrustSectionInput = {
  eyebrow: 'Trust',
  title: 'Built for reliable, controlled operation.',
  description:
    'Mkety is designed around secure access, clear account boundaries, dependable operations, and transparent product controls.',
  items: [
    {
      key: 'access',
      title: 'Secure access',
      description: 'Account and workspace access is protected with secure permissions and organization-level access controls.',
    },
    {
      key: 'privacy',
      title: 'Privacy-conscious',
      description: 'Private account and workspace information is kept separate from public Mkety content.',
    },
    {
      key: 'operations',
      title: 'Operational clarity',
      description:
        'Usage, billing, deployments, and product access are presented through clear customer-facing controls.',
    },
  ],
  cta: { label: 'Read the docs', href: '/docs' },
};

export const defaultPricingPlans: PlatformPricingPlanInput[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceLabel: '$5.99',
    billingLabel: '/ month',
    description: 'A Pages-first website and publishing plan for landing pages, portfolios, simple business sites, and other lightweight web publishing.',
    highlighted: false,
    ctaLabel: 'Get Started',
    ctaHref: '/signup?plan=starter',
    features: [
      'Published websites and pages',
      'Landing pages, portfolios, simple business sites, and supported blogs/docs',
      'Custom domains, SSL, and edge delivery where supported',
      'Forms and integrations where supported',
      'Basic analytics and project management',
      'Asset/storage and Mkety usage/credits visibility',
    ],
  },
  {
    key: 'ai-workspace',
    name: 'AI Workspace',
    priceLabel: '$16.99',
    billingLabel: '/ month',
    description: 'Build and operate AI agents with knowledge, tools, model choice, publishing, supported channels, API access, and usage visibility.',
    highlighted: false,
    ctaLabel: 'Get Started',
    ctaHref: '/signup?plan=ai-workspace',
    features: [
      'AI Agent Builder with agents and published agents',
      'Drafts, version history, model choice, and test playground',
      'Knowledge sources, storage, and retrieval',
      'Tools, actions, and API access',
      'Website AI, Telegram, and supported messaging integrations',
      'Conversation/run history, usage, and team access',
    ],
  },
  {
    key: 'automation-workspace',
    name: 'Automation Workspace',
    priceLabel: '$16.99',
    billingLabel: '/ month',
    description: 'Build and operate visual workflows with triggers, actions, integrations, execution history, and usage visibility.',
    highlighted: false,
    ctaLabel: 'Get Started',
    ctaHref: '/signup?plan=automation-workspace',
    features: [
      'Visual workflow builder and workflow management',
      'Webhook and scheduled triggers',
      'API actions, conditions, notifications, and integrations',
      'Secrets and protected integration configuration',
      'Run history, execution logs, and retries',
      'Execution/usage visibility and team access',
    ],
  },
  {
    key: 'deploy-workspace',
    name: 'Deploy Workspace',
    priceLabel: '$9.99',
    billingLabel: '/ month',
    description: 'For lightweight web apps, APIs, portals, and serverless application deployment through a managed edge runtime.',
    highlighted: false,
    ctaLabel: 'Get Started',
    ctaHref: '/signup?plan=deploy-workspace',
    features: [
      'Managed serverless application runtime and edge deployment',
      'Lightweight web app, API, and portal deployment',
      'Custom domains and SSL where supported',
      'Environment variables and secrets',
      'Deployment history, logs, and status where available',
      'Project, application, and usage visibility',
    ],
  },
  {
    key: 'mkety-one',
    name: 'Mkety One',
    priceLabel: '$49',
    billingLabel: '/ month',
    description: 'The complete self-service Mkety bundle: Starter plus AI, Automation, and Deploy Workspaces.',
    highlighted: true,
    ctaLabel: 'Get Started',
    ctaHref: '/signup?plan=mkety-one',
    features: [
      'Starter website and publishing capabilities',
      'AI Workspace, Automation Workspace, and Deploy Workspace included',
      'Unified projects and workspace management',
      'Domains, usage, credits, and activity visibility',
      'Team access and shared operational controls',
      'Support and history/analytics experience across the bundle',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    description:
      'For requirements beyond the standard shared platform envelope, including dedicated infrastructure, specialized integrations, private runtimes, persistent services, and Trading.',
    highlighted: false,
    ctaLabel: 'Talk to Mkety Enterprise',
    ctaHref: '/contact',
    features: [
      'Custom implementation and managed delivery',
      'Dedicated or private infrastructure when required',
      'Container, persistent-service, networking, and high-throughput requirements',
      'Specialized integrations and Trading infrastructure',
      'Enterprise support and commercial terms',
    ],
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
      'No. You can start with Starter or choose an individual AI, Automation, or Deploy Workspace. Mkety One combines Starter and all three self-service Workspaces in one bundle. Self-service plans can be paid monthly or prepaid for 3, 6, or 12 months, with progressively larger prepaid discounts.',
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
  {
    key: 'getting-started',
    title: 'Getting Started',
    description: 'Understand Mkety and choose the right place to begin.',
    sortOrder: 10,
  },
  {
    key: 'platform',
    title: 'Platform',
    description: 'Projects, workspaces, plans, usage, credits, and account concepts.',
    sortOrder: 20,
  },
  {
    key: 'workspaces',
    title: 'Workspaces',
    description: 'AI, Automation, Deploy, and the specialized Trading product.',
    sortOrder: 30,
  },
  {
    key: 'solutions',
    title: 'SolutionHub',
    description: 'Ready-made solutions, reusable blueprints, and custom solution options.',
    sortOrder: 35,
  },
  {
    key: 'academy',
    title: 'Academy',
    description: 'Practical Mkety learning paths and digital skills programs.',
    sortOrder: 40,
  },
  {
    key: 'enterprise',
    title: 'Enterprise',
    description: 'Custom implementations and specialized requirements.',
    sortOrder: 45,
  },
  {
    key: 'domains',
    title: 'Mkety Products & Domains',
    description: 'The official web addresses for Mkety products and customer experiences.',
    sortOrder: 50,
  },
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
      '# Projects and workspaces\n\nProjects organize the work you are building. AI Workspace focuses on agents, knowledge, tools and supported AI channels. Automation Workspace focuses on visual workflows, triggers, actions, integrations and execution history. Deploy Workspace focuses on lightweight web apps, APIs, portals and managed edge/serverless deployment. Mkety One combines Starter with all three self-service Workspaces.',
    sortOrder: 10,
  },
  {
    categoryKey: 'platform',
    slug: 'plans-usage-credits',
    title: 'Plans, pricing, usage and credits',
    excerpt: 'The current Mkety Platform commercial options.',
    bodyMarkdown:
      '# Plans, pricing, usage and credits\n\nCurrent Mkety Platform monthly list prices are Starter at $5.99/month, AI Workspace at $16.99/month, Automation Workspace at $16.99/month, Deploy Workspace at $9.99/month, and Mkety One at $49/month, with Enterprise on custom terms. Self-service customers may prepay 1, 3, 6, or 12 months. The approved prepaid discounts are 0%, 5%, 10%, and 15% respectively, so longer terms have a lower effective monthly subscription rate. Mkety One includes Starter, AI Workspace, Automation Workspace, and Deploy Workspace. Usage and credits may vary by product activity and are shown separately from the subscription price.',
    sortOrder: 20,
  },
  {
    categoryKey: 'workspaces',
    slug: 'ai-workspace',
    title: 'AI Workspace',
    excerpt: 'Build agents, knowledge-powered tools, and AI applications.',
    bodyMarkdown:
      '# AI Workspace\n\nAI Workspace is the Mkety agent-building workspace for agents and published agents, knowledge sources and retrieval, model choice, tools/actions, testing, drafts and version history, Website AI, supported messaging integrations, API access, conversation/run history, usage, and team access.',
    sortOrder: 10,
  },
  {
    categoryKey: 'workspaces',
    slug: 'automation-workspace',
    title: 'Automation Workspace',
    excerpt: 'Build repeatable workflows and connected business automations.',
    bodyMarkdown:
      '# Automation Workspace\n\nAutomation Workspace provides a visual workflow builder with webhook and scheduled triggers, API actions, conditions, notifications, integrations, secrets, retries, execution logs and run history, usage/execution visibility, and team access.',
    sortOrder: 20,
  },
  {
    categoryKey: 'workspaces',
    slug: 'deploy-workspace',
    title: 'Deploy Workspace',
    excerpt: 'Deploy lightweight web apps, APIs, portals, and managed serverless workloads.',
    bodyMarkdown:
      '# Deploy Workspace\n\nDeploy Workspace is for lightweight web applications, APIs, portals, and serverless workloads using Mkety managed edge/serverless deployment. It includes environment configuration, secrets, supported custom domains and SSL, deployment history, logs/status where available, and project/application usage visibility.',
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
  },,
  {
    categoryKey: 'getting-started',
    slug: 'choose-where-to-start',
    title: 'Choose where to start',
    excerpt: 'Pick Starter, a Workspace, Mkety One, Academy, or Enterprise based on what you need.',
    bodyMarkdown:
      '# Choose where to start\n\nUse Starter when your main goal is publishing websites and pages. Choose AI Workspace for agents and knowledge-powered experiences, Automation Workspace for workflows and integrations, and Deploy Workspace for lightweight applications, APIs and portals. Mkety One combines the standard self-service products. Use Mkety Academy when your goal is learning, and Enterprise when your requirement needs dedicated infrastructure, specialized integrations, persistent services, Trading, or other custom delivery.',
    sortOrder: 20,
  },
  {
    categoryKey: 'getting-started',
    slug: 'account-workspace-and-checkout',
    title: 'Account, workspace and checkout',
    excerpt: 'How registration, workspace creation, checkout and activation fit together.',
    bodyMarkdown:
      '# Account, workspace and checkout\n\nFor self-service plans, choose a plan and billing term, sign in or create your Mkety account, choose or create a workspace, and then complete the authenticated checkout for that workspace. Plan access is activated from verified payment settlement; a browser return or success screen alone does not grant entitlements.',
    sortOrder: 30,
  },
  {
    categoryKey: 'platform',
    slug: 'teams-and-access',
    title: 'Teams and access',
    excerpt: 'How Mkety keeps workspace access and administration scoped.',
    bodyMarkdown:
      '# Teams and access\n\nMkety work is scoped to organizations, workspaces and projects. Roles and permissions determine who can view or manage protected areas. Public Mkety AI never has access to private tenant, project, billing, deployment, file, agent or workflow information.',
    sortOrder: 30,
  },
  {
    categoryKey: 'platform',
    slug: 'billing-and-subscription-terms',
    title: 'Billing and subscription terms',
    excerpt: 'Monthly, 3-month, 6-month and annual prepaid self-service terms.',
    bodyMarkdown:
      '# Billing and subscription terms\n\nSelf-service plans support 1, 3, 6 and 12 month prepaid terms. The approved subscription discounts are 0%, 5%, 10% and 15% respectively. The discount applies to the fixed subscription total, not automatically to metered usage, credits or pass-through provider charges. Enterprise and Trading use separately agreed commercial terms.',
    sortOrder: 40,
  },
  {
    categoryKey: 'workspaces',
    slug: 'starter-publishing',
    title: 'Starter publishing',
    excerpt: 'Pages-first website and publishing capabilities in the Starter plan.',
    bodyMarkdown:
      '# Starter publishing\n\nStarter is the Pages-first Mkety plan for published websites and pages, landing pages, portfolios, simple business sites and supported blogs or documentation. It also covers supported custom domains, SSL and edge delivery, forms and integrations, basic analytics/project management, assets/storage and usage visibility. Starter is not sold as a VPS, CPU/RAM allocation or general-purpose server.',
    sortOrder: 5,
  },
  {
    categoryKey: 'workspaces',
    slug: 'mkety-one',
    title: 'Mkety One',
    excerpt: 'The complete standard self-service Mkety bundle.',
    bodyMarkdown:
      '# Mkety One\n\nMkety One combines Starter plus AI Workspace, Automation Workspace and Deploy Workspace. It is designed for customers who want the standard publishing, agent, workflow and lightweight deployment capabilities together, with unified projects, workspace management, usage/credits visibility and team controls.',
    sortOrder: 40,
  },
  {
    categoryKey: 'solutions',
    slug: 'shared-vs-enterprise-solutions',
    title: 'Shared-platform vs Enterprise solutions',
    excerpt: 'Know when a SolutionHub use case fits the shared platform and when it becomes Enterprise.',
    bodyMarkdown:
      '# Shared-platform vs Enterprise solutions\n\nShared-platform SolutionHub use cases include AI assistants, knowledge and document Q&A, support and lead qualification, webhook and scheduled automations, business websites, portals, lightweight CRM or project tools, dashboards and APIs. Complex ERP, substantial regulated-data systems, heavy browser automation, arbitrary containers, persistent services, private networking, dedicated environments, Trading infrastructure, high-throughput or strict-SLA requirements belong to Enterprise.',
    sortOrder: 20,
  },
  {
    categoryKey: 'academy',
    slug: 'academy-learning-hubs',
    title: 'Academy learning hubs',
    excerpt: 'The practical learning areas represented across Mkety Academy.',
    bodyMarkdown:
      '# Academy learning hubs\n\nMkety Academy presents learning across Web & App Engineering, Trading Masterclass, Digital Funnel & Marketing, AI & Automation Lab, and Certified Digital Skills. Current programmes, schedules, enrolment and pricing should always be checked at academy.mkety.com.',
    sortOrder: 20,
  },
  {
    categoryKey: 'enterprise',
    slug: 'when-to-use-enterprise',
    title: 'When to use Enterprise',
    excerpt: 'Requirements that sit outside the standard self-service platform envelope.',
    bodyMarkdown:
      '# When to use Enterprise\n\nUse Enterprise for dedicated or private infrastructure, arbitrary containers, persistent services, special networking, high-throughput workloads, complex integrations, substantial regulated-data systems, strict latency or SLA requirements, browser automation, custom commercial delivery, or specialized Trading infrastructure. Enterprise scope and pricing are agreed for the specific project.',
    sortOrder: 20,
  },
  {
    categoryKey: 'trust',
    slug: 'support-and-contact-safety',
    title: 'Support and contact safety',
    excerpt: 'Use Mkety AI and official support channels without sharing secrets.',
    bodyMarkdown:
      '# Support and contact safety\n\nStart public product, pricing, documentation, support and sales questions with Mkety AI. It searches approved public Mkety information first and can route you to human support when needed. You may voluntarily leave normal contact details for follow-up, but never send passwords, API keys, payment secrets, recovery codes or other sensitive credentials in a public support conversation.',
    sortOrder: 30,
  },
];
