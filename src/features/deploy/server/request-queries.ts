import { and, desc, eq } from 'drizzle-orm';

import { withRequestDatabase } from '@/shared/db/request';
import {
  deployApplications,
  deployEnvironments,
  deploymentRequests,
  projects,
} from '@/shared/db/schema';

export interface DeploymentApprovalRow {
  id: string;
  applicationName: string;
  environmentName: string;
  environmentKind: string;
  projectName: string;
  releaseRef: string;
  sourceRef: string | null;
  requestedAt: Date;
  requestedByUserId: string | null;
  status: string;
}

export async function getDeploymentApprovalQueue(tenantId: string): Promise<DeploymentApprovalRow[]> {
  return withRequestDatabase(async (db) =>
    db
      .select({
        id: deploymentRequests.id,
        applicationName: deployApplications.name,
        environmentName: deployEnvironments.name,
        environmentKind: deployEnvironments.kind,
        projectName: projects.name,
        releaseRef: deploymentRequests.releaseRef,
        sourceRef: deploymentRequests.sourceRef,
        requestedAt: deploymentRequests.requestedAt,
        requestedByUserId: deploymentRequests.requestedByUserId,
        status: deploymentRequests.status,
      })
      .from(deploymentRequests)
      .innerJoin(projects, eq(deploymentRequests.projectId, projects.id))
      .innerJoin(deployApplications, eq(deploymentRequests.applicationId, deployApplications.id))
      .innerJoin(deployEnvironments, eq(deploymentRequests.environmentId, deployEnvironments.id))
      .where(
        and(
          eq(deploymentRequests.tenantId, tenantId),
          eq(deploymentRequests.status, 'pending'),
        ),
      )
      .orderBy(desc(deploymentRequests.requestedAt))
      .limit(100),
  );
}
