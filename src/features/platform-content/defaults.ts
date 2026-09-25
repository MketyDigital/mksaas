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
  defaultSeoTitle: 'Mkety | AI, Automation, Deployments, Media & Enterprise',
  defaultSeoDescription:
    'Build AI agents, automate workflows, deploy applications, manage media, and deliver custom business systems with Mkety.',
  contactEmail: 'support@mkety.com',
  contactHref: '/contact#mkety-ai',
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
  cta: { label: 'Ask Mkety AI about Academy', href: '/academy#mkety-ai' },
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
  eyebrow: 'Security & Trust',
  title: 'Clear boundaries for access, operations, data, and service commitments.',
  description:
    'Mkety is designed around scoped access, protected configuration, observable operations, data portability, and explicit Enterprise terms rather than hidden assumptions.',
  items: [
    {
      key: 'access',
      title: 'Scoped identity & access',
      description:
        'Organizations, workspaces, projects, roles, and permissions separate protected customer activity from the public Mkety experience.',
    },
    {
      key: 'secrets',
      title: 'Protected configuration',
      description:
        'Sensitive credentials and environment configuration use protected secret/configuration paths and are not intended for public support conversations.',
    },
    {
      key: 'operations',
      title: 'Operational visibility',
      description:
        'Supported products expose relevant usage, run, deployment, status, history, billing, or capacity information so customers can understand what is operating.',
    },
    {
      key: 'enterprise',
      title: 'Contractable Enterprise controls',
      description:
        'Private or dedicated infrastructure, data-residency requirements, retention controls, migration assistance, private delivery, and service-level terms can be scoped where agreed.',
    },
  ],
  cta: { label: 'Security & Trust docs', href: '/docs/trust/security-and-reliability' },
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
      'Website AI and supported messaging integrations',
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
    ctaHref: '/contact#mkety-ai',
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
      'No. Mkety includes AI, automation, deployment, media storage and delivery, integrations, business solutions, practical learning, and Enterprise implementation support.',
  },
  {
    question: 'Do I need Mkety One to use Mkety?',
    answer:
      'No. You can start with Starter or choose an individual AI, Automation, or Deploy Workspace. Mkety One combines Starter and all three self-service Workspaces in one bundle. Self-service plans can be paid monthly or prepaid for 3, 6, or 12 months, with progressively larger prepaid discounts.',
  },
  {
    question: 'How does Mkety protect private customer information?',
    answer:
      'Public Mkety pages and Mkety AI are separated from authenticated organization, workspace, project, billing, deployment, file, agent, workflow, and other private customer information. Protected access is handled through the appropriate authenticated experience and scoped permissions.',
  },
  {
    question: 'How are API keys, credentials, and deployment secrets handled?',
    answer:
      'Supported Mkety products use protected secret and environment-configuration paths for sensitive values. Passwords, API keys, payment secrets, and other credentials should never be pasted into public support conversations.',
  },
  {
    question: 'Does Mkety provide an uptime or support SLA?',
    answer:
      'Standard self-service products operate under the applicable standard service terms. Enterprise customers can agree specific service-level, support-response, retention, availability, or operational commitments when those requirements are documented in the relevant order or agreement.',
  },
  {
    question: 'Can Enterprise use private, dedicated, regional, or specialized infrastructure?',
    answer:
      'Yes, where the requirement is technically and commercially agreed. Enterprise can be scoped for private or dedicated infrastructure, regional or data-residency requirements, persistent services, containers, specialized networking, high-throughput workloads, private delivery, migration, retention, and other requirements outside the standard shared platform envelope.',
  },
  {
    question: 'Can I move my data or media out of Mkety?',
    answer:
      'Portability depends on the product and data type. Mkety Media provides full-library inventory export and migration tooling, while Enterprise projects can include agreed migration and handoff requirements. Product-specific export options are documented in the relevant Mkety experience.',
  },
  {
    question: 'Where do I access Mkety Academy and Trading?',
    answer:
      'Start Academy questions on the public Academy page and with Mkety AI. Mkety AI can explain published programmes, schedules, enrolment steps and capture follow-up details; the Academy access destination is provided separately after Mkety confirms the appropriate enrolment/access. New Trading sales, custom pricing, and access requests start through Mkety Enterprise.',
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
      { label: 'Contact', href: '/contact#mkety-ai' },
      { label: 'Security & Trust', href: '/docs/trust/security-and-reliability' },
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
  {
    key: 'trust',
    title: 'Security, Trust & Service Levels',
    description: 'Access boundaries, protected configuration, reliability, portability, and Enterprise service commitments.',
    sortOrder: 60,
  },
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
      '# Mkety Academy\n\nMkety Academy covers Web & App Engineering, Trading Masterclass, Digital Funnel & Marketing, AI & Automation Lab, and Certified Digital Skills. Start public Academy questions with Mkety AI on mkety.com so it can check published information, answer questions, capture follow-up details when appropriate, and escalate to the team. The Academy access destination is provided separately after Mkety confirms the appropriate enrolment/access.',
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
      '# Official Mkety web addresses\n\nUse `mkety.com` for the public Mkety website and `app.mkety.com` for the Mkety Platform application. `media.mkety.com` is the official Mkety Media platform for discovering current media products, published features, plan details, and signup options. Public Academy discovery starts through Mkety AI on `mkety.com`; Academy access is handed off separately after the appropriate enrolment/access is confirmed. `trade.mkety.com` remains approved access for the specialized Trading product. New Trading sales and custom pricing start through Enterprise on `mkety.com`. Customer deployments may use approved `*.mkety.app` addresses.',
    sortOrder: 10,
  },
  {
    categoryKey: 'domains',
    slug: 'mkety-media',
    title: 'Mkety Media',
    excerpt: 'The official Mkety platform for current media products, features, plans, and signup.',
    bodyMarkdown:
      '# Mkety Media\n\nMkety Media is a standalone Mkety product for managed media storage and delivery, available at `https://media.mkety.com`. Upload images, videos and general files, organize them into buckets, and use permanent cached Mkety delivery URLs across websites, landing pages, applications, campaigns, training content and other systems.\n\nCore capabilities include secure direct and multipart uploads, bucket-based organization, storage/delivery/request usage monitoring, prepaid hard limits, team access within plan seat limits, self-service upgrades, extra prepaid capacity, and complete library export through JSON/CSV manifests and generated download-all scripts.\n\nPublic plans are Starter, Growth and Business. Billing supports monthly, 3-month, 6-month and 12-month terms. Current prices, discounts and exact quotas are managed on the Media platform and should be checked there before purchase. Public plans are prepaid and hard-capped rather than creating unlimited post-paid overage.\n\nEnterprise is request-based and can use exact private pricing and quotas, extra team seats, branded media domains, assisted migration, retention/deletion-protection requirements, data-residency options, regional or dedicated infrastructure, private/signed delivery requirements, and contractual SLA terms where agreed.\n\nCustomers retain ownership of uploaded content. Standard delivery URLs are public to anyone who has the URL; private or signed delivery is an Enterprise/custom requirement. Mkety Media also provides full-library portability so customers can export their inventory and move their files.\n\nUse `media.mkety.com` as the canonical source for current plan details, signup and product availability.',
    sortOrder: 20,
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
      '# Privacy and access\n\nPublic Mkety pages and documentation contain general product information. Account, workspace, billing, deployment, and organization-specific information should only be accessed through the appropriate authenticated Mkety experience. Public Mkety AI does not receive private tenant, project, billing, deployment, file, agent, workflow, or organization data simply because a visitor asks for it.',
    sortOrder: 20,
  },
  {
    categoryKey: 'trust',
    slug: 'security-and-reliability',
    title: 'Security and reliability',
    excerpt: 'How Mkety approaches protected access, secrets, operational visibility, and reliable delivery.',
    bodyMarkdown:
      '# Security and reliability\n\nMkety separates public product information from authenticated customer operations. Organizations, workspaces, projects, roles, and permissions scope protected activity. Supported products use protected secret and environment-configuration paths for sensitive credentials, and customers should never place passwords, API keys, payment secrets, or other sensitive values into public support conversations.\n\nOperational controls vary by product and can include usage visibility, run and execution history, deployment status and logs, billing/capacity visibility, retries, monitoring, and managed delivery controls. Security and reliability requirements beyond the standard self-service platform can be scoped through Enterprise.\n\nMkety does not represent a certification, regulatory status, or guaranteed service level unless that claim is explicitly published by Mkety or written into an applicable customer agreement.',
    sortOrder: 30,
  },
  {
    categoryKey: 'trust',
    slug: 'enterprise-service-levels',
    title: 'Enterprise service levels and architecture',
    excerpt: 'How dedicated infrastructure, data residency, retention, private delivery, and SLA requirements are handled.',
    bodyMarkdown:
      '# Enterprise service levels and architecture\n\nEnterprise is the route for requirements outside the standard shared platform envelope. Depending on the agreed solution, Mkety can scope private or dedicated infrastructure, regional or data-residency requirements, persistent services, containers, specialized networking, high-throughput workloads, assisted migration, retention or deletion-protection requirements, private or signed delivery, and tailored operational support.\n\nService-level commitments are contractual: uptime targets, response times, support coverage, retention rules, recovery expectations, and other guarantees apply only when they are explicitly agreed in the relevant Enterprise order or agreement. Mkety does not silently convert a standard self-service plan into a custom SLA.',
    sortOrder: 40,
  },
  {
    categoryKey: 'trust',
    slug: 'data-portability',
    title: 'Data portability and migration',
    excerpt: 'How Mkety approaches export, migration, and customer handoff requirements.',
    bodyMarkdown:
      '# Data portability and migration\n\nPortability depends on the Mkety product and the data involved. Mkety Media provides complete library inventory export through JSON/CSV manifests and generated download-all tooling so customers can move their media. Other products expose product-specific data, history, or configuration through their supported interfaces. Enterprise engagements can include agreed migration, export, retention, handoff, or transition requirements when portability needs go beyond standard product controls.',
    sortOrder: 50,
  },
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
      '# Academy learning hubs\n\nMkety Academy presents learning across Web & App Engineering, Trading Masterclass, Digital Funnel & Marketing, AI & Automation Lab, and Certified Digital Skills. Start with Mkety AI for current published programme, schedule, enrolment and pricing information. When an Academy access handoff is appropriate, Mkety provides the destination separately.',
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
