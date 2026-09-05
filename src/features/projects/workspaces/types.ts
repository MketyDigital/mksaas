export type WorkspaceKey = 'ai' | 'automation' | 'deploy' | 'solutions' | 'trading';

export type WorkspaceAvailability = 'available' | 'planned' | 'enterprise' | 'protected';

export type ProjectWorkspaceDefinition = {
  key: WorkspaceKey;
  title: string;
  shortTitle: string;
  description: string;
  hrefSegment: string;
  availability: WorkspaceAvailability;
  statusLabel: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  protectedReason?: string;
};
