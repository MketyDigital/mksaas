import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { workflowRuns, workflows } from '@/shared/db/schema';

import { type AutomationWorkspaceMetrics, buildAutomationWorkspaceMetrics } from './automation-model';

export type AutomationWorkflowSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  triggerType: string;
  version: string;
  updatedAt: Date;
};

export type AutomationRunSummary = {
  id: string;
  workflowId: string;
  status: string;
  triggerType: string;
  startedAt: Date;
  completedAt: Date | null;
};

export type AutomationWorkspaceSnapshot = {
  metrics: AutomationWorkspaceMetrics;
  recentWorkflows: AutomationWorkflowSummary[];
  recentRuns: AutomationRunSummary[];
};

export async function getAutomationWorkspaceSnapshot({
  projectId,
  tenantId,
}: {
  tenantId: string;
  projectId: string;
}): Promise<AutomationWorkspaceSnapshot> {
  const [projectWorkflows, projectRuns] = await Promise.all([
    db.query.workflows.findMany({
      where: and(eq(workflows.tenantId, tenantId), eq(workflows.projectId, projectId)),
      orderBy: [desc(workflows.updatedAt)],
      limit: 6,
    }),
    db.query.workflowRuns.findMany({
      where: and(eq(workflowRuns.tenantId, tenantId), eq(workflowRuns.projectId, projectId)),
      orderBy: [desc(workflowRuns.startedAt)],
      limit: 6,
    }),
  ]);

  return {
    metrics: buildAutomationWorkspaceMetrics({ workflows: projectWorkflows, runs: projectRuns }),
    recentWorkflows: projectWorkflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      slug: workflow.slug,
      status: workflow.status,
      triggerType: workflow.triggerType,
      version: workflow.version,
      updatedAt: workflow.updatedAt,
    })),
    recentRuns: projectRuns.map((run) => ({
      id: run.id,
      workflowId: run.workflowId,
      status: run.status,
      triggerType: run.triggerType,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    })),
  };
}
