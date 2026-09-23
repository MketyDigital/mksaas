import { and, desc, eq } from 'drizzle-orm';

import { withRequestDatabase } from '@/shared/db/request';
import { deployApplications, deployEnvironments, deploymentRequests, deployments } from '@/shared/db/schema';

export interface DeployFoundationState {
  applications: Array<typeof deployApplications.$inferSelect>;
  environments: Array<typeof deployEnvironments.$inferSelect>;
  deploymentHistory: Array<typeof deployments.$inferSelect>;
  deploymentRequests: Array<typeof deploymentRequests.$inferSelect>;
}

export async function getDeployFoundationState(
  tenantId: string,
  projectId: string,
): Promise<DeployFoundationState> {
  return withRequestDatabase(async (db) => {
    const [applications, environments, deploymentHistory, requests] = await Promise.all([
      db
        .select()
        .from(deployApplications)
        .where(
          and(
            eq(deployApplications.tenantId, tenantId),
            eq(deployApplications.projectId, projectId),
          ),
        )
        .orderBy(desc(deployApplications.createdAt)),
      db
        .select()
        .from(deployEnvironments)
        .where(
          and(
            eq(deployEnvironments.tenantId, tenantId),
            eq(deployEnvironments.projectId, projectId),
          ),
        )
        .orderBy(desc(deployEnvironments.createdAt)),
      db
        .select()
        .from(deployments)
        .where(
          and(
            eq(deployments.tenantId, tenantId),
            eq(deployments.projectId, projectId),
          ),
        )
        .orderBy(desc(deployments.createdAt))
        .limit(25),
      db
        .select()
        .from(deploymentRequests)
        .where(
          and(
            eq(deploymentRequests.tenantId, tenantId),
            eq(deploymentRequests.projectId, projectId),
          ),
        )
        .orderBy(desc(deploymentRequests.requestedAt))
        .limit(25),
    ]);

    return { applications, environments, deploymentHistory, deploymentRequests: requests };
  });
}
