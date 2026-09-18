export type DeploymentProviderId = 'cloudflare' | 'oci';

export interface DeploymentExecutionContext {
  tenantId: string;
  projectId: string;
  application: {
    id: string;
    name: string;
    slug: string;
    kind: string;
  };
  environment: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    protected: boolean;
  };
  releaseRef?: string | null;
  sourceRef?: string | null;
  requestedByUserId: string;
}

export interface DeploymentProviderResult {
  providerDeploymentRef?: string | null;
  completedAt?: Date;
}

export interface DeploymentProviderAdapter {
  id: DeploymentProviderId;
  deploy(context: DeploymentExecutionContext & { deploymentId: string }): Promise<DeploymentProviderResult>;
}

export interface DeploymentExecutionRecord {
  id: string;
}

export interface DeploymentExecutionRepository {
  createQueued(context: DeploymentExecutionContext, provider: DeploymentProviderId): Promise<DeploymentExecutionRecord>;
  markRunning(deploymentId: string, provider: DeploymentProviderId, startedAt: Date): Promise<void>;
  markCompleted(
    deploymentId: string,
    input: { providerDeploymentRef?: string | null; completedAt: Date },
  ): Promise<void>;
  markFailed(deploymentId: string, completedAt: Date): Promise<void>;
}
