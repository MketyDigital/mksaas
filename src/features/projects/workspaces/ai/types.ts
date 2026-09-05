export type AiAgentSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  provider: string | null;
  model: string | null;
  instructions: string | null;
};

export type AiWorkspaceReadinessStatus = 'available' | 'planned' | 'protected';

export type AiWorkspaceReadinessItem = {
  key: 'agents' | 'knowledge' | 'tools' | 'runs' | 'versions' | 'publish';
  title: string;
  description: string;
  status: AiWorkspaceReadinessStatus;
  href?: string;
  metric?: string;
};
