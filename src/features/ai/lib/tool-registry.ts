import { tool } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod';

type AgentTool = Tool<unknown, unknown>;

export type AgentToolDefinition = {
  id: string;
  name: string;
  description: string;
  category: 'platform' | 'web' | 'automation' | 'integration';
  enabledByDefault?: boolean;
  create: (context: { tenantId: string; projectId: string; agentId: string }) => AgentTool;
};

const registry = new Map<string, AgentToolDefinition>();

registry.set('current_time', {
  id: 'current_time',
  name: 'Current time',
  description: 'Returns the current server time.',
  category: 'platform',
  enabledByDefault: true,
  create: () => tool({
    description: 'Get the current date and time.',
    inputSchema: z.object({}),
    execute: async () => ({ now: new Date().toISOString() }),
  }),
});

export function registerAgentTool(definition: AgentToolDefinition) {
  registry.set(definition.id, definition);
}

export function listAgentTools() {
  return [...registry.values()].map(({ create: _create, ...definition }) => definition);
}

export function createRegisteredTools(
  ids: string[] | undefined,
  context: { tenantId: string; projectId: string; agentId: string },
) {
  const selected = ids?.length
    ? ids
    : [...registry.values()]
        .filter((item) => item.enabledByDefault)
        .map((item) => item.id);

  return Object.fromEntries(
    selected
      .map((id) => {
        const definition = registry.get(id);
        return definition ? [id, definition.create(context)] : null;
      })
      .filter((entry): entry is [string, AgentTool] => Boolean(entry)),
  );
}
