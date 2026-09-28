import type { ManagedAiModelCandidate } from '../model-candidates';

export type AiBenchmarkCategory =
  | 'chat'
  | 'long_context_rag'
  | 'tool_calls'
  | 'structured_output'
  | 'coding'
  | 'reasoning'
  | 'vision'
  | 'latency'
  | 'reliability'
  | 'cost';

export interface AiBenchmarkCase {
  id: string;
  category: AiBenchmarkCategory;
  description: string;
  requiresVision?: boolean;
  requiresTools?: boolean;
  requiresStructuredOutput?: boolean;
  maxOutputTokens?: number;
}

export interface AiBenchmarkMeasurement {
  modelKey: ManagedAiModelCandidate['key'];
  caseId: string;
  passed: boolean;
  qualityScore?: number;
  latencyMs?: number;
  firstTokenLatencyMs?: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  providerErrorClass?: string;
  notes?: string;
}

export const ENTERPRISE_AI_BENCHMARK_SUITE: readonly AiBenchmarkCase[] = [
  {
    id: 'chat-instruction-following',
    category: 'chat',
    description: 'Follow a multi-constraint business instruction without dropping requirements or inventing facts.',
    maxOutputTokens: 1200,
  },
  {
    id: 'rag-long-context-grounding',
    category: 'long_context_rag',
    description: 'Answer from a long supplied corpus, cite supplied evidence, and avoid unsupported claims.',
    maxOutputTokens: 1800,
  },
  {
    id: 'tool-selection-and-arguments',
    category: 'tool_calls',
    description: 'Select the correct tool and produce schema-valid arguments without unnecessary calls.',
    requiresTools: true,
    maxOutputTokens: 1000,
  },
  {
    id: 'strict-json-schema',
    category: 'structured_output',
    description: 'Return output conforming to a nested JSON schema with required fields and enums.',
    requiresStructuredOutput: true,
    maxOutputTokens: 1000,
  },
  {
    id: 'coding-debug-and-patch',
    category: 'coding',
    description: 'Find a realistic application bug, explain the failure concisely, and return a correct minimal patch.',
    maxOutputTokens: 2200,
  },
  {
    id: 'reasoning-multi-step',
    category: 'reasoning',
    description: 'Solve a multi-step constrained planning problem and return only the requested concise result.',
    maxOutputTokens: 1600,
  },
  {
    id: 'vision-document-understanding',
    category: 'vision',
    description: 'Extract and reason over a chart or document image while preserving visible numeric details.',
    requiresVision: true,
    maxOutputTokens: 1400,
  },
  {
    id: 'latency-short-chat',
    category: 'latency',
    description: 'Measure end-to-end and first-token latency on a short representative chat request.',
    maxOutputTokens: 300,
  },
  {
    id: 'reliability-repeatability',
    category: 'reliability',
    description: 'Repeat representative requests and measure provider errors, malformed outputs, timeouts, and variance.',
    maxOutputTokens: 800,
  },
  {
    id: 'cost-normalized-workload',
    category: 'cost',
    description: 'Calculate observed raw provider cost for the same normalized input/output workload.',
    maxOutputTokens: 1200,
  },
] as const;

export function validateBenchmarkCandidate(
  model: ManagedAiModelCandidate,
  benchmarkCase: AiBenchmarkCase,
) {
  if (benchmarkCase.requiresVision && !model.capabilities.vision) return false;
  if (benchmarkCase.requiresTools && !model.capabilities.tools) return false;
  if (benchmarkCase.requiresStructuredOutput && !model.capabilities.structuredOutput) return false;
  return true;
}

export function calculateRawProviderCostUsd(input: {
  model: ManagedAiModelCandidate;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
}) {
  const cachedInputTokens = Math.max(0, input.cachedInputTokens ?? 0);
  const normalInputTokens = Math.max(0, input.inputTokens - cachedInputTokens);
  const pricing = input.model.pricingUsdPerMillionTokens;

  return (
    (normalInputTokens / 1_000_000) * pricing.input
    + (cachedInputTokens / 1_000_000) * (pricing.cachedInput ?? pricing.input)
    + (Math.max(0, input.outputTokens) / 1_000_000) * pricing.output
  );
}
