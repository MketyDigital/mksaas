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


export async function embedWithManagedWorkersAi(
  text: string,
  model = '@cf/baai/bge-m3',
): Promise<number[]> {
  const binding = env.AI as WorkersAiBinding | undefined;
  if (!binding?.run) throw new Error('Workers AI binding is not available.');

  const response = await binding.run(
    model,
    { text: [text] },
    {
      rejectIfBusy: true,
      gateway: { id: gatewayId(), skipCache: true },
    },
  );

  if (!response || typeof response !== 'object') {
    throw new Error('Workers AI embedding response is invalid.');
  }
  const value = response as { data?: unknown; shape?: unknown };
  const data = Array.isArray(value.data) ? value.data : [];
  const first = Array.isArray(data[0]) ? data[0] : data;
  if (!first.length || first.some((item) => typeof item !== 'number')) {
    throw new Error('Workers AI embedding response did not contain a numeric vector.');
  }
  return first as number[];
}
