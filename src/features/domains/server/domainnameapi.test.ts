import { DomainNameApiAdapter } from './domainnameapi';

describe('DomainNameApiAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses OT&E and parses an available-domain quote', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        status: 'available',
        price: 10.81,
        renewalPrice: 12.5,
        currency: 'USD',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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
      'https://ote.domainresellerapi.com/api/v1/domains/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back to the documented check endpoint only when modern discovery is absent', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        Status: 'available',
        Price: '9.99',
        Currency: 'USD',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new DomainNameApiAdapter({
      username: '00000000-0000-0000-0000-000000000000',
      apiToken: 'test-token',
      environment: 'ote',
    });
    await expect(adapter.quote('hello.com')).resolves.toMatchObject({ available: true });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/domain/check?');
  });

  it('does not retry registration on an ambiguous server error', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'upstream timeout' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps production opt-in explicit', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'available', price: 10, currency: 'USD' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const adapter = new DomainNameApiAdapter({
      username: '00000000-0000-0000-0000-000000000000',
      apiToken: 'test-token',
      environment: 'production',
    });
    await adapter.quote('example.net');
    expect(String(fetchMock.mock.calls[0]?.[0]).startsWith('https://api.domainresellerapi.com/')).toBe(true);
  });
});
