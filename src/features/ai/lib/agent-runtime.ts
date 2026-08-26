import { generateText, streamText, type ModelMessage } from 'ai';

import { createAgentTools } from './agent-tools';
import { getAIModel, getAIProvider } from './provider';

export type AgentRuntimeConfig = {
  temperature?: number;
  maxOutputTokens?: number;
  tools?: string[];
  maxSteps?: number;
};

export type AgentRuntimeDefinition = {
  id: string;
  tenantId: string;
  name: string;
  instructions: string | null;
  provider: string;
  model: string | null;
  status: string;
  config: string | null;
};

function parseConfig(value: string | null): AgentRuntimeConfig {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const config = parsed as Record<string, unknown>;
    const result: AgentRuntimeConfig = {};

    if (typeof config.temperature === 'number' && Number.isFinite(config.temperature)) {
      result.temperature = Math.min(2, Math.max(0, config.temperature));
    }

    if (typeof config.maxOutputTokens === 'number' && Number.isInteger(config.maxOutputTokens)) {
      result.maxOutputTokens = Math.min(16384, Math.max(1, config.maxOutputTokens));
    }

    if (Array.isArray(config.tools)) {
      result.tools = config.tools.filter((id): id is string => typeof id === 'string');
    }

    if (typeof config.maxSteps === 'number' && Number.isInteger(config.maxSteps)) {
      result.maxSteps = Math.min(10, Math.max(1, config.maxSteps));
    }

    return result;
  } catch {
    return {};
  }
}

function buildSystemPrompt(agent: AgentRuntimeDefinition): string {
  const instructions = agent.instructions?.trim();

  return instructions
    ? instructions
    : `You are ${agent.name}, an AI agent running on the Mkety Platform. Be helpful, accurate, and concise. Do not claim to have performed actions you did not perform.`;
}

function normalizeMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.filter((message) => {
    if (message.role !== 'user' && message.role !== 'assistant') return false;
    return Array.isArray(message.content) || typeof message.content === 'string';
  });
}

function getModel(agent: AgentRuntimeDefinition) {
  const provider = getAIProvider(agent.provider as Parameters<typeof getAIProvider>[0]);
  const model = agent.model?.trim() || getAIModel();
  return provider(model);
}

function prepare(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  if (agent.status === 'disabled') throw new Error('This agent is disabled.');

  const config = parseConfig(agent.config);
  const model = getModel(agent);
  const normalizedMessages = normalizeMessages(messages);

  if (!normalizedMessages.length) throw new Error('At least one user message is required.');

  const tools = createAgentTools(
    { tenantId: agent.tenantId, agentId: agent.id },
    config.tools,
  );

  return { config, model, normalizedMessages, tools };
}

export function runAgent(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  const { config, model, normalizedMessages, tools } = prepare(agent, messages);

  return streamText({
    model,
    system: buildSystemPrompt(agent),
    messages: normalizedMessages,
    tools,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    maxSteps: config.maxSteps,
  });
}

export async function testAgent(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  const { config, model, normalizedMessages, tools } = prepare(agent, messages);

  return generateText({
    model,
    system: buildSystemPrompt(agent),
    messages: normalizedMessages,
    tools,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    maxSteps: config.maxSteps,
  });
}
