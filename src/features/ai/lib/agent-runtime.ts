import { generateText, streamText, type ModelMessage } from 'ai';

import { createAgentTools } from './agent-tools';
import { parseAgentRuntimeConfig } from './agent-runtime-config';
import { getAIModel, getAIProvider } from './provider';

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

  const config = parseAgentRuntimeConfig(agent.config);
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
