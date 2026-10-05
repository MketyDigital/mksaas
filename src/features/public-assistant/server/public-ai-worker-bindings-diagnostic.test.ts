import { summarizePublicAiWorkerBindings } from './public-ai-worker-bindings-diagnostic';

describe('production Worker binding diagnostic', () => {
  it('returns only the allowlisted binding presence booleans', () => {
    const result = summarizePublicAiWorkerBindings(
      {
        success: true,
        result: {
          bindings: [
            { name: 'AI', type: 'ai' },
            { name: 'MKETY_AI_GATEWAY_ID', type: 'plain_text', text: 'private-gateway-id' },
          ],
        },
      },
      {
        success: true,
        result: [{ name: 'PRIVATE_OTHER_SECRET', type: 'secret_text', text: 'private-secret' }],
      },
    );

    expect(result).toEqual({ aiBindingPresent: true, gatewayIdBindingPresent: true });
    expect(JSON.stringify(result)).not.toContain('private-gateway-id');
    expect(JSON.stringify(result)).not.toContain('private-secret');
  });

  it('recognizes the gateway ID as a secret name without returning its value', () => {
    expect(
      summarizePublicAiWorkerBindings(
        { success: true, result: { bindings: [{ name: 'AI', type: 'ai' }] } },
        {
          success: true,
          result: [
            {
              name: 'MKETY_AI_GATEWAY_ID',
              type: 'secret_text',
              text: 'never-return-this-secret',
            },
          ],
        },
      ),
    ).toEqual({ aiBindingPresent: true, gatewayIdBindingPresent: true });
  });

  it('does not accept lookalike names or unrelated binding types', () => {
    expect(
      summarizePublicAiWorkerBindings(
        {
          success: true,
          result: {
            bindings: [
              { name: 'AI', type: 'plain_text' },
              { name: 'PUBLIC_AI', type: 'ai' },
              { name: 'MKETY_AI_GATEWAY_ID', type: 'json' },
            ],
          },
        },
        { success: true, result: [{ name: 'MKETY_AI_GATEWAY_ID_SUFFIX', type: 'secret_text' }] },
      ),
    ).toEqual({ aiBindingPresent: false, gatewayIdBindingPresent: false });
  });

  it('fails closed for missing or malformed API payloads', () => {
    expect(summarizePublicAiWorkerBindings(null, null)).toEqual({
      aiBindingPresent: false,
      gatewayIdBindingPresent: false,
    });
  });
});
