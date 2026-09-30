import { resolveAiModelRoute } from '../server/model-routing';
import { resolveByokProviderConnection, resolveSystemAiProviderConnection } from '../server/provider-connections';
import { getManagedWorkersAiProvider } from './runtime.cloudflare';

import { runCentralAi } from './central-runtime';

jest.mock('../server/model-routing', () => ({
  resolveAiModelRoute: jest.fn(),
}));
jest.mock('../server/provider-connections', () => ({
  resolveByokProviderConnection: jest.fn(),
  resolveSystemAiProviderConnection: jest.fn(),
}));
jest.mock('./runtime.cloudflare', () => ({
  getManagedWorkersAiProvider: jest.fn(),
}));

const routeMock = jest.mocked(resolveAiModelRoute);
const byokMock = jest.mocked(resolveByokProviderConnection);
const systemMock = jest.mocked(resolveSystemAiProviderConnection);
const managedMock = jest.mocked(getManagedWorkersAiProvider);

describe('central Mkety AI runtime', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('routes smart managed work through the active database alias', async () => {
    routeMock.mockResolvedValue({
      alias: { alias: 'mkety-smart' },
      model: {
        providerKey: 'workers-ai',
        nativeModel: '@cf/zai-org/glm-5.3-flash',
      },
      route: { id: 'route-1' },
    } as never);
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

    expect(routeMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      projectId: null,
      requestedModel: 'mkety-smart',
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


  it('omits blank system messages from managed provider requests', async () => {
    routeMock.mockResolvedValue({
      alias: { alias: 'mkety-economy' },
      model: {
        providerKey: 'workers-ai',
        nativeModel: '@cf/google/gemma-4-26b-a4b-it',
      },
      route: { id: 'route-economy' },
    } as never);
    const complete = jest.fn().mockResolvedValue({
      text: 'ok',
      usage: { inputTokens: 2n, cachedInputTokens: 0n, outputTokens: 1n },
      providerRequestId: 'provider-blank-system',
      finishReason: 'stop',
    });
    managedMock.mockReturnValue({ complete } as never);

    await runCentralAi({
      tenantId: 'tenant-1',
      model: 'mkety-economy',
      system: '   ',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'hello' }],
      }),
      '@cf/google/gemma-4-26b-a4b-it',
    );
  });

  it('trims and preserves non-empty system messages before user messages', async () => {
    routeMock.mockResolvedValue({
      alias: { alias: 'mkety-economy' },
      model: {
        providerKey: 'workers-ai',
        nativeModel: '@cf/google/gemma-4-26b-a4b-it',
      },
      route: { id: 'route-economy' },
    } as never);
    const complete = jest.fn().mockResolvedValue({
      text: 'ok',
      usage: { inputTokens: 2n, cachedInputTokens: 0n, outputTokens: 1n },
      providerRequestId: 'provider-system',
      finishReason: 'stop',
    });
    managedMock.mockReturnValue({ complete } as never);

    await runCentralAi({
      tenantId: 'tenant-1',
      model: 'mkety-economy',
      system: '  Follow instructions.  ',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'Follow instructions.' },
          { role: 'user', content: 'hello' },
        ],
      }),
      '@cf/google/gemma-4-26b-a4b-it',
    );
  });


  it('honors an operator-defined mkety-* managed alias from the database', async () => {
    routeMock.mockResolvedValue({
      alias: { alias: 'mkety-frontier' },
      model: {
        providerKey: 'workers-ai',
        nativeModel: '@cf/zai-org/glm-5.3-flash',
      },
      route: { id: 'route-frontier' },
    } as never);
    const complete = jest.fn().mockResolvedValue({
      text: 'frontier',
      usage: { inputTokens: 1n, cachedInputTokens: 0n, outputTokens: 1n },
      finishReason: 'stop',
    });
    managedMock.mockReturnValue({ complete } as never);

    await runCentralAi({
      tenantId: 'tenant-1',
      model: 'mkety-frontier',
      system: '',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(routeMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      projectId: null,
      requestedModel: 'mkety-frontier',
    });
  });

  it('routes a managed alias through an approved Mkety-owned external provider connection', async () => {
    routeMock.mockResolvedValue({
      alias: { alias: 'mkety-smart' },
      model: {
        providerKey: 'openai-compatible',
        nativeModel: 'mkety-self-hosted-70b',
      },
      route: { id: 'route-external' },
    } as never);
    const generate = jest.fn().mockResolvedValue({
      text: 'external-managed',
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      providerRequestId: 'external-1',
    });
    systemMock.mockResolvedValue({
      connection: { id: 'system-connection' },
      adapter: { id: 'openai-compatible', generate },
    } as never);

    const result = await runCentralAi({
      tenantId: 'tenant-1',
      model: 'mkety-smart',
      system: 'system',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(systemMock).toHaveBeenCalledWith({
      mode: 'platform',
      providerKey: 'openai-compatible',
    });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'mkety-self-hosted-70b',
    }));
    expect(managedMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: 'openai-compatible',
      source: 'managed',
      nativeModel: 'mkety-self-hosted-70b',
      text: 'external-managed',
    });
  });

  it('fails closed when the requested managed alias has no active route', async () => {
    routeMock.mockResolvedValue(null);

    await expect(runCentralAi({
      tenantId: 'tenant-1',
      system: 'system',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toThrow('Managed AI route is unavailable');

    expect(managedMock).not.toHaveBeenCalled();
    expect(byokMock).not.toHaveBeenCalled();
  });

  it('uses an explicit BYOK connection without managed fallback', async () => {
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
    expect(routeMock).not.toHaveBeenCalled();
    expect(managedMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: 'vertex',
      source: 'byok',
      text: 'customer-provider',
    });
  });
});
