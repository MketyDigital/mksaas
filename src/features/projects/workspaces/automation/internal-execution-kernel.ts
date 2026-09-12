import { executeAutomationAgentAction } from './agent-action-runtime';
import type { AutomationAgentDependency } from './agent-dependency-readiness';
import { type AutomationHttpExecutionInput, executeAutomationHttpAction } from './http-action-runtime';

type WorkflowData = Record<string, unknown>;
type RawWorkflowNode = { id?: unknown; type?: unknown; config?: unknown };
export type AutomationExecutionContext = { tenantId: string; projectId: string; workflowId: string; triggerType: 'manual' | 'webhook' };
export type AutomationResolvedDependencies = { agents: Record<string, AutomationAgentDependency> };
export type AutomationExecutionStep = {
  nodeId: string;
  nodeType: 'trigger' | 'transform' | 'condition' | 'http' | 'agent';
  status: 'completed' | 'skipped';
  conditionMatched?: boolean;
  resolvedInput?: string;
  http?: { method: string; status: number; durationMs: number; responseType: 'json' | 'text' | 'empty'; responsePreview: unknown };
  agent?: { agentId: string; versionId: string; version: number; provider: string; model: string | null; durationMs: number; outputPreview: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } };
};
export type AutomationExecutionResult = { mode: 'workflow-execution'; data: WorkflowData; steps: AutomationExecutionStep[] };

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function getPathValue(data: WorkflowData, path: string): unknown { let current: unknown = data; for (const part of path.split('.')) { if (!isRecord(current)) return undefined; current = current[part]; } return current; }
function interpolate(value: string, data: WorkflowData): string { return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) => { const resolved = getPathValue(data, path.trim()); return resolved == null ? '' : typeof resolved === 'string' ? resolved : JSON.stringify(resolved); }); }
function interpolateValue(value: unknown, data: WorkflowData): unknown { if (typeof value === 'string') return interpolate(value, data); if (Array.isArray(value)) return value.map((item) => interpolateValue(item, data)); if (!isRecord(value)) return value; return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateValue(item, data)])); }
function parseTransformMapping(value: unknown): WorkflowData { if (typeof value !== 'string') throw new Error('Transform mapping must be a valid JSON object.'); try { const parsed: unknown = JSON.parse(value); if (!isRecord(parsed)) throw new Error('Transform mapping must be a valid JSON object.'); return parsed; } catch { throw new Error('Transform mapping must be a valid JSON object.'); } }
function evaluateCondition(config: Record<string, unknown>, data: WorkflowData): boolean { const field = String(config.field ?? '').trim(); const operator = String(config.operator ?? '').trim(); const expected = config.value; const actual = getPathValue(data, field); if (operator === 'equals') return String(actual ?? '') === String(expected ?? ''); if (operator === 'not_equals') return String(actual ?? '') !== String(expected ?? ''); if (operator === 'contains') return String(actual ?? '').includes(String(expected ?? '')); if (operator === 'greater_than') return Number(actual) > Number(expected); if (operator === 'less_than') return Number(actual) < Number(expected); throw new Error('Unsupported condition operator.'); }

export async function executeAutomationWorkflowDefinition({ context, definition, dependencies = { agents: {} }, input }: { context: AutomationExecutionContext; definition: unknown; dependencies?: AutomationResolvedDependencies; input: WorkflowData }): Promise<AutomationExecutionResult> {
  if (!context.tenantId || !context.projectId || !context.workflowId) throw new Error('Workflow execution context is required.');
  if (!isRecord(definition) || !Array.isArray(definition.nodes)) throw new Error('Workflow definition must contain a nodes array.');
  const nodes = definition.nodes as RawWorkflowNode[];
  for (const [index, node] of nodes.entries()) {
    const type = typeof node?.type === 'string' ? node.type : 'unknown';
    if (!['trigger', 'transform', 'condition', 'http', 'agent'].includes(type)) throw new Error('External or unsupported workflow action runtime is not enabled.');
    if (type === 'agent') { const nodeId = typeof node?.id === 'string' && node.id.trim() ? node.id : `node-${index + 1}`; if (!dependencies.agents[nodeId]) throw new Error('Resolved Agent dependency is required before workflow execution.'); }
  }

  let data: WorkflowData = { ...input };
  const steps: AutomationExecutionStep[] = [];
  let branchOpen = true;

  for (const [index, node] of nodes.entries()) {
    const nodeId = typeof node.id === 'string' && node.id.trim() ? node.id : `node-${index + 1}`;
    const nodeType = node.type as AutomationExecutionStep['nodeType'];
    const config = isRecord(node.config) ? node.config : {};
    if (nodeType !== 'trigger' && !branchOpen) { steps.push({ nodeId, nodeType, status: 'skipped' }); continue; }
    if (nodeType === 'trigger') { steps.push({ nodeId, nodeType, status: 'completed' }); continue; }
    if (nodeType === 'transform') { const mapping = parseTransformMapping(config.mapping); const resolvedInput = interpolate(String(config.input ?? ''), data); const resolvedMapping = interpolateValue(mapping, data); if (!isRecord(resolvedMapping)) throw new Error('Transform mapping must be a valid JSON object.'); data = { ...data, ...resolvedMapping }; steps.push({ nodeId, nodeType, resolvedInput, status: 'completed' }); continue; }
    if (nodeType === 'condition') { const conditionMatched = evaluateCondition(config, data); branchOpen = conditionMatched; steps.push({ conditionMatched, nodeId, nodeType, status: 'completed' }); continue; }
    if (nodeType === 'agent') {
      const dependency = dependencies.agents[nodeId];
      if (!dependency) throw new Error('Resolved Agent dependency is required before workflow execution.');
      const prompt = interpolate(String(config.prompt ?? ''), data).trim();
      if (!prompt) throw new Error('Automation Agent prompt resolved to an empty value.');
      const agent = await executeAutomationAgentAction({ dependency, tenantId: context.tenantId, projectId: context.projectId, prompt });
      data = { ...data, agent: { nodeId, agentId: agent.agentId, versionId: agent.versionId, version: agent.version, text: agent.text } };
      steps.push({ agent: { agentId: agent.agentId, versionId: agent.versionId, version: agent.version, provider: agent.provider, model: agent.model, durationMs: agent.durationMs, outputPreview: agent.outputPreview, ...(agent.usage ? { usage: agent.usage } : {}) }, nodeId, nodeType, status: 'completed' });
      continue;
    }

    const method = String(config.method ?? '').toUpperCase() as AutomationHttpExecutionInput['method'];
    const url = interpolate(String(config.url ?? ''), data);
    const request: AutomationHttpExecutionInput = { method, url };
    if (['POST', 'PUT', 'PATCH'].includes(method)) { const body = interpolate(String(config.body ?? ''), data).trim(); if (body) { try { JSON.parse(body); } catch { throw new Error('HTTP action body must be valid JSON before execution.'); } request.body = body; } }
    const http = await executeAutomationHttpAction(request);
    data = { ...data, http: { body: http.data, nodeId, status: http.status } };
    steps.push({ http: { durationMs: http.durationMs, method: http.method, responsePreview: http.responsePreview, responseType: http.responseType, status: http.status }, nodeId, nodeType, status: 'completed' });
  }
  return { data, mode: 'workflow-execution', steps };
}
