import { env } from 'cloudflare:workers';

import { type WorkersAiBinding, WorkersAiProviderAdapter } from './workers-ai';

function gatewayId() {
  const value = typeof env.MKETY_AI_GATEWAY_ID === 'string'
    ? env.MKETY_AI_GATEWAY_ID.trim()
    : '';
  if (!value) throw new Error('MKETY_AI_GATEWAY_ID is not configured.');
  return value;
}

export function getManagedWorkersAiProvider() {
  const binding = env.AI as WorkersAiBinding | undefined;
  if (!binding?.run) throw new Error('Workers AI binding is not available.');
  return new WorkersAiProviderAdapter(binding, { gatewayId: gatewayId() });
}
