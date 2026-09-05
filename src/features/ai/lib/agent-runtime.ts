import { generateText, type ModelMessage, stepCountIs, streamText } from 'ai';

import { parseAgentRuntimeConfig } from './agent-runtime-config';
import { createAgentTools } from './agent-tools';
import { buildKnowledgeContext } from './knowledge-context';
import { getAIModel, getAIProvider } from './provider';

export type AgentRuntimeDefinition = { id: string; tenantId: string; projectId: string; name: string; instructions: string | null; provider: string; model: string | null; status: string; config: string | null };

function buildSystemPrompt(agent: AgentRuntimeDefinition, knowledgeContext: string) {
  const instructions = agent.instructions?.trim() || `You are ${agent.name}, an AI agent running on the Mkety Platform. Be helpful, accurate, and concise. Do not claim to have performed actions you did not perform.`;
  return knowledgeContext ? `${instructions}\n\n${knowledgeContext}` : instructions;
}
function normalizeMessages(messages: ModelMessage[]) { return messages.filter((message) => (message.role === 'user' || message.role === 'assistant') && (Array.isArray(message.content) || typeof message.content === 'string')); }
function getModel(agent: AgentRuntimeDefinition) { const provider = getAIProvider(agent.provider as Parameters<typeof getAIProvider>[0]); return provider(agent.model?.trim() || getAIModel()); }

async function prepare(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  if (agent.status === 'disabled') throw new Error('This agent is disabled.');
  const config = parseAgentRuntimeConfig(agent.config);
  const model = getModel(agent);
  const normalizedMessages = normalizeMessages(messages);
  if (!normalizedMessages.length) throw new Error('At least one user message is required.');
  const lastUserMessage = [...normalizedMessages].reverse().find((message) => message.role === 'user');
  const query = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';
  const knowledgeContext = config.knowledge?.enabled !== false && query ? await buildKnowledgeContext({ tenantId: agent.tenantId, projectId: agent.projectId, agentId: agent.id, query, topK: config.knowledge?.topK }) : '';
  const tools = createAgentTools({ tenantId: agent.tenantId, agentId: agent.id }, config.tools);
  return { config, model, normalizedMessages, tools, knowledgeContext };
}

export async function runAgent(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  const { config, model, normalizedMessages, tools, knowledgeContext } = await prepare(agent, messages);
  return streamText({ model, system: buildSystemPrompt(agent, knowledgeContext), messages: normalizedMessages, tools, temperature: config.temperature, maxOutputTokens: config.maxOutputTokens, stopWhen: stepCountIs(config.maxSteps ?? 1) });
}

export async function testAgent(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  const { config, model, normalizedMessages, tools, knowledgeContext } = await prepare(agent, messages);
  return generateText({ model, system: buildSystemPrompt(agent, knowledgeContext), messages: normalizedMessages, tools, temperature: config.temperature, maxOutputTokens: config.maxOutputTokens, stopWhen: stepCountIs(config.maxSteps ?? 1) });
}
