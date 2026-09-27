import type { PlatformOverviewSectionInput } from './schemas';

export interface MketyPublicPageDefault {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  headline: string;
  intro: string;
  sections: PlatformOverviewSectionInput[];
}

export const MKETY_PUBLIC_PAGE_DEFAULTS: readonly MketyPublicPageDefault[] = [
  {
    slug: 'platform',
    title: 'Mkety Platform',
    seoTitle: 'Mkety Platform | Build, automate, deploy and operate',
    seoDescription:
      'Explore Mkety Platform and how projects, workspaces, AI, automation, deployments, SolutionHub, usage and billing fit together.',
    eyebrow: 'Platform',
    headline: 'One connected platform for modern digital systems.',
    intro:
      'Mkety brings focused workspaces, projects, teams, solutions, usage and commercial controls together in one product ecosystem.',
    sections: [
      {
        eyebrow: 'Core model',
        title: 'Build from projects and focused workspaces.',
        description:
          'Projects organize what you are building while AI, Automation and Deploy Workspaces provide specialized tools. SolutionHub supplies ready-made starting points and Enterprise supports specialized requirements.',
        items: [
          {
            key: 'projects',
            title: 'Projects',
            description:
              'Organize teams, workspaces, deployments, usage and operational context around what you are building.',
          },
          {
            key: 'workspaces',
            title: 'Focused workspaces',
            description:
              'Choose AI, Automation or Deploy individually, or combine all self-service Workspaces with Mkety One.',
          },
          {
            key: 'solutions',
            title: 'Solutions',
            description:
              'Start faster with reusable SolutionHub blueprints or work with Mkety on custom Enterprise delivery.',
          },
          {
            key: 'operate',
            title: 'Operate',
            description:
              'Manage domains, usage, credits, billing visibility, team access, history, and approved administration from the same Mkety platform.',
          },
        ],
        cta: { label: 'Explore Workspaces', href: '/workspaces' },
      },
      {
        eyebrow: 'Provider flexibility',
        title: 'Mkety abstracts the provider layer so your product is not tied to one AI vendor.',
        description:
          'Mkety AI is built around approved provider routes and current model governance. Today Mkety supports OpenAI, Azure OpenAI, Google Gemini, Google Vertex AI, Cloudflare Workers AI, and AWS Bedrock, with provider selection kept behind one Mkety experience.',
        items: [
          {
            key: 'ai-provider-routing',
            title: 'Multiple AI provider paths',
            description:
              'Use Mkety-supported model routes across OpenAI, Azure OpenAI, Gemini, Vertex AI, Workers AI, and Bedrock without rebuilding the surrounding agent, knowledge, tool, project, and usage experience.',
          },
          {
            key: 'model-operations',
            title: 'Current-model governance',
            description:
              'Mkety keeps an approved model registry so current stable and limited-access models can be validated centrally instead of scattering model IDs throughout customer applications.',
          },
          {
            key: 'provider-growth',
            title: 'Designed for provider expansion',
            description:
              'The provider boundary is designed to add approved provider routes such as direct Anthropic, OpenRouter, Groq, and other supported model services without changing the customer-facing Mkety product model.',
          },
          {
            key: 'infrastructure',
            title: 'Mkety-managed infrastructure boundary',
            description:
              'Mkety presents one operating experience while using selected cloud, edge, identity, storage, database, and payment infrastructure behind protected service boundaries.',
            href: '/infrastructure',
          },
        ],
        cta: { label: 'Explore Infrastructure', href: '/infrastructure' },
      },
    ],
  },
  {
    slug: 'workspaces',
    title: 'Mkety Workspaces',
    seoTitle: 'Mkety Workspaces | AI, Automation and Deploy',
    seoDescription:
      'Explore Mkety AI, Automation and Deploy Workspaces, plus the specialized Custom / Enterprise Trading product.',
    eyebrow: 'Workspaces',
    headline: 'Focused tools that share one Mkety experience.',
    intro:
      'Choose the workspace that fits what you want to build, or use Mkety One for Starter plus all three self-service Workspaces.',
    sections: [
      {
        eyebrow: 'Available workspaces',
        title: 'AI, Automation and Deploy.',
        description: 'Each Workspace focuses on a different type of work while remaining part of the Mkety Platform.',
        items: [
          {
            key: 'ai',
            title: 'AI Workspace',
            description:
              'Build and publish AI agents with knowledge/RAG, tools and actions, model choice, testing, versions, Website AI, supported channels, API access, run history, token/usage visibility, and project-scoped controls.',
            href: '/app',
          },
          {
            key: 'automation',
            title: 'Automation Workspace',
            description:
              'Build workflows with manual, webhook and scheduled triggers, API/HTTP actions, transforms, conditions, agent actions, variables, protected secrets, retries, failure recording, execution history, and usage visibility.',
            href: '/app',
          },
          {
            key: 'deploy',
            title: 'Deploy Workspace',
            description:
              'Deploy lightweight web apps, APIs, portals and serverless workloads with preview and production environments, environment variables, secrets, custom domains, HTTPS, logs, deployment status/history, routing and usage visibility.',
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
      },
      {
        eyebrow: 'AI Workspace',
        title: 'Choose models through Mkety, not around Mkety.',
        description:
          'The current Mkety AI provider layer supports OpenAI, Azure OpenAI, Google Gemini, Google Vertex AI, Cloudflare Workers AI, and AWS Bedrock. Bedrock also provides access to supported Anthropic and Amazon model families through that provider route.',
        items: [
          {
            key: 'openai-family',
            title: 'OpenAI & Azure OpenAI',
            description:
              'Approved current OpenAI model families are available through both direct OpenAI and Azure OpenAI provider paths where configured.',
          },
          {
            key: 'google-family',
            title: 'Gemini & Vertex AI',
            description:
              'Google model routes are supported through Gemini API and Vertex AI so Mkety can fit direct and Google Cloud operating requirements.',
          },
          {
            key: 'cloudflare-ai',
            title: 'Workers AI',
            description:
              'Mkety supports Cloudflare Workers AI as an AI execution path. Mkety is also designed to add AI Gateway routing for observability, control and multi-provider operations as that workstream is promoted.',
          },
          {
            key: 'bedrock',
            title: 'AWS Bedrock',
            description:
              'AWS Bedrock is supported as a provider path for approved Bedrock-hosted model families, including supported Anthropic Claude and Amazon Nova models in the current registry.',
          },
        ],
      },
      {
        eyebrow: 'Deploy Workspace',
        title: 'Mkety-managed edge and application delivery.',
        description:
          'Deploy is presented as a Mkety product. Under the hood, the current production architecture uses Cloudflare edge services for appropriate serverless, routing, DNS, CDN, storage and custom-hostname workloads, with OCI used for persistent backend and compute requirements.',
        items: [
          {
            key: 'edge-runtime',
            title: 'Edge/serverless runtime',
            description:
              'Deploy lightweight web applications, APIs, routing logic and supported serverless workloads through Mkety-managed edge deployment.',
          },
          {
            key: 'preview-production',
            title: 'Preview and production',
            description:
              'Use isolated preview deployments before production promotion, with deployment state, history and verification boundaries.',
          },
          {
            key: 'domains',
            title: 'Mkety and custom domains',
            description:
              'Customer applications can use approved *.mkety.app deployment hostnames and supported custom domains with HTTPS and routing managed through Mkety.',
            href: '/infrastructure',
          },
          {
            key: 'persistent',
            title: 'Persistent workloads when required',
            description:
              'Workloads that need persistent compute, databases, Redis, containers or specialized networking can use Mkety-managed OCI-backed infrastructure or Enterprise architecture where appropriate.',
          },
        ],
        cta: { label: 'How Mkety infrastructure works', href: '/infrastructure' },
      },
    ],
  },
  {
    slug: 'solutions',
    title: 'Mkety SolutionHub',
    seoTitle: 'Mkety SolutionHub | Ready-made business solutions',
    seoDescription:
      'Discover reusable Mkety AI, automation, website, portal, dashboard, lightweight application and enterprise solutions.',
    eyebrow: 'SolutionHub',
    headline: 'Start from a useful solution, then adapt it to your business.',
    intro: 'SolutionHub gives you reusable starting points that can use one or more Mkety Workspaces.',
    sections: [
      {
        eyebrow: 'Solution classes',
        title: 'Reusable where possible. Custom where necessary.',
        description:
          'Use ready-made solutions for common needs or work with Mkety on a custom Enterprise implementation for specialized requirements.',
        items: [
          {
            key: 'ai-solutions',
            title: 'AI solutions',
            description: 'Website AI, knowledge assistants, support and sales agents, document Q&A, lead qualification, appointment AI, and supported messaging AI.',
          },
          {
            key: 'automation-solutions',
            title: 'Automation solutions',
            description: 'Lead, notification, content, API, scheduled, webhook, approval, CRM, sales, support, and reasonable data-sync workflows.',
          },
          {
            key: 'business-solutions',
            title: 'Web & lightweight applications',
            description: 'Landing pages, business sites, portfolios, blogs, booking apps, portals, dashboards, lightweight CRM/help-desk/inventory tools, APIs, and web applications.',
          },
        ],
        cta: { label: 'Get Started', href: '/signup' },
      },
      {
        eyebrow: 'Enterprise boundary',
        title: 'Dedicated infrastructure when the requirement needs it.',
        description:
          'Complex ERP, larger transactional or regulated systems, browser automation, heavy data processing, arbitrary containers, persistent services, private databases or networking, dedicated environments, specialized Trading infrastructure, high-throughput integrations, and strict SLA deployments are scoped through Enterprise.',
        items: [],
        cta: { label: 'Discuss Enterprise Project', href: '/contact#mkety-ai' },
      },
    ],
  },
  {
    slug: 'academy',
    title: 'Mkety Academy',
    seoTitle: 'Mkety Academy | Practical digital skills',
    seoDescription:
      'Learn web and app engineering, trading, digital marketing, AI, automation and certified digital skills through Mkety Academy.',
    eyebrow: 'Academy',
    headline: 'Practical learning for valuable digital skills.',
    intro:
      'Mkety Academy provides structured learning paths built around real skills, practical implementation and measurable capability.',
    sections: [
      {
        eyebrow: 'Learning hubs',
        title: 'Choose the skill path that fits your goal.',
        description:
          'Start with Mkety AI for current published programme, schedule, enrolment and pricing information. Mkety provides Academy access separately when the right enrolment/access is confirmed.',
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
        cta: { label: 'Ask Mkety AI about Academy', href: '#mkety-ai' },
      },
      {
        eyebrow: 'Courses & tiers',
        title: 'Published course options can have their own tiers and prices.',
        description:
          'Mkety admins can add, remove, duplicate, reorder, or change course/tier cards from Platform Control. Each tier card can carry its own title, description, price badge, and enrolment CTA. Published sales and enrolment questions start with Mkety AI so current programme details can be checked before human follow-up.',
        items: [
          {
            key: 'course-tier-guide',
            title: 'Course and tier catalogue',
            description:
              'Current course tiers, schedules, pricing and enrolment availability are published by Mkety admins and can change without code deployment.',
            href: '#mkety-ai',
            badge: 'Ask AI for current options',
          },
        ],
        cta: { label: 'Check current courses and pricing', href: '#mkety-ai' },
      },
      {
        eyebrow: 'Ready to learn?',
        title: 'Already enrolled or ready to enter the learning portal?',
        description:
          'The Academy app is the learning-access destination. Public discovery, programme questions, sales and enrolment guidance remain on mkety.com through Mkety AI and human support.',
        items: [],
        cta: { label: 'Sign in to Mkety Academy', href: 'https://academy.mkety.com' },
      },
    ],
  },
  {
    slug: 'pricing',
    title: 'Mkety Pricing',
    seoTitle: 'Mkety Pricing | Starter, Workspaces, Mkety One and Enterprise',
    seoDescription:
      'Compare Mkety Starter, AI Workspace, Automation Workspace, Deploy Workspace, Mkety One, Trading Workspace as Custom / Enterprise, and Enterprise.',
    eyebrow: 'Pricing',
    headline: 'Choose Starter, a Workspace, Mkety One, or Enterprise.',
    intro:
      'Pick the product access you need and pay monthly or prepay 3, 6, or 12 months. Longer prepaid terms receive progressively lower effective monthly pricing. Mkety One combines the standard self-service options, while Trading Workspace and other specialized requirements remain Custom / Enterprise.',
    sections: [
      {
        eyebrow: 'Commercial model',
        title: 'Clear options for different ways of working.',
        description:
          'Starter is the Pages-first website and publishing plan. AI, Automation and Deploy can be purchased as individual Workspaces. Self-service plans support 1, 3, 6, and 12 month prepaid terms with 0%, 5%, 10%, and 15% discounts respectively. Mkety One combines Starter plus all three self-service Workspaces. Trading Workspace remains visible as Custom / Enterprise without self-service pricing. Enterprise covers requirements beyond the standard shared platform envelope.',
        items: [
          {
            key: 'trading-workspace',
            title: 'Trading Workspace',
            description:
              'Specialized trading automation, signal workflows, integrations, execution infrastructure, monitoring and deployments are delivered under Custom / Enterprise terms.',
            href: '/enterprise',
            badge: 'Custom / Enterprise',
          },
        ],
      },
    ],
  },
  {
    slug: 'enterprise',
    title: 'Mkety Enterprise',
    seoTitle: 'Mkety Enterprise | Custom systems and implementations',
    seoDescription:
      'Mkety Enterprise delivers custom systems, managed implementations, private or dedicated infrastructure, specialized integrations and contractable service levels.',
    eyebrow: 'Enterprise',
    headline: 'Custom delivery for requirements beyond standard self-service.',
    intro:
      'Use Mkety Enterprise for specialized systems, private or dedicated infrastructure, managed delivery, trading infrastructure, migration, data-residency requirements and organization-specific service commitments.',
    sections: [
      {
        eyebrow: 'Custom delivery',
        title: 'Built around the requirement.',
        description:
          'Enterprise projects are scoped and commercially agreed before Mkety issues exact-amount payment links and provisions the appropriate product or workspace access.',
        items: [
          {
            key: 'trading',
            title: 'Trading infrastructure',
            description:
              'Specialized trading systems are sold and scoped through Enterprise before approved Trading access is provided.',
            href: '/enterprise',
            badge: 'Custom / Enterprise',
          },
          {
            key: 'customer-projects',
            title: 'Custom projects',
            description: 'Dedicated systems and integrations designed around your organization.',
          },
          {
            key: 'architecture',
            title: 'Private & specialized architecture',
            description:
              'Scope dedicated or regional infrastructure, persistent services, containers, specialized networking, private delivery, high-throughput workloads, migration and retention requirements where agreed.',
          },
          {
            key: 'support',
            title: 'Managed support & service levels',
            description:
              'Implementation, operational support, response expectations, retention controls and service-level commitments can be written into the applicable Enterprise order or agreement.',
          },
        ],
        cta: { label: 'Discuss Enterprise Project', href: '/contact#mkety-ai' },
      },
    ],
  },
  {
    slug: 'trust',
    title: 'Mkety Trust',
    seoTitle: 'Mkety Trust | Security, identity, data and operational controls',
    seoDescription:
      'Review Mkety security, identity, tenant isolation, protected configuration, payments, operational visibility, portability and Enterprise control boundaries.',
    eyebrow: 'Trust',
    headline: 'Clear technical and operational boundaries customers can verify.',
    intro:
      'Mkety is built around scoped identity, tenant and project isolation, protected secrets, verified payment settlement, observable operations, explicit infrastructure boundaries, and data portability rather than hidden assumptions.',
    sections: [
      {
        eyebrow: 'Identity & access',
        title: 'Access is scoped by user, organization, project, role and entitlement.',
        description:
          'Mkety uses a dedicated identity foundation and Mkety-owned application sessions while keeping authorization, tenant membership and purchased entitlements separate concerns.',
        items: [
          {
            key: 'identity',
            title: 'Managed identity',
            description:
              'Authentication is handled through the Mkety identity boundary while Mkety applications maintain their own protected session and authorization state.',
          },
          {
            key: 'tenant-isolation',
            title: 'Tenant and project isolation',
            description:
              'Customer resources are scoped to organizations and projects, with server-side authorization required before protected resources are accessed.',
          },
          {
            key: 'roles',
            title: 'Roles and permissions',
            description:
              'Workspace membership, roles and permissions are maintained by Mkety and are not inferred only from external identity-provider claims.',
          },
        ],
      },
      {
        eyebrow: 'Operations & commercial safety',
        title: 'Sensitive operations fail closed and remain auditable.',
        description:
          'Secrets stay server-side, payment settlement requires verified provider evidence, important administrative actions are designed for auditability, and usage/billing state is kept separate from browser redirects or unverified client events.',
        items: [
          {
            key: 'secrets',
            title: 'Protected secrets',
            description:
              'API keys, provider credentials, webhook secrets and runtime configuration are stored in protected server-side configuration paths rather than public content or browser bundles.',
          },
          {
            key: 'payments',
            title: 'Verified payments',
            description:
              'Mkety payment flows use server-side provider verification, exact amount/reference validation, idempotency and auditable settlement boundaries.',
          },
          {
            key: 'portability',
            title: 'Portability and migration',
            description:
              'Mkety products expose product-specific export and portability controls, with Enterprise migration, retention and handoff requirements available where agreed.',
          },
        ],
        cta: { label: 'View Infrastructure', href: '/infrastructure' },
      },
    ],
  },
  {
    slug: 'infrastructure',
    title: 'Mkety Infrastructure',
    seoTitle: 'Mkety Infrastructure | Edge, cloud, deployment and provider architecture',
    seoDescription:
      'See how Mkety combines managed edge/serverless delivery, persistent cloud infrastructure, customer deployment domains, storage, databases and provider abstractions.',
    eyebrow: 'Infrastructure',
    headline: 'Mkety operates as one platform across selected edge and cloud infrastructure.',
    intro:
      'Customers use Mkety products and controls rather than raw provider consoles. Mkety currently combines Cloudflare for appropriate edge, routing, serverless, storage and delivery workloads with OCI for persistent backend and compute requirements, while keeping architecture portable where practical.',
    sections: [
      {
        eyebrow: 'Current foundation',
        title: 'Edge where appropriate. Persistent compute where required.',
        description:
          'The production architecture separates lightweight edge/serverless workloads from persistent backend services so each workload can run in the appropriate operating environment.',
        items: [
          {
            key: 'edge',
            title: 'Mkety edge delivery',
            description:
              'Mkety uses Cloudflare capabilities where appropriate for DNS, CDN, Workers, routing, custom hostnames, R2 object storage and other edge delivery functions.',
          },
          {
            key: 'persistent',
            title: 'Mkety persistent infrastructure',
            description:
              'OCI-backed services provide persistent compute for components such as PostgreSQL, Redis, managed application services and workloads that do not belong in an edge runtime.',
          },
          {
            key: 'database',
            title: 'Database connectivity',
            description:
              'Mkety uses protected database connectivity and pooling boundaries rather than exposing customer-facing database endpoints as part of the public application surface.',
          },
          {
            key: 'portable',
            title: 'Provider-aware, Mkety-owned architecture',
            description:
              'Underlying providers can supply infrastructure capabilities while Mkety owns the product model, authorization, billing, deployment orchestration, customer controls and service boundaries.',
          },
        ],
      },
      {
        eyebrow: 'Customer applications',
        title: 'mkety.app is the deployment namespace, not the Mkety dashboard.',
        description:
          'The authenticated customer control plane belongs to app.mkety.com. Customer applications, generated sites, APIs and preview environments may use approved *.mkety.app hostnames or supported custom domains.',
        items: [
          {
            key: 'platform-domain',
            title: 'app.mkety.com',
            description:
              'Authenticated Mkety Platform where customers manage workspaces, projects, usage, billing, teams and supported product operations.',
          },
          {
            key: 'deployment-domain',
            title: '*.mkety.app',
            description:
              'Customer-facing preview and production application hostnames created through Mkety Deploy. The apex mkety.app should explain this deployment namespace and point customers back to Mkety Platform.',
          },
          {
            key: 'custom-domains',
            title: 'Custom domains',
            description:
              'Supported customer-owned domains can be mapped to eligible deployments with managed routing and HTTPS.',
          },
          {
            key: 'api-domain',
            title: 'api.mkety.com',
            description:
              'Reserved as the public/platform API boundary for supported APIs, integrations, webhooks and service entry points.',
          },
        ],
        cta: { label: 'Explore Deploy Workspace', href: '/workspaces' },
      },
    ],
  },
  {
    slug: 'about',
    title: 'About Mkety',
    seoTitle: 'About Mkety | Technology platform and solutions company',
    seoDescription:
      'Learn how Mkety combines Platform software, Academy learning, ready-made solutions and enterprise delivery.',
    eyebrow: 'About',
    headline: 'Technology designed around building useful systems and valuable skills.',
    intro:
      'Mkety brings software, practical learning, reusable solutions and enterprise delivery together in one product ecosystem.',
    sections: [
      {
        eyebrow: 'What Mkety is',
        title: 'Platform + Academy, with SolutionHub and Enterprise around them.',
        description:
          'Mkety Platform provides software Workspaces. Mkety Academy provides practical learning. SolutionHub packages reusable solutions. Enterprise handles specialized customer requirements.',
        items: [],
        cta: { label: 'Explore Platform', href: '/platform' },
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact Mkety',
    seoTitle: 'Contact Mkety | Platform, Academy and Enterprise enquiries',
    seoDescription:
      'Contact Mkety about Platform access, Academy, partnerships, enterprise implementations or support.',
    eyebrow: 'Contact',
    headline: 'Talk to the right part of Mkety.',
    intro: 'Start with Mkety AI for product, support, sales and general enquiries. It checks public Mkety documentation first, answers directly when it can, and points you to human support when needed.',
    sections: [
      {
        eyebrow: 'Enquiries',
        title: 'Start with Mkety AI, then escalate only when needed.',
        description:
          'Choose the area that best matches your enquiry. Never send passwords, API keys, payment secrets or other sensitive credentials through a general enquiry.',
        items: [
          {
            key: 'ai-support',
            title: 'Ask Mkety AI',
            description: 'Start here for product, docs, pricing, support and sales questions. Mkety AI can guide you and escalate to a human channel when needed.',
            href: '#mkety-ai',
          },
          {
            key: 'support',
            title: 'Product & Support',
            description: 'Ask Mkety AI first for account, product, access and general support; it will provide the configured human channel when needed.',
            href: '#mkety-ai',
          },
          {
            key: 'enterprise',
            title: 'Enterprise & Partnerships',
            description: 'Start Enterprise, Trading, partnership and managed implementation enquiries with Mkety AI; it will escalate to sales when needed.',
            href: '#mkety-ai',
          },
          {
            key: 'academy',
            title: 'Academy',
            description: 'Ask Mkety AI about programmes, schedules, enrolment and next steps; Academy access is handed off separately when appropriate.',
            href: '#mkety-ai',
          },
        ],
      },
    ],
  },
] as const;

export function getDefaultPublicPage(slug: string): MketyPublicPageDefault | null {
  return MKETY_PUBLIC_PAGE_DEFAULTS.find((page) => page.slug === slug) ?? null;
}
