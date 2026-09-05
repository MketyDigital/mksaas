import { platformControlModules } from './control-center-registry';
import type { AppExperienceDefaultsInput } from './schemas';

export const defaultAppExperience: AppExperienceDefaultsInput = {
  dashboard: {
    headline: 'Build and operate from one Mkety workspace',
    description:
      'Manage projects, AI agents, automations, deployments, SolutionHub, usage, billing, docs, and support from your Mkety dashboard.',
    primaryCta: { label: 'Create Project', href: '/create-workspace' },
    secondaryCta: { label: 'Explore SolutionHub', href: '/app/solutions' },
    support: { label: 'Open Documentation', href: '/docs' },
  },
  workspaces: [
    {
      key: 'ai',
      label: 'AI Workspace',
      description: 'Create agents, connect knowledge, manage tools and models, test runs, publish versions, and monitor usage.',
      href: '/app/ai',
      iconKey: 'sparkles',
      enabled: true,
      sortOrder: 10,
    },
    {
      key: 'automation',
      label: 'Automation Workspace',
      description: 'Build workflows from triggers, actions, conditions, transformations, webhooks, and agent steps.',
      href: '/app/automation',
      iconKey: 'workflow',
      enabled: true,
      sortOrder: 20,
    },
    {
      key: 'deploy',
      label: 'Deploy Workspace',
      description: 'Manage applications, environments, previews, production deployments, domains, and deployment history.',
      href: '/app/deploy',
      iconKey: 'rocket',
      enabled: true,
      sortOrder: 30,
    },
    {
      key: 'solutions',
      label: 'SolutionHub',
      description: 'Discover ready-made agents, workflows, applications, templates, blueprints, and business solutions.',
      href: '/app/solutions',
      iconKey: 'blocks',
      enabled: true,
      sortOrder: 40,
    },
    {
      key: 'trading',
      label: 'Trading Workspace',
      description: 'Access custom and enterprise trading infrastructure where the tenant has the required entitlement.',
      href: '/app/trading',
      iconKey: 'chart',
      badgeLabel: 'Custom / Enterprise',
      enabled: true,
      requiresEntitlement: 'workspace.trading.enterprise',
      sortOrder: 50,
    },
  ],
  controlCenterModules: platformControlModules,
};
