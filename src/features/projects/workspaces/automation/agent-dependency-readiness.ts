import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { agents, agentVersions } from '@/shared/db/schema';

export type AutomationAgentDependencyContext = { tenantId: string; projectId: string };
export type AutomationAgentDependency = { nodeId: string; agentId: string; versionId: string; version: number; name: string; instructions: string | null; provider: string; model: string | null; config: string | null };
export type AutomationWorkflowDependencyReadiness = { ready: boolean; blockers: Array<{ code: string; message: string; nodeId?: string }>; agents: Record<string, AutomationAgentDependency> };

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function readString(record: Record<string, unknown>, key: string) { return typeof record[key] === 'string' ? record[key].trim() : ''; }

export async function resolveAutomationWorkflowDependencies({ context, definition }: { context: AutomationAgentDependencyContext; definition: unknown }): Promise<AutomationWorkflowDependencyReadiness> {
  const resolved: Record<string, AutomationAgentDependency> = {};
  const blockers: AutomationWorkflowDependencyReadiness['blockers'] = [];
  const nodes = isRecord(definition) && Array.isArray(definition.nodes) ? definition.nodes : [];

  for (const rawNode of nodes) {
    if (!isRecord(rawNode) || readString(rawNode, 'type') !== 'agent') continue;
    const nodeId = readString(rawNode, 'id');
    const config = isRecord(rawNode.config) ? rawNode.config : {};
    const agentId = readString(config, 'agentId');
    if (!nodeId || !agentId) { blockers.push({ code: 'agent.dependency-reference-required', message: 'Agent dependency cannot be resolved without a node and Agent reference.', nodeId: nodeId || undefined }); continue; }

    const agent = await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, context.tenantId), eq(agents.projectId, context.projectId)) });
    if (!agent) { blockers.push({ code: 'agent.dependency-not-found', message: 'Referenced Agent was not found in this project.', nodeId }); continue; }

    const version = await db.query.agentVersions.findFirst({ where: and(eq(agentVersions.agentId, agentId), eq(agentVersions.tenantId, context.tenantId), eq(agentVersions.projectId, context.projectId), eq(agentVersions.status, 'published')) });
    if (!version) { blockers.push({ code: 'agent.dependency-no-published-version', message: 'Publish this Agent before running the workflow.', nodeId }); continue; }

    resolved[nodeId] = { nodeId, agentId, versionId: version.id, version: version.version, name: version.name, instructions: version.instructions, provider: version.provider, model: version.model, config: version.config };
  }

  return { agents: resolved, blockers, ready: blockers.length === 0 };
}
