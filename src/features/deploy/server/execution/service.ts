import type {
  DeploymentExecutionContext,
  DeploymentExecutionRepository,
  DeploymentProviderAdapter,
} from './types';

export class DeploymentExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeploymentExecutionError';
  }
}

export async function executeDeployment(
  repository: DeploymentExecutionRepository,
  provider: DeploymentProviderAdapter,
  context: DeploymentExecutionContext,
) {
  if (context.environment.protected || context.environment.kind === 'production') {
    throw new DeploymentExecutionError('Protected deployment environments cannot be executed yet.');
  }

  const record = await repository.createQueued(context, provider.id);
  const startedAt = new Date();
  await repository.markRunning(record.id, provider.id, startedAt);

  try {
    const result = await provider.deploy({ ...context, deploymentId: record.id });
    const completedAt = result.completedAt ?? new Date();
    await repository.markCompleted(record.id, {
      providerDeploymentRef: result.providerDeploymentRef ?? null,
      completedAt,
    });

    return {
      deploymentId: record.id,
      provider: provider.id,
      providerDeploymentRef: result.providerDeploymentRef ?? null,
      status: 'completed' as const,
      startedAt,
      completedAt,
    };
  } catch {
    const completedAt = new Date();
    await repository.markFailed(record.id, completedAt);
    throw new DeploymentExecutionError('Deployment provider execution failed.');
  }
}
