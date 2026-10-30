import {
  customerDeploymentArtifactKey,
  loadCustomerDeploymentArtifact,
} from './customer-deployment-artifacts-store';

describe('customer deployment artifact scope', () => {
  it('constructs a tenant/project/request-owned immutable object key', () => {
    expect(customerDeploymentArtifactKey(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
    )).toBe('mkety-deploy-artifacts/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000003/artifact.json');
  });

  it('rejects malformed identity and missing integrity metadata before storage access', async () => {
    expect(() => customerDeploymentArtifactKey('../tenant', 'project-identifier-long', 'request-identifier-long')).toThrow(/identity is invalid/);
    await expect(loadCustomerDeploymentArtifact({
      tenantId: '00000000-0000-0000-0000-000000000001',
      projectId: '00000000-0000-0000-0000-000000000002',
      requestId: '00000000-0000-0000-0000-000000000003',
      artifactKey: 'wrong-key',
      artifactSha256: '',
    })).rejects.toThrow(/scope is invalid/);
  });
});
