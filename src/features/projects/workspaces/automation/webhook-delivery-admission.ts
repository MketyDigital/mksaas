type AdmissionInput = {
  tenantId: string;
  projectId: string;
  workflowId: string;
  webhookEndpointId: string;
  eventId: string;
  eventIdSource: 'external' | 'derived';
  payloadHash: string;
};

export type WebhookDeliveryAdmissionDependencies = {
  insertDelivery: (input: AdmissionInput & { status: 'received' }) => Promise<{ id: string } | null>;
  hasActiveRun: (scope: Pick<AdmissionInput, 'tenantId' | 'projectId' | 'workflowId'>) => Promise<boolean>;
  updateDelivery: (deliveryId: string, update: Record<string, unknown>) => Promise<void>;
};

export async function admitWebhookDelivery(input: AdmissionInput, dependencies: WebhookDeliveryAdmissionDependencies) {
  const inserted = await dependencies.insertDelivery({ ...input, status: 'received' });
  if (!inserted) return { status: 'duplicate' as const };

  const busy = await dependencies.hasActiveRun({ tenantId: input.tenantId, projectId: input.projectId, workflowId: input.workflowId });
  if (busy) {
    await dependencies.updateDelivery(inserted.id, { status: 'busy', errorCode: 'workflow_busy' });
    return { status: 'busy' as const, deliveryId: inserted.id };
  }

  await dependencies.updateDelivery(inserted.id, { status: 'admitted', admittedAt: new Date(), errorCode: null });
  return { status: 'admitted' as const, deliveryId: inserted.id };
}

export async function associateWebhookDeliveryRun({ deliveryId, workflowRunId }: { deliveryId: string; workflowRunId: string }, dependencies: Pick<WebhookDeliveryAdmissionDependencies, 'updateDelivery'>) {
  await dependencies.updateDelivery(deliveryId, { workflowRunId });
}

export async function markWebhookDeliveryFailure({ deliveryId, errorCode }: { deliveryId: string; errorCode: string }, dependencies: Pick<WebhookDeliveryAdmissionDependencies, 'updateDelivery'>) {
  const bounded = errorCode.trim().slice(0, 120) || 'execution_failed';
  await dependencies.updateDelivery(deliveryId, { status: 'failed', errorCode: bounded });
}
