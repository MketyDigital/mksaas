import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { workflowRuns } from '@/shared/db/schema';

import { executeAutomationWorkflowDefinition } from './internal-execution-kernel';
import type { AutomationWorkflowExecutionDependencies } from './workflow-execution-service';

export const automationWorkflowExecutionDbDependencies: AutomationWorkflowExecutionDependencies = {
  async insertRun(input) {
    const [run] = await db.insert(workflowRuns).values(input).returning({ id: workflowRuns.id });
    return run ?? null;
  },
  async updateRun(runId, update, workflow) {
    await db.update(workflowRuns).set(update).where(and(
      eq(workflowRuns.id, runId),
      eq(workflowRuns.tenantId, workflow.tenantId),
      eq(workflowRuns.projectId, workflow.projectId),
      eq(workflowRuns.workflowId, workflow.id),
    ));
  },
  executeDefinition: executeAutomationWorkflowDefinition,
};
