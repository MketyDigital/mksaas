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
              'Build and publish AI agents with knowledge, tools/actions, model choice, testing, drafts/versions, Website AI, supported messaging channels, API access, run history, and usage visibility.',
            href: '/app',
          },
          {
            key: 'automation',
            title: 'Automation Workspace',
            description:
              'Build visual workflows with webhooks, schedules, API actions, conditions, notifications, integrations, secrets, retries, execution logs/history, and usage visibility.',
            href: '/app',
          },
          {
            key: 'deploy',
            title: 'Deploy Workspace',
            description:
              'Deploy lightweight web apps, APIs, portals, and serverless workloads through Mkety managed edge/serverless deployment with environment variables, secrets, supported domains, logs, status, history, and usage visibility.',
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
        items: [],
      },
    ],
  },
  {
    slug: 'enterprise',
    title: 'Mkety Enterprise',
    seoTitle: 'Mkety Enterprise | Custom systems and implementations',
    seoDescription:
      'Mkety Enterprise delivers custom systems, integrations, managed implementations and specialized Trading infrastructure.',
    eyebrow: 'Enterprise',
    headline: 'Custom delivery for requirements beyond standard self-service.',
    intro:
      'Use Mkety Enterprise for specialized systems, integrations, managed delivery, trading infrastructure and organization-specific requirements.',
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
            key: 'support',
            title: 'Managed support',
            description: 'Implementation and operational support tailored to enterprise requirements.',
          },
        ],
        cta: { label: 'Discuss Enterprise Project', href: '/contact#mkety-ai' },
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
            key: 'telegram',
            title: 'Telegram',
            description: 'Mkety AI can route you to the configured Telegram support channel when a human conversation is needed.',
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
