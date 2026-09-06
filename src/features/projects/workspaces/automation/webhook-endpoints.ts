import { generateWebhookCredentials } from './webhook-security';
import { encryptWebhookSecret, fingerprintWebhookSecret } from './webhook-secret-crypto';

type Scope = { tenantId: string; projectId: string; workflowId: string };
type EndpointScope = Scope & { endpointId: string };
type WorkflowRecord = { id: string; triggerType: string } | null;
type EndpointRecord = { id: string; endpointId: string; status: string; secretCiphertext?: string; secretFingerprint?: string } | null;
type ProtectedSecret = { secretCiphertext: string; secretFingerprint: string };

export type WorkflowWebhookEndpointDependencies = {
  findWorkflow: (scope: Scope) => Promise<WorkflowRecord>;
  findEndpoint: (scope: Scope) => Promise<EndpointRecord>;
  insertEndpoint: (input: Scope & { endpointId: string; secretCiphertext: string; secretFingerprint: string; status: 'active' }) => Promise<void>;
  updateEndpoint: (endpointRowId: string, update: Record<string, unknown>) => Promise<void>;
  protectSecret?: (secret: string) => ProtectedSecret;
};

function protectWebhookSecret(secret: string): ProtectedSecret {
  return {
    secretCiphertext: encryptWebhookSecret(secret),
    secretFingerprint: fingerprintWebhookSecret(secret),
  };
}

async function requireWebhookWorkflow(scope: Scope, dependencies: WorkflowWebhookEndpointDependencies) {
  const workflow = await dependencies.findWorkflow(scope);
  if (!workflow) throw new Error('Workflow not found.');
  if (workflow.triggerType !== 'webhook') throw new Error('Workflow must use the webhook trigger before creating an endpoint.');
  return workflow;
}

async function requireEndpoint(scope: EndpointScope, dependencies: WorkflowWebhookEndpointDependencies) {
  const endpoint = await dependencies.findEndpoint(scope);
  if (!endpoint || endpoint.endpointId !== scope.endpointId) throw new Error('Webhook endpoint not found.');
  return endpoint;
}

export async function createWorkflowWebhookEndpoint(scope: Scope, dependencies: WorkflowWebhookEndpointDependencies) {
  await requireWebhookWorkflow(scope, dependencies);
  const existing = await dependencies.findEndpoint(scope);
  if (existing) throw new Error('Webhook endpoint already exists for this workflow.');

  const { endpointId, secret } = generateWebhookCredentials();
  const protectedSecret = (dependencies.protectSecret ?? protectWebhookSecret)(secret);
  await dependencies.insertEndpoint({ ...scope, endpointId, ...protectedSecret, status: 'active' });
  return { endpointId, secret };
}

export async function getWorkflowWebhookEndpoint(scope: Scope, dependencies: WorkflowWebhookEndpointDependencies) {
  const endpoint = await dependencies.findEndpoint(scope);
  if (!endpoint) return null;
  return { endpointId: endpoint.endpointId, status: endpoint.status };
}

export async function rotateWorkflowWebhookSecret(scope: EndpointScope, dependencies: WorkflowWebhookEndpointDependencies) {
  const endpoint = await requireEndpoint(scope, dependencies);
  const { secret } = generateWebhookCredentials();
  const protectedSecret = (dependencies.protectSecret ?? protectWebhookSecret)(secret);
  const now = new Date();
  await dependencies.updateEndpoint(endpoint.id, { ...protectedSecret, rotatedAt: now, updatedAt: now });
  return { endpointId: endpoint.endpointId, secret };
}

export async function disableWorkflowWebhookEndpoint(scope: EndpointScope, dependencies: WorkflowWebhookEndpointDependencies) {
  const endpoint = await requireEndpoint(scope, dependencies);
  await dependencies.updateEndpoint(endpoint.id, { status: 'disabled', updatedAt: new Date() });
}
