import { DeploymentExecutionError, executeDeployment } from './service';
import type {
  DeploymentExecutionContext,
  DeploymentExecutionRepository,
  DeploymentProviderAdapter,
} from './types';

function context(overrides: Partial<DeploymentExecutionContext['environment']> = {}): DeploymentExecutionContext {
  return {
    tenantId: 'tenant-1',
    projectId: 'project-1',
    application: {
      id: 'app-1',
      name: 'Portal',
      slug: 'portal',
      kind: 'web',
    },
    environment: {
      id: 'env-1',
      name: 'Preview',
      slug: 'preview',
      kind: 'preview',
      protected: false,
      ...overrides,
    },
    releaseRef: 'release-123',
    sourceRef: 'main',
    requestedByUserId: 'user-1',
  };
}

function repository(): jest.Mocked<DeploymentExecutionRepository> {
  return {
    createQueued: jest.fn().mockResolvedValue({ id: 'deployment-1' }),
    markRunning: jest.fn().mockResolvedValue(true),
    markCompleted: jest.fn().mockResolvedValue(true),
    markFailed: jest.fn().mockResolvedValue(true),
  };
}

function provider(): jest.Mocked<DeploymentProviderAdapter> {
  return {
    id: 'cloudflare',
    deploy: jest.fn().mockResolvedValue({
      providerDeploymentRef: 'provider-1',
      completedAt: new Date('2026-09-18T16:00:00.000Z'),
    }),
  };
}

describe('Deploy execution kernel', () => {
  it('records a bounded successful lifecycle around an injected provider', async () => {
    const storage = repository();
    const adapter = provider();
    const input = context();

    const result = await executeDeployment(storage, adapter, input);

    expect(storage.createQueued).toHaveBeenCalledWith(input, 'cloudflare');
    expect(storage.markRunning).toHaveBeenCalledWith(
      'deployment-1',
      'cloudflare',
      expect.any(Date),
    );
    expect(adapter.deploy).toHaveBeenCalledWith({
      ...input,
      deploymentId: 'deployment-1',
    });
    expect(storage.markCompleted).toHaveBeenCalledWith('deployment-1', {
      providerDeploymentRef: 'provider-1',
      completedAt: new Date('2026-09-18T16:00:00.000Z'),
    });
    expect(storage.markFailed).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        deploymentId: 'deployment-1',
        provider: 'cloudflare',
        providerDeploymentRef: 'provider-1',
        status: 'completed',
      }),
    );
  });

  it('uses a pre-created queued deployment without creating a duplicate record', async () => {
    const storage = repository();
    const adapter = provider();
    const input = context();

    const result = await executeDeployment(storage, adapter, input, {
      queuedDeploymentId: 'deployment-approved-1',
    });

    expect(storage.createQueued).not.toHaveBeenCalled();
    expect(storage.markRunning).toHaveBeenCalledWith(
      'deployment-approved-1',
      'cloudflare',
      expect.any(Date),
    );
    expect(adapter.deploy).toHaveBeenCalledWith({
      ...input,
      deploymentId: 'deployment-approved-1',
    });
    expect(result.deploymentId).toBe('deployment-approved-1');
  });

  it('rejects protected environments before persistence or provider execution', async () => {
    const storage = repository();
    const adapter = provider();

    await expect(
      executeDeployment(storage, adapter, context({ protected: true })),
    ).rejects.toThrow('Protected deployment environments cannot be executed yet.');

    expect(storage.createQueued).not.toHaveBeenCalled();
    expect(storage.markRunning).not.toHaveBeenCalled();
    expect(adapter.deploy).not.toHaveBeenCalled();
  });

  it('rejects production environments before persistence or provider execution', async () => {
    const storage = repository();
    const adapter = provider();

    await expect(
      executeDeployment(storage, adapter, context({ kind: 'production' })),
    ).rejects.toThrow('Protected deployment environments cannot be executed yet.');

    expect(storage.createQueued).not.toHaveBeenCalled();
    expect(storage.markRunning).not.toHaveBeenCalled();
    expect(adapter.deploy).not.toHaveBeenCalled();
  });

  it('marks failed and hides raw provider errors', async () => {
    const storage = repository();
    const adapter = provider();
    adapter.deploy.mockRejectedValue(
      new Error('secret-token=https://internal-provider.example/private'),
    );

    await expect(executeDeployment(storage, adapter, context())).rejects.toEqual(
      new DeploymentExecutionError('Deployment provider execution failed.'),
    );

    expect(storage.markFailed).toHaveBeenCalledWith('deployment-1', expect.any(Date));
    expect(storage.markCompleted).not.toHaveBeenCalled();
  });

  it('fails closed before provider execution when queued -> running does not transition', async () => {
    const storage = repository();
    const adapter = provider();
    storage.markRunning.mockResolvedValue(false);

    await expect(executeDeployment(storage, adapter, context())).rejects.toThrow(
      'Deployment lifecycle could not enter running state.',
    );

    expect(adapter.deploy).not.toHaveBeenCalled();
    expect(storage.markCompleted).not.toHaveBeenCalled();
  });

  it('fails closed when running -> completed does not transition', async () => {
    const storage = repository();
    const adapter = provider();
    storage.markCompleted.mockResolvedValue(false);

    await expect(executeDeployment(storage, adapter, context())).rejects.toThrow(
      'Deployment lifecycle could not enter completed state.',
    );

    expect(storage.markFailed).toHaveBeenCalledWith('deployment-1', expect.any(Date));
  });

  it('bounds provider execution duration and sanitizes timeout failure', async () => {
    jest.useFakeTimers();
    try {
      const storage = repository();
      const adapter = provider();
      adapter.deploy.mockImplementation(() => new Promise(() => undefined));

      const execution = executeDeployment(storage, adapter, context(), { timeoutMs: 100 });
      const rejection = expect(execution).rejects.toThrow('Deployment provider execution timed out.');

      await jest.advanceTimersByTimeAsync(100);
      await rejection;

      expect(storage.markFailed).toHaveBeenCalledWith('deployment-1', expect.any(Date));
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects invalid provider timeout before creating a deployment record', async () => {
    const storage = repository();
    const adapter = provider();

    await expect(
      executeDeployment(storage, adapter, context(), { timeoutMs: 0 }),
    ).rejects.toThrow('Deployment provider timeout must be a positive finite number.');

    expect(storage.createQueued).not.toHaveBeenCalled();
    expect(adapter.deploy).not.toHaveBeenCalled();
  });
});
