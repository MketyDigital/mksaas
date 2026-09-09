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
    seoDescription: 'Explore Mkety Platform and how projects, workspaces, AI, automation, deployments, SolutionHub, usage and billing fit together.',
    eyebrow: 'Platform',
    headline: 'One connected platform for modern digital systems.',
    intro: 'Mkety brings focused workspaces, projects, teams, solutions, usage and commercial controls together in one product ecosystem.',
    sections: [
      {
        eyebrow: 'Core model',
        title: 'Build from projects and focused workspaces.',
        description: 'Projects organize what you are building while AI, Automation and Deploy Workspaces provide specialized tools. SolutionHub supplies ready-made starting points and Enterprise supports specialized requirements.',
        items: [
          { key: 'projects', title: 'Projects', description: 'Organize teams, workspaces, deployments, usage and operational context around what you are building.' },
          { key: 'workspaces', title: 'Focused workspaces', description: 'Choose AI, Automation or Deploy individually, or combine all self-service Workspaces with Mkety One.' },
          { key: 'solutions', title: 'Solutions', description: 'Start faster with reusable SolutionHub blueprints or work with Mkety on custom Enterprise delivery.' },
        ],
        cta: { label: 'Explore Workspaces', href: '/workspaces' },
      },
    ],
  },
  {
    slug: 'workspaces',
    title: 'Mkety Workspaces',
    seoTitle: 'Mkety Workspaces | AI, Automation and Deploy',
    seoDescription: 'Explore Mkety AI, Automation and Deploy Workspaces, plus the specialized Custom / Enterprise Trading product.',
    eyebrow: 'Workspaces',
    headline: 'Focused tools that share one Mkety experience.',
    intro: 'Choose the workspace that fits what you want to build, or use Mkety One for Starter plus all three self-service Workspaces.',
    sections: [
      {
        eyebrow: 'Available workspaces',
        title: 'AI, Automation and Deploy.',
        description: 'Each Workspace focuses on a different type of work while remaining part of the Mkety Platform.',
        items: [
          { key: 'ai', title: 'AI Workspace', description: 'Build agents, connect knowledge, choose models, test, version, publish, and monitor AI applications.', href: '/app/ai' },
          { key: 'automation', title: 'Automation Workspace', description: 'Create workflows from triggers, actions, conditions, webhooks, transformations, and agent steps.', href: '/app/automation' },
          { key: 'deploy', title: 'Deploy Workspace', description: 'Publish websites, lightweight applications, APIs, portals, and serverless workloads with domains and deployment history.', href: '/app/deploy' },
          { key: 'trading', title: 'Trading Workspace', description: 'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.', href: 'https://trade.mkety.com', badge: 'Custom / Enterprise' },
        ],
      },
    ],
  },
  {
    slug: 'solutions',
    title: 'Mkety SolutionHub',
    seoTitle: 'Mkety SolutionHub | Ready-made business solutions',
    seoDescription: 'Discover reusable Mkety agents, workflows, applications, deployment templates, business automations and enterprise solutions.',
    eyebrow: 'SolutionHub',
    headline: 'Start from a useful solution, then adapt it to your business.',
    intro: 'SolutionHub gives you reusable starting points that can use one or more Mkety Workspaces.',
    sections: [
      {
        eyebrow: 'Solution classes',
        title: 'Reusable where possible. Custom where necessary.',
        description: 'Use ready-made solutions for common needs or work with Mkety on a custom Enterprise implementation for specialized requirements.',
        items: [
          { key: 'ai-solutions', title: 'AI solutions', description: 'Packaged agents, knowledge patterns and AI applications.' },
          { key: 'automation-solutions', title: 'Automation solutions', description: 'Workflow blueprints for repeatable business processes.' },
          { key: 'business-solutions', title: 'Business solutions', description: 'Complete solution patterns combining multiple Mkety capabilities.' },
        ],
        cta: { label: 'Get Started', href: '/create-workspace' },
      },
    ],
  },
  {
    slug: 'academy',
    title: 'Mkety Academy',
    seoTitle: 'Mkety Academy | Practical digital skills',
    seoDescription: 'Learn web and app engineering, trading, digital marketing, AI, automation and certified digital skills through Mkety Academy.',
    eyebrow: 'Academy',
    headline: 'Practical learning for valuable digital skills.',
    intro: 'Mkety Academy provides structured learning paths built around real skills, practical implementation and measurable capability.',
    sections: [
      {
        eyebrow: 'Learning hubs',
        title: 'Choose the skill path that fits your goal.',
        description: 'Current programmes, enrolment options and Academy pricing are maintained directly by Mkety Academy.',
        items: [
          { key: 'web-app', title: 'Web & App Engineering', description: 'Learn to design, build, ship, and improve modern web and application products.' },
          { key: 'trading', title: 'Trading Masterclass', description: 'Structured trading education focused on market skills, risk, process, and execution.' },
          { key: 'marketing', title: 'Digital Funnel & Marketing', description: 'Build practical customer acquisition, conversion, content, and digital sales systems.' },
          { key: 'ai-automation', title: 'AI & Automation Lab', description: 'Build useful AI agents, automations, and connected workflows for real use cases.' },
          { key: 'certified-skills', title: 'Certified Digital Skills', description: 'Follow practical learning paths designed to build demonstrable digital capability.' },
        ],
        cta: { label: 'Explore Mkety Academy', href: 'https://academy.mkety.com' },
      },
    ],
  },
  {
    slug: 'pricing',
    title: 'Mkety Pricing',
    seoTitle: 'Mkety Pricing | Starter, Workspaces, Mkety One and Enterprise',
    seoDescription: 'Compare Mkety Starter, AI Workspace, Automation Workspace, Deploy Workspace, Mkety One and Enterprise.',
    eyebrow: 'Pricing',
    headline: 'Choose Starter, a Workspace, Mkety One, or Enterprise.',
    intro: 'Pick only the Mkety access you need, combine the self-service Workspaces with Mkety One, or use Enterprise for specialized requirements.',
    sections: [
      {
        eyebrow: 'Commercial model',
        title: 'Clear options for different ways of working.',
        description: 'Starter is the entry plan. AI, Automation and Deploy can be purchased as individual Workspaces. Mkety One combines Starter plus all three self-service Workspaces. Enterprise is custom.',
        items: [],
      },
    ],
  },
  {
    slug: 'enterprise',
    title: 'Mkety Enterprise',
    seoTitle: 'Mkety Enterprise | Custom systems and implementations',
    seoDescription: 'Mkety Enterprise delivers custom systems, integrations, managed implementations and specialized Trading infrastructure.',
    eyebrow: 'Enterprise',
    headline: 'Custom delivery for requirements beyond standard self-service.',
    intro: 'Use Mkety Enterprise for specialized systems, integrations, managed delivery, trading infrastructure and organization-specific requirements.',
    sections: [
      {
        eyebrow: 'Custom delivery',
        title: 'Built around the requirement.',
        description: 'Enterprise projects are scoped around the system, integration, support and operational needs of the customer.',
        items: [
          { key: 'trading', title: 'Trading infrastructure', description: 'Specialized trading systems are delivered under Custom / Enterprise terms.', href: 'https://trade.mkety.com', badge: 'Custom / Enterprise' },
          { key: 'customer-projects', title: 'Custom projects', description: 'Dedicated systems and integrations designed around your organization.' },
          { key: 'support', title: 'Managed support', description: 'Implementation and operational support tailored to enterprise requirements.' },
        ],
        cta: { label: 'Start Enterprise Project', href: '/enterprise/checkout' },
      },
    ],
  },
  {
    slug: 'about',
    title: 'About Mkety',
    seoTitle: 'About Mkety | Technology platform and solutions company',
    seoDescription: 'Learn how Mkety combines Platform software, Academy learning, ready-made solutions and enterprise delivery.',
    eyebrow: 'About',
    headline: 'Technology designed around building useful systems and valuable skills.',
    intro: 'Mkety brings software, practical learning, reusable solutions and enterprise delivery together in one product ecosystem.',
    sections: [
      {
        eyebrow: 'What Mkety is',
        title: 'Platform + Academy, with SolutionHub and Enterprise around them.',
        description: 'Mkety Platform provides software Workspaces. Mkety Academy provides practical learning. SolutionHub packages reusable solutions. Enterprise handles specialized customer requirements.',
        items: [],
        cta: { label: 'Explore Platform', href: '/platform' },
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact Mkety',
    seoTitle: 'Contact Mkety | Platform, Academy and Enterprise enquiries',
    seoDescription: 'Contact Mkety about Platform access, Academy, partnerships, enterprise implementations or support.',
    eyebrow: 'Contact',
    headline: 'Talk to the right part of Mkety.',
    intro: 'Use the options below for product, Academy, enterprise and general Mkety enquiries.',
    sections: [
      {
        eyebrow: 'Enquiries',
        title: 'Product, learning and enterprise conversations.',
        description: 'Choose the area that best matches your enquiry. Never send passwords, API keys, payment secrets or other sensitive credentials through a general enquiry.',
        items: [
          { key: 'general', title: 'General', description: 'Questions about Mkety, products and public information.' },
          { key: 'enterprise', title: 'Enterprise', description: 'Custom systems, integrations, Trading and managed implementation requirements.' },
          { key: 'academy', title: 'Academy', description: 'Courses, programmes and enrolment information.', href: 'https://academy.mkety.com' },
        ],
      },
    ],
  },
] as const;

export function getDefaultPublicPage(slug: string): MketyPublicPageDefault | null {
  return MKETY_PUBLIC_PAGE_DEFAULTS.find((page) => page.slug === slug) ?? null;
}
