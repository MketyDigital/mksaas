import { and, eq } from 'drizzle-orm';

import { withRequestDatabase } from '@/shared/db/request';
import { deployments } from '@/shared/db/schema';

import type {
  DeploymentExecutionContext,
  DeploymentExecutionRepository,
  DeploymentProviderId,
} from './types';

export const drizzleDeploymentExecutionRepository: DeploymentExecutionRepository = {
  createQueued(context: DeploymentExecutionContext, provider: DeploymentProviderId) {
    return withRequestDatabase(async (db) => {
      const [row] = await db
        .insert(deployments)
        .values({
          tenantId: context.tenantId,
          projectId: context.projectId,
          applicationId: context.application.id,
          environmentId: context.environment.id,
          status: 'queued',
          releaseRef: context.releaseRef ?? null,
          sourceRef: context.sourceRef ?? null,
          provider,
          createdByUserId: context.requestedByUserId,
        })
        .returning({ id: deployments.id });

      if (!row) throw new Error('Failed to create deployment record.');
      return row;
    });
  },

  markRunning(deploymentId, provider, startedAt) {
    return withRequestDatabase(async (db) => {
      await db
        .update(deployments)
        .set({ status: 'running', provider, startedAt })
        .where(and(eq(deployments.id, deploymentId), eq(deployments.status, 'queued')));
    });
  },

  markCompleted(deploymentId, input) {
    return withRequestDatabase(async (db) => {
      await db
        .update(deployments)
        .set({
          status: 'completed',
          providerDeploymentRef: input.providerDeploymentRef ?? null,
          completedAt: input.completedAt,
        })
        .where(and(eq(deployments.id, deploymentId), eq(deployments.status, 'running')));
    });
  },

  markFailed(deploymentId, completedAt) {
    return withRequestDatabase(async (db) => {
      await db
        .update(deployments)
        .set({ status: 'failed', completedAt })
        .where(eq(deployments.id, deploymentId));
    });
  },
};
