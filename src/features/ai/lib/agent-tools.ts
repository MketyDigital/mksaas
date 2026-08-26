import type { Tool } from 'ai';
import { z } from 'zod';

/**
 * Runtime tool registry. Tools are deliberately explicit and server-owned.
 * User credentials and arbitrary code execution are added later through the
 * authenticated connector system, rather than accepting executable config
 * from an agent record.
 */
export type AgentToolContext = {
  tenantId: string;
  agentId: string;
};

export type AgentToolDefinition = {
  id: string;
  name: string;
  description: string;
  create: (context: AgentToolContext) => Tool;
};

export const AGENT_TOOL_IDS = ['current_time'] as const;

export const agentToolRegistry: Record<(typeof AGENT_TOOL_IDS)[number], AgentToolDefinition> = {
  current_time: {
    id: 'current_time',
    name: 'Current Time',
    description: 'Returns the current UTC time in ISO 8601 format.',
    create: () => ({
      description: 'Get the current UTC time. Use this when the user asks what time it is or needs a current timestamp.',
      inputSchema: z.object({}),
      execute: async () => ({
        iso: new Date().toISOString(),
      }),
    }),
  },
};

export function createAgentTools(
  context: AgentToolContext,
  enabledToolIds: string[] = [],
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const id of enabledToolIds) {
    const definition = agentToolRegistry[id as keyof typeof agentToolRegistry];
    if (definition) tools[id] = definition.create(context);
  }

  return tools;
}
