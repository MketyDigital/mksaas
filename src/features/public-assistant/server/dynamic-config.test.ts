const mockFindFirst = jest.fn();
const mockListConnections = jest.fn();
const mockResolveConnection = jest.fn();
const mockCreateAdapters = jest.fn();

jest.mock('@/shared/db/cloudflare', () => ({
  db: { query: { platformAppControlCenterModules: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } } },
}));
jest.mock('@/features/ai-runtime/server/provider-connections', () => ({
  listSystemAiProviderConnections: (...args: unknown[]) => mockListConnections(...args),
  resolveSystemAiProviderConnection: (...args: unknown[]) => mockResolveConnection(...args),
}));
jest.mock('./providers', () => ({ createPublicAIProviderAdapters: (...args: unknown[]) => mockCreateAdapters(...args) }));

import { getPublicAiControlOverview, resolveDynamicPublicAiTargets } from './dynamic-config';

describe('Public AI central provider connection lookup', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockListConnections.mockReset();
    mockResolveConnection.mockReset();
    mockCreateAdapters.mockReset();
  });

  it('uses the shared platform connection list for the Public AI control panel', async () => {
    mockFindFirst.mockResolvedValue({ metadataJson: { publicAiConfig: { enabled: false } } });
    mockListConnections.mockResolvedValue([]);

    await getPublicAiControlOverview();

    expect(mockListConnections).toHaveBeenCalledWith('platform');
  });

  it('resolves external Public AI providers from the shared platform connection', async () => {
    mockResolveConnection.mockResolvedValue({ adapter: { generate: jest.fn() } });

    await resolveDynamicPublicAiTargets({
      enabled: true,
      primaryProvider: 'azure-openai',
      fallbackProviders: [],
      models: { 'azure-openai': 'gpt-6-luna-1' },
    });

    expect(mockResolveConnection).toHaveBeenCalledWith({ mode: 'platform', providerKey: 'azure-openai' });
  });
});
