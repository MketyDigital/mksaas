import type { DeploymentExecutionContext } from '@/features/deploy/server/execution/types';

import {
  type CloudflareDispatchTransport,
  createCloudflareDispatchAdapter,
  type CustomerDeploymentArtifactSource,
  deriveMketyAppScriptName,
} from './cloudflare-dispatch';

function context(environment: Partial<DeploymentExecutionContext['environment']> = {}) {
  return {
    deploymentId: '12345678-1234-1234-1234-123456789abc',
    deploymentRequestId: 'request-1',
    artifactKey: 'mkety-deploy-artifacts/tenant-1/project-1/request-1/artifact.json',
    artifactSha256: 'a'.repeat(64),
    tenantId: 'tenant-1',
    projectId: 'project-1',
    application: { id: 'app-1', name: 'Portal', slug: 'portal', kind: 'web' },
    environment: { id: 'env-1', name: 'Preview', slug: 'preview', kind: 'preview', protected: false, ...environment },
    requestedByUserId: 'user-1',
  };
}

function source(): jest.Mocked<CustomerDeploymentArtifactSource> {
  return { load: jest.fn().mockResolvedValue({
    mainModule: 'index.js',
    compatibilityDate: '2026-10-23',
    modules: [{ name: 'index.js', source: 'export default { fetch() { return new Response("ok") } };', contentType: 'application/javascript+module' }],
  }) };
}

function transport(): jest.Mocked<CloudflareDispatchTransport> {
  return { verifyNamespace: jest.fn().mockResolvedValue(undefined), uploadWorker: jest.fn().mockResolvedValue(undefined), deleteWorker: jest.fn().mockResolvedValue(undefined) };
}

describe('Cloudflare customer dispatch deployment', () => {
  it('deploys the request-scoped artifact into the verified dispatch namespace', async () => {
    const artifactSource = source();
    const api = transport();
    const adapter = createCloudflareDispatchAdapter({ artifactSource, transport: api });
    const result = await adapter.deploy(context());
    const scriptName = deriveMketyAppScriptName(context().deploymentId);

    expect(artifactSource.load).toHaveBeenCalledWith(context());
    expect(api.verifyNamespace).toHaveBeenCalledTimes(1);
    expect(api.uploadWorker).toHaveBeenCalledWith(expect.objectContaining({ scriptName }));
    expect(result.providerDeploymentRef).toBe(scriptName);
    expect(api.deleteWorker).not.toHaveBeenCalled();
  });

  it.each([{ protected: true }, { kind: 'production' }])('rejects protected environments before artifact access', async (environment) => {
    const artifactSource = source();
    const api = transport();
    const adapter = createCloudflareDispatchAdapter({ artifactSource, transport: api });
    await expect(adapter.deploy(context(environment))).rejects.toThrow(/protected environments/);
    expect(artifactSource.load).not.toHaveBeenCalled();
    expect(api.verifyNamespace).not.toHaveBeenCalled();
  });

  it('fails closed without an approved artifact reference', async () => {
    const artifactSource = source();
    const api = transport();
    const adapter = createCloudflareDispatchAdapter({ artifactSource, transport: api });
    await expect(adapter.deploy({ ...context(), artifactKey: null })).rejects.toThrow(/approved immutable artifact/);
    expect(api.uploadWorker).not.toHaveBeenCalled();
  });
});
