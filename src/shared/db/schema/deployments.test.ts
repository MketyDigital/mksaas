import { deployApplications, deployEnvironments, deployments } from './deployments';

describe('Deploy persistence schema', () => {
  it('scopes applications to tenants and projects', () => {
    expect(deployApplications.tenantId).toBeDefined();
    expect(deployApplications.projectId).toBeDefined();
    expect(deployApplications.slug).toBeDefined();
    expect(deployApplications.createdByUserId).toBeDefined();
  });

  it('scopes environments to applications and protects production metadata', () => {
    expect(deployEnvironments.tenantId).toBeDefined();
    expect(deployEnvironments.projectId).toBeDefined();
    expect(deployEnvironments.applicationId).toBeDefined();
    expect(deployEnvironments.protected).toBeDefined();
  });

  it('stores deployment history separately from provider execution', () => {
    expect(deployments.applicationId).toBeDefined();
    expect(deployments.environmentId).toBeDefined();
    expect(deployments.status).toBeDefined();
    expect(deployments.releaseRef).toBeDefined();
    expect(deployments.providerDeploymentRef).toBeDefined();
  });
});
