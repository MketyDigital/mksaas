import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  deployApplications,
  deployEnvironments,
  deploymentHostnames,
  deployments,
} from '@/shared/db/schema';
import { normalizeMketyAppHostname } from '../hostnames';

const PROVIDER_DEPLOYMENT_REF = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function findActiveMketyAppDeployment(hostname: string) {
  const normalized = normalizeMketyAppHostname(hostname);
  if (!normalized) return null;

  const [row] = await db.select({
    hostname: deploymentHostnames.hostname,
    tenantId: deploymentHostnames.tenantId,
    projectId: deploymentHostnames.projectId,
    applicationId: deploymentHostnames.applicationId,
    environmentId: deploymentHostnames.environmentId,
    deploymentId: deploymentHostnames.deploymentId,
    kind: deploymentHostnames.kind,
    status: deploymentHostnames.status,
    providerDeploymentRef: deployments.providerDeploymentRef,
  }).from(deploymentHostnames)
    .innerJoin(deployments, and(
      eq(deployments.id, deploymentHostnames.deploymentId),
      eq(deployments.tenantId, deploymentHostnames.tenantId),
      eq(deployments.projectId, deploymentHostnames.projectId),
      eq(deployments.applicationId, deploymentHostnames.applicationId),
      eq(deployments.environmentId, deploymentHostnames.environmentId),
      eq(deployments.status, 'completed'),
    ))
    .innerJoin(deployEnvironments, and(
      eq(deployEnvironments.id, deploymentHostnames.environmentId),
      eq(deployEnvironments.tenantId, deploymentHostnames.tenantId),
      eq(deployEnvironments.projectId, deploymentHostnames.projectId),
      eq(deployEnvironments.applicationId, deploymentHostnames.applicationId),
    ))
    .innerJoin(deployApplications, and(
      eq(deployApplications.id, deploymentHostnames.applicationId),
      eq(deployApplications.tenantId, deploymentHostnames.tenantId),
      eq(deployApplications.projectId, deploymentHostnames.projectId),
    ))
    .where(and(
      eq(deploymentHostnames.hostname, normalized),
      eq(deploymentHostnames.status, 'active'),
    )).limit(1);

  if (!row || row.status !== 'active' || !row.providerDeploymentRef || !PROVIDER_DEPLOYMENT_REF.test(row.providerDeploymentRef)) {
    return null;
  }
  return row as typeof row & { kind: 'preview' | 'production'; status: 'active' };
}
