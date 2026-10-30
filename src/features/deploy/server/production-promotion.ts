import { createMketyAppHostname, normalizeMketyAppHostname } from '../hostnames';

const PROVIDER_DEPLOYMENT_REF = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface ProductionPromotionDeployment {
  deploymentId: string;
  tenantId: string;
  projectId: string;
  applicationId: string;
  applicationSlug: string;
  status: string;
  environmentKind: string;
  providerDeploymentRef: string | null;
  previewHostname: string | null;
  previewHostnameKind: string | null;
  previewHostnameStatus: string | null;
}

export interface ProductionPromotionEnvironment {
  tenantId: string;
  projectId: string;
  applicationId: string;
  kind: string;
  protected: boolean;
}

export interface CurrentProductionAlias {
  hostname: string;
  tenantId: string;
  projectId: string;
  applicationId: string;
  kind: string;
  status: string;
  deploymentId: string;
}

export interface ProductionAliasPromotion {
  hostname: string;
  previousDeploymentId: string | null;
  deploymentId: string;
  providerDeploymentRef: string;
  previewHostname: string;
}

export function buildProductionAliasPromotion(input: {
  projectSlug: string;
  deployment: ProductionPromotionDeployment;
  productionEnvironment: ProductionPromotionEnvironment;
  currentAlias: CurrentProductionAlias | null;
}): ProductionAliasPromotion {
  const { deployment, productionEnvironment: environment, currentAlias } = input;

  if (deployment.status !== 'completed' || deployment.environmentKind === 'production') {
    throw new Error('Only a completed non-production customer deployment can be promoted.');
  }
  if (!deployment.providerDeploymentRef || !PROVIDER_DEPLOYMENT_REF.test(deployment.providerDeploymentRef)) {
    throw new Error('The completed deployment has no valid isolated customer runtime target.');
  }
  if (deployment.previewHostnameKind !== 'preview' || deployment.previewHostnameStatus !== 'active') {
    throw new Error('The deployment must have an active immutable preview hostname before promotion.');
  }
  const previewHostname = normalizeMketyAppHostname(deployment.previewHostname ?? '');
  if (!previewHostname || previewHostname !== deployment.previewHostname) {
    throw new Error('The deployment preview hostname is invalid.');
  }
  if (
    environment.kind !== 'production' ||
    !environment.protected ||
    environment.tenantId !== deployment.tenantId ||
    environment.projectId !== deployment.projectId ||
    environment.applicationId !== deployment.applicationId
  ) {
    throw new Error('The protected production environment must belong to the same customer application.');
  }

  const hostname = createMketyAppHostname(input.projectSlug, deployment.applicationId);
  if (currentAlias) {
    if (
      currentAlias.hostname !== hostname ||
      currentAlias.tenantId !== deployment.tenantId ||
      currentAlias.projectId !== deployment.projectId ||
      currentAlias.applicationId !== deployment.applicationId ||
      currentAlias.kind !== 'production' ||
      currentAlias.status !== 'active'
    ) {
      throw new Error('The active production alias belongs to a different customer application.');
    }
    if (currentAlias.deploymentId === deployment.deploymentId) {
      throw new Error('The selected deployment is already serving the production alias.');
    }
  }

  return {
    hostname,
    previousDeploymentId: currentAlias?.deploymentId ?? null,
    deploymentId: deployment.deploymentId,
    providerDeploymentRef: deployment.providerDeploymentRef,
    previewHostname,
  };
}
