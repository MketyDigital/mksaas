/** @jest-environment node */

import type { DeploymentExecutionContext } from '@/features/deploy/server/execution/types';

import {
  type CloudflareCandidateArtifactSource,
  type CloudflareCandidateTransport,
  createCloudflareCandidateAdapter,
  deriveCloudflareCandidateWorkerName,
} from './cloudflare-candidate';

function context(
  environment: Partial<DeploymentExecutionContext['environment']> = {},
): DeploymentExecutionContext & { deploymentId: string } {
  return {
    deploymentId: '12345678-1234-1234-1234-123456789abc',
    tenantId: 'tenant-1',
    projectId: 'project-1',
    application: { id: 'app-1', name: 'Portal', slug: 'portal', kind: 'web' },
    environment: {
      id: 'env-1',
      name: 'Preview',
      slug: 'preview',
      kind: 'preview',
      protected: false,
      ...environment,
    },
    releaseRef: 'release-1',
    sourceRef: 'main',
    requestedByUserId: 'user-1',
  };
}

function artifactSource(): jest.Mocked<CloudflareCandidateArtifactSource> {
  return {
    load: jest.fn().mockResolvedValue({
      mainModule: 'index.js',
      compatibilityDate: '2026-09-18',
      modules: [
        {
          name: 'index.js',
          source: 'export default { fetch() { return new Response("ok"); } };',
        },
      ],
    }),
  };
}

function transport(): jest.Mocked<CloudflareCandidateTransport> {
  return {
    uploadWorker: jest.fn().mockResolvedValue(undefined),
    enableWorkersDev: jest.fn().mockResolvedValue(undefined),
    getWorkersDevUrl: jest
      .fn()
      .mockResolvedValue('https://mkety-deploy-candidate-x.example.workers.dev'),
    deleteWorker: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Cloudflare Deploy candidate adapter', () => {
  it('derives a bounded isolated workers.dev-compatible Worker name', () => {
    const name = deriveCloudflareCandidateWorkerName(
      '12345678-1234-1234-1234-123456789ABC',
    );

    expect(name).toBe(
      'mkety-deploy-candidate-12345678-1234-1234-1234-123456789abc',
    );
    expect(name.length).toBeLessThanOrEqual(63);
  });

  it('uploads only the trusted artifact and enables workers.dev for a non-production environment', async () => {
    const source = artifactSource();
    const api = transport();
    const adapter = createCloudflareCandidateAdapter({
      artifactSource: source,
      transport: api,
    });

    const result = await adapter.deploy(context());
    const scriptName = deriveCloudflareCandidateWorkerName(context().deploymentId);

    expect(source.load).toHaveBeenCalledWith(context());
    expect(api.uploadWorker).toHaveBeenCalledWith(
      expect.objectContaining({ scriptName }),
    );
    expect(api.enableWorkersDev).toHaveBeenCalledWith(scriptName);
    expect(api.getWorkersDevUrl).toHaveBeenCalledWith(scriptName);
    expect(api.deleteWorker).not.toHaveBeenCalled();
    expect(result.providerDeploymentRef).toBe(scriptName);
  });

  it.each([
    { protected: true },
    { kind: 'production' },
  ])('rejects protected/production execution before artifact or API access', async (environment) => {
    const source = artifactSource();
    const api = transport();
    const adapter = createCloudflareCandidateAdapter({
      artifactSource: source,
      transport: api,
    });

    await expect(adapter.deploy(context(environment))).rejects.toThrow(
      'Cloudflare candidate adapter cannot deploy protected or production environments.',
    );

    expect(source.load).not.toHaveBeenCalled();
    expect(api.uploadWorker).not.toHaveBeenCalled();
  });

  it('cleans up an uploaded candidate when workers.dev isolation fails', async () => {
    const source = artifactSource();
    const api = transport();
    api.enableWorkersDev.mockRejectedValue(new Error('raw provider detail'));
    const adapter = createCloudflareCandidateAdapter({
      artifactSource: source,
      transport: api,
    });

    await expect(adapter.deploy(context())).rejects.toThrow(
      'Cloudflare candidate deployment failed.',
    );

    const scriptName = deriveCloudflareCandidateWorkerName(context().deploymentId);
    expect(api.deleteWorker).toHaveBeenCalledWith(scriptName);
  });

  it('rejects an artifact whose main module is absent', async () => {
    const source = artifactSource();
    source.load.mockResolvedValue({
      mainModule: 'missing.js',
      compatibilityDate: '2026-09-18',
      modules: [{ name: 'index.js', source: 'export default {};' }],
    });
    const api = transport();
    const adapter = createCloudflareCandidateAdapter({
      artifactSource: source,
      transport: api,
    });

    await expect(adapter.deploy(context())).rejects.toThrow(
      'Cloudflare candidate main module is missing from the artifact.',
    );
    expect(api.uploadWorker).not.toHaveBeenCalled();
  });
});
