import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { workflowRuns, workflows } from '@/shared/db/schema';

import type { AutomationBuilderWorkflowSummary } from './AutomationBuilderShell';
import { type AutomationWorkspaceMetrics, buildAutomationWorkspaceMetrics } from './automation-model';
import { buildWorkflowNodeSummaries } from './workflow-nodes';

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

export type AutomationBuilderSnapshot = {
  workflow: AutomationBuilderWorkflowSummary;
  recentRuns: AutomationRunSummary[];
};

function toRunSummary(run: typeof workflowRuns.$inferSelect): AutomationRunSummary {
  return {
    completedAt: run.completedAt,
    id: run.id,
    startedAt: run.startedAt,
    status: run.status,
    triggerType: run.triggerType,
    workflowId: run.workflowId,
  };
}

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
    recentRuns: projectRuns.map(toRunSummary),
  };
}

export async function getAutomationBuilderSnapshot({
  projectId,
  tenantId,
  workflowSlug,
}: {
  tenantId: string;
  projectId: string;
  workflowSlug: string;
}): Promise<AutomationBuilderSnapshot | null> {
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.tenantId, tenantId), eq(workflows.projectId, projectId), eq(workflows.slug, workflowSlug)),
  });

  if (!workflow) {
    return null;
  }

  const nodes = buildWorkflowNodeSummaries(workflow.definition);
  const recentRuns = await db.query.workflowRuns.findMany({
    where: and(eq(workflowRuns.tenantId, tenantId), eq(workflowRuns.projectId, projectId), eq(workflowRuns.workflowId, workflow.id)),
    orderBy: [desc(workflowRuns.startedAt)],
    limit: 6,
  });

  return {
    recentRuns: recentRuns.map(toRunSummary),
    workflow: {
      description: workflow.description,
      id: workflow.id,
      name: workflow.name,
      nodeCount: nodes.length,
      nodes,
      slug: workflow.slug,
      status: workflow.status,
      triggerType: workflow.triggerType,
      updatedAt: workflow.updatedAt,
      version: workflow.version,
    },
  };
}
