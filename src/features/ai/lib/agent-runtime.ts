import { generateText, type ModelMessage, stepCountIs, streamText } from 'ai';

import { runCentralAi } from '@/features/ai-runtime/providers/central-runtime';

import { parseAgentRuntimeConfig } from './agent-runtime-config';
import { createAgentTools } from './agent-tools';
import { buildKnowledgeContext } from './knowledge-context';
import { getAIModel, getAIProvider } from './provider';

export type AgentRuntimeDefinition = {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  instructions: string | null;
  provider: string;
  model: string | null;
  status: string;
  config: string | null;
};
export type AgentAutomationExecutionOptions = { tools: 'disabled' };
export type AgentAutomationUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

function buildSystemPrompt(agent: AgentRuntimeDefinition, knowledgeContext: string) {
  const instructions = agent.instructions?.trim()
    || `You are ${agent.name}, an AI agent running on the Mkety Platform. Be helpful, accurate, and concise. Do not claim to have performed actions you did not perform.`;
  return knowledgeContext ? `${instructions}\n\n${knowledgeContext}` : instructions;
}

function normalizeMessages(messages: ModelMessage[]) {
  return messages.filter((message) =>
    (message.role === 'user' || message.role === 'assistant')
    && (Array.isArray(message.content) || typeof message.content === 'string'));
}

function modelMessageText(message: ModelMessage) {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const value = part as { type?: string; text?: string };
      return value.type === 'text' && typeof value.text === 'string' ? value.text : '';
    })
    .join('\n')
    .trim();
}

function getLegacyModel(agent: AgentRuntimeDefinition) {
  const provider = getAIProvider(agent.provider as Parameters<typeof getAIProvider>[0]);
  return provider(agent.model?.trim() || getAIModel());
}

function isCentralAgent(agent: AgentRuntimeDefinition) {
  return agent.provider === 'platform'
    || agent.provider === 'workers-ai'
    || agent.provider.startsWith('byok:');
}

function byokConnectionId(agent: AgentRuntimeDefinition) {
  return agent.provider.startsWith('byok:') ? agent.provider.slice('byok:'.length).trim() || null : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeUsage(value: unknown): AgentAutomationUsage | undefined {
  if (!isRecord(value)) return undefined;
  const usage: AgentAutomationUsage = {};
  if (typeof value.inputTokens === 'number') usage.inputTokens = value.inputTokens;
  if (typeof value.outputTokens === 'number') usage.outputTokens = value.outputTokens;
  if (typeof value.totalTokens === 'number') usage.totalTokens = value.totalTokens;
  return Object.keys(usage).length ? usage : undefined;
}

async function prepare(agent: AgentRuntimeDefinition, messages: ModelMessage[], toolsEnabled = true) {
  if (agent.status === 'disabled') throw new Error('This agent is disabled.');
  const config = parseAgentRuntimeConfig(agent.config);
  const normalizedMessages = normalizeMessages(messages);
  if (!normalizedMessages.length) throw new Error('At least one user message is required.');
  const lastUserMessage = [...normalizedMessages].reverse().find((message) => message.role === 'user');
  const query = lastUserMessage ? modelMessageText(lastUserMessage) : '';
  const knowledgeContext = config.knowledge?.enabled !== false && query
    ? await buildKnowledgeContext({
        tenantId: agent.tenantId,
        projectId: agent.projectId,
        agentId: agent.id,
        query,
        topK: config.knowledge?.topK,
      })
    : '';
  const tools = toolsEnabled ? createAgentTools({ tenantId: agent.tenantId, agentId: agent.id }, config.tools) : {};
  return { config, normalizedMessages, tools, knowledgeContext };
}

function centralMessages(messages: ModelMessage[]) {
  return messages.map((message) => ({
    role: message.role as 'user' | 'assistant',
    content: modelMessageText(message),
  })).filter((message) => message.content);
}

function centralToolDefinitions(toolIds: string[]) {
  return toolIds.flatMap((id) => {
    if (id === 'current_time') {
      return [{
        name: 'current_time',
        description: 'Get the current UTC time. Use this when the user asks what time it is or needs a current timestamp.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      }];
    }
    return [];
  });
}

async function runCentralAgent(
  agent: AgentRuntimeDefinition,
  messages: ModelMessage[],
  toolsEnabled: boolean,
) {
  const { config, normalizedMessages, knowledgeContext } = await prepare(agent, messages, toolsEnabled);
  const providerConnectionId = byokConnectionId(agent);
  const conversation = centralMessages(normalizedMessages);
  const configuredToolIds = toolsEnabled ? config.tools ?? [] : [];
  const tools = centralToolDefinitions(configuredToolIds);
  const maxSteps = toolsEnabled ? config.maxSteps ?? 1 : 1;

  let input = [...conversation];
  let totalInput = 0;
  let totalOutput = 0;
  let finalText = '';

  for (let step = 0; step < maxSteps; step += 1) {
    const result = await runCentralAi({
      tenantId: agent.tenantId,
      projectId: agent.projectId,
      providerConnectionId,
      model: agent.model?.trim() || null,
      taskClass: 'smart',
      system: buildSystemPrompt(agent, knowledgeContext),
      messages: input,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
      tools,
    });

    totalInput += result.usage?.inputTokens ?? 0;
    totalOutput += result.usage?.outputTokens ?? 0;
    if (result.text?.trim()) finalText = result.text.trim();

    if (!result.toolCalls?.length) break;

    if (providerConnectionId) {
      throw new Error('BYOK agent tool calling is not enabled for this provider connection.');
    }

    for (const call of result.toolCalls) {
      if (call.name !== 'current_time') {
        throw new Error(`Agent requested unsupported tool: ${call.name}`);
      }
      input.push({
        role: 'assistant',
        content: result.text?.trim() || 'I need to use the current_time tool.',
      });
      input.push({
        role: 'user',
        content: `Tool current_time returned: ${JSON.stringify({ iso: new Date().toISOString() })}. Continue the task using this result.`,
      });
    }
  }

  return {
    text: finalText,
    usage: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      totalTokens: totalInput + totalOutput,
    },
  };
}

function textStreamResult(text: string) {
  return {
    text,
    toTextStreamResponse(options?: { headers?: HeadersInit }) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          ...(options?.headers ?? {}),
        },
      });
    },
  };
}

export async function runAgent(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  if (isCentralAgent(agent)) {
    const result = await runCentralAgent(agent, messages, true);
    return textStreamResult(result.text);
  }

  const { config, normalizedMessages, tools, knowledgeContext } = await prepare(agent, messages);
  return streamText({
    model: getLegacyModel(agent),
    system: buildSystemPrompt(agent, knowledgeContext),
    messages: normalizedMessages,
    tools,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    stopWhen: stepCountIs(config.maxSteps ?? 1),
  });
}

export async function testAgent(agent: AgentRuntimeDefinition, messages: ModelMessage[]) {
  if (isCentralAgent(agent)) {
    return runCentralAgent(agent, messages, true);
  }

  const { config, normalizedMessages, tools, knowledgeContext } = await prepare(agent, messages);
  return generateText({
    model: getLegacyModel(agent),
    system: buildSystemPrompt(agent, knowledgeContext),
    messages: normalizedMessages,
    tools,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    stopWhen: stepCountIs(config.maxSteps ?? 1),
  });
}

export async function runAgentForAutomation(
  agent: AgentRuntimeDefinition,
  messages: ModelMessage[],
  options: AgentAutomationExecutionOptions,
): Promise<{ text: string; usage?: AgentAutomationUsage }> {
  if (options.tools !== 'disabled') throw new Error('Automation Agent tools must remain disabled.');

  if (isCentralAgent(agent)) {
    return runCentralAgent(agent, messages, false);
  }

  const { config, normalizedMessages, knowledgeContext } = await prepare(agent, messages, false);
  const result = await generateText({
    model: getLegacyModel(agent),
    system: buildSystemPrompt(agent, knowledgeContext),
    messages: normalizedMessages,
    tools: {},
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    stopWhen: stepCountIs(1),
  });
  const usage = normalizeUsage(result.usage);
  return usage ? { text: result.text, usage } : { text: result.text };
}
