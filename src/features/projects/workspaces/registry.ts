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
    description: 'Build and run project workflows with manual and authenticated webhook triggers, guarded actions, readiness checks, and run history.',
    hrefSegment: 'automation',
    availability: 'available',
    statusLabel: 'Available',
    primaryCtaLabel: 'Open Automation',
  },
  {
    key: 'deploy',
    title: 'Deploy Workspace',
    shortTitle: 'Deploy',
    description: 'Manage app and environment metadata, deployment history, and approval-gated non-production candidate execution while production and domains remain protected.',
    hrefSegment: 'deploy',
    availability: 'available',
    statusLabel: 'Non-production available',
    primaryCtaLabel: 'Open Deploy',
  },
  {
    key: 'solutions',
    title: 'SolutionHub',
    shortTitle: 'Solutions',
    description: 'Explore shared-platform solution paths and reviewed Enterprise/Custom implementations, then continue in the correct Mkety workspace or request path.',
    hrefSegment: 'solutions',
    availability: 'available',
    statusLabel: 'Catalog available',
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
