import { and, eq, or } from 'drizzle-orm';

import { db } from '@/shared/db';
import { workflowRuns, workflows, workflowWebhookDeliveries, workflowWebhookEndpoints } from '@/shared/db/schema';

import { resolveAutomationWorkflowDependencies } from './agent-dependency-readiness';
import { admitWebhookDelivery, associateWebhookDeliveryRun, markWebhookDeliveryFailure } from './webhook-delivery-admission';
import { decryptWebhookSecret } from './webhook-secret-crypto';
import { automationWorkflowExecutionDbDependencies } from './workflow-execution-db';
import { executeAutomationWorkflowRun } from './workflow-execution-service';

const deliveryDependencies = {
  async insertDelivery(input: Parameters<typeof admitWebhookDelivery>[0] & { status: 'received' }) {
    const [delivery] = await db.insert(workflowWebhookDeliveries).values(input).onConflictDoNothing({
      target: [workflowWebhookDeliveries.webhookEndpointId, workflowWebhookDeliveries.eventId],
    }).returning({ id: workflowWebhookDeliveries.id });
    return delivery ?? null;
  },
  async hasActiveRun(scope: { tenantId: string; projectId: string; workflowId: string }) {
    const [run] = await db.select({ id: workflowRuns.id }).from(workflowRuns).where(and(
      eq(workflowRuns.tenantId, scope.tenantId),
      eq(workflowRuns.projectId, scope.projectId),
      eq(workflowRuns.workflowId, scope.workflowId),
      or(eq(workflowRuns.status, 'queued'), eq(workflowRuns.status, 'running')),
    )).limit(1);
    return Boolean(run);
  },
  async updateDelivery(deliveryId: string, update: Record<string, unknown>) {
    await db.update(workflowWebhookDeliveries).set(update).where(eq(workflowWebhookDeliveries.id, deliveryId));
  },
};

export const automationWebhookServerDependencies = {
  async findEndpoint(endpointId: string) {
    const [endpoint] = await db.select().from(workflowWebhookEndpoints).where(eq(workflowWebhookEndpoints.endpointId, endpointId)).limit(1);
    return endpoint ?? null;
  },
  decryptSecret: decryptWebhookSecret,
  async findWorkflow(scope: { tenantId: string; projectId: string; workflowId: string }) {
    const [workflow] = await db.select().from(workflows).where(and(
      eq(workflows.id, scope.workflowId),
      eq(workflows.tenantId, scope.tenantId),
      eq(workflows.projectId, scope.projectId),
    )).limit(1);
    return workflow ?? null;
  },
  resolveDependencies: resolveAutomationWorkflowDependencies,
  async admitDelivery(input: Parameters<typeof admitWebhookDelivery>[0]) {
    return admitWebhookDelivery(input, deliveryDependencies);
  },
  async executeWorkflow(input: Parameters<typeof executeAutomationWorkflowRun>[0]) {
    return executeAutomationWorkflowRun(input, automationWorkflowExecutionDbDependencies);
  },
  async associateDeliveryRun(input: { deliveryId: string; workflowRunId: string }) {
    return associateWebhookDeliveryRun(input, deliveryDependencies);
  },
  async markDeliveryFailure(input: { deliveryId: string; errorCode: string }) {
    return markWebhookDeliveryFailure(input, deliveryDependencies);
  },
};
