import type {
  DeploymentExecutionContext,
  DeploymentExecutionOptions,
  DeploymentExecutionRepository,
  DeploymentProviderAdapter,
} from './types';

const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;

export class DeploymentExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeploymentExecutionError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DeploymentExecutionError('Deployment provider execution timed out.')),
      timeoutMs,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function executeDeployment(
  repository: DeploymentExecutionRepository,
  provider: DeploymentProviderAdapter,
  context: DeploymentExecutionContext,
  options: DeploymentExecutionOptions = {},
) {
  if (context.environment.protected || context.environment.kind === 'production') {
    throw new DeploymentExecutionError('Protected deployment environments cannot be executed yet.');
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new DeploymentExecutionError('Deployment provider timeout must be a positive finite number.');
  }

  const record = options.queuedDeploymentId
    ? { id: options.queuedDeploymentId }
    : await repository.createQueued(context, provider.id);
  const startedAt = new Date();
  const started = await repository.markRunning(record.id, provider.id, startedAt);
  if (!started) {
    throw new DeploymentExecutionError('Deployment lifecycle could not enter running state.');
  }

  try {
    const result = await withTimeout(
      provider.deploy({ ...context, deploymentId: record.id }),
      timeoutMs,
    );
    const completedAt = result.completedAt ?? new Date();
    const completed = await repository.markCompleted(record.id, {
      providerDeploymentRef: result.providerDeploymentRef ?? null,
      completedAt,
    });
    if (!completed) {
      throw new DeploymentExecutionError('Deployment lifecycle could not enter completed state.');
    }

    return {
      deploymentId: record.id,
      provider: provider.id,
      providerDeploymentRef: result.providerDeploymentRef ?? null,
      status: 'completed' as const,
      startedAt,
      completedAt,
    };
  } catch (error) {
    const completedAt = new Date();
    await repository.markFailed(record.id, completedAt);
    if (error instanceof DeploymentExecutionError) throw error;
    throw new DeploymentExecutionError('Deployment provider execution failed.');
  }
}
