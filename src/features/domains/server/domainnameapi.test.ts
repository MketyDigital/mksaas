import { DomainNameApiAdapter } from './domainnameapi';

function mockJsonResponse(payload: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => payload),
  } as unknown as Response;
}

describe('DomainNameApiAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the documented v1 check endpoint and parses an available-domain quote', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        status: 'available',
        price: 10.81,
        renewalPrice: 12.5,
        currency: 'USD',
      }, 200),
    );

    const adapter = new DomainNameApiAdapter({
      username: '00000000-0000-0000-0000-000000000000',
      apiToken: 'test-token',
      environment: 'ote',
    });
    await expect(adapter.quote('example.com')).resolves.toMatchObject({
      domain: 'example.com',
      available: true,
      registrationPriceMinor: 1081n,
      renewalPriceMinor: 1250n,
      currency: 'USD',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ote.domainresellerapi.com/v1/domain/check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          resellerId: '00000000-0000-0000-0000-000000000000',
          apiKey: 'test-token',
          domainName: 'example.com',
          period: 1,
        }),
      }),
    );
  });

  it('falls back to Basic-auth availability discovery only when v1 is absent', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse(null, 404))
      .mockResolvedValueOnce(mockJsonResponse({
        Status: 'available',
        Price: '9.99',
        Currency: 'USD',
      }, 200));

    const adapter = new DomainNameApiAdapter({
      username: '00000000-0000-0000-0000-000000000000',
      apiToken: 'test-token',
      environment: 'ote',
    });
    await expect(adapter.quote('hello.com')).resolves.toMatchObject({ available: true });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/domain/check?'))).toBe(true);
  });

  it('does not hide v1 authentication failures behind endpoint fallbacks', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ message: 'Unauthorized' }, 401),
    );

    const adapter = new DomainNameApiAdapter({
      username: '00000000-0000-0000-0000-000000000000',
      apiToken: 'test-token',
      environment: 'production',
    });

    await expect(adapter.quote('example.com')).rejects.toThrow('DomainNameAPI availability check failed (401)');
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('https://api.domainresellerapi.com/v1/domain/check');
  });

  it('does not retry registration on an ambiguous server error', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ message: 'upstream timeout' }, 500),
    );

    const adapter = new DomainNameApiAdapter({
      username: '00000000-0000-0000-0000-000000000000',
      apiToken: 'test-token',
      environment: 'ote',
    });

    await expect(adapter.register({
      domain: 'example.com',
      years: 1,
      idempotencyKey: 'order-1',
      contactRef: 'contact-1',
    })).rejects.toThrow('DomainNameAPI request failed (500)');
    const registrationCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/domain/register'));
    expect(registrationCalls).toHaveLength(1);
  });

  it('keeps production opt-in explicit', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ status: 'available', price: 10, currency: 'USD' }, 200),
    );
    const adapter = new DomainNameApiAdapter({
      username: '00000000-0000-0000-0000-000000000000',
      apiToken: 'test-token',
      environment: 'production',
    });
    await adapter.quote('example.net');
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('https://api.domainresellerapi.com/'))).toBe(true);
  });
});
