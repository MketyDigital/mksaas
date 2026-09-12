import type { ModelMessage } from 'ai';
import { and, eq } from 'drizzle-orm';

import { testAgent } from '@/features/ai/lib/agent-runtime';
import { db } from '@/shared/db';
import { agents, workflowRuns, workflows } from '@/shared/db/schema';

import type { WorkflowDefinition, WorkflowNode } from '@/shared/db/schema/workflows';

type WorkflowData = Record<string, unknown>;

function interpolate(value: string, data: WorkflowData) {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => {
    const parts = key.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[part];
    }
    return current == null ? '' : typeof current === 'string' ? current : JSON.stringify(current);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function runNode(node: WorkflowNode, data: WorkflowData, tenantId: string, projectId: string): Promise<WorkflowData> {
  if (node.type === 'trigger') return data;

  if (node.type === 'transform') {
    const output = asRecord(node.config.output);
    const next = { ...data };
    for (const [key, value] of Object.entries(output)) {
      next[key] = typeof value === 'string' ? interpolate(value, data) : value;
    }
    return next;
  }

  if (node.type === 'condition') {
    const field = String(node.config.field ?? '');
    const operator = String(node.config.operator ?? 'equals');
    const expected = node.config.value;
    const actual = field.split('.').reduce<unknown>((current, part) => asRecord(current)[part], data);
    const matched = operator === 'exists'
      ? actual !== undefined && actual !== null
      : operator === 'contains'
        ? String(actual ?? '').includes(String(expected ?? ''))
        : String(actual ?? '') === String(expected ?? '');
    return { ...data, _condition: matched };
  }

  if (node.type === 'http') {
    const url = interpolate(String(node.config.url ?? ''), data);
    if (!url.startsWith('https://')) throw new Error('HTTP workflow actions require an HTTPS URL.');
    const method = String(node.config.method ?? 'POST').toUpperCase();
    const headers = asRecord(node.config.headers);
    const body = node.config.body === undefined ? undefined : JSON.stringify(node.config.body);
    const maxRetries = Math.min(Math.max(Number(node.config.retries ?? 0) || 0, 0), 3);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])) },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`HTTP action failed with ${response.status}: ${text.slice(0, 500)}`);
        let responseData: unknown = text;
        try { responseData = JSON.parse(text); } catch { /* keep text */ }
        return { ...data, http: { status: response.status, body: responseData, attempts: attempt + 1 } };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('HTTP action failed.');
        if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 4000)));
      }
    }
    throw lastError ?? new Error('HTTP action failed.');
  }

  if (node.type === 'agent') {
    const agentId = String(node.config.agentId ?? '');
    const agent = await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenantId), eq(agents.projectId, projectId)) });
    if (!agent) throw new Error('Workflow agent action could not find the requested agent.');
    const message = interpolate(String(node.config.message ?? ''), data);
    const result = await testAgent(agent, [{ role: 'user', content: message } as ModelMessage]);
    return { ...data, agent: { id: agent.id, text: result.text } };
  }

  throw new Error(`Unsupported workflow node type: ${node.type}`);
}

export async function executeWorkflow({ tenantId, projectId, workflowId, input, triggerType = 'manual' }: { tenantId: string; projectId: string; workflowId: string; input: WorkflowData; triggerType?: string }) {
  const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.id, workflowId), eq(workflows.tenantId, tenantId), eq(workflows.projectId, projectId)) });
  if (!workflow) throw new Error('Workflow not found.');
  if (workflow.status !== 'active') throw new Error('Workflow is not active.');

  const [run] = await db.insert(workflowRuns).values({ tenantId, projectId, workflowId, triggerType, input, status: 'running' }).returning();
  try {
    const definition = workflow.definition as WorkflowDefinition;
    let data = { ...input };
    for (const node of definition.nodes) {
      if (node.type !== 'trigger' && data._condition === false) continue;
      data = await runNode(node, data, tenantId, projectId);
    }
    await db.update(workflowRuns).set({ status: 'completed', output: data, completedAt: new Date() }).where(eq(workflowRuns.id, run.id));
    return { runId: run.id, output: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow execution failed.';
    await db.update(workflowRuns).set({ status: 'failed', error: message, completedAt: new Date() }).where(eq(workflowRuns.id, run.id));
    throw error;
  }
}
