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
    seoDescription: 'Explore the Mkety Platform and how projects, workspaces, AI, automation, deployments, usage, credits, billing and operations fit together.',
    eyebrow: 'Platform',
    headline: 'One operating layer for modern business systems.',
    intro: 'Mkety connects focused workspaces through projects, teams, identity, usage, commercial controls and operations while keeping protected backend behavior code-owned.',
    sections: [
      {
        eyebrow: 'Core model',
        title: 'Build from projects and focused workspaces.',
        description: 'Projects provide context while AI, Automation and Deploy workspaces provide specialized tools. SolutionHub supplies packaged starting points and enterprise work stays clearly separated.',
        items: [
          { key: 'projects', title: 'Projects', description: 'Organize teams, workspaces, deployments, usage and operational context around what you are building.' },
          { key: 'commercial', title: 'Commercial controls', description: 'Plans, entitlements, usage, credits, wallet/accounting views and billing remain distinct concepts with authoritative backend enforcement.' },
          { key: 'operations', title: 'Operations', description: 'Domains, environments, audit-sensitive actions and infrastructure boundaries stay controlled by Mkety architecture.' },
        ],
        cta: { label: 'Explore Workspaces', href: '/workspaces' },
      },
    ],
  },
  {
    slug: 'workspaces',
    title: 'Mkety Workspaces',
    seoTitle: 'Mkety Workspaces | AI, Automation and Deploy',
    seoDescription: 'Explore Mkety AI, Automation and Deploy workspaces, plus the Custom / Enterprise Trading boundary.',
    eyebrow: 'Workspaces',
    headline: 'Focused tools that share one platform context.',
    intro: 'Each workspace solves a different class of work without forcing every capability into one crowded interface.',
    sections: [
      {
        eyebrow: 'Available workspace model',
        title: 'AI, Automation and Deploy.',
        description: 'The Platform keeps workspace capabilities distinct while allowing them to cooperate through projects and controlled shared services.',
        items: [
          { key: 'ai', title: 'AI Workspace', description: 'Agents, knowledge, tools, models, runs, versions and publishing.', href: '/app/ai' },
          { key: 'automation', title: 'Automation Workspace', description: 'Triggers, workflow nodes, actions, conditions, transformations, webhooks and run history.', href: '/app/automation' },
          { key: 'deploy', title: 'Deploy Workspace', description: 'Websites, lightweight apps, APIs, previews, production environments and domains.', href: '/app/deploy' },
          { key: 'trading', title: 'Trading', description: 'Specialized trading infrastructure is visible but remains Custom / Enterprise rather than a standard self-service workspace.', href: '/enterprise', badge: 'Custom / Enterprise' },
        ],
      },
    ],
  },
  {
    slug: 'solutions',
    title: 'Mkety SolutionHub',
    seoTitle: 'Mkety SolutionHub | Ready-made business solutions',
    seoDescription: 'Discover Mkety SolutionHub: reusable agents, workflows, applications, deployment templates, business automations and enterprise solutions.',
    eyebrow: 'SolutionHub',
    headline: 'Start from a useful solution, then adapt it to your business.',
    intro: 'SolutionHub is the packaged-solution layer of Mkety. It is not the same thing as a workspace or a pricing plan.',
    sections: [
      {
        eyebrow: 'Solution classes',
        title: 'Reusable where possible. Custom where necessary.',
        description: 'Standard solutions fit within shared Platform economics. Enterprise solutions are used when runtime, security, integrations or operational requirements demand a dedicated approach.',
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
    seoTitle: 'Mkety Academy | Practical technology training',
    seoDescription: 'Learn AI, automation, deployment and practical business technology through Mkety Academy courses, workshops and enterprise training.',
    eyebrow: 'Academy',
    headline: 'Practical learning for the systems people actually need to build.',
    intro: 'Mkety Academy is a core Mkety product for courses, workshops, webinars, certifications and enterprise enablement.',
    sections: [
      {
        eyebrow: 'Learning',
        title: 'Training connected to real implementation.',
        description: 'Academy content focuses on useful technical and business capability rather than treating education as an afterthought to the Platform.',
        items: [
          { key: 'courses', title: 'Courses', description: 'Structured learning paths for individuals and teams.' },
          { key: 'workshops', title: 'Workshops & webinars', description: 'Focused sessions for implementation, adoption and practical skill-building.' },
          { key: 'enterprise', title: 'Enterprise training', description: 'Organization-specific enablement aligned to implementation goals.' },
        ],
        cta: { label: 'Contact Mkety', href: '/contact' },
      },
    ],
  },
  {
    slug: 'pricing',
    title: 'Mkety Pricing',
    seoTitle: 'Mkety Pricing | Plans, credits and usage',
    seoDescription: 'Understand Mkety public plans and how pricing, entitlements, usage and credits are kept as distinct concepts.',
    eyebrow: 'Pricing',
    headline: 'Plans define access. Usage measures consumption. Credits are product units.',
    intro: 'Mkety keeps public pricing language simple without turning infrastructure resources into ordinary plan marketing or inventing backend entitlements that are not implemented.',
    sections: [
      {
        eyebrow: 'Commercial model',
        title: 'Clear boundaries between commercial concepts.',
        description: 'Pricing communicates the offer. Plans group commercial terms. Entitlements enforce access. Usage records consumption. Credits represent product units. Wallet/accounting views remain separate from product credits.',
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
    headline: 'When the requirement exceeds normal self-service boundaries.',
    intro: 'Enterprise work can use Mkety shared services while preserving the deployment, security, commercial and operational boundaries required by the customer.',
    sections: [
      {
        eyebrow: 'Custom delivery',
        title: 'Specialized implementations without pretending everything is a standard plan.',
        description: 'Mkety can deliver custom systems, managed implementations, integrations, trading infrastructure and customer projects where standard Platform economics or controls are not appropriate.',
        items: [
          { key: 'trading', title: 'Trading infrastructure', description: 'Specialized systems delivered under Custom / Enterprise terms.', badge: 'Custom / Enterprise' },
          { key: 'customer-projects', title: 'Customer projects', description: 'Dedicated implementations such as mklms-style systems remain customer projects rather than core product workspaces.' },
          { key: 'support', title: 'Managed support', description: 'Implementation and operational support tailored to enterprise requirements.' },
        ],
        cta: { label: 'Talk to Mkety', href: '/contact' },
      },
    ],
  },
  {
    slug: 'about',
    title: 'About Mkety',
    seoTitle: 'About Mkety | Technology platform and solutions company',
    seoDescription: 'Learn how Mkety combines Platform software, Academy training, packaged solutions and enterprise implementation.',
    eyebrow: 'About',
    headline: 'Technology designed around building and operating useful systems.',
    intro: 'Mkety brings software, practical learning, packaged solutions and enterprise delivery together without collapsing them into one product category.',
    sections: [
      {
        eyebrow: 'What Mkety is',
        title: 'Platform + Academy, with solutions and enterprise delivery around them.',
        description: 'Mkety Platform and Mkety Academy are core products. SolutionHub packages reusable solutions. Enterprise handles specialized customer requirements.',
        items: [],
        cta: { label: 'Explore Platform', href: '/platform' },
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact Mkety',
    seoTitle: 'Contact Mkety | Product, Academy and Enterprise enquiries',
    seoDescription: 'Contact Mkety about Platform access, Academy, partnerships, enterprise implementations or support.',
    eyebrow: 'Contact',
    headline: 'Talk to the right part of Mkety.',
    intro: 'Use the contact options below for product, Academy, enterprise and general Mkety enquiries.',
    sections: [
      {
        eyebrow: 'Enquiries',
        title: 'Product, learning and enterprise conversations.',
        description: 'Public contact details can be managed from Mkety site settings. Do not send passwords, private keys or other secrets through general enquiry channels.',
        items: [
          { key: 'general', title: 'General', description: 'Questions about Mkety, products and public information.' },
          { key: 'enterprise', title: 'Enterprise', description: 'Custom systems, integrations, Trading and managed implementation requirements.' },
          { key: 'academy', title: 'Academy', description: 'Courses, workshops, certifications and enterprise training.' },
        ],
      },
    ],
  },
] as const;

export function getDefaultPublicPage(slug: string): MketyPublicPageDefault | null {
  return MKETY_PUBLIC_PAGE_DEFAULTS.find((page) => page.slug === slug) ?? null;
}
