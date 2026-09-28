import { env } from 'cloudflare:workers';

import { WorkersAiProviderAdapter, type WorkersAiBinding } from '@/features/ai-runtime/providers/workers-ai';
import type { AiRuntimeRequest, AiRuntimeResult } from '@/features/ai-runtime/runtime/types';

function requireWorkersAiBinding(): WorkersAiBinding {
  const binding = env.AI as WorkersAiBinding | undefined;
  if (!binding || typeof binding.run !== 'function') {
    throw new Error('Workers AI binding is not configured.');
  }
  return binding;
}

function requireGatewayId() {
  const value = typeof env.MKETY_AI_GATEWAY_ID === 'string'
    ? env.MKETY_AI_GATEWAY_ID.trim()
    : '';
  if (!value) throw new Error('MKETY_AI_GATEWAY_ID is not configured.');
  return value;
}

export async function executeManagedAiRequest(input: {
  providerKey: string;
  nativeModel: string;
  request: AiRuntimeRequest;
}): Promise<AiRuntimeResult> {
  if (input.providerKey !== 'workers-ai') {
    throw new Error('Managed provider is not enabled for customer execution.');
  }

  const adapter = new WorkersAiProviderAdapter(requireWorkersAiBinding(), {
    gatewayId: requireGatewayId(),
  });
  return adapter.complete(input.request, input.nativeModel);
}
