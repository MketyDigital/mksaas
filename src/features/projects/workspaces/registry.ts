import type { ProjectWorkspaceDefinition, WorkspaceKey } from './types';

export const projectWorkspaces: ProjectWorkspaceDefinition[] = [
  {
    key: 'ai',
    title: 'AI Workspace',
    shortTitle: 'AI',
    description: 'Create agents, connect knowledge, configure tools, and test AI-powered workflows inside this project.',
    hrefSegment: 'ai',
    availability: 'available',
    statusLabel: 'Available',
    primaryCtaLabel: 'Open AI Workspace',
    secondaryCtaLabel: 'Manage agents',
  },
  {
    key: 'automation',
    title: 'Automation Workspace',
    shortTitle: 'Automate',
    description: 'Design workflows, triggers, actions, webhooks, and run history for repeatable business operations.',
    hrefSegment: 'automation',
    availability: 'planned',
    statusLabel: 'Planned',
    primaryCtaLabel: 'Preview Automation',
  },
  {
    key: 'deploy',
    title: 'Deploy Workspace',
    shortTitle: 'Deploy',
    description: 'Manage apps, websites, APIs, environments, previews, production deployments, and domains.',
    hrefSegment: 'deploy',
    availability: 'planned',
    statusLabel: 'Planned',
    primaryCtaLabel: 'Preview Deploy',
  },
  {
    key: 'solutions',
    title: 'SolutionHub',
    shortTitle: 'Solutions',
    description: 'Explore ready-made solutions, templates, blueprints, and enterprise implementation paths.',
    hrefSegment: 'solutions',
    availability: 'planned',
    statusLabel: 'Planned',
    primaryCtaLabel: 'Open SolutionHub',
  },
  {
    key: 'trading',
    title: 'Trading Workspace',
    shortTitle: 'Trading',
    description: 'Request custom enterprise trading systems without mixing website display records with broker, signal, or execution data.',
    hrefSegment: 'trading',
    availability: 'enterprise',
    statusLabel: 'Custom / Enterprise',
    primaryCtaLabel: 'Request Trading System',
    protectedReason: 'Trading is a custom enterprise solution. This shell does not create trading accounts, signals, broker links, copy trading, or execution records.',
  },
];

export function getProjectWorkspaceByKey(key: WorkspaceKey) {
  const workspace = projectWorkspaces.find((item) => item.key === key);
  if (!workspace) {
    throw new Error(`Unknown Mkety workspace: ${key}`);
  }
  return workspace;
}
