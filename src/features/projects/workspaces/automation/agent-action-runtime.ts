import { runAgentForAutomation, type AgentRuntimeDefinition } from '@/features/ai/lib/agent-runtime';

import type { AutomationAgentDependency } from './agent-dependency-readiness';

export type AutomationAgentExecutionInput = { dependency: AutomationAgentDependency; tenantId: string; projectId: string; prompt: string };
export type AutomationAgentExecutionResult = { agentId: string; versionId: string; version: number; provider: string; model: string | null; durationMs: number; text: string; outputPreview: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } };

export async function executeAutomationAgentAction({ dependency, tenantId, projectId, prompt }: AutomationAgentExecutionInput): Promise<AutomationAgentExecutionResult> {
  if (!prompt.trim()) throw new Error('Automation Agent prompt is required.');
  const agent: AgentRuntimeDefinition = { id: dependency.agentId, tenantId, projectId, name: dependency.name, instructions: dependency.instructions, provider: dependency.provider, model: dependency.model, status: 'published', config: dependency.config };
  const startedAt = Date.now();
  try {
    const result = await runAgentForAutomation(agent, [{ role: 'user', content: prompt }], { tools: 'disabled' });
    return { agentId: dependency.agentId, versionId: dependency.versionId, version: dependency.version, provider: dependency.provider, model: dependency.model, durationMs: Math.max(0, Date.now() - startedAt), text: result.text, outputPreview: result.text.slice(0, 4096), ...(result.usage ? { usage: result.usage } : {}) };
  } catch { throw new Error('Automation Agent action failed.'); }
}
