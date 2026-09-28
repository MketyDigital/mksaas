export const USAGE_METER_KEYS = [
  'ai.generation',
  'ai.tokens.input',
  'ai.tokens.output',
  'ai.request',
  'ai.tokens.cached_input',
  'ai.embedding.tokens',
  'ai.image.input',
  'ai.image.output',
  'ai.audio.input_seconds',
  'ai.audio.output_seconds',
  'automation.run',
  'workflow.execution',
  'knowledge.ingestion',
  'webhook.delivery',
] as const;

export type UsageMeterKey = (typeof USAGE_METER_KEYS)[number];

const USAGE_METER_KEY_SET = new Set<string>(USAGE_METER_KEYS);

export function isUsageMeterKey(value: string): value is UsageMeterKey {
  return USAGE_METER_KEY_SET.has(value);
}
