import { customerCandidateProofArtifactSource } from './customer-candidate-artifact';

describe('customer candidate proof artifact', () => {
  it('builds a bounded Mkety-controlled worker artifact from deployment metadata', async () => {
    const artifact = await customerCandidateProofArtifactSource.load({
      deploymentId: 'deployment-1',
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
      },
      releaseRef: 'release-42',
      sourceRef: 'main',
      requestedByUserId: 'user-1',
    });

    expect(artifact.mainModule).toBe('index.js');
    expect(artifact.modules).toHaveLength(1);
    expect(artifact.modules[0]?.source).toContain('customer-candidate-proof');
    expect(artifact.modules[0]?.source).toContain('deployment-1');
    expect(artifact.modules[0]?.source).toContain('release-42');
  });
});
