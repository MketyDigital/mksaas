import type { AutomationWorkflowDependencyReadiness } from './agent-dependency-readiness';
import { deriveWebhookEventId, hashWebhookPayload, normalizeWebhookEventId, parseWebhookJsonObject, validateWebhookContentType, verifyWebhookSignature } from './webhook-security';
import { validateAutomationWorkflowDefinition } from './workflow-preflight';
import { validateAutomationWorkflowRuntimeReadiness } from './workflow-runtime-readiness';

type EndpointRecord = { id: string; endpointId: string; tenantId: string; projectId: string; workflowId: string; status: string; secretCiphertext: string } | null;
type WorkflowRecord = { id: string; tenantId: string; projectId: string; status: string; triggerType: string; version: string; definition: unknown } | null;
type Admission = { status: 'admitted'; deliveryId: string } | { status: 'duplicate' } | { status: 'busy'; deliveryId: string };

type Dependencies = {
  findEndpoint: (endpointId: string) => Promise<EndpointRecord>;
  decryptSecret: (ciphertext: string) => string;
  findWorkflow: (scope: { tenantId: string; projectId: string; workflowId: string }) => Promise<WorkflowRecord>;
  resolveDependencies: (input: { context: { tenantId: string; projectId: string }; definition: unknown }) => Promise<AutomationWorkflowDependencyReadiness>;
  admitDelivery: (input: { tenantId: string; projectId: string; workflowId: string; webhookEndpointId: string; eventId: string; eventIdSource: 'external' | 'derived'; payloadHash: string }) => Promise<Admission>;
  executeWorkflow: (input: { workflow: Exclude<WorkflowRecord, null>; triggerType: 'webhook'; input: Record<string, unknown>; dependencyReadiness: AutomationWorkflowDependencyReadiness; onRunCreated?: (runId: string) => Promise<void> }) => Promise<{ runId: string; output: unknown }>;
  associateDeliveryRun: (input: { deliveryId: string; workflowRunId: string }) => Promise<void>;
  markDeliveryFailure: (input: { deliveryId: string; errorCode: string }) => Promise<void>;
};

export type AutomationWebhookIngressResult = { status: number; body: { ok: true } | { error: string } };

async function readBoundedBody(request: Request, maxBytes = 256 * 1024) {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > maxBytes) throw new Error('payload_too_large');
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('payload_too_large');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function handleAutomationWebhookIngress({ endpointId, request }: { endpointId: string; request: Request }, dependencies: Dependencies): Promise<AutomationWebhookIngressResult> {
  const endpoint = await dependencies.findEndpoint(endpointId);
  if (!endpoint || endpoint.status !== 'active') return { status: 404, body: { error: 'Webhook endpoint not found.' } };

  try { validateWebhookContentType(request.headers.get('content-type')); }
  catch { return { status: 415, body: { error: 'Webhook content type must be application/json.' } }; }

  let rawBody: Uint8Array;
  try { rawBody = await readBoundedBody(request); }
  catch { return { status: 413, body: { error: 'Webhook payload is too large.' } }; }

  let secret: string;
  try { secret = dependencies.decryptSecret(endpoint.secretCiphertext); }
  catch { return { status: 500, body: { error: 'Webhook service is unavailable.' } }; }

  if (!verifyWebhookSignature({ secret, rawBody, signatureHeader: request.headers.get('x-mkety-signature') })) {
    return { status: 401, body: { error: 'Webhook authentication failed.' } };
  }

  let input: Record<string, unknown>;
  try { input = parseWebhookJsonObject(rawBody); }
  catch { return { status: 400, body: { error: 'Webhook body must be a valid JSON object.' } }; }

  const workflow = await dependencies.findWorkflow({ tenantId: endpoint.tenantId, projectId: endpoint.projectId, workflowId: endpoint.workflowId });
  if (!workflow || workflow.status !== 'active' || workflow.triggerType !== 'webhook') {
    return { status: 422, body: { error: 'Webhook workflow is not executable.' } };
  }

  const preflight = validateAutomationWorkflowDefinition(workflow.definition, { triggerType: workflow.triggerType });
  if (!preflight.readyForExecutionFoundation || preflight.errorCount || preflight.warningCount) {
    return { status: 422, body: { error: 'Webhook workflow is not executable.' } };
  }
  const runtime = validateAutomationWorkflowRuntimeReadiness(workflow.definition);
  if (!runtime.ready || runtime.blockers.length) return { status: 422, body: { error: 'Webhook workflow is not executable.' } };

  const dependencyReadiness = await dependencies.resolveDependencies({ context: { tenantId: workflow.tenantId, projectId: workflow.projectId }, definition: workflow.definition });
  if (!dependencyReadiness.ready || dependencyReadiness.blockers.length) return { status: 422, body: { error: 'Webhook workflow is not executable.' } };

  let externalEventId: string | null;
  try { externalEventId = normalizeWebhookEventId(request.headers.get('x-mkety-event-id')); }
  catch { return { status: 400, body: { error: 'Webhook event ID is invalid.' } }; }
  const eventId = externalEventId ?? deriveWebhookEventId(endpoint.endpointId, rawBody);
  const eventIdSource = externalEventId ? 'external' as const : 'derived' as const;
  const admission = await dependencies.admitDelivery({ tenantId: workflow.tenantId, projectId: workflow.projectId, workflowId: workflow.id, webhookEndpointId: endpoint.id, eventId, eventIdSource, payloadHash: hashWebhookPayload(rawBody) });
  if (admission.status === 'duplicate') return { status: 409, body: { error: 'Webhook event already received.' } };
  if (admission.status === 'busy') return { status: 409, body: { error: 'Workflow is already running.' } };

  try {
    await dependencies.executeWorkflow({
      workflow,
      triggerType: 'webhook',
      input,
      dependencyReadiness,
      onRunCreated: async (runId) => dependencies.associateDeliveryRun({ deliveryId: admission.deliveryId, workflowRunId: runId }),
    });
    return { status: 200, body: { ok: true } };
  } catch {
    await dependencies.markDeliveryFailure({ deliveryId: admission.deliveryId, errorCode: 'execution_failed' });
    return { status: 500, body: { error: 'Webhook execution failed.' } };
  }
}
