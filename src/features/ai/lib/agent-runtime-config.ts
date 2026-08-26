import { z } from 'zod';

export const agentRuntimeConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(1).max(16384).optional(),
  maxSteps: z.number().int().min(1).max(10).optional(),
  tools: z.array(z.string().min(1)).optional(),
  knowledge: z.object({
    enabled: z.boolean().optional(),
    topK: z.number().int().min(1).max(10).optional(),
  }).optional(),
});

export type AgentRuntimeConfig = z.infer<typeof agentRuntimeConfigSchema>;

export function parseAgentRuntimeConfig(value: string | null): AgentRuntimeConfig {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    const result = agentRuntimeConfigSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function serializeAgentRuntimeConfig(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return JSON.stringify(agentRuntimeConfigSchema.parse(parsed));
}
