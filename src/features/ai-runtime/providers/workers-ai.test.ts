import type { AiRuntimeRequest } from '../runtime/types';
import {
  type WorkersAiBinding,
  WorkersAiProviderAdapter,
} from './workers-ai';

const request: AiRuntimeRequest = {
  tenantId: 'tenant-a',
  projectId: 'project-a',
  apiKeyId: 'key-a',
  actorUserId: null,
  requestedModel: 'gemma-4',
  messages: [{ role: 'user', content: 'hello' }],
  maxOutputTokens: 500,
  idempotencyKey: 'request-1',
};

describe('WorkersAiProviderAdapter', () => {
  it('uses Workers AI through an authenticated binding and gateway without enabling cache by default', async () => {
    const run = jest.fn().mockResolvedValue({
      id: 'cf-request-1',
      model: '@cf/google/gemma-4-26b-a4b-it',
      choices: [{ finish_reason: 'stop', message: { content: 'hello back' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 4,
        prompt_tokens_details: { cached_tokens: 2 },
      },
    });
    const binding: WorkersAiBinding = { run };
    const adapter = new WorkersAiProviderAdapter(binding, { gatewayId: 'mkety-ai-nonprod' });

    const result = await adapter.complete(request, '@cf/google/gemma-4-26b-a4b-it');

    expect(run).toHaveBeenCalledWith(
      '@cf/google/gemma-4-26b-a4b-it',
      expect.objectContaining({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
        max_completion_tokens: 500,
      }),
      {
        rejectIfBusy: true,
        gateway: {
          id: 'mkety-ai-nonprod',
          skipCache: true,
        },
      },
    );
    expect(result).toMatchObject({
      provider: 'workers-ai',
      nativeModel: '@cf/google/gemma-4-26b-a4b-it',
      text: 'hello back',
      finishReason: 'stop',
      providerRequestId: 'cf-request-1',
      usage: {
        inputTokens: 10n,
        cachedInputTokens: 2n,
        outputTokens: 4n,
      },
    });
  });

  it('maps tool and strict structured-output contracts without exposing Mkety credentials', async () => {
    const run = jest.fn().mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
      usage: { input_tokens: 8, output_tokens: 3, cached_input_tokens: 0 },
    });
    const adapter = new WorkersAiProviderAdapter({ run }, {
      gatewayId: 'mkety-ai-nonprod',
      cacheTtlSeconds: 60,
    });

    await adapter.complete({
      ...request,
      tools: [{
        name: 'lookup_customer',
        description: 'Lookup a customer',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      }],
      structuredOutput: {
        name: 'answer',
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
        },
      },
    }, '@cf/zai-org/glm-5.3-flash');

    expect(run).toHaveBeenCalledWith(
      '@cf/zai-org/glm-5.3-flash',
      expect.objectContaining({
        tools: [expect.objectContaining({
          type: 'function',
          function: expect.objectContaining({ name: 'lookup_customer' }),
        })],
        response_format: expect.objectContaining({
          type: 'json_schema',
          json_schema: expect.objectContaining({ name: 'answer', strict: true }),
        }),
      }),
      {
        rejectIfBusy: true,
        gateway: {
          id: 'mkety-ai-nonprod',
          skipCache: false,
          cacheTtl: 60,
        },
      },
    );
  });

  it('rejects malformed provider responses instead of fabricating success', async () => {
    const adapter = new WorkersAiProviderAdapter(
      { run: jest.fn().mockResolvedValue(null) },
      { gatewayId: 'mkety-ai-nonprod' },
    );

    await expect(adapter.complete(request, '@cf/qwen/qwen3.8-27b'))
      .rejects.toThrow('invalid response');
  });
});
