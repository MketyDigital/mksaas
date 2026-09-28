import { getEnterpriseAiRuntimePolicy } from '../server/commercial-policy';
import { resolveByokProviderConnection } from '../server/provider-connections';
import { getManagedWorkersAiProvider } from './runtime.cloudflare';

import { runCentralAi } from './central-runtime';

jest.mock('../server/commercial-policy', () => ({
  getEnterpriseAiRuntimePolicy: jest.fn(),
}));
jest.mock('../server/provider-connections', () => ({
  resolveByokProviderConnection: jest.fn(),
}));
jest.mock('./runtime.cloudflare', () => ({
  getManagedWorkersAiProvider: jest.fn(),
}));

const policyMock = jest.mocked(getEnterpriseAiRuntimePolicy);
const byokMock = jest.mocked(resolveByokProviderConnection);
const managedMock = jest.mocked(getManagedWorkersAiProvider);

describe('central Mkety AI runtime', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fails closed before any provider work when customer inference is disabled', async () => {
    policyMock.mockResolvedValue({
      key: 'enterprise-default',
      maxRequestBytes: 1_000_000,
      maxMessages: 128,
      maxTools: 64,
      maxOutputTokens: 32768,
      reservationTtlSeconds: 120,
      prepaidOnly: true,
      customerInferenceEnabled: false,
    });

    await expect(runCentralAi({
      tenantId: 'tenant-1',
      system: 'system',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toThrow('not enabled');

    expect(managedMock).not.toHaveBeenCalled();
    expect(byokMock).not.toHaveBeenCalled();
  });

  it('routes smart managed work to the selected Workers AI model', async () => {
    policyMock.mockResolvedValue({
      key: 'enterprise-default',
      maxRequestBytes: 1_000_000,
      maxMessages: 128,
      maxTools: 64,
      maxOutputTokens: 32768,
      reservationTtlSeconds: 120,
      prepaidOnly: true,
      customerInferenceEnabled: true,
    });
    const complete = jest.fn().mockResolvedValue({
      text: 'ok',
      usage: { inputTokens: 2n, cachedInputTokens: 0n, outputTokens: 1n },
      providerRequestId: 'provider-1',
      finishReason: 'stop',
    });
    managedMock.mockReturnValue({ complete } as never);

    const result = await runCentralAi({
      tenantId: 'tenant-1',
      system: 'system',
      messages: [{ role: 'user', content: 'hello' }],
      taskClass: 'smart',
    });

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ requestedModel: 'mkety-smart' }),
      '@cf/zai-org/glm-5.3-flash',
    );
    expect(result).toMatchObject({
      provider: 'workers-ai',
      source: 'managed',
      nativeModel: '@cf/zai-org/glm-5.3-flash',
      text: 'ok',
    });
  });

  it('uses an explicit BYOK connection without managed fallback', async () => {
    policyMock.mockResolvedValue({
      key: 'enterprise-default',
      maxRequestBytes: 1_000_000,
      maxMessages: 128,
      maxTools: 64,
      maxOutputTokens: 32768,
      reservationTtlSeconds: 120,
      prepaidOnly: true,
      customerInferenceEnabled: true,
    });
    const generate = jest.fn().mockResolvedValue({ text: 'customer-provider' });
    byokMock.mockResolvedValue({
      connection: { id: 'connection-1' },
      adapter: { id: 'vertex', generate },
    } as never);

    const result = await runCentralAi({
      tenantId: 'tenant-1',
      providerConnectionId: 'connection-1',
      model: 'gemini-3.8-flash',
      system: 'system',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(generate).toHaveBeenCalled();
    expect(managedMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: 'vertex',
      source: 'byok',
      text: 'customer-provider',
    });
  });
});
