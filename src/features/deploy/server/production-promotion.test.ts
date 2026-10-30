import { buildProductionAliasPromotion } from './production-promotion';

const deployment = {
  deploymentId: 'deployment-new',
  tenantId: 'tenant-1',
  projectId: 'project-1',
  applicationId: 'application-1',
  applicationSlug: 'portal',
  status: 'completed',
  environmentKind: 'preview',
  providerDeploymentRef: 'customer-worker-new',
  previewHostname: 'portal-deployment-new.mkety.app',
  previewHostnameKind: 'preview',
  previewHostnameStatus: 'active',
};

const productionEnvironment = {
  tenantId: 'tenant-1',
  projectId: 'project-1',
  applicationId: 'application-1',
  kind: 'production',
  protected: true,
};

describe('production alias promotion planning', () => {
  it('moves a stable app hostname to a completed preview without changing the preview', () => {
    expect(buildProductionAliasPromotion({
      projectSlug: 'customer-portal',
      deployment,
      productionEnvironment,
      currentAlias: null,
    })).toEqual({
      hostname: 'customer-portal-plication1.mkety.app',
      previousDeploymentId: null,
      deploymentId: 'deployment-new',
      providerDeploymentRef: 'customer-worker-new',
      previewHostname: 'portal-deployment-new.mkety.app',
    });
  });

  it('supports rollback by promoting a previous completed deployment through the same alias', () => {
    expect(buildProductionAliasPromotion({
      projectSlug: 'customer-portal',
      deployment: { ...deployment, deploymentId: 'deployment-previous', providerDeploymentRef: 'customer-worker-previous' },
      productionEnvironment,
      currentAlias: {
        hostname: 'customer-portal-plication1.mkety.app',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        applicationId: 'application-1',
        kind: 'production',
        status: 'active',
        deploymentId: 'deployment-new',
      },
    })).toEqual({
      hostname: 'customer-portal-plication1.mkety.app',
      previousDeploymentId: 'deployment-new',
      deploymentId: 'deployment-previous',
      providerDeploymentRef: 'customer-worker-previous',
      previewHostname: 'portal-deployment-new.mkety.app',
    });
  });

  it.each([
    ['deployment is not completed', { status: 'running' }],
    ['deployment has no provider target', { providerDeploymentRef: null }],
    ['preview hostname is inactive', { previewHostnameStatus: 'suspended' }],
    ['hostname is not a preview', { previewHostnameKind: 'production' }],
    ['deployment is already in production', { environmentKind: 'production' }],
    ['deployment belongs to another tenant', { tenantId: 'tenant-2' }],
  ])('rejects unsafe candidates when %s', (_case, override) => {
    expect(() => buildProductionAliasPromotion({
      projectSlug: 'customer-portal',
      deployment: { ...deployment, ...override },
      productionEnvironment,
      currentAlias: null,
    })).toThrow();
  });

  it('rejects a protected production environment owned by a different app', () => {
    expect(() => buildProductionAliasPromotion({
      projectSlug: 'customer-portal',
      deployment,
      productionEnvironment: { ...productionEnvironment, applicationId: 'application-2' },
      currentAlias: null,
    })).toThrow();
  });

  it('rejects an existing alias owned by another tenant or application', () => {
    expect(() => buildProductionAliasPromotion({
      projectSlug: 'customer-portal',
      deployment,
      productionEnvironment,
      currentAlias: {
        hostname: 'customer-portal-application1.mkety.app',
        tenantId: 'tenant-2',
        projectId: 'project-1',
        applicationId: 'application-1',
        kind: 'production',
        status: 'active',
        deploymentId: 'deployment-old',
      },
    })).toThrow();
  });
});
